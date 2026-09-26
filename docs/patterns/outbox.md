# Outbox Pattern (Database as Message Broker)

> Module C — Messaging & Reliability · Section 9

## Mental outline

1. [What and why](#what-and-why)  
2. [Dual-write hell](#dual-write-hell)  
3. [Outbox flow](#outbox-flow)  
4. [Schema + Laravel write](#schema--laravel-write)  
5. [Relay worker (polling)](#relay-worker-polling)  
6. [CDC / log tailing](#cdc--log-tailing)  
7. [At-least-once + Inbox](#at-least-once--inbox)  
8. [Ops: growth, order, cleanup](#ops-growth-order-cleanup)  
9. [When to use / skip](#when-to-use--skip)  
10. [Decision rule](#decision-rule)  
11. [Antipatterns](#antipatterns)

---

## What and why

You need **DB state and an external message** to stay in sync: create an order *and* notify inventory; signup *and* enqueue a verify-email job.

A single ACID transaction cannot span your database **and** Kafka/RabbitMQ. So the naive path is a **dual write** — and dual writes break.

**Outbox** flips the problem: in the **same local DB transaction**, write the business row **and** an outbox row. A separate relay later publishes to the broker. The database temporarily *is* the message broker.

Tradeoff: disk write + short delay, for **consistency over raw publish latency**.

```
API ──tx──► DB (orders + outbox)
                    │
              Worker polls / CDC
                    ▼
                 Broker ──► consumers
```

Related: [Acknowledgment](/messaging/acknowledgment) · [Brokers](/messaging/brokers) · [DLQ](/messaging/dlq)

---

## Dual-write hell

```php
DB::transaction(function () {
    Order::create(...);
});
$bus->publish(new OrderCreated(...)); // what if this fails?
```

| Order of failure | Result |
|------------------|--------|
| Commit OK, publish fails | State exists; event lost (warehouse never hears) |
| Publish OK, then rollback | False event; consumers act on nothing |
| Broker down at signup | User row created; email task never enlisted |

Health-checks on the broker before insert only add complexity and still race. Distributed 2PC across DB + broker blocks, amplifies latency, and does not scale.

Signup example: user row in DB + “send verify email” must be atomic. If MQ is down and you only publish after insert, you get a **partial transaction**. Outbox puts the email task in the same DB as the user — then a worker (or CDC) moves it to the broker when ready.

---

## Outbox flow

```
begin
  insert orders
  insert outbox
commit
─── later ───
read unpublished outbox
publish to broker
mark published
```

| Piece | Role |
|-------|------|
| **API / service** | Business write + outbox insert in one tx |
| **outbox table** | Durable intent to notify (local queue) |
| **Relay worker** | Poll (or CDC) → publish → mark done |
| **Broker** | Fan-out to consumers |
| **Consumers** | Must be **idempotent** (duplicates happen) |

Why this is not an anti-pattern: you *are* paying for an extra durable write. Brokers often keep hot data in memory; disk is slower. You buy the guarantee that **if the business row committed, the intent to publish committed too**. Lost messages after that are worker/broker problems you can retry — not silent divergence.

---

## Schema + Laravel write

```sql
CREATE TABLE outbox_messages (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  type          VARCHAR(128) NOT NULL,
  payload       JSON NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at  TIMESTAMP NULL,
  INDEX idx_unpublished (published_at, id)
);
```

Richer variants add `aggregate_type` / `aggregate_id` for ordering and replay by entity.

```php
DB::transaction(function () use ($data) {
    $order = Order::create($data);

    OutboxMessage::create([
        'type' => 'order.created',
        'payload' => ['order_id' => $order->id],
    ]);
});
```

Same shape for signup: insert user + outbox email task in one transaction. Broker health no longer gates the write path.

---

## Relay worker (polling)

Scheduled command / loop: fetch unpublished rows, publish, mark.

```php
OutboxMessage::query()
    ->whereNull('published_at')
    ->orderBy('id')
    ->limit(100)
    ->get()
    ->each(function (OutboxMessage $msg) {
        // Kafka produce, Rabbit publish, or Laravel event bus
        event(new OrderCreated($msg->payload['order_id']));
        $msg->update(['published_at' => now()]);
    });
```

Production hardening:

- Claim with `FOR UPDATE SKIP LOCKED` so multiple workers do not double-grab  
- Publish **then** mark — crash between them → duplicate publish (see Inbox)  
- Index `published_at IS NULL` (+ `id`) so the poll stays cheap  
- Interval is your eventual-consistency bound (e.g. 1s is fine for many apps)

Polling wins on **operational simplicity**. No binlog expertise. Shopify-style background jobs often use this for email/analytics/integrations.

---

## CDC / log tailing

Every DB keeps a transaction log (WAL / binlog / redo). **Change Data Capture** (e.g. Debezium) tails that log and emits outbox (or table) changes to Kafka — no poll loop.

| Guarantee | Notes |
|-----------|--------|
| Commit order | Events leave in DB commit order |
| No loss of committed work | Log is the durability stream |
| Low latency | Often milliseconds after commit |

Use when order and lag matter (billing, booking sequences). Failover resumes from last log position. Cost: connector ops, DB privileges, expertise.

Both strategies are Outbox: **local tx for write**, **async path for broker**.

---

## At-least-once + Inbox

Outbox gives **at-least-once** publish, not exactly-once:

1. Worker reads row  
2. Publishes to broker (ack)  
3. Crashes before `published_at`  
4. Restart republishes the same event  

Duplicates are recoverable; silent loss is not. Consumers must be idempotent (`idempotency_key`, unique constraints, “process once” tables).

**Inbox** on the consumer side:

```
receive event
  if event_id in inbox → ignore
  else in one tx: handle business + insert inbox(event_id)
```

Outbox (producer) + Inbox (consumer) ≈ end-to-end **effectively once**. Pair with [ack / delivery semantics](/messaging/acknowledgment).

---

## Ops: growth, order, cleanup

**Table growth** — unbounded outbox kills indexed polls and backups.

| Strategy | When |
|----------|------|
| Delete after publish | No audit need |
| Archive to cold storage | Compliance / replay |
| Partition by day + drop old | High volume |

**Ordering** — CDC ≈ total commit order. Polling ≈ order by `id` / `created_at`; concurrent commits can surprise you. For strict per-aggregate order: key by `booking_id` / `order_id` and partition the broker topic the same way.

**Monoliths** — same pattern for webhooks, internal buses, email. Reliability is not microservices-only.

**Saga / Event Sourcing** — complementary, not rivals: Outbox publishes saga step events reliably; full event sourcing stores *all* state as events. Outbox is “event sourcing lite” when current-state tables still dominate queries.

---

## When to use / skip

**Use when**

- DB write + external notification must not diverge  
- Broker / consumer can be down while writes continue  
- Money, orders, fulfillment, compliance care about the event  

**Skip or rethink when**

- Message is best-effort (lossy metrics) and dual-write failure is fine  
- You already stream the same change via CDC from the domain table (careful with semantics)  
- You refuse to run a relay / CDC and will not monitor lag  

---

## Decision rule

```
Must “DB state + external message” be atomic?
  Yes → Outbox (local tx) + relay/CDC
       + idempotent consumers (Inbox if needed)
  Loss OK → plain publish after commit (know the risk)

Never: dual-write without a recovery story
Never: 2PC across DB + broker as the default
```

From the module outline:

1. Same tx: domain row + outbox row  
2. Worker (or CDC) publishes; mark published  
3. Consumers: at-least-once → idempotent / Inbox  
4. Clean up or partition the outbox table  

---

## Antipatterns

- Publish to broker inside the business transaction “for simplicity”  
- Mark published **before** broker ack (loss window)  
- No idempotency on consumers (duplicate charges / emails)  
- Outbox with no lag / depth monitoring  
- Never deleting or archiving published rows  
- Expecting polling Outbox to give global total order without care  
- Treating Outbox as a substitute for fixing a broken consumer (see [DLQ](/messaging/dlq))  

---

## Mental drill

1. Order commits; relay publishes; process dies before `published_at`. What must the email consumer already do?  
2. MQ is down for 20 minutes. With Outbox, what still works? What piles up?  
3. Polling every 5s vs Debezium — pick one for “booking confirmed then payment authorized” strict order. Why?

::: tip Hints
1. Idempotent / Inbox — duplicate publish is normal · 2. Signups/orders commit; unpublished outbox grows; relay drains when MQ returns · 3. CDC (or carefully keyed partitions) — polling alone is weaker on total order
:::
