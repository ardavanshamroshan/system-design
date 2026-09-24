# Dead-Letter Queue (DLQ) Explained

## چیست؟

وقتی پیامی **چندبار مصرف می‌شود و همیشه fail** می‌کند، آن را به صف جداگانه‌ای به نام **Dead-Letter Queue** می‌فرستی تا:

- صف اصلی را مسدود نکند  
- برای بررسی، هشدار و replay نگه داشته شود  

```
[Main Queue] --fail x N--> [DLQ] --> alert / manual replay
```

---

## چرا لازم است؟

بدون DLQ:

- پیام poison بارها retry می‌شود  
- consumerها مشغول می‌مانند  
- پیام‌های سالم پشت سر می‌مانند  

با DLQ: شکست‌ها ایزوله می‌شوند.

---

## سناریوهای رایج fail

| نوع | مثال |
|-----|------|
| دادهٔ نامعتبر | JSON خراب، فیلد اجباری نیست |
| باگ منطق | null pointer مکرر |
| وابستگی down | پرداخت‌یار موقتاً 500 می‌دهد |
| poison message | یک پیام خاص همیشه می‌ترکاند |

برای خطای موقتی → retry با backoff.  
برای خطای دائمی → بعد از N بار → DLQ.

---

## پیکربندی مفهومی

```yaml
# مثال ذهنی (RabbitMQ / SQS-like)
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

## بعد از رسیدن به DLQ چه کنیم؟

1. **متریک و آلرت** روی عمق DLQ  
2. لاگ correlation id / payload امن  
3. Fix باگ یا داده  
4. **Replay** کنترل‌شده به صف اصلی  
5. اگر بی‌ارزش است → archive / drop با دلیل

---

## ضدالگو

- DLQ بدون مانیتورینگ (= سطل زبالهٔ فراموش‌شده)  
- فرستادن همهٔ خطاها به DLQ از اولین fail (بدون retry)  
- replay کور همهٔ پیام‌ها بدون idempotent consumer

---

## قانون تصمیم

1. هر صف production باید سیاست retry + DLQ داشته باشد.  
2. موقتی ≠ دائمی؛ نوع exception را جدا کن.  
3. DLQ را مثل «صف بیمارستانی» مانیتور کن، نه آرشیو خاموش.
