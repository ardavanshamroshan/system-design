# Kafka، RabbitMQ یا Redis Streams؟

> ماژول C — پیام‌رسانی و قابلیت اطمینان · بخش ۶

## فهرست ذهنی

1. [چیست و چرا](#چیست-و-چرا)  
2. [مقایسهٔ سریع](#مقایسهٔ-سریع)  
3. [RabbitMQ](#rabbitmq--پستخانه)  
4. [Kafka](#kafka--پخش-خبر--دفتر-رویداد)  
5. [Redis Streams](#redis-streams--پیک-سریع)  
6. [Laravel و صف‌ها](#laravel-و-صفها)  
7. [قانون تصمیم](#قانون-تصمیم)  
8. [ضدالگوها](#ضدالگوها)

---

## چیست و چرا

**Message broker** کار را از HTTP همزمان جدا می‌کند:

```
Producer → Broker → Consumer(ها)
```

تولیدکننده پیام می‌گذارد؛ مصرف‌کننده **بعداً** پردازش می‌کند. فایده‌ها:

- **Decoupling:** سرویس‌ها مستقیم به هم وابسته نیستند  
- **Buffer:** spike ترافیک را نرم می‌کند  
- **Retry / ACK:** شکست موقت را می‌توانی دوباره بزنی  
- **Scale workers:** تعداد مصرف‌کننده را جدا بالا ببر  

```
┌──────────┐     publish      ┌─────────┐     consume     ┌───────────┐
│ Producer │ ───────────────► │ Broker  │ ──────────────► │ Consumer1 │
└──────────┘                  │         │ ──────────────► │ Consumer2 │
                              └─────────┘                 └───────────┘
```

سؤال اشتباه: «کدام بهترین است؟»  
سؤال درست: **الگوی ترافیک، تضمین تحویل، ترتیب، retention، و مدل مصرف** چیست؟

تشبیه کوتاه:

| ابزار | تشبیه |
|-------|--------|
| **RabbitMQ** | پستخانه — نامه به صندوق مشخص، با رسید تحویل |
| **Kafka** | پخش خبر ۲۴/۷ — می‌توانی زنده ببینی یا نوار را rewind کنی |
| **Redis Streams** | پیک موتور داخل شهر — سریع و سبک؛ برای محمولهٔ سنگین/دور نه |

---

## مقایسهٔ سریع

| | **RabbitMQ** | **Kafka** | **Redis Streams** |
|--|--------------|-----------|-------------------|
| **مدل** | صف / exchange (ورکرها کار را برمی‌دارند) | لاگ توزیع‌شدهٔ append-only | ساختار stream در حافظه (+ persistence اختیاری AOF/RDB) |
| **قدرت** | routing انعطاف‌پذیر، AMQP، ACK دقیق | throughput بالا، replay، event log | سبک، latency کم، ops ساده‌تر (اگر Redis داری) |
| **ترتیب** | معمولاً per-queue | **per-partition** | **per-stream** |
| **نگه‌داری** | معمولاً تا consume (+ ACK) | روزها/هفته‌ها قابل replay | محدودتر از Kafka (حافظه / MAXLEN) |
| **Laravel** | driver / پکیج rabbitmq | پکیج‌های community | Redis queue native + Streams با پکیج/دستی |
| **پیچیدگی ops** | متوسط | بالاتر (کلاستر، partition، retention) | کمتر کنار Redis موجود |
| **مناسب** | task queue، workflow | analytics، CDC، event history | job سبک، realtime، cache+queue |

**Trade-off کلی:** برای اکثر اپ‌های Laravel، **Redis queue یا RabbitMQ** کافی است. **Kafka** وقتی event history، fan-out عظیم، یا چند consumer group با **replay** لازم است.

---

## RabbitMQ — پستخانه

### مدل

```
Producer → Exchange → (binding/routing key) → Queue → Consumer
```

- **Exchange** پیام را با قانون (direct / topic / fanout / headers) به صف‌ها می‌فرستد  
- **Queue** انبار کار برای workerها  
- **ACK:** بعد از پردازش موفق، پیام حذف می‌شود؛ crash قبل از ACK → دوباره تحویل (at-least-once)  

مثل پستخانه با چند صندوق: نامه به آدرس مشخص می‌رود؛ اگر گیرنده لحظه‌ای نباشد، نامه منتظر می‌ماند.

### قدرت‌ها

- Routing غنی و پروتکل AMQP (+ MQTT/STOMP در بعضی setupها)  
- Priority، TTL، delayed message، DLX (dead-letter)  
- تضمین تحویل قوی برای **کار** (email، payment job، fulfillment)  

### کی؟

- Job queue با routing پیچیده  
- Workflow چندمرحله‌ای  
- نیاز به ACK / retry / DLQ دقیق  
- الگوهای request/reply  

---

## Kafka — پخش خبر / دفتر رویداد

### مدل

```
Producer → Topic (partitions) → Consumer Groups
```

- پیام در **لاگ append-only** روی دیسک می‌ماند (تا retention)  
- **Partition:** مقیاس افقی + ترتیب داخل همان partition  
- مصرف‌کننده **offset** خودش را نگه می‌دارد و می‌تواند عقب برگردد (**replay**)  
- چند **consumer group** مستقل همان event را جدا می‌خوانند  

Producer معمولاً کاری ندارد که «آیا کسی خواند؟» — مثل کتابخانه/نوار خبر: پیام روی قفسه است؛ خواننده تصمیم می‌گیرد از کجا بخواند.

### قدرت‌ها

- Throughput خیلی بالا  
- Retention بلند و replay برای analytics / rebuild state  
- Event streaming، CDC، audit trail  

### کی؟

- حجم بالای event (clickstream، IoT، log)  
- نیاز به تاریخچه و چند مصرف‌کننده مستقل  
- Event-driven در مقیاس سازمانی  

### هشدار هزینه/پیچیدگی

برای چند هزار پیام در روز، Kafka اغلب **overkill** است: RAM/دیسک، مانیتورینگ، partition، schema. بسیاری اپ‌های متوسط با Redis/RabbitMQ ارزان‌تر و ساده‌تر زنده‌اند.

::: tip
Kafka بیشتر «دفتر رویداد» است تا work queue کلاسیک. اگر فقط «بعداً یک job بزن» می‌خواهی، اول صف ساده‌تر را امتحان کن.
:::

---

## Redis Streams — پیک سریع

### مدل

```
XADD → Stream → XREADGROUP (consumer group)
```

- Stream شبیه لاگ سبک داخل Redis  
- Consumer group برای تقسیم کار بین workerها  
- سریع (in-memory)؛ دوام وابسته به AOF/RDB و ظرفیت حافظه  

**تفاوت با Redis Pub/Sub:** Pub/Sub آتش‌و‌فراموش است (بدون persistence قوی / replay). Streams برای پردازش قابل‌اطمینان‌تر طراحی شده. صف استاندارد Laravel روی Redis اغلب لیست/queue driver است — با Streams فرق مفهومی دارد ولی هر دو «کار پس‌زمینه» می‌دهند.

### قدرت‌ها

- Latency کم، راه‌اندازی ساده اگر Redis از قبل هست  
- Cache + queue در یک ابزار  
- مناسب اعلان، job کوتاه، نرخ متوسط  

### کی؟

- Laravel/Horizon با Redis  
- ترافیک متوسط، نه Netflix-scale  
- نمی‌خواهی کلاستر Kafka راه بیندازی  

محدودیت: retention و دوام سطح Kafka را فرض نکن؛ حافظه و HA را جدی بگیر.

---

## Laravel و صف‌ها

مدل پیش‌فرض Laravel (`ShouldQueue`) ≈ **کار در صف** (نزدیک Rabbit/Redis queue)، نه لزوماً Kafka event log.

### Dispatch + Job

```php
// dispatch
ProcessOrder::dispatch($order->id)->onQueue('orders');

// Job
class ProcessOrder implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $orderId) {}

    public function handle(OrderService $orders): void
    {
        $orders->fulfill($this->orderId);
    }
}
```

| نیاز Laravel | انتخاب رایج |
|--------------|-------------|
| Job پس‌زمینه ساده (ایمیل، تصویر، webhook) | **Redis** + Horizon |
| Routing پیچیده، ACK/DLX قوی، چند پروتکل | **RabbitMQ** |
| Event history، چند سرویس با replay، analytics | **Kafka** (معمولاً خارج از `ShouldQueue` خالص) |

`failed_jobs`، retry، timeout، و idempotency را جدا طراحی کن — broker جایگزین منطق کسب‌وکار نیست.

مرتبط: [تأیید پیام (Ack)](/fa/messaging/acknowledgment) · [Dead-Letter Queue](/fa/messaging/dlq)

---

## قانون تصمیم

```
نیاز به event history / replay / fan-out عظیم؟
  بله → Kafka
  خیر → routing پیچیده یا ACK/DLX دقیق؟
         بله → RabbitMQ
         خیر → Redis از قبل هست / job ساده؟
                بله → Redis queue / Streams
                خیر → معمولاً باز هم Redis یا RabbitMQ؛ Kafka را زود نیاور
```

فشرده از outline:

1. **job پس‌زمینه ساده** → Redis queue  
2. **routing پیچیده / ACK دقیق** → RabbitMQ  
3. **event streaming سازمانی** → Kafka  

همچنین بسنج: ترتیب (per-queue vs per-partition)، هزینه ops، و اینکه پیام بعد از consume هنوز ارزش دارد یا نه.

| اگر پیام… | متمایل شو به |
|-----------|--------------|
| «کار است؛ بعد از انجام تمام» | Rabbit / Redis queue |
| «رویداد است؛ بعداً هم می‌خواهم بخوانم» | Kafka (یا Streams با retention آگاهانه) |
| «فقط الان سریع برسان» | Redis Pub/Sub یا کانال realtime |

---

## ضدالگوها

- آوردن Kafka برای ۱٬۰۰۰ پیام در روز  
- Redis Streams/Pub برای سیستم مالی بدون فهم durability و failover  
- یک broker برای همه SLOها بدون اندازه‌گیری  
- فرض «Laravel queue = exactly-once» بدون idempotent handler  
- نگه داشتن کار طولانی داخل consumer بدون timeout/visibility درست  

---

## تمرین ذهنی

1. ارسال ایمیل بعد از ثبت‌نام — کدام؟  
2. clickstream برای پیشنهاد کالا با replay هفتگی — کدام؟  
3. اعلان live در اپ چت، از دست رفتن گاه‌به‌گاه قابل قبول — کدام؟  

::: tip راهنما
1. Redis/Rabbit · 2. Kafka · 3. Redis Pub/Sub یا Streams سبک
:::
