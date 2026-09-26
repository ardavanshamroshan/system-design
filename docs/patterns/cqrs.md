# CQRS Light

> Module D — System Architecture · Section 12

## Mental outline

1. [What and why](#what-and-why)  
2. [From CQS to CQRS](#from-cqs-to-cqrs)  
3. [Light flow (one DB)](#light-flow-one-db)  
4. [Write side — rich, with invariants](#write-side--rich-with-invariants)  
5. [Read side — flat, UI-shaped](#read-side--flat-ui-shaped)  
6. [Optional projection](#optional-projection)  
7. [When to use / skip](#when-to-use--skip)  
8. [Decision rule](#decision-rule)  
9. [Antipatterns](#antipatterns)

---

## What and why

**CQRS** = *Command Query Responsibility Segregation* — split the **write model (commands)** from the **read model (queries)**.

**Light** version: **no full Event Sourcing**. Often one database. Separate code (and sometimes tables / indexes) for write vs read.

| Side | Job | Shape |
|------|-----|-------|
| **Command / write** | Mutate state, enforce invariants | Rich domain / transactional |
| **Query / read** | Return UI-ready data | Flat, denormalized, fast |

Why? Write path wants simple, safe rules. Dashboard / list pages want heavy joins, filters, projections. One shared model → either writes get messy or reads get slow.

```
Commands → WriteModel → WriteTables
                              │
                    OptionalProjection
                              ▼
                         ReadModels ← Queries
```

Related: [Directory Query](/patterns/directory-query) · [Outbox](/patterns/outbox) · [Cache patterns](/patterns/cache-patterns)

---

## From CQS to CQRS

**CQS** (Command–Query Separation) is the method-level rule:

| Kind | May change state? | Returns domain data? |
|------|-------------------|----------------------|
| **Command** | Yes | Prefer no (weak exception: return new id) |
| **Query** | **Never** | Yes |

**CQRS** lifts that rule to the **application / architecture** level: separate handlers, models, and often tables — not just method names on one god service.

CQRS is often taught only with Event Sourcing. That pairing is optional. **Any project can use light CQRS** without an event store.

::: tip
CQS → clearer classes. CQRS → clearer *sides* of the app. Start with CQS; graduate to CQRS when read and write needs diverge.
:::

---

## Light flow (one DB)

| Piece | Role |
|-------|------|
| **Commands + WriteModel** | Intent + invariants (`PlaceOrder`, stock, totals) |
| **WriteTables** | Normalized source of truth (`orders`, `order_items`) |
| **OptionalProjection** | Sync / build read shape (same tx, event, cron, or DB view) |
| **ReadModels** | Denormalized tables / views (`order_summaries`) |
| **Queries** | Thin readers for UI / API lists |

Physical split (second DB, Kafka streams) is allowed later. Light CQRS stops at **code + maybe a read table**.

---

## Write side — rich, with invariants

```php
// Write side — rich, with invariants
final class PlaceOrderHandler
{
    public function __invoke(PlaceOrder $cmd): Order
    {
        return DB::transaction(function () use ($cmd) {
            $order = Order::create([
                'user_id' => $cmd->userId,
                'status' => 'placed',
                'total' => $cmd->total,
            ]);

            $order->items()->createMany($cmd->items);

            // outbox / domain events — optional, still light CQRS
            return $order;
        });
    }
}
```

Write side owns:

- Validation and business rules  
- Concurrency / locking where needed  
- Side effects enlisted safely (see [Outbox](/patterns/outbox))

Do **not** stuff dashboard join logic into the write model.

---

## Read side — flat, UI-shaped

```php
// Read side — flat, optimized for UI
final class OrderSummaryQuery
{
    public function __invoke(int $userId): Collection
    {
        return DB::table('order_summaries') // or Eloquent read model
            ->where('user_id', $userId)
            ->orderByDesc('placed_at')
            ->limit(50)
            ->get();
    }
}
```

For filter-heavy lists, pair with a [Directory Query Class](/patterns/directory-query) on the **query** side only.

| Write model | Read model |
|-------------|------------|
| Normalized, invariant-heavy | Denormalized columns the screen needs |
| Few writers, careful tx | Many readers, cheap selects |
| `Order` + `OrderItem` | `order_summaries` row per list card |

---

## Optional projection

How the read side stays current (pick one; escalate only when needed):

| Approach | When |
|----------|------|
| **Same transaction** update write + read row | Strong consistency, simple domains |
| **DB view** over write tables | MVP / low traffic; no extra write path |
| **Domain event / Outbox → worker** | Async, scale reads, avoid dual-write hell |
| **Scheduled job** | Tolerable lag; rare rebuilds |
| **Full Event Sourcing projections** | Audit / rebuild-from-events — **beyond** light CQRS |

::: warning Consistency
Async projection ⇒ short-lived read lag. UI and APIs must tolerate “eventual” where you chose async.
:::

---

## When to use / skip

**Use when**

- Dashboard / reports need heavy joins; write path must stay simple and safe  
- Read shape ≠ write shape (different indexes, denormalization)  
- You want to scale or cache reads without touching write transactions  

**Skip when**

- Plain CRUD: same fields on form and list  
- Team cannot own two models yet — complexity cost is real  
- You only want Event Sourcing fashion without a real divergence  

Trade-off: **more code / classes**; for simple CRUD → overkill. When read and write pull opposite directions → excellent.

---

## Decision rule

```
Do read and write needs conflict?
  Yes → CQRS light (split code; add read table/view if needed)
  No  → stay simple CRUD / one model

Escalate storage split only after code split is not enough.
Never require full Event Sourcing just to “do CQRS”.
```

1. Split **handlers and models** first.  
2. Add a **read table / view** when joins hurt.  
3. Add **async projection** when sync dual-write or lag policy demands it.  
4. Keep queries free of side effects (CQS strong rule).

---

## Antipatterns

- Treating CQRS as “must have Event Sourcing + two databases”  
- One god service that both mutates and returns huge joined DTOs  
- Writing to the read table from random controllers (no single projection path)  
- Side effects inside query handlers (email, charge, enqueue)  
- Premature second database before a clear scale/isolation need  
- Full aggregate + command + event ceremony for empty validation-only CRUD (keep light)

---

## Mental drill

1. Order form needs stock check + total rules; admin list needs customer name + item count + last status. One Eloquent model for both — what breaks first?  
2. You add `order_summaries` updated in the same tx as `orders`. What did you gain vs an async worker? What did you lose?  
3. Product wants a real-time dashboard and a strict write path. Is light CQRS enough, or do you need ES?

::: tip Hints
1. Either writes grow filter/join noise or lists stay slow/fragile · 2. Gain: strong consistency; lose: write latency / coupling · 3. Light CQRS usually enough; ES only if you need event log rebuild / audit as source of truth
:::
