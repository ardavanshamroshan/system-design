# Outbox Pattern (Database as Message Broker)

## مسئله

می‌خواهی بعد از ذخیره در DB، یک پیام به Kafka/RabbitMQ بفرستی:

```php
DB::transaction(function () {
    Order::create(...);
});
$bus->publish(new OrderCreated(...)); // اگر اینجا fail شود؟
```

اگر publish بعد از commit fail شود → رویداد از دست می‌رود.  
اگر قبل از commit publish کنی و بعد rollback شود → رویداد دروغین.

---

## ایدهٔ Outbox

داخل **همان تراکنش دیتابیس**:

1. دادهٔ اصلی را بنویس.  
2. رویداد را در جدول `outbox` بنویس.  
3. یک worker جدا ردیف‌های outbox را می‌خواند و به broker می‌فرستد.

```
[Service] --tx--> [orders] + [outbox]
                      ↓
              [Relay Worker] --> [Kafka/RabbitMQ]
```

دیتابیس موقتاً نقش «منبع حقیقت پیام» را بازی می‌کند.

---

## اسکیمای ساده

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

## Relay Worker

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

بهتر: publishing با **idempotent consumer** و علامت‌گذاری امن (مثلاً `FOR UPDATE SKIP LOCKED`).

---

## مزایا و هزینه‌ها

| مزیت | هزینه |
|------|-------|
| atomicity بین state و event | جدول outbox + worker |
| بدون dual-write ناامن | تأخیر کوتاه تا publish |
| ساده برای شروع | پاکسازی ردیف‌های قدیمی لازم است |

---

## ارتباط با Inbox

مصرف‌کننده می‌تواند جدول `inbox` داشته باشد تا همان event دو بار پردازش نشود (**at-least-once** + idempotency).

---

## قانون تصمیم

1. اگر «DB + پیام» باید با هم درست باشند → Outbox.  
2. اگر از دست رفتن گاه‌به‌گاه event قابل قبول است → شاید ساده publish کافی باشد (معمولاً نیست).  
3. CDC (مثل Debezium) نسخهٔ پیشرفته‌تر همان ایده‌است.
