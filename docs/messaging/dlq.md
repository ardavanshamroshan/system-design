# Dead-Letter Queue (DLQ) Explained

## What is it?

When a message **fails to process repeatedly**, you send it to a separate queue called a **Dead-Letter Queue** so that:

- It doesn’t block the main queue  
- You can alert, inspect, and replay it  

```
[Main Queue] --fail x N--> [DLQ] --> alert / manual replay
```

---

## Why you need it

Without a DLQ:

- Poison messages retry forever  
- Consumers stay busy  
- Healthy messages pile up behind them  

With a DLQ: failures are isolated.

---

## Common failure scenarios

| Type | Example |
|------|---------|
| Invalid data | Broken JSON, missing required field |
| Logic bug | Repeated null pointer |
| Dependency down | Payment provider returns 500 temporarily |
| Poison message | One specific payload always crashes |

Temporary errors → retry with backoff.  
Permanent errors → after N attempts → DLQ.

---

## Conceptual config

```yaml
# Mental example (RabbitMQ / SQS-like)
max_receive_count: 5
dead_letter_queue: orders.dlq
retry_backoff: exponential
```

```php
try {
    $handler->handle($message);
    $message->ack();
} catch (RetryableException $e) {
    $message->nack(requeue: true);
} catch (PermanentException $e) {
    $message->nack(requeue: false); // → DLQ path
}
```

---

## After a message hits the DLQ

1. **Metrics and alerts** on DLQ depth  
2. Log correlation id / safe payload  
3. Fix the bug or data  
4. **Replay** carefully to the main queue  
5. If worthless → archive / drop with a reason

---

## Antipatterns

- DLQ with no monitoring (= forgotten trash can)  
- Sending every error to DLQ on the first fail (no retries)  
- Blind replay of everything without idempotent consumers

---

## Decision rule

1. Every production queue needs a retry + DLQ policy.  
2. Temporary ≠ permanent; separate exception types.  
3. Treat the DLQ like a hospital ward — monitor it, don’t ignore it.
