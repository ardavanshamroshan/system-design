# Message Acknowledgment Patterns

> Module C — Messaging & Reliability · Section 7

## Mental outline

1. [What and why](#what-and-why)  
2. [Delivery guarantees](#delivery-guarantees)  
3. [Auto-Ack vs Manual Ack](#auto-ack-vs-manual-ack)  
4. [Broker-native ack models](#broker-native-ack-models)  
5. [Laravel queues](#laravel-queues)  
6. [Idempotency](#idempotency--required-companion)  
7. [Late acks and prefetch](#late-acks-and-prefetch)  
8. [Decision rule](#decision-rule)  
9. [Antipatterns](#antipatterns)

---

## What and why

An **Acknowledgment (Ack)** is the consumer telling the broker:

> “I processed this message correctly — you may delete it / advance the offset.”

Without a correct ack path:

- Crash mid-process → message **lost** (acked too early), or  
- Crash / timeout → message **redelivered forever** (never acked)

```
Deliver → Process → Ack  → broker releases message
                 ↘ fail → Nack / release / DLQ
```

Ack is a **consumer-side** concept. On the producer side, “ack” usually just means `publish`/`send` returned successfully — that is not the same as “someone finished the work.”

Related: [Brokers](/messaging/brokers) · [Dead-Letter Queue](/messaging/dlq) · [Outbox](/patterns/outbox)

---

## Delivery guarantees

| Pattern | Meaning | Typical risk |
|---------|---------|--------------|
| **At-most-once** | Deliver ≤ 1 time; may skip | Lost messages |
| **At-least-once** | Deliver ≥ 1 time; may duplicate | Duplicate side effects |
| **Exactly-once** | Deliver = 1 time end-to-end | Very hard; high complexity |

Reality check:

- **At-most-once** ≈ fire-and-forget / auto-ack before work finishes  
- **At-least-once** ≈ manual ack after success + broker redelivery on crash  
- **Exactly-once** end-to-end is rare. Most teams get **effectively once**:  
  **at-least-once delivery + idempotent consumer** (+ often [transactional outbox](/patterns/outbox))

```
At-most-once:   Deliver → (ack) → Process     // die in Process → gone
At-least-once:  Deliver → Process → Ack       // die before Ack → retry
Effectively once: At-least-once + idempotent handler (+ outbox where needed)
```

---

## Auto-Ack vs Manual Ack

### Auto-Ack

Broker marks the message done as soon as it is delivered (or right when `receive` / `onMessage` returns), **before** your business logic is proven safe.

```
Deliver → (auto ack) → Process
```

If the worker dies mid-process → message is gone → **at-most-once**.

Use only when loss is acceptable (metrics scrapes, non-critical logs, ephemeral signals).

### Manual Ack

You ack **after** successful processing. Fail → nack / release / send to DLQ.

```
Deliver → Process → Ack
         ↘ fail → Nack / requeue / DLQ
```

Crash before ack → broker redelivers → **at-least-once**.

```php
$msg = $channel->wait();
try {
    process($msg->body);
    $channel->ack($msg);
} catch (Throwable $e) {
    $channel->nack($msg, requeue: shouldRetry($e));
}
```

| Mode | When |
|------|------|
| Auto-ack | Loss OK; maximize speed |
| Manual ack + retry | Business events, jobs, money |
| “Exactly-once” marketing claim | Trust only with real tx + idempotency |

---

## Broker-native ack models

Same idea, different APIs.

### Classic queue (RabbitMQ / AMQP)

- `basic.ack` after success  
- `basic.nack` / `reject` with `requeue` or route via DLX → [DLQ](/messaging/dlq)  
- Prefetch (`qos`) limits unacked messages per consumer  

### JMS-style modes (conceptual map)

| Mode | Behavior | Maps roughly to |
|------|----------|-----------------|
| `AUTO_ACKNOWLEDGE` | Session acks for you | Auto-ack (sync: before return; async: after listener returns) |
| `DUPS_OK_ACKNOWLEDGE` | Lazy batch ack | Faster; more duplicates after crash |
| `CLIENT_ACKNOWLEDGE` | You call `acknowledge()` | Manual; often acks all prior msgs in session |
| Transacted session | `commit` / `rollback` as unit of work | Batch ack / recover |

Client crash with unacked messages → session recover → redelivery.

### Redis Streams (PEL + XACK)

Consumer groups keep a **Pending Entry List (PEL)**:

```
1. XREADGROUP  → message recorded in PEL
2. process
3. XACK        → removed from PEL
4. crash before XACK → stays in PEL → reclaim (XAUTOCLAIM / XCLAIM)
```

Track delivery count via `XPENDING`; after N failures → move to a DLQ list/stream and then `XACK` so it leaves the PEL.

### Kafka

Consumers advance **offsets**. Commit after processing ≈ ack. Commit too early ≈ at-most-once; commit after success ≈ at-least-once within the group.

### Cloud queues (e.g. SQS)

Visibility timeout acts as a soft lease: if you don’t delete/ack in time, the message becomes visible again (at-least-once).

---

## Laravel queues

Laravel’s queue worker maps cleanly onto ack semantics:

| Outcome | Broker / queue effect |
|---------|------------------------|
| `handle()` returns OK | **Implicit ack** — job deleted |
| Uncaught exception | **Release / retry** (tries + backoff) |
| `$this->fail()` or max tries | **Failed jobs** ≈ DLQ semantics |

```php
class ChargeCard implements ShouldQueue
{
    public int $tries = 5;

    public function backoff(): array
    {
        return [10, 30, 60];
    }

    public function handle(): void
    {
        // Idempotency key — never double-charge
        $payment = Payment::query()->firstOrCreate(
            ['idempotency_key' => $this->key],
            ['order_id' => $this->orderId, 'status' => 'pending']
        );

        if ($payment->status === 'paid') {
            return; // already processed = safe ack path
        }

        $gateway->charge($this->orderId);
        $payment->update(['status' => 'paid']);
    }

    public function failed(\Throwable $e): void
    {
        // alert / DLQ-style handling
    }
}
```

Tune: `$tries`, `backoff()`, `$timeout`, Horizon supervisors, and `failed_jobs` monitoring — same knobs as manual ack + DLQ elsewhere.

---

## Idempotency — required companion

At-least-once **will** duplicate under crash, timeout, or reclaim. Handlers must tolerate repeats.

```php
if (Inbox::alreadyProcessed($eventId)) {
    return; // ack and done
}

DB::transaction(function () use ($event) {
    apply($event);
    Inbox::markProcessed($event->id);
});
```

Common keys: `event_id`, API `idempotency-key`, unique DB constraints, upserts (`ON CONFLICT DO NOTHING`).

Natural idempotent ops (set status = paid) beat non-idempotent ones (increment balance) unless you guard with a key.

---

## Late acks and prefetch

If prefetch / in-flight leases are high and acks come late:

- One slow consumer **holds** many messages  
- Other workers sit idle  
- Visibility timeouts fire → surprise redeliveries  

Knobs: `prefetch` / `qos`, SQS visibility timeout, Redis `XAUTOCLAIM` idle threshold, Laravel `$timeout` and Horizon `maxProcesses`.

Rule of thumb: prefetch ≈ what one worker can finish before the lease expires.

---

## Decision rule

```
Is loss acceptable?
  Yes → at-most-once / auto-ack
  No  → at-least-once + manual ack (or Laravel success path)
         + idempotent consumer
         + retry/backoff
         + DLQ / failed_jobs after N tries

Financial / money / inventory?
  → Always at-least-once + idempotent
  → Never promise “exactly once” without outbox/tx + keys
```

From the module outline:

1. Important data → **manual ack / Laravel success = ack** + at-least-once  
2. Always design for **duplicates** (idempotent)  
3. Financial consumers → **at-least-once + idempotent**; “exactly once” only with side mechanisms  
4. Tune prefetch / visibility to real capacity  

---

## Antipatterns

- Auto-ack on payment / order / inventory jobs  
- Claiming “exactly-once” because the broker brochure said so  
- Ack before the side effect commits (DB write, gateway charge)  
- Infinite retry with no max tries / DLQ  
- Huge prefetch + long jobs → head-of-line blocking and false redeliveries  
- Blind replay from DLQ without idempotent consumers  

---

## Mental drill

1. Crash after charging the card but before job ack — what must be true?  
2. Metrics counter can drop 0.1% of events — which mode?  
3. Redis worker dies mid-`handle` with consumer groups — where is the message?  

::: tip Hints
1. Idempotency key / paid status check · 2. At-most-once / auto-ack · 3. Still in the PEL until XACK or reclaim
:::
