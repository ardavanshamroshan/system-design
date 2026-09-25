# Dead-Letter Queue (DLQ) توضیح داده شد

## چیست؟

وقتی یک پیام **بارها در پردازش fail می‌شود**، آن را به صف جداگانه‌ای به نام **Dead-Letter Queue** می‌فرستی تا:

- صف اصلی را مسدود نکند  
- بتوانی alert بدهی، بررسی کنی و replay کنی  

```
[Main Queue] --fail x N--> [DLQ] --> alert / manual replay
```

---

## چرا لازم است

بدون DLQ:

- پیام‌های poison تا ابد retry می‌شوند  
- Consumerها مشغول می‌مانند  
- پیام‌های سالم پشت سرشان انباشته می‌شوند  

با DLQ: شکست‌ها ایزوله می‌شوند.

---

## سناریوهای رایج شکست

| نوع | مثال |
|-----|------|
| دادهٔ نامعتبر | JSON خراب، فیلد ضروری غایب |
| باگ منطق | null pointer تکراری |
| وابستگی down | Payment provider موقتاً ۵۰۰ برمی‌گرداند |
| Poison message | یک payload خاص همیشه crash می‌کند |

خطاهای موقت → retry با backoff.  
خطاهای دائمی → بعد از N تلاش → DLQ.

---

## کانفیگ مفهومی

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

## بعد از رسیدن پیام به DLQ

1. **Metrics و alert** روی عمق DLQ  
2. Log کردن correlation id / payload امن  
3. فیکس باگ یا داده  
4. **Replay** با احتیاط به صف اصلی  
5. اگر بی‌ارزش است → با دلیل archive / drop کن

---

## Antipatternها

- DLQ بدون monitoring (= سطل زبالهٔ فراموش‌شده)  
- فرستادن هر خطا به DLQ در اولین fail (بدون retry)  
- Replay کور همهٔ پیام‌ها بدون consumerهای idempotent

---

## قاعدهٔ تصمیم

1. هر صف production به سیاست retry + DLQ نیاز دارد.  
2. موقت ≠ دائمی؛ نوع exception را جدا کن.  
3. با DLQ مثل بخش بیمارستان رفتار کن — مانیتور کن، نادیده نگیر.
