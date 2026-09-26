# CQRS Light

> ماژول D — معماری سیستم · بخش ۱۲

## فهرست ذهنی

1. [چیست و چرا](#چیست-و-چرا)  
2. [از CQS تا CQRS](#از-cqs-تا-cqrs)  
3. [جریان light (یک DB)](#جریان-light-یک-db)  
4. [سمت Write — غنی، با invariant](#سمت-write--غنی-با-invariant)  
5. [سمت Read — تخت، مناسب UI](#سمت-read--تخت-مناسب-ui)  
6. [Projection اختیاری](#projection-اختیاری)  
7. [کی استفاده / کی نه](#کی-استفاده--کی-نه)  
8. [قانون تصمیم](#قانون-تصمیم)  
9. [ضدالگوها](#ضدالگوها)

---

## چیست و چرا

**CQRS** = *Command Query Responsibility Segregation* — مدل **نوشتن (command)** را از مدل **خواندن (query)** جدا کن.

نسخهٔ **light** بدون Event Sourcing کامل: اغلب **یک DB**، اما کد/کلاس‌های جدا برای write و read (گاهی جدول یا ایندکس read جدا).

| سمت | کار | شکل |
|-----|-----|-----|
| **Command / write** | تغییر state، نگه داشتن invariant | دامنهٔ غنی / تراکنشی |
| **Query / read** | دادهٔ آمادهٔ UI | تخت، denormalized، سریع |

چرا؟ مسیر write باید ساده و safe بماند. داشبورد / لیست اغلب join سنگین، فیلتر، projection می‌خواهد. یک model مشترک → یا write شلوغ می‌شود یا read کند.

```
Commands → WriteModel → WriteTables
                              │
                    OptionalProjection
                              ▼
                         ReadModels ← Queries
```

مرتبط: [Directory Query](/fa/patterns/directory-query) · [Outbox](/fa/patterns/outbox) · [الگوهای Cache](/fa/patterns/cache-patterns)

---

## از CQS تا CQRS

**CQS** (Command–Query Separation) قانون سطح متد است:

| نوع | state عوض کند؟ | دادهٔ دامنه برگرداند؟ |
|-----|----------------|------------------------|
| **Command** | بله | ترجیحاً نه (استثنای ضعیف: برگرداندن id جدید) |
| **Query** | **هرگز** | بله |

**CQRS** همان قانون را به سطح **اپ / معماری** می‌برد: handler، model، و اغلب جدول جدا — نه فقط نام متد روی یک سرویس خدا.

CQRS معمولاً فقط با Event Sourcing گفته می‌شود. آن جفت اختیاری است. **هر پروژه‌ای می‌تواند CQRS light بگیرد** بدون event store.

::: tip
CQS → کلاس شفاف‌تر. CQRS → *سمت‌های* اپ شفاف‌تر. با CQS شروع کن؛ وقتی نیاز read و write از هم فاصله گرفت → CQRS.
:::

---

## جریان light (یک DB)

| قطعه | نقش |
|------|-----|
| **Commands + WriteModel** | نیت + invariant (`PlaceOrder`، موجودی، جمع) |
| **WriteTables** | منبع حقیقت نرمال (`orders`، `order_items`) |
| **OptionalProjection** | ساخت شکل read (همان tx، event، cron، یا DB view) |
| **ReadModels** | جدول / view دنرمال (`order_summaries`) |
| **Queries** | خوانندهٔ نازک برای UI / API |

جداسازی فیزیکی (DB دوم، Kafka streams) بعداً مجاز است. CQRS light تا **کد + شاید جدول read** می‌ایستد.

---

## سمت Write — غنی، با invariant

```php
// Write side — غنی، با invariant
final class PlaceOrderHandler
{
    public function __invoke(PlaceOrder $cmd): Order
    {
        return DB::transaction(function () use ($cmd) {
            $order = Order::create([
                'user_id' => $cmd->userId,
                'status' => 'placed',
                'total' => $cmd->total,
            ]);

            $order->items()->createMany($cmd->items);

            // outbox / domain events — اختیاری، هنوز CQRS light
            return $order;
        });
    }
}
```

سمت write مالک این‌هاست:

- Validation و قوانین دامنه  
- Concurrency / locking در صورت نیاز  
- Side effect امن (ببین [Outbox](/fa/patterns/outbox))

منطق join داشبورد را داخل write model نگذار.

---

## سمت Read — تخت، مناسب UI

```php
// Read side — تخت، بهینه برای UI
final class OrderSummaryQuery
{
    public function __invoke(int $userId): Collection
    {
        return DB::table('order_summaries') // یا Eloquent read model
            ->where('user_id', $userId)
            ->orderByDesc('placed_at')
            ->limit(50)
            ->get();
    }
}
```

برای لیست پر فیلتر، روی **سمت query** با [کلاس Directory Query](/fa/patterns/directory-query) جفت کن.

| مدل write | مدل read |
|-----------|----------|
| نرمال، سنگین از invariant | ستون‌های denormal که صفحه لازم دارد |
| نویسندهٔ کم، tx دقیق | خوانندهٔ زیاد، select ارزان |
| `Order` + `OrderItem` | یک ردیف `order_summaries` برای کارت لیست |

---

## Projection اختیاری

چطور read به‌روز بماند (یکی را انتخاب کن؛ فقط وقتی لازم بالا برو):

| رویکرد | کی |
|--------|-----|
| آپدیت **همان تراکنش** write + read | consistency قوی، دامنه ساده |
| **DB view** روی جدول‌های write | MVP / ترافیک کم؛ بدون مسیر write اضافه |
| **Domain event / Outbox → worker** | async، scale خواندن، دوری از جهنم dual-write |
| **جاب زمان‌بندی‌شده** | lag قابل قبول؛ rebuild نادر |
| **Projection با Event Sourcing کامل** | audit / بازسازی از event — **فراتر** از CQRS light |

::: warning Consistency
Projection ناهمگام ⇒ lag کوتاه روی read. UI و API باید «eventual» را جایی که async انتخاب کردی تحمل کنند.
:::

---

## کی استفاده / کی نه

**استفاده وقتی**

- داشبورد / گزارش join سنگین دارد؛ write path باید ساده و safe بماند  
- شکل read ≠ شکل write (ایندکس و denormalization متفاوت)  
- می‌خواهی read را scale / cache کنی بدون دست زدن به تراکنش write  

**رد کن وقتی**

- CRUD ساده: همان فیلدها روی فرم و لیست  
- تیم هنوز دو model را نمی‌تواند نگه دارد — هزینهٔ پیچیدگی واقعی است  
- فقط مد Event Sourcing می‌خواهی بدون فاصلهٔ واقعی نیازها  

Trade-off: **پیچیدگی کد بیشتر**؛ برای CRUD ساده overkill. وقتی read و write خلاف هم می‌کشند → عالی.

---

## قانون تصمیم

```
نیازهای read و write متضادند؟
  بله → CQRS light (جدا کردن کد؛ جدول/view در صورت نیاز)
  خیر → CRUD ساده / یک model بماند

جدا کردن storage فقط بعد از اینکه جدا کردن کد کافی نبود.
هرگز برای «CQRS کردن» Event Sourcing کامل اجباری نکن.
```

1. اول **handler و model** را جدا کن.  
2. وقتی join درد شد → **جدول / view خواندنی** اضافه کن.  
3. وقتی sync dual-write یا سیاست lag ایجاب کرد → **projection ناهمگام**.  
4. Query بدون side effect بماند (قانون قوی CQS).

---

## ضدالگوها

- CQRS = «حتماً Event Sourcing + دو دیتابیس»  
- یک سرویس خدا که هم mutate می‌کند هم DTO joinشدهٔ عظیم برمی‌گرداند  
- نوشتن روی جدول read از کنترلرهای پراکنده (بدون یک مسیر projection)  
- Side effect داخل query handler (ایمیل، شارژ، enqueue)  
- DB دوم زودهنگام قبل از نیاز واقعی scale/isolation  
- مراسم کامل aggregate + command + event برای CRUD خالی از منطق (light بمان)

---

## تمرین ذهنی

1. فرم سفارش چک موجودی + قوانین جمع می‌خواهد؛ لیست ادمین نام مشتری + تعداد آیتم + آخرین وضعیت. یک Eloquent برای هر دو — اول چه می‌شکند؟  
2. `order_summaries` را در همان tx با `orders` آپدیت می‌کنی. نسبت به worker ناهمگام چه به‌دست آوردی / چه از دست دادی؟  
3. محصول داشبورد real-time و write سخت می‌خواهد. CQRS light کافی است یا ES؟

::: tip راهنما
1. یا write پر از نویز فیلتر/join می‌شود یا لیست کند/شکننده می‌ماند · 2. به‌دست: consistency قوی؛ از دست: latency write / coupling · 3. معمولاً light کافی؛ ES فقط اگر event log منبع حقیقت / بازسازی لازم باشد
:::
