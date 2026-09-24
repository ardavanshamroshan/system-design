# Outbox Pattern (Database as Message Broker)

## The problem

You want to save to the DB, then publish to Kafka/RabbitMQ:

```php
DB::transaction(function () {
    Order::create(...);
});
$bus->publish(new OrderCreated(...)); // what if this fails?
```

If publish fails after commit → the event is lost.  
If you publish before commit and then roll back → a false event.

---

## Outbox idea

Inside the **same database transaction**:

1. Write the domain row.  
2. Write the event into an `outbox` table.  
3. A separate worker reads outbox rows and publishes to the broker.

```
[Service] --tx--> [orders] + [outbox]
                      ↓
              [Relay Worker] --> [Kafka/RabbitMQ]
```

The database temporarily acts as the “source of truth” for messages.

---

## Simple schema

```sql
CREATE TABLE outbox (
  id            BIGINT PRIMARY KEY AUTO_INCREMENT,
  aggregate_type VARCHAR(64) NOT NULL,
  aggregate_id   VARCHAR(64) NOT NULL,
  event_type     VARCHAR(128) NOT NULL,
  payload        JSON NOT NULL,
  created_at     TIMESTAMP NOT NULL,
  processed_at   TIMESTAMP NULL
);
```

```php
DB::transaction(function () use ($order) {
    $order->save();

    DB::table('outbox')->insert([
        'aggregate_type' => 'order',
        'aggregate_id'   => $order->id,
        'event_type'     => 'order.created',
        'payload'        => json_encode($order->toEvent()),
        'created_at'     => now(),
    ]);
});
```

---

## Relay worker

```php
$batch = DB::table('outbox')
    ->whereNull('processed_at')
    ->orderBy('id')
    ->limit(100)
    ->get();

foreach ($batch as $row) {
    $bus->publish($row->event_type, json_decode($row->payload, true));
    DB::table('outbox')->where('id', $row->id)->update([
        'processed_at' => now(),
    ]);
}
```

Better: publish with **idempotent consumers** and safe claiming (e.g. `FOR UPDATE SKIP LOCKED`).

---

## Pros and costs

| Upside | Cost |
|--------|------|
| Atomicity between state and event | Outbox table + worker |
| No unsafe dual-write | Short delay until publish |
| Simple to start | Need cleanup of old rows |

---

## Relation to Inbox

Consumers can keep an `inbox` table so the same event isn’t processed twice (**at-least-once** + idempotency).

---

## Decision rule

1. If “DB + message” must succeed together → Outbox.  
2. If occasional event loss is acceptable → plain publish might be enough (usually it isn’t).  
3. CDC (e.g. Debezium) is a more advanced form of the same idea.
