# الگوهای Message Acknowledgment

## ایده

وقتی consumer پیامی برمی‌دارد، باید به broker بگوید: «تمام شد» یا «نه — requeue / بفرست به DLQ.»

این سیگنال **Acknowledgment (Ack)** است.

---

## سه الگوی اصلی تحویل

| الگو | معنی | ریسک |
|------|------|------|
| **At-most-once** | حداکثر یک‌بار؛ ممکن است گم شود | پیام از دست‌رفته |
| **At-least-once** | حداقل یک‌بار؛ ممکن است تکراری شود | پردازش تکراری |
| **Exactly-once** | دقیقاً یک‌بار (سخت end-to-end) | پیچیدگی بالا |

بیشتر سیستم‌ها **at-least-once + consumerهای idempotent** می‌سازند.

---

## Auto-Ack در برابر Manual Ack

### Auto-Ack

پیام به‌محض تحویل ack می‌شود.

```
Deliver → (auto ack) → Process
```

اگر وسط پردازش بمیری → پیام رفته (**at-most-once**).

### Manual Ack

بعد از پردازش موفق ack می‌کنی.

```
Deliver → Process → Ack
         ↘ fail → Nack / requeue / DLQ
```

اگر قبل از ack بمیری → پیام برمی‌گردد (**at-least-once**).

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

## Idempotency — همراه ضروری برای at-least-once

چون پیام ممکن است دو بار برسد:

```php
if (Inbox::alreadyProcessed($eventId)) {
    return; // ack and done
}
DB::transaction(function () use ($event) {
    apply($event);
    Inbox::markProcessed($event->id);
});
```

کلیدهای رایج: `event_id`، `idempotency-key` در API، unique constraint.

---

## Ack دیرهنگام و prefetch

اگر prefetch بالا باشد و ack دیر بیاید:

- یک consumer کند پیام‌های زیادی را نگه می‌دارد  
- بقیه بیکار می‌مانند  

تنظیمات مهم: `prefetch / qos`، visibility timeout (SQS)، حداکثر زمان پردازش.

---

## مقایسهٔ کوتاه

| حالت | کی |
|------|-----|
| Auto-ack | لاگ‌های غیرحیاتی که گم شدنشان مهم نیست |
| Manual ack + retry | بیشتر jobها و eventهای بیزنس |
| ادعای «Exactly-once» | فقط با تراکنش واقعی / idempotency اعتماد کن |

---

## قاعدهٔ تصمیم

1. دادهٔ مهم → manual ack + at-least-once.  
2. همیشه برای duplicate آماده باش (idempotent).  
3. prefetch را با ظرفیت واقعی consumer تنظیم کن.
