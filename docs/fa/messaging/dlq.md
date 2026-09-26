# Dead-Letter Queue (DLQ)

> ماژول C — پیام‌رسانی و قابلیت اطمینان · بخش ۸

## فهرست ذهنی

1. [چیست و چرا](#چیست-و-چرا)  
2. [پیام‌های poison](#پیامهای-poison)  
3. [جریان اصلی](#جریان-اصلی)  
4. [الگوهای broker](#الگوهای-broker)  
5. [Laravel به‌عنوان DLQ](#laravel-بهمنوان-dlq)  
6. [بعد از DLQ](#بعد-از-dlq)  
7. [کی استفاده / کی نه](#کی-استفاده--کی-نه)  
8. [قانون تصمیم](#قانون-تصمیم)  
9. [ضدالگوها](#ضدالگوها)

---

## چیست و چرا

**Dead-Letter Queue (DLQ)** صف نگهداری پیام‌هایی است که **بعد از N تلاش** همچنان شکست می‌خورند. Broker (یا اپ) دیگر روی خط اصلی retry نمی‌کند و آن‌ها را کنار می‌گذارد تا:

- کار سالم بند نیاید  
- دادهٔ باارزش بی‌صدا گم نشود  
- بشود بررسی کرد، فیکس کرد و بعداً **replay** کرد  

اسم از *ادارهٔ نامهٔ مرده* پست می‌آید: نامهٔ غیرقابل‌تحویل را نه می‌سوزانی، نه می‌گذاری خط سورت را بند بیاورد.

```
Producer → MainQueue → Worker
                         │ success → ack / delete
                         │ fail → retry (backoff)
                         └ fail × N → FailedJobs_DLQ → alert / replay
```

مرتبط: [Acknowledgment](/fa/messaging/acknowledgment) · [Brokerها](/fa/messaging/brokers) · [Outbox](/fa/patterns/outbox)

---

## پیام‌های poison

**Poison message** پیامی است که هرچقدر retry کنی موفق نمی‌شود:

- Payload خراب / ناسازگاری schema  
- ارجاع به موجودیت حذف‌شده  
- باگ handler که همیشه throw می‌کند  

بدون DLQ یکی از سه بدی را انتخاب می‌کنی:

| انتخاب | هزینه |
|--------|--------|
| Retry ابدی | هدر CPU؛ روی صف مرتب → **head-of-line block** |
| Drop روی شکست | از دست رفتن بی‌صدای داده (سفارش، پرداخت، audit) |
| توقف consumer | یک رکورد بد کل سرویس را پایین می‌کشد |

DLQ این‌ها را جمع می‌کند به: **چند بار retry → پارک → alert → فیکس → replay**.

---

## جریان اصلی

```
fail_retry          → خطای موقت؛ release با backoff
max_tries_exceeded  → انتقال به FailedJobs_DLQ
manual_retry        → انسان / job بعد از فیکس علت، دوباره می‌فرستد
```

اجزایی که همیشه هست:

| قطعه | نقش |
|------|-----|
| **MainQueue** | کار عادی |
| **Worker** | پردازش؛ موفقیت → ack؛ شکست → nack/release |
| **سیاست retry / redrive** | سقف تلاش قبل از تسلیم (`maxReceiveCount`، `$tries`، …) |
| **FailedJobs_DLQ** | مقصد ایزوله + دلیل شکست |
| **Monitoring** | عمق > 0 → کسی را page کن |
| **مسیر replay** | بررسی → فیکس علت → تزریق دوباره (idempotent) |

آستانه tradeoff است، نه default:

- خیلی پایین (مثلاً ۱) → blip شبکه شبیه poison می‌شود  
- خیلی بالا → ظرفیت worker روی payload محکوم هدر می‌رود  

طوری تنظیم کن که شکست‌های موقت عادی پاک شوند؛ همان‌جا بایست.

---

## الگوهای broker

یک ایده؛ برچسب‌های مختلف.

### Amazon SQS — redrive policy

```json
{
  "deadLetterTargetArn": "arn:aws:sqs:...:orders-dlq",
  "maxReceiveCount": 5
}
```

بعد از `maxReceiveCount` دریافت بدون delete موفق → پیام به DLQ می‌رود. retentionِ DLQ را از صف مبدأ **بلندتر** نگه دار (صف‌های standard timestamp اصلی enqueue را نگه می‌دارند).

### RabbitMQ — dead-letter exchange (DLX)

```js
channel.assertQueue('orders', {
  arguments: {
    'x-dead-letter-exchange': 'orders.dlx',
    'x-message-ttl': 60000,
    'x-max-length': 10000
  }
});
```

دلایل dead-letter: reject/nack مصرف‌کننده (بدون requeue)، انقضای TTL، پر شدن طول صف، سقف delivery. Broker با `x-death` دلیل را مهر می‌زند.

### Kafka Connect / streams

رکوردهای بد را به یک **topic** DLQ بفرست تا pipeline زنده بماند؛ headerها را ببین؛ schema را فیکس کن؛ replay کن. پیام‌های سالم پشت poison pill گیر نمی‌کنند.

### Handler مفهومی

```php
try {
    $handler->handle($message);
    $message->ack();
} catch (RetryableException $e) {
    $message->nack(requeue: true);   // fail_retry
} catch (PermanentException $e) {
    $message->nack(requeue: false);  // → مسیر DLQ
}
```

---

## Laravel به‌عنوان DLQ

در Laravel، **`failed_jobs` + `queue:failed` / `queue:retry`** نقش DLQ را دارند.

| نتیجه | اثر |
|-------|-----|
| `handle()` OK | Job حذف می‌شود (ack ضمنی) |
| Exception، هنوز tries باقی است | Release / retry (`fail_retry`) |
| سقف tries / `$this->fail()` | ردیف در `failed_jobs` ≈ **FailedJobs_DLQ** |
| `queue:retry {id}` | **manual_retry** به MainQueue |

```bash
php artisan queue:failed
php artisan queue:retry {id}
php artisan queue:flush   # خطر — پاک کردن DLQ
```

```php
// config/queue.php — حداکثر ماندن job رزروشده قبل از گرفتن توسط worker دیگر
'retry_after' => 90,
```

```php
class ChargeCard implements ShouldQueue
{
    public int $tries = 5;
    public int $maxExceptions = 3;

    public function retryUntil(): \DateTime
    {
        return now()->addMinutes(30);
    }

    public function backoff(): array
    {
        return [10, 30, 60];
    }

    public function handle(): void
    {
        // handler را idempotent نگه دار — replay از failed_jobs باید امن باشد
    }

    public function failed(\Throwable $e): void
    {
        // alert: Horizon / Sentry / Slack
    }
}
```

دکمه‌هایی که به سیاست DLQ broker نگاشت می‌شوند: `$tries`، `$maxExceptions`، `retryUntil()`، `backoff()`، `retry_after`، متریک‌های failed در Horizon.

---

## بعد از DLQ

1. **Alert** روی عمق DLQ / `failed_jobs` (Horizon، Sentry، CloudWatch، …)  
2. Log کردن correlation id + payload امن + دلیل شکست  
3. فیکس باگ، داده، یا وابستگی  
4. **Replay** با consumerهای idempotent (`queue:retry`، SQS redrive، …)  
5. اگر بی‌ارزش است → با دلیل صریح archive / drop  

DLQ **فرودگاه** است، نه درمان. جملهٔ Azure همه‌جا صدق می‌کند: پیام‌ها می‌مانند تا **تو** آن‌ها را برداری.

---

## کی استفاده / کی نه

**استفاده وقتی**

- کار async روی صف/استریم می‌تواند برای همیشه fail شود  
- گم شدن پیام درد دارد (پول، سفارش، audit)  
- ترافیک سالم باید جاری بماند (مخصوصاً صف‌های مرتب)  
- واقعاً بررسی و replay می‌کنی  

**رد شو یا دوباره فکر کن وقتی**

- شکست‌ها تقریباً همیشه موقت‌اند → ابزار اصلی retry/backoff است؛ DLQ فقط پشتیبان  
- پیام را می‌شود دور انداخت (متریک best-effort)  
- **هیچ‌کس DLQ را نگاه نمی‌کند** → از دست رفتن بی‌صدا با مراحل اضافه  
- کل downstream down است → Circuit Breaker / توقف مصرف؛ DLQ را با پیام‌های «خوب» سیل نکن  
- ترتیب end-to-end مقدس است → کنار گذاشتن ترتیب را می‌شکند؛ هزینه را بدان  

---

## قانون تصمیم

```
آیا این پیام طوری fail می‌شود که retry هرگز درستش نمی‌کند؟
  و گم شدنش درد دارد؟
    بله → MainQueue + retry/backoff + FailedJobs_DLQ + alerting
    فقط موقت → retry/backoff؛ DLQ به‌عنوان پشتیبان
    Loss OK → در شکست نهایی دور بینداز

DLQ بدون alerting = سطل زبالهٔ بی‌فایده
Replay قبل از فیکس علت = retry ابدی، فقط کندتر
```

از outline ماژول:

1. بعد از N شکست → روی DLQ پارک کن؛ MainQueue را بند نیاور  
2. Laravel: `failed_jobs` + `queue:failed` / `queue:retry`  
3. **همیشه** failed job را مانیتور کن (Horizon / Sentry)  
4. Replay فقط بعد از فیکس علت + handler idempotent  

---

## ضدالگوها

- DLQ بدون owner و بدون alarm  
- `maxReceiveCount` / `$tries = 1` روی شبکهٔ ناپایدار  
- `queue:retry` / redrive کور قبل از فیکس باگ  
- سیل outage را poison فرض کردن (از circuit breaker استفاده کن)  
- retentionِ DLQ کوتاه‌تر از مبدأ (مخصوصاً timestamp اصلی SQS)  
- برگرداندن DLQ به همان مسیر شکست‌خورده (حلقهٔ retry)  
- ادعای امنیت چون «DLQ داریم» در حالی که کسی نگاه نمی‌کند  

---

## تمرین ذهنی

1. Payment provider ده دقیقه down است — همهٔ jobها به سقف tries می‌رسند. واکنش اول: بالا بردن `$tries` یا توقف مصرف؟  
2. باگ schema را فیکس کردی؛ ۴۰۰۰ ردیف در `failed_jobs` است. قبل از `queue:retry all` چه چیزی باید درست باشد؟  
3. صف اصلی SQS چهار روز نگه می‌دارد؛ DLQ یک روز. چرا پیام ممکن است درست بعد از ورود به DLQ ناپدید شود؟  

::: tip راهنمایی
1. Circuit breaker / pause — نه poison · 2. علت فیکس شده + handler idempotent · 3. timestamp اصلی enqueue هنوز حساب می‌شود؛ retentionِ DLQ باید بلندتر باشد
:::
