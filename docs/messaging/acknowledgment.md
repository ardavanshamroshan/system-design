# Message Acknowledgment Patterns

## Idea

When a consumer takes a message, it must tell the broker: “I’m done” or “no — requeue / send to DLQ.”

That signal is the **Acknowledgment (Ack)**.

---

## Three main delivery patterns

| Pattern | Meaning | Risk |
|---------|---------|------|
| **At-most-once** | At most once; may be lost | Lost messages |
| **At-least-once** | At least once; may duplicate | Duplicate processing |
| **Exactly-once** | Exactly once (hard end-to-end) | High complexity |

Most systems build **at-least-once + idempotent consumers**.

---

## Auto-Ack vs Manual Ack

### Auto-Ack

The message is acked as soon as it’s delivered.

```
Deliver → (auto ack) → Process
```

If processing dies mid-way → the message is gone (**at-most-once**).

### Manual Ack

You ack after successful processing.

```
Deliver → Process → Ack
         ↘ fail → Nack / requeue / DLQ
```

If you die before ack → the message comes back (**at-least-once**).

```php
$msg = $channel->wait();
try {
    process($msg->body);
    $channel->ack($msg);
} catch (Throwable $e) {
    $channel->nack($msg, requeue: shouldRetry($e));
}
```

---

## Idempotency — required companion for at-least-once

Because a message may arrive twice:

```php
if (Inbox::alreadyProcessed($eventId)) {
    return; // ack and done
}
DB::transaction(function () use ($event) {
    apply($event);
    Inbox::markProcessed($event->id);
});
```

Common keys: `event_id`, API `idempotency-key`, unique constraints.

---

## Late acks and prefetch

If prefetch is high and acks are late:

- One slow consumer holds many messages  
- Others sit idle  

Important knobs: `prefetch / qos`, visibility timeout (SQS), max processing time.

---

## Short comparison

| Mode | When |
|------|------|
| Auto-ack | Non-critical logs that can be lost |
| Manual ack + retry | Most jobs and business events |
| “Exactly-once” claims | Only trust with real transactions/idempotency |

---

## Decision rule

1. Important data → manual ack + at-least-once.  
2. Always prepare for duplicates (idempotent).  
3. Tune prefetch to real consumer capacity.
