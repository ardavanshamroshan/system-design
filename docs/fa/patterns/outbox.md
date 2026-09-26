# الگوی Outbox (دیتابیس به‌عنوان Message Broker)

> ماژول C — پیام‌رسانی و قابلیت اطمینان · بخش ۹

## فهرست ذهنی

1. [چیست و چرا](#چیست-و-چرا)  
2. [جهنم dual-write](#جهنم-dual-write)  
3. [جریان Outbox](#جریان-outbox)  
4. [Schema + نوشتن Laravel](#schema--نوشتن-laravel)  
5. [Relay worker (polling)](#relay-worker-polling)  
6. [CDC / دنبال کردن لاگ](#cdc--دنبال-کردن-لاگ)  
7. [At-least-once + Inbox](#at-least-once--inbox)  
8. [عملیات: رشد، ترتیب، پاکسازی](#عملیات-رشد-ترتیب-پاکسازی)  
9. [کی استفاده / کی نه](#کی-استفاده--کی-نه)  
10. [قانون تصمیم](#قانون-تصمیم)  
11. [ضدالگوها](#ضدالگوها)

---

## چیست و چرا

باید **state دیتابیس و یک پیام بیرونی** هم‌تراز بمانند: سفارش بسازی *و* انبار خبردار شود؛ signup کنی *و* جاب تأیید ایمیل enqueue شود.

یک تراکنش ACID نمی‌تواند هم‌زمان DB تو و Kafka/RabbitMQ را بپوشاند. مسیر ساده‌لوحانه **dual write** است — و dual write می‌شکند.

**Outbox** مسئله را برمی‌گرداند: داخل **همان تراکنش محلی DB**، ردیف دامنه **و** ردیف outbox را بنویس. یک relay جدا بعداً به broker publish می‌کند. دیتابیس موقتاً *همان* message broker است.

Tradeoff: نوشتن روی دیسک + تأخیر کوتاه، به‌جای تأخیر خام publish — **consistency روی efficiency**.

```
API ──tx──► DB (orders + outbox)
                    │
              Worker polls / CDC
                    ▼
                 Broker ──► consumers
```

مرتبط: [Acknowledgment](/fa/messaging/acknowledgment) · [Brokerها](/fa/messaging/brokers) · [DLQ](/fa/messaging/dlq)

---

## جهنم dual-write

```php
DB::transaction(function () {
    Order::create(...);
});
$bus->publish(new OrderCreated(...)); // اگر این fail شود چه؟
```

| ترتیب شکست | نتیجه |
|------------|--------|
| Commit OK، publish fail | State هست؛ event گم (انبار خبر ندارد) |
| Publish OK، بعد rollback | Event دروغین؛ consumer روی هیچ عمل می‌کند |
| Broker هنگام signup پایین | ردیف کاربر ساخته؛ تسک ایمیل اصلاً ثبت نشده |

Health-check روی broker قبل از insert فقط پیچیدگی و race می‌آورد. 2PC توزیع‌شده روی DB + broker بلاک می‌کند، latency را چند برابر می‌کند و scale نمی‌شود.

مثال signup: ردیف کاربر + «بفرست ایمیل تأیید» باید اتمیک باشد. اگر MQ پایین باشد و فقط بعد از insert publish کنی، **تراکنش ناقص** می‌گیری. Outbox تسک ایمیل را در همان DB کاربر می‌گذارد — بعد worker (یا CDC) وقتی آماده بود به broker می‌برد.

---

## جریان Outbox

```
begin
  insert orders
  insert outbox
commit
─── بعداً ───
read unpublished outbox
publish to broker
mark published
```

| قطعه | نقش |
|------|-----|
| **API / سرویس** | نوشتن دامنه + insert outbox در یک tx |
| **جدول outbox** | قصد پایدار برای notify (صف محلی) |
| **Relay worker** | Poll (یا CDC) → publish → علامت زدن |
| **Broker** | Fan-out به consumerها |
| **Consumerها** | باید **idempotent** باشند (duplicate پیش می‌آید) |

چرا anti-pattern نیست: واقعاً یک نوشتن durable اضافه می‌پردازی. Brokerها اغلب دادهٔ داغ را در RAM نگه می‌دارند؛ دیسک کندتر است. چیزی که می‌خری: **اگر ردیف دامنه commit شد، قصد publish هم commit شده**. از دست رفتن بعد از آن مشکل worker/broker است که می‌شود retry کرد — نه واگرایی بی‌صدا.

---

## Schema + نوشتن Laravel

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

نسخه‌های غنی‌تر `aggregate_type` / `aggregate_id` برای ترتیب و replay بر اساس موجودیت اضافه می‌کنند.

```php
DB::transaction(function () use ($data) {
    $order = Order::create($data);

    OutboxMessage::create([
        'type' => 'order.created',
        'payload' => ['order_id' => $order->id],
    ]);
});
```

همان شکل برای signup: insert کاربر + تسک ایمیل outbox در یک تراکنش. سلامت broker دیگر مسیر نوشتن را قفل نمی‌کند.

---

## Relay worker (polling)

Command زمان‌بندی‌شده / حلقه: ردیف‌های unpublished را بگیر، publish کن، علامت بزن.

```php
OutboxMessage::query()
    ->whereNull('published_at')
    ->orderBy('id')
    ->limit(100)
    ->get()
    ->each(function (OutboxMessage $msg) {
        // Kafka produce، Rabbit publish، یا event bus لاراول
        event(new OrderCreated($msg->payload['order_id']));
        $msg->update(['published_at' => now()]);
    });
```

سخت‌کاری production:

- Claim با `FOR UPDATE SKIP LOCKED` تا چند worker دوبار نگیرند  
- اول publish، بعد mark — crash بینشان → publish تکراری (ببین Inbox)  
- ایندکس روی `published_at IS NULL` (+ `id`) تا poll ارزان بماند  
- فاصلهٔ poll = کران eventual consistency تو (مثلاً ۱ث برای خیلی از اپ‌ها کافی است)

Polling با **سادگی عملیاتی** برنده است. تخصص binlog لازم نیست. جاب‌های پس‌زمینهٔ شبیه Shopify اغلب برای ایمیل/آنالیتیکس/ادغام‌ها همین را می‌زنند.

---

## CDC / دنبال کردن لاگ

هر DB یک لاگ تراکنش دارد (WAL / binlog / redo). **Change Data Capture** (مثلاً Debezium) آن لاگ را دنبال می‌کند و تغییر outbox (یا جدول) را به Kafka می‌فرستد — بدون حلقهٔ poll.

| تضمین | نکته |
|-------|------|
| ترتیب commit | Eventها به ترتیب commit دیتابیس خارج می‌شوند |
| بدون از دست رفتن کار commit‌شده | لاگ همان stream دوام است |
| تأخیر کم | اغلب میلی‌ثانیه بعد از commit |

وقتی ترتیب و lag مهم است (صورتحساب، توالی booking) استفاده کن. Failover از آخرین موقعیت لاگ ادامه می‌دهد. هزینه: عملیات connector، دسترسی DB، تخصص.

هر دو استراتژی Outboxاند: **tx محلی برای نوشتن**، **مسیر async برای broker**.

---

## At-least-once + Inbox

Outbox **at-least-once** می‌دهد، نه exactly-once:

1. Worker ردیف را می‌خواند  
2. به broker publish می‌کند (ack)  
3. قبل از `published_at` crash می‌کند  
4. Restart همان event را دوباره می‌فرستد  

Duplicate قابل‌جبران است؛ گم‌شدن بی‌صدا نیست. Consumer باید idempotent باشد (`idempotency_key`، unique constraint، جدول «یک‌بار پردازش»).

**Inbox** سمت مصرف‌کننده:

```
receive event
  if event_id in inbox → ignore
  else در یک tx: handle دامنه + insert inbox(event_id)
```

Outbox (تولیدکننده) + Inbox (مصرف‌کننده) ≈ **effectively once** سرتاسری. با [معناشناسی ack / تحویل](/fa/messaging/acknowledgment) جفت کن.

---

## عملیات: رشد، ترتیب، پاکسازی

**رشد جدول** — outbox بی‌کران poll ایندکس‌شده و backup را می‌کشد.

| استراتژی | کی |
|----------|-----|
| Delete بعد از publish | نیاز به audit نیست |
| Archive به cold storage | Compliance / replay |
| Partition روزانه + drop قدیمی | حجم بالا |

**ترتیب** — CDC ≈ ترتیب کل commit. Polling ≈ ترتیب با `id` / `created_at`؛ commitهای موازی می‌توانند غافلگیر کنند. برای ترتیب سخت per-aggregate: با `booking_id` / `order_id` کلید بزن و partition تاپیک broker را همان‌طور ببر.

**Monolith** — همان الگو برای webhook، باس داخلی، ایمیل. Reliability فقط مال microservice نیست.

**Saga / Event Sourcing** — مکمل‌اند، رقیب نه: Outbox eventهای گام saga را reliably منتشر می‌کند؛ event sourcing کامل *همه* state را event نگه می‌دارد. Outbox «event sourcing سبک» است وقتی جدول state فعلی هنوز بر query غالب است.

---

## کی استفاده / کی نه

**استفاده وقتی**

- نوشتن DB + اطلاع بیرونی نباید واگرا شود  
- Broker / consumer می‌تواند پایین باشد و نوشتن ادامه یابد  
- پول، سفارش، fulfillment، compliance به event اهمیت می‌دهند  

**رد کردن یا بازنگری وقتی**

- پیام best-effort است (متریک قابل‌از‌دست‌رفتن) و شکست dual-write قابل قبول است  
- همان تغییر را از قبل با CDC از جدول دامنه stream می‌کنی (معناشناسی را مواظب باش)  
- حاضر نیستی relay / CDC برانی و lag را مانیتور کنی  

---

## قانون تصمیم

```
باید «DB state + پیام خارجی» اتمیک باشد؟
  بله → Outbox (tx محلی) + relay/CDC
       + consumer idempotent (در صورت نیاز Inbox)
  از دست رفتن OK → publish ساده بعد از commit (ریسک را بدان)

هرگز: dual-write بدون داستان recovery
هرگز: 2PC روی DB + broker به‌عنوان پیش‌فرض
```

از outline ماژول:

1. همان tx: ردیف دامنه + ردیف outbox  
2. Worker (یا CDC) publish کند؛ published علامت بزند  
3. Consumerها: at-least-once → idempotent / Inbox  
4. جدول outbox را پاک یا partition کن  

---

## ضدالگوها

- Publish به broker داخل تراکنش دامنه «برای سادگی»  
- Mark کردن published **قبل از** ack بروکر (پنجرهٔ از دست رفتن)  
- بدون idempotency روی consumer (شارژ / ایمیل تکراری)  
- Outbox بدون مانیتور lag / عمق  
- هرگز حذف یا archive نکردن ردیف‌های published  
- انتظار ترتیب کل جهانی از polling Outbox بدون مراقبت  
- جایگزینی Outbox به‌جای فیکس consumer خراب (ببین [DLQ](/fa/messaging/dlq))  

---

## تمرین ذهنی

1. Order commit می‌شود؛ relay publish می‌کند؛ قبل از `published_at` می‌میرد. consumer ایمیل از قبل چه باید بکند؟  
2. MQ بیست دقیقه پایین است. با Outbox چه هنوز کار می‌کند؟ چه انباشته می‌شود؟  
3. Polling هر ۵ث در برابر Debezium — برای ترتیب سخت «booking confirmed بعد payment authorized» کدام؟ چرا؟

::: tip راهنما
1. Idempotent / Inbox — publish تکراری عادی است · 2. Signup/order commit می‌شود؛ outbox unpublished رشد می‌کند؛ با برگشت MQ، relay خالی می‌کند · 3. CDC (یا partition با کلید دقیق) — polling تنها روی ترتیب کل ضعیف‌تر است
:::
