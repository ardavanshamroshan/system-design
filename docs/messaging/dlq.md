# Dead-Letter Queue (DLQ)

> Module C — Messaging & Reliability · Section 8

## Mental outline

1. [What and why](#what-and-why)  
2. [Poison messages](#poison-messages)  
3. [Core flow](#core-flow)  
4. [Broker patterns](#broker-patterns)  
5. [Laravel as DLQ](#laravel-as-dlq)  
6. [After the DLQ](#after-the-dlq)  
7. [When to use / skip](#when-to-use--skip)  
8. [Decision rule](#decision-rule)  
9. [Antipatterns](#antipatterns)

---

## What and why

A **Dead-Letter Queue (DLQ)** is a holding area for messages that **keep failing after N attempts**. The broker (or app) stops retrying them on the main line and parks them aside so:

- Healthy work keeps flowing  
- Nothing valuable is silently dropped  
- Someone can inspect, fix, and **replay** later  

Name comes from the postal *dead letter office*: undeliverable mail is set aside, not burned and not left jamming the sorter.

```
Producer → MainQueue → Worker
                         │ success → ack / delete
                         │ fail → retry (backoff)
                         └ fail × N → FailedJobs_DLQ → alert / replay
```

Related: [Acknowledgment](/messaging/acknowledgment) · [Brokers](/messaging/brokers) · [Outbox](/patterns/outbox)

---

## Poison messages

A **poison message** never succeeds no matter how often you retry:

- Malformed payload / schema mismatch  
- References a deleted entity  
- Handler bug that always throws  

Without a DLQ you pick one of three bad outcomes:

| Choice | Cost |
|--------|------|
| Retry forever | CPU burn; on ordered queues → **head-of-line block** |
| Drop on failure | Silent data loss (orders, payments, audit) |
| Stop the consumer | One bad record takes the whole service down |

DLQ collapses those into: **retry a few times → park → alert → fix → replay**.

---

## Core flow

```
fail_retry          → transient error; release with backoff
max_tries_exceeded  → move to FailedJobs_DLQ
manual_retry        → human / job replays after root cause fixed
```

Components that always show up:

| Piece | Role |
|-------|------|
| **MainQueue** | Normal work |
| **Worker** | Process; ack on success; nack/release on fail |
| **Retry / redrive policy** | Max attempts before giving up (`maxReceiveCount`, `$tries`, …) |
| **FailedJobs_DLQ** | Isolated destination + failure reason |
| **Monitoring** | Depth > 0 → page someone |
| **Replay path** | Inspect → fix cause → reinject (idempotent) |

Threshold is a tradeoff, not a default:

- Too low (e.g. 1) → network blips look like poison  
- Too high → waste worker capacity on doomed payloads  

Tune so normal transient failures clear; stop there.

---

## Broker patterns

Same idea, different labels.

### Amazon SQS — redrive policy

```json
{
  "deadLetterTargetArn": "arn:aws:sqs:...:orders-dlq",
  "maxReceiveCount": 5
}
```

After `maxReceiveCount` receives without successful delete → message moves to the DLQ. Keep DLQ retention **longer** than the source (standard queues keep the original enqueue timestamp).

### RabbitMQ — dead-letter exchange (DLX)

```js
channel.assertQueue('orders', {
  arguments: {
    'x-dead-letter-exchange': 'orders.dlx',
    'x-message-ttl': 60000,
    'x-max-length': 10000
  }
});
```

Dead-letter reasons include: consumer reject/nack (no requeue), TTL expire, queue length overflow, delivery limit. Broker stamps `x-death` with why.

### Kafka Connect / streams

Route bad records to a DLQ **topic** so the pipeline keeps running; inspect headers; fix schema; replay. Valid messages never stall behind a poison pill.

### Conceptual handler

```php
try {
    $handler->handle($message);
    $message->ack();
} catch (RetryableException $e) {
    $message->nack(requeue: true);   // fail_retry
} catch (PermanentException $e) {
    $message->nack(requeue: false);  // → DLQ path
}
```

---

## Laravel as DLQ

In Laravel, **`failed_jobs` + `queue:failed` / `queue:retry`** play the DLQ role.

| Outcome | Effect |
|---------|--------|
| `handle()` OK | Job deleted (implicit ack) |
| Exception, tries left | Release / retry (`fail_retry`) |
| Max tries / `$this->fail()` | Row in `failed_jobs` ≈ **FailedJobs_DLQ** |
| `queue:retry {id}` | **manual_retry** back onto MainQueue |

```bash
php artisan queue:failed
php artisan queue:retry {id}
php artisan queue:flush   # danger — wipe DLQ
```

```php
// config/queue.php — how long a reserved job may sit before another worker may take it
'retry_after' => 90,
```

```php
class ChargeCard implements ShouldQueue
{
    public int $tries = 5;
    public int $maxExceptions = 3;

    public function retryUntil(): \DateTime
    {
        return now()->addMinutes(30);
    }

    public function backoff(): array
    {
        return [10, 30, 60];
    }

    public function handle(): void
    {
        // keep handler idempotent — replay from failed_jobs must be safe
    }

    public function failed(\Throwable $e): void
    {
        // alert: Horizon / Sentry / Slack
    }
}
```

Knobs that map to broker DLQ policy: `$tries`, `$maxExceptions`, `retryUntil()`, `backoff()`, `retry_after`, Horizon failed-job metrics.

---

## After the DLQ

1. **Alert** on DLQ / `failed_jobs` depth (Horizon, Sentry, CloudWatch, …)  
2. Log correlation id + safe payload + failure reason  
3. Fix the bug, data, or dependency  
4. **Replay** with idempotent consumers (`queue:retry`, SQS redrive, …)  
5. If worthless → archive / drop with an explicit reason  

A DLQ is a **landing zone**, not a fix. Azure’s framing applies everywhere: messages stay until **you** retrieve them.

---

## When to use / skip

**Use when**

- Async queue/stream work can fail permanently  
- Losing the message hurts (money, orders, audit)  
- Healthy traffic must keep flowing (especially ordered queues)  
- You will inspect and replay  

**Skip or rethink when**

- Failures are almost always transient → retry/backoff is the real tool; DLQ is only a backstop  
- Message is safe to drop (best-effort metrics)  
- **Nobody will watch the DLQ** → silent loss with extra steps  
- Downstream is fully down → Circuit Breaker / pause consumers; don’t flood the DLQ with “good” messages  
- Strict end-to-end order must never break → moving aside reorders; know that cost  

---

## Decision rule

```
Can this fail in a way retry never fixes?
  AND would losing it hurt?
    Yes → MainQueue + retry/backoff + FailedJobs_DLQ + alerting
    Only transient → retry/backoff; DLQ as backstop
    Loss OK → discard on final failure

DLQ without alerting = useless trash can
Replay before fixing cause = retry-forever, slower
```

From the module outline:

1. After N failures → park on DLQ; don’t clog MainQueue  
2. Laravel: `failed_jobs` + `queue:failed` / `queue:retry`  
3. **Always** monitor failed jobs (Horizon / Sentry)  
4. Replay only after root cause + idempotent handlers  

---

## Antipatterns

- DLQ with no owner and no alarm  
- `maxReceiveCount` / `$tries = 1` on flaky networks  
- Blind `queue:retry` / redrive before the bug is fixed  
- Treating an outage flood as poison (use circuit breaker)  
- DLQ retention shorter than source (esp. SQS original timestamp)  
- Routing DLQ back into the same failing path (retry loop)  
- Claiming the system is safe because “we have a DLQ” while nobody looks  

---

## Mental drill

1. Payment provider down 10 minutes — every job hits max tries. First response: raise `$tries`, or stop consuming?  
2. You fix a schema bug; 4000 rows sit in `failed_jobs`. What must be true before `queue:retry all`?  
3. SQS main queue retains 4 days; DLQ retains 1 day. Why can a message vanish right after redrive into the DLQ?  

::: tip Hints
1. Circuit breaker / pause — not poison · 2. Cause fixed + idempotent handler · 3. Original enqueue timestamp still counts; DLQ retention must be longer
:::
