# الگوهای Message Acknowledgment

> ماژول C — پیام‌رسانی و قابلیت اطمینان · بخش ۷

## فهرست ذهنی

1. [چیست و چرا](#چیست-و-چرا)  
2. [تضمین‌های تحویل](#تضمینهای-تحویل)  
3. [Auto-Ack در برابر Manual Ack](#auto-ack-در-برابر-manual-ack)  
4. [مدل‌های ack در brokerها](#مدلهای-ack-در-brokerها)  
5. [صف‌های Laravel](#صفهای-laravel)  
6. [Idempotency](#idempotency--همراه-ضروری)  
7. [Ack دیرهنگام و prefetch](#ack-دیرهنگام-و-prefetch)  
8. [قانون تصمیم](#قانون-تصمیم)  
9. [ضدالگوها](#ضدالگوها)

---

## چیست و چرا

**Acknowledgment (Ack)** یعنی consumer به broker بگوید:

> «این پیام را درست خوردم — حذفش کن / offset را جلو ببر.»

بدون مسیر ack درست:

- Crash وسط کار → پیام **گم** می‌شود (ack خیلی زود)، یا  
- Crash / timeout → پیام **بی‌نهایت تکرار** می‌شود (هرگز ack نشد)

```
Deliver → Process → Ack  → broker پیام را آزاد می‌کند
                 ↘ fail → Nack / release / DLQ
```

Ack مفهوم **سمت consumer** است. سمت producer، «موفق بودن `publish`/`send`» یعنی فقط ارسال قبول شد — نه اینکه کسی کار را تمام کرده باشد.

مرتبط: [Brokerها](/fa/messaging/brokers) · [Dead-Letter Queue](/fa/messaging/dlq) · [Outbox](/fa/patterns/outbox)

---

## تضمین‌های تحویل

| الگو | معنی | ریسک رایج |
|------|------|-----------|
| **At-most-once** | حداکثر یک‌بار؛ ممکن است نرسد | پیام از دست‌رفته |
| **At-least-once** | حداقل یک‌بار؛ ممکن است تکراری شود | اثر جانبی تکراری |
| **Exactly-once** | دقیقاً یک‌بار end-to-end | خیلی سخت؛ پیچیدگی بالا |

واقعیت:

- **At-most-once** ≈ fire-and-forget / auto-ack قبل از اتمام کار  
- **At-least-once** ≈ manual ack بعد از موفقیت + redelivery بعد از crash  
- **Exactly-once** واقعی نادر است. بیشتر تیم‌ها به **effectively once** می‌رسند:  
  **تحویل at-least-once + consumer idempotent** (+ اغلب [transactional outbox](/fa/patterns/outbox))

```
At-most-once:   Deliver → (ack) → Process     // مرگ در Process → پیام رفته
At-least-once:  Deliver → Process → Ack       // مرگ قبل از Ack → retry
Effectively once: At-least-once + handler idempotent (+ در صورت نیاز outbox)
```

---

## Auto-Ack در برابر Manual Ack

### Auto-Ack

Broker به‌محض تحویل (یا وقتی `receive` / `onMessage` برمی‌گردد) پیام را تمام‌شده می‌داند — **قبل** از اینکه منطق بیزنس اثبات شود.

```
Deliver → (auto ack) → Process
```

اگر worker وسط پردازش بمیرد → پیام رفته → **at-most-once**.

فقط وقتی loss قابل قبول است (لاگ غیرحیاتی، سیگنال ephemeral، scrape متریک).

### Manual Ack

بعد از پردازش موفق ack می‌کنی. شکست → nack / release / DLQ.

```
Deliver → Process → Ack
         ↘ fail → Nack / requeue / DLQ
```

Crash قبل از ack → broker دوباره می‌دهد → **at-least-once**.

```php
$msg = $channel->wait();
try {
    process($msg->body);
    $channel->ack($msg);
} catch (Throwable $e) {
    $channel->nack($msg, requeue: shouldRetry($e));
}
```

| حالت | کی |
|------|-----|
| Auto-ack | گم شدن OK؛ حداکثر سرعت |
| Manual ack + retry | event بیزنس، job، پول |
| ادعای «Exactly-once» | فقط با تراکنش واقعی + idempotency |

---

## مدل‌های ack در brokerها

یک ایده؛ APIهای مختلف.

### صف کلاسیک (RabbitMQ / AMQP)

- بعد از موفقیت: `basic.ack`  
- شکست: `basic.nack` / `reject` با `requeue` یا مسیر DLX → [DLQ](/fa/messaging/dlq)  
- Prefetch (`qos`) تعداد پیام‌های unacked هر consumer را محدود می‌کند  

### حالت‌های JMS (نگاشت مفهومی)

| حالت | رفتار | تقریباً معادل |
|------|--------|----------------|
| `AUTO_ACKNOWLEDGE` | Session خودش ack می‌کند | Auto-ack (sync: قبل از return؛ async: بعد از listener) |
| `DUPS_OK_ACKNOWLEDGE` | Ack تنبل / دسته‌ای | سریع‌تر؛ بعد از crash duplicate بیشتر |
| `CLIENT_ACKNOWLEDGE` | خودت `acknowledge()` می‌زنی | Manual؛ اغلب پیام‌های قبلی session هم ack می‌شوند |
| Transacted session | `commit` / `rollback` به‌عنوان واحد کار | Ack دسته‌ای / recover |

Crash کلاینت با پیام‌های unacked → recover session → redelivery.

### Redis Streams (PEL + XACK)

Consumer group یک **Pending Entry List (PEL)** نگه می‌دارد:

```
1. XREADGROUP  → پیام در PEL ثبت می‌شود
2. process
3. XACK        → از PEL حذف می‌شود
4. crash قبل از XACK → در PEL می‌ماند → reclaim (XAUTOCLAIM / XCLAIM)
```

با `XPENDING` تعداد delivery را ببین؛ بعد از N شکست → به DLQ ببر و بعد `XACK` تا از PEL خارج شود.

### Kafka

Consumerها **offset** را جلو می‌برند. Commit بعد از پردازش ≈ ack. Commit زود ≈ at-most-once؛ Commit بعد از موفقیت ≈ at-least-once داخل group.

### صف‌های ابری (مثلاً SQS)

Visibility timeout مثل lease نرم است: اگر در مهلت delete/ack نکنی، پیام دوباره دیده می‌شود (at-least-once).

---

## صف‌های Laravel

Worker صف Laravel مستقیم روی معناشناسی ack می‌نشیند:

| نتیجه | اثر روی صف |
|-------|------------|
| `handle()` موفق برگردد | **Ack ضمنی** — job حذف می‌شود |
| Exception بدون catch | **Release / retry** (tries + backoff) |
| `$this->fail()` یا max tries | **failed_jobs** ≈ معنای DLQ |

```php
class ChargeCard implements ShouldQueue
{
    public int $tries = 5;

    public function backoff(): array
    {
        return [10, 30, 60];
    }

    public function handle(): void
    {
        // idempotency key — پرداخت تکراری نشود
        $payment = Payment::query()->firstOrCreate(
            ['idempotency_key' => $this->key],
            ['order_id' => $this->orderId, 'status' => 'pending']
        );

        if ($payment->status === 'paid') {
            return; // already processed = مسیر امن ack
        }

        $gateway->charge($this->orderId);
        $payment->update(['status' => 'paid']);
    }

    public function failed(\Throwable $e): void
    {
        // alert / رفتار شبیه DLQ
    }
}
```

تنظیمات مهم: `$tries`، `backoff()`، `$timeout`، supervisorهای Horizon، مانیتور `failed_jobs` — همان پیچ‌های manual ack + DLQ.

---

## Idempotency — همراه ضروری

At-least-once زیر crash، timeout یا reclaim **تکرار می‌کند**. Handler باید تحمل duplicate داشته باشد.

```php
if (Inbox::alreadyProcessed($eventId)) {
    return; // ack و تمام
}

DB::transaction(function () use ($event) {
    apply($event);
    Inbox::markProcessed($event->id);
});
```

کلیدهای رایج: `event_id`، `idempotency-key` در API، unique constraint، upsert (`ON CONFLICT DO NOTHING`).

عملیات ذاتاً idempotent (وضعیت = paid) بهتر از عملیات غیرidempotent (افزایش موجودی) است مگر با کلید محافظت شود.

---

## Ack دیرهنگام و prefetch

اگر prefetch / leaseهای in-flight بالا باشد و ack دیر بیاید:

- یک consumer کند پیام‌های زیادی را **نگه** می‌دارد  
- بقیه بیکار می‌مانند  
- Visibility timeout تمام می‌شود → redelivery غافلگیرکننده  

پیچ‌ها: `prefetch` / `qos`، visibility timeout در SQS، آستانه idle در `XAUTOCLAIM`، `$timeout` در Laravel و `maxProcesses` در Horizon.

قاعده سرانگشتی: prefetch ≈ چیزی که یک worker قبل از انقضای lease تمام می‌کند.

---

## قانون تصمیم

```
گم شدن قابل قبول است؟
  بله → at-most-once / auto-ack
  خیر → at-least-once + manual ack (یا مسیر موفق Laravel)
         + consumer idempotent
         + retry/backoff
         + DLQ / failed_jobs بعد از N تلاش

مالی / پول / موجودی؟
  → همیشه at-least-once + idempotent
  → هرگز «دقیقاً یک‌بار» را بدون outbox/tx + کلید قول نده
```

از outline ماژول:

1. دادهٔ مهم → **manual ack / موفقیت Laravel = ack** + at-least-once  
2. همیشه برای **duplicate** آماده باش (idempotent)  
3. consumerهای مالی → **at-least-once + idempotent**؛ «exactly once» فقط با مکانیزم جانبی  
4. prefetch / visibility را با ظرفیت واقعی تنظیم کن  

---

## ضدالگوها

- Auto-ack روی job پرداخت / سفارش / موجودی  
- ادعای «exactly-once» فقط چون بروشور broker گفته  
- Ack قبل از commit اثر جانبی (نوشتن DB، شارژ gateway)  
- Retry بی‌نهایت بدون max tries / DLQ  
- Prefetch بزرگ + job طولانی → مسدود شدن صف و redelivery کاذب  
- Replay کور از DLQ بدون consumerهای idempotent  

---

## تمرین ذهنی

1. بعد از شارژ کارت و قبل از ack جاب، crash — چه چیزی باید درست باشد؟  
2. شمارندهٔ متریک می‌تواند ۰٫۱٪ رویداد را از دست بدهد — کدام حالت؟  
3. Worker ردیس وسط `handle` می‌میرد (consumer group) — پیام کجاست؟  

::: tip راهنمایی
1. Idempotency key / چک وضعیت paid · 2. At-most-once / auto-ack · 3. تا XACK یا reclaim در PEL می‌ماند
:::
