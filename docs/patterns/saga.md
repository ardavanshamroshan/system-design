# Saga Pattern

> Module C / D — Messaging & Architecture · Section 13

## Mental outline

1. [What and why](#what-and-why)  
2. [Mental model](#mental-model)  
3. [Orchestration vs choreography](#orchestration-vs-choreography)  
4. [Compensation (undo)](#compensation-undo)  
5. [State machine + Laravel code](#state-machine--laravel-code)  
6. [Outbox, idempotency, and timeouts](#outbox-idempotency-and-timeouts)  
7. [Real challenges](#real-challenges)  
8. [When to use / skip](#when-to-use--skip)  
9. [Interview notes](#interview-notes)  
10. [Decision rule](#decision-rule)  
11. [Antipatterns](#antipatterns)  
12. [Mental drill](#mental-drill)

---

## What and why

A **saga** coordinates a **multi-step business transaction** across services (or bounded contexts) **without** a distributed ACID transaction / 2PC.

Each step:

1. Does local work in **one** database transaction  
2. Publishes an event / command for the next step  
3. On failure later, runs **compensating** actions to undo earlier steps

```
Reserve stock → Charge card → Create shipment
      │              │               │
   local tx       local tx        local tx
      X fail ─────────────────────────────► Release stock + refund
```

**Why?** Cross-service 2PC blocks, times out, and does not scale. Saga trades **atomicity** for **eventual consistency + explicit undo**.

Related: [Outbox](/patterns/outbox) · [Acknowledgment](/messaging/acknowledgment) · [CQRS](/patterns/cqrs) · [Replication](/architecture/replication) · [Resilience](/architecture/resilience)

---

## Mental model

Think **trip booking**, not bank ledger ACID:

| Classic ACID (one DB) | Saga (many services) |
|-----------------------|----------------------|
| Commit all or roll back all | Forward steps + compensations |
| Locks held across participants | Short local locks only |
| Strong consistency now | Visible intermediate states |

User may briefly see: `stock reserved`, payment pending — then either `confirmed` or `cancelled + refunded`.

::: tip
Saga is a **process**, not a library. You own the state machine, timeouts, and compensations.
:::

---

## Orchestration vs choreography

### Orchestration — one conductor

A **orchestrator** (workflow service / saga manager) tells each participant what to do next.

```
┌─────────────┐
│  Checkout   │──cmd──► Inventory.reserve
│ Orchestrator│──cmd──► Payments.charge
│             │──cmd──► Shipping.create
└─────────────┘
        ▲ events / replies
```

| Pros | Cons |
|------|------|
| Clear flow in one place | Orchestrator can become a god service |
| Easier to see status / timeouts | Extra hop / ownership |
| Simpler debugging | Must not hold DB locks across remote calls |

### Choreography — events only

Each service reacts to events; no central brain.

```
OrderCreated → Inventory reserves → StockReserved → Payment charges → …
Failure: PaymentFailed → Inventory releases → …
```

| Pros | Cons |
|------|------|
| Loose coupling | Flow scattered across services |
| No single orchestrator SPOF | Hard to visualize / change order |
| Natural with event bus | Easy to create event ping-pong |

**Default for Laravel monoliths / few services:** orchestration (job + saga table).  
**Many autonomous teams + mature event design:** choreography (or hybrid).

---

## Compensation (undo)

Compensation is **business undo**, not DB `ROLLBACK` of a remote commit.

| Forward step | Compensation |
|--------------|--------------|
| Reserve inventory | Release reservation |
| Capture payment | Refund (or void auth) |
| Create shipment label | Cancel label |
| Send “confirmed” email | Send “cancelled” email (don’t unsend) |

Some steps are **not compensatable** (SMS already read). Design: do irreversible steps **last**, or accept irreversible + apology flow.

```php
interface SagaStep
{
    public function name(): string;
    public function execute(SagaContext $ctx): void;
    public function compensate(SagaContext $ctx): void;
}
```

---

## State machine + Laravel code

### Schema

```php
Schema::create('checkout_sagas', function (Blueprint $t) {
    $t->uuid('id')->primary();
    $t->foreignId('order_id')->constrained();
    $t->string('state'); // started|stock_reserved|paid|shipped|completed|compensating|failed
    $t->json('context');
    $t->unsignedTinyInteger('version')->default(0); // optimistic concurrency
    $t->timestamps();
});
```

### Orchestrator sketch

```php
final class CheckoutSagaOrchestrator
{
    public function __construct(
        private InventoryClient $inventory,
        private PaymentsClient $payments,
        private ShippingClient $shipping,
    ) {}

    public function start(Order $order): void
    {
        $saga = CheckoutSaga::create([
            'id' => (string) Str::uuid(),
            'order_id' => $order->id,
            'state' => 'started',
            'context' => ['order_id' => $order->id, 'total_cents' => $order->total_cents],
        ]);

        DB::transaction(function () use ($saga) {
            OutboxMessage::create([
                'type' => 'saga.checkout.advance',
                'payload' => ['saga_id' => $saga->id],
                'idempotency_key' => "saga.advance:{$saga->id}:started",
            ]);
        });
    }

    public function advance(string $sagaId): void
    {
        $saga = CheckoutSaga::query()->whereKey($sagaId)->lockForUpdate()->firstOrFail();

        match ($saga->state) {
            'started' => $this->reserveStock($saga),
            'stock_reserved' => $this->charge($saga),
            'paid' => $this->ship($saga),
            'shipped' => $this->complete($saga),
            'compensating' => $this->compensateNext($saga),
            default => null,
        };
    }

    private function reserveStock(CheckoutSaga $saga): void
    {
        try {
            $reservationId = $this->inventory->reserve(
                orderId: $saga->order_id,
                idempotencyKey: "inv.reserve:{$saga->id}",
            );
            $saga->forceFill([
                'state' => 'stock_reserved',
                'context->reservation_id' => $reservationId,
                'version' => $saga->version + 1,
            ])->save();
            $this->enqueueAdvance($saga);
        } catch (Throwable $e) {
            $this->fail($saga, $e);
        }
    }

    private function charge(CheckoutSaga $saga): void
    {
        try {
            $paymentId = $this->payments->charge(
                amountCents: $saga->context['total_cents'],
                idempotencyKey: "pay.charge:{$saga->id}",
            );
            $saga->forceFill([
                'state' => 'paid',
                'context->payment_id' => $paymentId,
                'version' => $saga->version + 1,
            ])->save();
            $this->enqueueAdvance($saga);
        } catch (Throwable $e) {
            $saga->state = 'compensating';
            $saga->context['compensate_from'] = 'stock_reserved';
            $saga->save();
            $this->enqueueAdvance($saga);
        }
    }

    private function compensateNext(CheckoutSaga $saga): void
    {
        // Undo in reverse order of success
        if ($paymentId = $saga->context['payment_id'] ?? null) {
            $this->payments->refund($paymentId, idempotencyKey: "pay.refund:{$saga->id}");
            unset($saga->context['payment_id']);
        }
        if ($reservationId = $saga->context['reservation_id'] ?? null) {
            $this->inventory->release($reservationId, idempotencyKey: "inv.release:{$saga->id}");
            unset($saga->context['reservation_id']);
        }
        $saga->state = 'failed';
        $saga->save();
    }
}
```

```python
# Choreography sketch — each handler is idempotent
def on_stock_reserved(event: dict) -> None:
    if already_processed(event["idempotency_key"]):
        return
    try:
        payment_id = payments.charge(event["order_id"], event["total_cents"])
        emit("PaymentCaptured", {**event, "payment_id": payment_id})
    except PaymentError:
        emit("PaymentFailed", event)  # inventory listens → release
```

---

## Outbox, idempotency, and timeouts

| Concern | Practice |
|---------|----------|
| Step + event atomic | [Outbox](/patterns/outbox) in each service |
| At-least-once delivery | Idempotency keys per step ([Ack](/messaging/acknowledgment)) |
| Stuck saga | Timeout + alarm → compensate or manual ops |
| Concurrent workers | Optimistic `version` / `lockForUpdate` on saga row |
| Partial visibility | UI states: `processing` / `failed` / `confirmed` |

```
Deadline example:
  reserve ≤ 30s hold
  payment auth ≤ 2m
  whole checkout saga ≤ 15m then auto-compensate
```

Without timeouts, reserved stock and open authorizations leak forever.

---

## Real challenges

### Challenge A — Double charge on retry

Payment HTTP times out. Client retries. Orchestrator retries `charge`. Card charged twice.

| Cause | Fix |
|-------|-----|
| No idempotency key to PSP | Same key for saga id + step |
| Treating timeout as failure then retry unsafe op | Query payment status before re-charge |

### Challenge B — Compensation fails

Refund API down after charge succeeded and stock release needed. Saga stuck in `compensating`.

| Cause | Fix |
|-------|-----|
| Assumed undo always works | Compensate queue + DLQ + pager |
| No dead-letter for saga | [DLQ](/messaging/dlq) + admin replay |

### Challenge C — User sees “paid” then “cancelled”

Payment succeeded; shipping permanently fails; compensate refunds. User confused.

| Cause | Fix |
|-------|-----|
| Irreversible UX too early | Confirm email only on `completed` |
| Poor state copy | “Refund started” not “order vanished” |

### Challenge D — Choreography ping-pong

`PaymentFailed` → `StockReleased` → `OrderCancelled` → `Notify` → someone emits `OrderCreated` again by bug → loop.

| Cause | Fix |
|-------|-----|
| Missing correlation / causal rules | Saga id + idempotency; never re-enter forward from compensate events |
| No ownership of flow | Prefer orchestrator when flow is complex |

---

## When to use / skip

**Use when**

- Multiple services / DBs must agree on one business outcome  
- 2PC is unacceptable  
- Compensations are definable  

**Skip when**

- Single DB transaction already covers the flow  
- Step cannot be compensated and cannot be last  
- Team cannot operate stuck-state tooling  

---

## Interview notes

1. Saga ≠ event sourcing (can pair; not the same).  
2. Name **compensation** explicitly; give one irreversible step example.  
3. Orchestration vs choreography — pick one and defend.  
4. Tie to **outbox + idempotency + timeout**.  
5. Mention visible intermediate state (eventual consistency).  

---

## Decision rule

1. One DB? Prefer local transaction — no saga.  
2. Multi-service? Saga (or accept weaker “best effort”).  
3. Need a single place to read status / SLA? **Orchestration**.  
4. Every forward step needs **idempotent** execute + **compensating** undo (or “last step irreversible”).  
5. Persist saga state; advance via outbox; alarm on stuck.  
6. Money steps: idempotency keys mandatory.  

---

## Antipatterns

- Distributed 2PC as the default “just make it atomic”  
- Saga state only in memory / queue messages  
- Retry `charge` without idempotency  
- Compensations that assume perfect networks ([Fallacies](/architecture/fallacies-pacelc))  
- Confirming success to the user before the saga completes  
- God orchestrator that also owns every domain invariant  

---

## Mental drill

Checkout: reserve → pay → ship.

1. Pay succeeds; ship fails forever — list compensations in order.  
2. Why put outbox on each service, not only the orchestrator?  
3. Timeout on pay: do you compensate stock immediately or check PSP first?  
4. Next: when Inventory is slow, how do timeout/retry/circuit interact with the saga? → [Resilience](/architecture/resilience)
