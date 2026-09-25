# Optimistic vs Pessimistic Locking

> Module B — Data, Concurrency, Durability · Section 3

## What and why

When two transactions update the same row at once, without a lock one overwrites the other (**lost update**):

```
A reads qty=5
B reads qty=5
A writes qty=4
B writes qty=4  ← one decrement was lost
```

Two classic approaches: **Pessimistic** and **Optimistic**.

---

## Pessimistic locking

Lock before you edit (`SELECT … FOR UPDATE`) — others wait.

```sql
SELECT * FROM orders WHERE id = 1 FOR UPDATE;
-- others wait on this row
UPDATE orders SET status = 'paid' WHERE id = 1;
COMMIT;
```

“Lock first, then work.”

| Upside | Cost |
|--------|------|
| Fewer conflicts at commit time | Waiting / lock contention |
| Fits high-conflict paths | Deadlock risk if lock order is bad |

---

## Optimistic locking

No lock; check with `version` / `updated_at` that nobody changed the row mid-flight.

```
WriterA                Database                WriterB
   |                      |                       |
   |-- read version=1 --->|                       |
   |                      |<--- read version=1 ---|
   |                      |                       |
   |-- update if v=1 ---->|                       |
   |   set version=2      |                       |
   |<----- OK ------------|                       |
   |                      |<--- update if v=1 ----|
   |                      |---- 0 rows / conflict>|
```

```sql
UPDATE orders
SET status = 'paid', version = version + 1
WHERE id = 1 AND version = 1;
-- if 0 rows → someone wrote first; conflict / retry
```

| Upside | Cost |
|--------|------|
| No long-held locks | Many retries under high conflict |
| Scales better for low-contention paths | UX must handle conflict |

---

## Trade-off

| Approach | Fits |
|----------|------|
| **Optimistic** | Low contention — e.g. user profile |
| **Pessimistic** | High conflict — inventory / seat reservation |

---

## Laravel code

### Pessimistic

```php
DB::transaction(function () use ($orderId) {
    $order = Order::whereKey($orderId)->lockForUpdate()->firstOrFail();
    $order->status = 'paid';
    $order->save();
});
```

### Optimistic — `version` column on the table

```php
DB::transaction(function () use ($orderId, $payload) {
    $order = Order::findOrFail($orderId);

    $affected = Order::whereKey($order->id)
        ->where('version', $order->version)
        ->update([
            ...$payload,
            'version' => $order->version + 1,
        ]);

    if ($affected === 0) {
        throw new \RuntimeException('Conflict: order changed by another request');
    }
});
```

---

## Atomic updates without “mental locks”

Sometimes you don’t name either pattern, but an atomic condition is enough:

```sql
UPDATE wallets
SET balance = balance - 100
WHERE id = 9 AND balance >= 100;
```

Simple and powerful — especially for inventory-like counters.

---

## Decision rule

1. **Rare conflict** → optimistic  
2. **Financial / inventory correctness + heavy races** → pessimistic (+ short transactions)  
3. Always budget for deadlock and retry.  
4. Keep locks short; don’t do external HTTP inside a transaction.
