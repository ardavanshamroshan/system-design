# Kafka, RabbitMQ, or Redis Streams?

## Ask the right question

“Which is best?” is the wrong question.  
Ask: what are the **traffic pattern, guarantees, ordering, and consumption model**?

---

## Quick comparison

| Criterion | Kafka | RabbitMQ | Redis Streams |
|-----------|-------|----------|---------------|
| Model | Distributed log | Classic message broker | Stream on Redis |
| Throughput | Very high | High (usually less than Kafka) | High at moderate scale |
| Retention | Long / replay | Usually until consumed | With MAXLEN / trim |
| Routing | Topic + partition | Very flexible exchanges | Key / consumer group |
| Ops complexity | Higher | Medium | Lower if you already run Redis |
| Strengths | Event streaming, analytics | Task queues, rich routing | Lightweight queues, realtime |

---

## Kafka — when?

- High event volume (clickstream, audit, CDC)  
- Need **replay** of history  
- Multiple independent consumers on one topic  
- Per-partition ordering matters

```
Producer → Topic(partitions) → Consumer Groups
```

::: tip
Kafka is more of an “event ledger” than a classic work queue.
:::

---

## RabbitMQ — when?

- Job queues with rich routing (topic/fanout/headers)  
- Priority, TTL, delayed messages  
- Diverse protocols (AMQP)  
- Request/reply patterns

```
Producer → Exchange → Queue → Consumer
```

---

## Redis Streams — when?

- Redis is already in the stack  
- You need simple consumer groups  
- Low latency at moderate scale  
- You don’t want to operate a Kafka cluster

```
XADD → Stream → XREADGROUP
```

Limitation: don’t assume Kafka-level durability/ops; HA Redis properly.

---

## Short decision table

| Your need | First pick |
|-----------|------------|
| Event sourcing / heavy analytics | Kafka |
| Job queue + rich routing | RabbitMQ |
| Light queue next to existing cache | Redis Streams |
| “Run a job later” in Laravel | Sometimes Redis/database queue is enough |

---

## Antipatterns

- Bringing Kafka for 1,000 messages/day  
- Using Redis Streams for financial systems without understanding durability  
- One broker for everything with no SLOs

---

## Decision rule

1. Write down volume + retention + replay needs.  
2. Be honest about team ops complexity.  
3. Start with the simplest tool that meets the SLO; upgrade later.
