# الگوی Outbox (دیتابیس به‌عنوان Message Broker)

## مسئله

می‌خواهی در DB ذخیره کنی، بعد به Kafka/RabbitMQ publish کنی:

```php
DB::transaction(function () {
    Order::create(...);
});
$bus->publish(new OrderCreated(...)); // اگر این fail شود چه؟
```

اگر بعد از commit، publish fail شود → event گم می‌شود.  
اگر قبل از commit publish کنی و بعد roll back شود → event دروغین.

---

## ایدهٔ Outbox

داخل **همان تراکنش دیتابیس**:

1. ردیف دامنه را بنویس.  
2. event را در جدول `outbox` بنویس.  
3. یک worker جدا ردیف‌های outbox را می‌خواند و به broker publish می‌کند.

```
[Service] --tx--> [orders] + [outbox]
                      ↓
              [Relay Worker] --> [Kafka/RabbitMQ]
```

دیتابیس موقتاً «منبع حقیقت» پیام‌ها می‌شود.

---

## Schema ساده

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

بهتر: publish با **consumerهای idempotent** و claim امن (مثلاً `FOR UPDATE SKIP LOCKED`).

---

## مزایا و هزینه‌ها

| مزیت | هزینه |
|------|-------|
| اتمیک بودن state و event | جدول outbox + worker |
| بدون dual-write ناامن | تأخیر کوتاه تا publish |
| شروع ساده | نیاز به cleanup ردیف‌های قدیمی |

---

## ارتباط با Inbox

Consumerها می‌توانند جدول `inbox` نگه دارند تا همان event دوبار پردازش نشود (**at-least-once** + idempotency).

---

## قاعدهٔ تصمیم

1. اگر «DB + پیام» باید با هم موفق شوند → Outbox.  
2. اگر گاهی گم شدن event قابل قبول است → publish ساده شاید کافی باشد (معمولاً نیست).  
3. CDC (مثلاً Debezium) شکل پیشرفته‌تر همین ایده است.
