# Kafka, RabbitMQ, or Redis Streams?

> Module C — Messaging & Reliability · Section 6

## Mental outline

1. [What and why](#what-and-why)  
2. [Quick comparison](#quick-comparison)  
3. [RabbitMQ](#rabbitmq--the-post-office)  
4. [Kafka](#kafka--the-news-broadcast--event-log)  
5. [Redis Streams](#redis-streams--the-fast-courier)  
6. [Laravel queues](#laravel-and-queues)  
7. [Decision rule](#decision-rule)  
8. [Antipatterns](#antipatterns)

---

## What and why

A **message broker** decouples work from synchronous HTTP:

```
Producer → Broker → Consumer(s)
```

The producer puts a message down; the consumer processes it **later**. Benefits:

- **Decoupling:** services don’t call each other directly  
- **Buffering:** smooths traffic spikes  
- **Retry / ACK:** transient failures can be retried  
- **Scale workers:** grow consumers independently  

```
┌──────────┐     publish      ┌─────────┐     consume     ┌───────────┐
│ Producer │ ───────────────► │ Broker  │ ──────────────► │ Consumer1 │
└──────────┘                  │         │ ──────────────► │ Consumer2 │
                              └─────────┘                 └───────────┘
```

Wrong question: “Which is best?”  
Right question: what are your **traffic pattern, delivery guarantees, ordering, retention, and consumption model**?

Short analogies:

| Tool | Analogy |
|------|---------|
| **RabbitMQ** | Post office — letter to a specific mailbox, with delivery receipts |
| **Kafka** | 24/7 news broadcast — watch live or rewind the tape |
| **Redis Streams** | Bike courier in the city — fast and light; not for heavy cross-country cargo |

---

## Quick comparison

| | **RabbitMQ** | **Kafka** | **Redis Streams** |
|--|--------------|-----------|-------------------|
| **Model** | Queue / exchange (workers pull work) | Distributed append-only log | In-memory stream (+ optional AOF/RDB) |
| **Strength** | Flexible routing, AMQP, precise ACK | High throughput, replay, event log | Light, low latency, simpler ops (if you already run Redis) |
| **Ordering** | Usually per-queue | **Per-partition** | **Per-stream** |
| **Retention** | Usually until consume (+ ACK) | Days/weeks, replayable | More limited than Kafka (memory / MAXLEN) |
| **Laravel** | rabbitmq driver / packages | Community packages | Native Redis queue + Streams via package/manual |
| **Ops complexity** | Medium | Higher (cluster, partitions, retention) | Lower beside existing Redis |
| **Fits** | Task queues, workflows | Analytics, CDC, event history | Light jobs, realtime, cache+queue |

**Overall trade-off:** for most Laravel apps, **Redis queue or RabbitMQ** is enough. **Kafka** when you need event history, huge fan-out, or multiple consumer groups with **replay**.

---

## RabbitMQ — the post office

### Model

```
Producer → Exchange → (binding/routing key) → Queue → Consumer
```

- An **exchange** routes by rules (direct / topic / fanout / headers)  
- A **queue** holds work for workers  
- **ACK:** after successful processing the message is removed; crash before ACK → redelivery (at-least-once)  

Like a post office with many mailboxes: the letter goes to a specific address; if the recipient is briefly away, the letter waits.

### Strengths

- Rich routing and AMQP (+ MQTT/STOMP in some setups)  
- Priority, TTL, delayed messages, DLX (dead-letter)  
- Strong delivery for **work** (email, payment jobs, fulfillment)  

### When?

- Job queues with complex routing  
- Multi-step workflows  
- Need precise ACK / retry / DLQ  
- Request/reply patterns  

---

## Kafka — the news broadcast / event log

### Model

```
Producer → Topic (partitions) → Consumer Groups
```

- Messages live in an **append-only log** on disk (until retention)  
- **Partitions:** horizontal scale + order within a partition  
- Consumers track their own **offset** and can go back (**replay**)  
- Multiple independent **consumer groups** each read the same events  

The producer usually doesn’t care “did someone read it?” — like a library shelf or news tape: the message stays; readers choose where to start.

### Strengths

- Very high throughput  
- Long retention and replay for analytics / state rebuild  
- Event streaming, CDC, audit trails  

### When?

- High-volume events (clickstream, IoT, logs)  
- Need history and independent consumers  
- Enterprise-scale event-driven systems  

### Cost / complexity caveat

For a few thousand messages a day, Kafka is often **overkill**: RAM/disk, monitoring, partitions, schemas. Many mid-size apps live cheaper and simpler on Redis/RabbitMQ.

::: tip
Kafka is more an “event ledger” than a classic work queue. If you only want “run a job later,” try a simpler queue first.
:::

---

## Redis Streams — the fast courier

### Model

```
XADD → Stream → XREADGROUP (consumer group)
```

- A stream is a light log inside Redis  
- Consumer groups split work across workers  
- Fast (in-memory); durability depends on AOF/RDB and memory headroom  

**Vs Redis Pub/Sub:** Pub/Sub is fire-and-forget (weak persistence / no real replay). Streams aim at more reliable processing. Laravel’s default Redis queue is often list-based — conceptually different from Streams, but both give “background work.”

### Strengths

- Low latency; easy if Redis is already there  
- Cache + queue in one tool  
- Fits notifications, short jobs, moderate rates  

### When?

- Laravel/Horizon on Redis  
- Medium traffic, not Netflix-scale  
- You don’t want to run a Kafka cluster  

Limit: don’t assume Kafka-class retention/durability; take memory and HA seriously.

---

## Laravel and queues

Laravel’s default `ShouldQueue` model ≈ **work in a queue** (closer to Rabbit/Redis queues), not necessarily a Kafka event log.

### Dispatch + Job

```php
// dispatch
ProcessOrder::dispatch($order->id)->onQueue('orders');

// Job
class ProcessOrder implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $orderId) {}

    public function handle(OrderService $orders): void
    {
        $orders->fulfill($this->orderId);
    }
}
```

| Laravel need | Common choice |
|--------------|---------------|
| Simple background jobs (email, images, webhooks) | **Redis** + Horizon |
| Complex routing, strong ACK/DLX, multi-protocol | **RabbitMQ** |
| Event history, multi-service replay, analytics | **Kafka** (usually beyond plain `ShouldQueue`) |

Design `failed_jobs`, retries, timeouts, and idempotency separately — the broker doesn’t replace business logic.

Related: [Message Acknowledgment](/messaging/acknowledgment) · [Dead-Letter Queue](/messaging/dlq)

---

## Decision rule

```
Need event history / replay / huge fan-out?
  Yes → Kafka
  No  → Complex routing or precise ACK/DLX?
         Yes → RabbitMQ
         No  → Already on Redis / simple jobs?
                Yes → Redis queue / Streams
                No  → Usually still Redis or RabbitMQ; don’t reach for Kafka early
```

From the module outline:

1. **Simple background jobs** → Redis queue  
2. **Complex routing / precise ACK** → RabbitMQ  
3. **Enterprise event streaming** → Kafka  

Also weigh: ordering (per-queue vs per-partition), ops cost, and whether the message still has value after consume.

| If the message is… | Lean toward |
|--------------------|-------------|
| “Work; done after success” | Rabbit / Redis queue |
| “An event; I may read it again later” | Kafka (or Streams with conscious retention) |
| “Just deliver fast right now” | Redis Pub/Sub or a realtime channel |

---

## Antipatterns

- Bringing Kafka for 1,000 messages/day  
- Redis Streams/Pub for financial flows without durability/failover understanding  
- One broker for every SLO without measuring  
- Assuming “Laravel queue = exactly-once” without idempotent handlers  
- Long work inside a consumer without proper timeout/visibility  

---

## Mental drill

1. Send email after signup — which?  
2. Clickstream for recommendations with weekly replay — which?  
3. Live chat notifications; occasional loss OK — which?  

::: tip Hints
1. Redis/Rabbit · 2. Kafka · 3. Redis Pub/Sub or light Streams
:::
