# Fallacyهای سیستم توزیع‌شده و PACELC

> ماژول D — معماری سیستم · بخش ۹٫۵ (مبانی قبل از CAP)

## فهرست ذهنی

1. [چیست و چرا](#چیست-و-چرا)  
2. [هشت Fallacy](#هشت-fallacy)  
3. [Fallacy → شکست → اصلاح (با کد)](#fallacy--شکست--اصلاح-با-کد)  
4. [از CAP تا PACELC](#از-cap-تا-pacelc)  
5. [PACELC در عمل](#pacelc-در-عمل)  
6. [چالش‌های واقعی](#چالشهای-واقعی)  
7. [نکته‌های مصاحبه](#نکتههای-مصاحبه)  
8. [قانون تصمیم](#قانون-تصمیم)  
9. [ضدالگوها](#ضدالگوها)  
10. [تمرین ذهنی](#تمرین-ذهنی)

---

## چیست و چرا

سیستم توزیع‌شده طوری می‌شکند که تک‌پروسس نمی‌شکند: پیام گم می‌شود، ساعت دروغ می‌گوید، latency «لوکال» می‌شود ۸۰ ms، و یک قطع «موقت» به outage ناقص تبدیل می‌شود.

دو لنز مکمل:

| لنز | سؤالی که جواب می‌دهد |
|-----|----------------------|
| **هشت Fallacy** (دویچ / سان، حدود ۱۹۹۴) | کدام **فرض‌ها** دربارهٔ شبکه معمولاً غلط‌اند؟ |
| **CAP** | زیر **partition**، Consistency یا Availability؟ |
| **PACELC** (آبادی، ۲۰۱۲) | زیر partition **و** در مسیر **سالم**: Latency در برابر Consistency؟ |

Fallacy جلوی چسب «فقط happy path» را می‌گیرد. CAP/PACELC مجبورت می‌کند tradeoff را صریح بگویی وقتی همان چسب باید به کاربر سرویس بدهد.

مرتبط: [قضیهٔ CAP](/fa/architecture/cap-theorem) · [Outbox](/fa/patterns/outbox) · [تأیید پیام (Ack)](/fa/messaging/acknowledgment) · [API Gateway](/fa/architecture/api-gateway)

---

## هشت Fallacy

فهرست کلاسیک — هر مورد یک **باور پیش‌فرض غلط** است تا خلافش ثابت شود:

| # | Fallacy (باور غلط) | واقعیت |
|---|---------------------|--------|
| ۱ | شبکه قابل‌اعتماد است | پکت drop، لینک flap، split بین AZ |
| ۲ | Latency صفر است | بین AZ / منطقه ده‌ها تا صدها ms |
| ۳ | Bandwidth نامحدود است | NIC، NAT، سهمیهٔ broker محدودند |
| ۴ | شبکه امن است | zero-trust؛ مسیر را خصمانه فرض کن |
| ۵ | Topology عوض نمی‌شود | IP، peer، route دائماً عوض می‌شوند |
| ۶ | یک administrator وجود دارد | چند تیم / چند ابر / چند SLA |
| ۷ | هزینهٔ انتقال صفر است | egress $، CPU سریالایز، هزینهٔ broker |
| ۸ | شبکه همگن است | MTU متفاوت، نسخهٔ TLS، HTTP/1 در برابر HTTP/2 |

::: tip
Fallacyها **آشکارکنندهٔ بوی بد طراحی**اند. اگر طرح فقط وقتی کار می‌کند که هر هشت‌تا درست باشند، طراحی توزیع‌شده نیست — اسکریپت لوکال با امیدواری است.
:::

---

## Fallacy → شکست → اصلاح (با کد)

### ۱ — شبکه قابل‌اعتماد است

**شکست:** Order سرویس `OrderPaid` را publish می‌کند بعد crash — یا broker می‌پذیرد و consumer هرگز اجرا نمی‌شود. جهنم dual-write.

**اصلاح:** نیت پایدار در همان تراکنش DB ([Outbox](/fa/patterns/outbox)) + at-least-once + consumer ایدمپوتنت ([Ack](/fa/messaging/acknowledgment)).

```php
// Laravel — بیرون از تراکنش کسب‌وکار publish نکن
DB::transaction(function () use ($order) {
    $order->markPaid();
    OutboxMessage::create([
        'type' => 'order.paid',
        'payload' => ['order_id' => $order->id],
        'idempotency_key' => "order.paid:{$order->id}",
    ]);
});
// Worker بعداً publish می‌کند — blip شبکه ≠ از دست رفتن نیت
```

### ۲ — Latency صفر است

**شکست:** Handler چک‌اوت پشت‌سرهم Inventory، Pricing، Fraud، Loyalty را صدا می‌زند. هر کدام p99 چهل ms → کاربر ۱۶۰ ms+؛ یک dependency کند → طوفان timeout.

**اصلاح:** Timeout به‌ازای hop، موازی‌سازی تماس‌های مستقل، degrade مسیرهای غیرحیاتی.

```php
use Illuminate\Support\Facades\Http;
use Illuminate\Http\Client\Pool;

$responses = Http::pool(fn (Pool $pool) => [
    $pool->as('price')->timeout(0.2)->get($pricingUrl),
    $pool->as('fraud')->timeout(0.15)->post($fraudUrl, $payload),
]);

$price = $responses['price']->successful()
    ? $responses['price']->json()
    : throw new ServiceUnavailable('pricing');

// Fraud: fail-open یا fail-closed تصمیم محصول است — هرگز «تا ابد صبر»
$fraudOk = $responses['fraud']->successful()
    ? $responses['fraud']->json('ok')
    : false; // مثال fail-closed
```

```python
# همان ایده — بودجهٔ صریح بهتر از client پیش‌فرض HTTP
import httpx, asyncio

async with httpx.AsyncClient(timeout=httpx.Timeout(0.2)) as client:
    price, fraud = await asyncio.gather(
        client.get(pricing_url),
        client.post(fraud_url, json=payload),
        return_exceptions=True,
    )
```

### ۳ — Bandwidth نامحدود است

**شکست:** کل جدول `orders` را هر sync داخل webhook می‌ریزی. دیسک broker / NAT پر می‌شود؛ بقیهٔ tenantها گرسنه می‌مانند.

**اصلاح:** رویداد فشرده، pagination، فشرده‌سازی فقط جایی که CPU اجازه می‌دهد، backpressure.

```php
// بد: کل aggregate هر بار
// خوب: رویداد دامنهٔ کوچک + در صورت نیاز pull جزئیات
$event = [
    'type' => 'order.paid',
    'order_id' => $order->id,
    'total_cents' => $order->total_cents,
    'occurred_at' => now()->toIso8601String(),
];
```

### ۴ — شبکه امن است

**شکست:** URL «داخلی» از pod هک‌شده در دسترس است؛ بدون mTLS؛ توکن استاتیک ابدی.

**اصلاح:** اعتبار کوتاه‌عمر، least privilege، secret در query string نه، ترافیک east-west را خصمانه بگیر.

```php
// ترجیح: JWT سرویس کوتاه‌عمر / mTLS در mesh — نه فقط secret ابدی در .env
Http::withToken($tokenProvider->mint(audience: 'inventory', ttl: 60))
    ->timeout(0.3)
    ->post($inventoryUrl, $body);
```

### ۵ — Topology عوض نمی‌شود

**شکست:** `http://10.0.1.47:8080` هاردکد. نود می‌میرد؛ DNS/k8s جابه‌جا می‌کند → آبشار ۵۰۰.

**اصلاح:** Service discovery / نام DNS، retry با jitter به endpoint جدید، pool اتصالی که refresh می‌شود.

```php
// DNS پایدار سرویس، نه IP پاد
$url = config('services.inventory.base_url'); // https://inventory.svc.cluster.local
```

### ۶ — یک administrator

**شکست:** تیم A API را v2 می‌کند؛ موبایل تیم B هنوز v1؛ rename خاموش فیلد موجودی را می‌شکند.

**اصلاح:** نسخه‌بندی صریح، قواعد schema evolution، قرارداد consumer-driven.

```php
// نسخه در path یا header — هرگز فیلد پول را خاموش عوض نکن
Route::prefix('v1')->group(function () {
    Route::post('/orders', PlaceOrderV1::class);
});
Route::prefix('v2')->group(function () {
    Route::post('/orders', PlaceOrderV2::class); // فیلد additive OK؛ breaking = نسخهٔ جدید
});
```

### ۷ — هزینهٔ انتقال صفر است

**شکست:** تماس چت‌تی N+1 مایکروسرویس («سفارش»، «هر خط»، «هر SKU») بین منطقه. صورت‌حساب و latency منفجر.

**اصلاح:** API درشت‌دانه، تجمیع BFF در لبه ([API Gateway](/fa/architecture/api-gateway))، کش برای read داغ.

### ۸ — شبکه همگن است

**شکست:** فرض کن همه HTTP/2 + همان قواعد اعشار JSON. شریک قدیمی پول را float کوتاه می‌کند → اختلاف سنت.

**اصلاح:** کدگذاری کانونیک (`total_cents` int)، تست قرارداد، تحمل پروتکل قدیمی در لبه.

```php
// پول به‌صورت عدد صحیح واحد خرد — نه float در JSON
'total_cents' => 1999, // ۱۹٫۹۹ دلار
```

---

## از CAP تا PACELC

[CAP](/fa/architecture/cap-theorem): وقتی **partition** رخ دهد، **C** و **A** کامل هم‌زمان نمی‌مانند.

**PACELC** حالت روزمره را اضافه می‌کند:

> **اگر** Partition → بین **A** یا **C** انتخاب کن  
> **وگرنه** (بدون partition) → بین **Latency** یا **Consistency** انتخاب کن

| حالت | انتخاب | معنی |
|------|--------|------|
| **PA/EL** | زیر P → A؛ سالم → Latency | جواب سریع؛ ممکن است stale (نزدیک Dynamo) |
| **PA/EC** | زیر P → A؛ سالم → Consistency | ترکیب نادر؛ اغلب ناجور |
| **PC/EL** | زیر P → C؛ سالم → Latency | نادر؛ «سریع ولی زیر split رد کن» |
| **PC/EC** | زیر P → C؛ سالم → Consistency | quorum / replication همزمان؛ مسیر شاد کندتر (نزدیک Spanner) |

محصول واقعی معمولاً **PACELC مخلوط به‌ازای feature** است، نه یک برچسب برای کل شرکت.

```
         Partition?
        /          \
      بله           نه
      / \           / \
    A   C         L   C
   (AP) (CP)   (سریع) (قوی)
```

::: warning
CAP نمی‌گوید هر روز عادی باید consistency را ول کنی. PACELC می‌گوید: حتی با شبکهٔ سالم، **quorum همزمان** Consistency قوی‌تر می‌خرد به قیمت **L**.
:::

---

## PACELC در عمل

### انتقال کیف پول (نزدیک PC/EC)

موجودی غلط فاجعه است → منتظر quorum / primary تک؛ latency بالاتر را بپذیر.

```php
// مفهومی: مسیر قوی — write روی primary، بعد ACK به کلاینت
DB::connection('pgsql_primary')->transaction(function () use ($from, $to, $cents) {
    $a = Account::whereKey($from)->lockForUpdate()->firstOrFail();
    $b = Account::whereKey($to)->lockForUpdate()->firstOrFail();
    if ($a->balance_cents < $cents) {
        throw new InsufficientFunds();
    }
    $a->decrement('balance_cents', $cents);
    $b->increment('balance_cents', $cents);
});
// کلاینت فقط بعد از commit موفقیت می‌بیند — هزینهٔ latency عمدی است
```

### شمارندهٔ لایک فید (نزدیک PA/EL)

عدد stale چندثانیه‌ای OK → افزایش async، خواندن کش، همگرایی eventual.

```php
// مسیر سریع: نیت را بنویس، برگرد؛ شمارنده با worker / Redis INCR همگرا می‌شود
Redis::incr("post:{$postId}:likes");
dispatch(new PersistLike($postId, $userId)); // ممکن است عقب بماند — AP/EL OK
return response()->json(['ok' => true]); // latency پایین برای کلاینت
```

### چک‌اوت در برابر browse

| سطح | تمایل PACELC | چرا |
|-----|--------------|-----|
| خواندن صفحه محصول | PA/EL | بنر قیمت stale بهتر از صفحه خالی |
| ثبت پرداخت | PC/EC | شارژ دوبل بدتر از اسپینر کند |
| رزرو موجودی | PC/EC یا hold زمان‌دار | oversell گران است |
| ورود analytics | PA/EL | تأخیر/حذف رویداد بهتر از بلاک UX |

---

## چالش‌های واقعی

### چالش الف — «روی staging کار می‌کرد»

Staging یک AZ، ترافیک کم، بدون packet loss. پروداکشن: lag رپلیکأ بین‌منطقه‌ای ۲ ثانیه. ابزار پشتیبانی از replica می‌خواند؛ مشتری الان پرداخت کرده؛ اپراتور «پرداخت‌نشده» می‌بیند.

| ریشه | Fallacy / PACELC |
|------|------------------|
| فرض «replica همیشه جاری است» | Latency ≈ ۰؛ نادیده گرفتن EL در برابر EC |
| بدون مسیریابی read-your-writes | «C» در CAP ≠ lag رپلیکا |

**کاهش آسیب:** sticky primary برای read بعد از write؛ توکن `read_after_write`؛ نشان بده «در حال پردازش» نه «ناموفق».

### چالش ب — تقویت Retry

Inventory در ۳۰ ثانیه timeout می‌شود. Gateway سه بار retry. کلاینت سه بار retry. یک کلیک → ۹ تماس Inventory → اتمام thread pool → outage کامل.

| ریشه | Fallacy |
|------|---------|
| فرض شبکه قابل‌اعتماد + retry ارزان | #۱ و #۷ |
| بدون انتشار deadline | Latency ≠ ۰ |

**کاهش آسیب:** بودجهٔ timeout (مثلاً جمع ۳۰۰ ms)، کلید ایدمپوتنسی، retry فقط روی خطای امن، jitter، circuit breaker (سند بعدی: Resilience).

```php
// deadline را منتقل کن — هر hop دوباره ۳۰ثانیه از صفر شروع نکند
$deadline = microtime(true) + 0.3;
$remaining = max(0.05, $deadline - microtime(true));
Http::timeout($remaining)->withHeaders([
    'Idempotency-Key' => $key,
])->post($url, $body);
```

### چالش ج — Split brain بعد از glitch «موقت»

دو primary هم‌زمان write می‌پذیرند (failover بدپیکربندی). بعد merge → آپدیت گم / موجودی واگرا.

| ریشه | Fallacy / CAP |
|------|---------------|
| فرض شبکه قابل‌اعتماد + یک admin که failover را «بلده» | #۱، #۶ |
| Availability بدون داستان merge | AP بدون قواعد conflict |

**کاهش آسیب:** fencing token، single writer با consensus (etcd/ZK)، یا CRDT/LWW با قواعد دامنه — هرگز dual primary خاموش برای پول.

---

## نکته‌های مصاحبه

1. **۲–۳ fallacy** را به طرح خودت گره بزن (نه هر هشت‌تا مثل trivia).  
2. بعد از CAP بگو: **«در مسیر سالم L می‌خریم یا C؟»** (PACELC).  
3. **به‌ازای feature** بگو، نه «شرکت ما AP است».  
4. Fallacy را به کنترل ملموس وصل کن: timeout، ایدمپوتنسی، outbox، discovery، نسخه‌بندی.  
5. تله: CAP را «هر روز دو تا از سه» گرفتن — PACELC دقیقاً برای ناقص بودن آن داستان است.

---

## قانون تصمیم

1. هشت fallacy را روی طرح راه برو — کدام فرض باید false-safe باشد؟  
2. زیر partition برای این feature: **C یا A**؟ ([CAP](/fa/architecture/cap-theorem))  
3. در مسیر سالم: **Latency یا Consistency**؟ (PACELC)  
4. اگر retry می‌کنی: **زمان**، **تعداد**، و **ایدمپوتنسی** را محدود کن.  
5. پول / صندلی / موجودی → نزدیک PC/EC. فید / شمارنده → PA/EL اغلب OK.  
6. Topology هاردکد نکن؛ پول را float بین سرویس‌ها نفرست.

---

## ضدالگوها

- Timeout پیش‌فرض بی‌نهایت بین سرویس‌ها  
- Retry بدون کلید ایدمپوتنسی یا deadline  
- Dual-write به DB + broker بدون outbox  
- خواندن رپلیکأ عقب‌افتاده برای UX بعد از پرداخت بدون sticky read  
- یک مهر جهانی «ما eventually consistent هستیم» روی checkout  
- IP هاردکد / فرض topology استیجینگ = پروداکشن  
- Float برای ارز در APIهای JSON  

---

## تمرین ذهنی

`POST /checkout` می‌سازی:

1. **سه fallacy** که handler نباید فرض کند نام ببر.  
2. برای **ثبت پرداخت** نزدیک‌تری به **PC/EC** یا **PA/EL**؟ چرا؟  
3. برای **نشان تعداد آیتم سبد** همان سؤال.  
4. **Outbox** کجا fallacy #۱ را از مسیر حیاتی حذف می‌کند؟  
5. اگر Inventory کند باشد — **fail-open، fail-closed، یا degrade** — و چه کسی تصمیم می‌گیرد؟

اگر بدون دست‌تکان‌دادن جواب دادی، مبانی سفت است — بعدی: [Replication](/fa/architecture/replication) (lag، failover، split-brain).
