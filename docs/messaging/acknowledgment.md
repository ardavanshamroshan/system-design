# Message Acknowledgment Patterns

## ایده

وقتی consumer پیامی را می‌گیرد، باید به broker بگوید: «کارم باهاش تمام شد» یا «نه، برگردان/به DLQ بفرست».

این سیگنال همان **Acknowledgment (Ack)** است.

---

## سه الگوی اصلی

| الگو | معنی | ریسک |
|------|------|------|
| **At-most-once** | حداکثر یک‌بار؛ ممکن است از دست برود | از دست رفتن پیام |
| **At-least-once** | حداقل یک‌بار؛ ممکن است تکراری برسد | پردازش تکراری |
| **Exactly-once** | دقیقاً یک‌بار (معمولاً end-to-end سخت) | پیچیدگی بالا |

در عمل بیشتر سیستم‌ها **at-least-once + idempotent consumer** می‌سازند.

---

## Auto-Ack در برابر Manual Ack

### Auto-Ack

به محض deliver، پیام ack می‌شود.

```
Deliver → (auto ack) → Process
```

اگر process وسطش بمیرد → پیام از دست می‌رود (**at-most-once**).

### Manual Ack

بعد از پردازش موفق ack می‌کنی.

```
Deliver → Process → Ack
         ↘ fail → Nack / requeue / DLQ
```

اگر قبل از ack بمیری → پیام دوباره می‌آید (**at-least-once**).

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

## Idempotency — همراه ضروری at-least-once

چون پیام ممکن است دوبار برسد:

```php
if (Inbox::alreadyProcessed($eventId)) {
    return; // ack و تمام
}
DB::transaction(function () use ($event) {
    apply($event);
    Inbox::markProcessed($event->id);
});
```

کلیدهای رایج: `event_id`, `idempotency-key` در API، unique constraint.

---

## Ack دیرهنگام و Prefetch

اگر prefetch بالا باشد و ack دیر بدهی:

- یک consumer کند، پیام‌های زیاد را نگه می‌دارد  
- بقیه بیکار می‌مانند  

تنظیمات مهم: `prefetch / qos`, timeout visibility (SQS), max processing time.

---

## مقایسهٔ کوتاه

| حالت | چه زمانی |
|------|----------|
| Auto-ack | لاگ‌های غیرحیاتی، قابل از دست رفتن |
| Manual ack + retry | اکثر jobها و رویدادهای کسب‌وکار |
| Exactly-once ادعا | فقط با تراکنش/idempotency واقعی باور کن |

---

## قانون تصمیم

1. دادهٔ مهم → manual ack + at-least-once.  
2. همیشه برای تکرار آماده باش (idempotent).  
3. prefetch را با ظرفیت واقعی consumer تنظیم کن.
