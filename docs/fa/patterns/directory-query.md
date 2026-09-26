# کلاس Directory / Query

> ماژول D — معماری سیستم · بخش ۱۳

## فهرست ذهنی

1. [چیست و چرا](#چیست-و-چرا)  
2. [نام‌ها و شکل‌ها](#نام‌ها-و-شکل‌ها)  
3. [Laravel — lookupهای نام‌دار](#laravel--lookupهای-نام‌دار)  
4. [Laravel — سبک filter builder](#laravel--سبک-filter-builder)  
5. [Controller نازک](#controller-نازک)  
6. [ارتباط با CQRS](#ارتباط-با-cqrs)  
7. [کی استفاده / کی نه](#کی-استفاده--کی-نه)  
8. [قانون تصمیم](#قانون-تصمیم)  
9. [ضدالگوها](#ضدالگوها)

---

## چیست و چرا

به‌جای پخش `Order::with(...)->where...` در Controllerها، یک **Query Object** (گاهی **Directory** / **Finder**) معیارهای خواندن را کپسول می‌کند — هم‌راستا با سمت **Query** در [CQRS Light](/fa/patterns/cqrs).

| بدون | با |
|------|-----|
| همان join/فیلتر کپی‌شده در API، CLI، job | یک جا مالک lookup است |
| Controller شکل SQL را می‌داند | Controller *نیت* را صدا می‌زند (`paidForUser`) |
| تست فیلتر سخت | Directory را جدا unit-test کن |

ایدهٔ قدیمی‌تر (class query، query manager): **lookup ازپیش‌تعریف‌شده** با معیار دامنه — نه کندن ID داخلی در هر caller.

مرتبط: [CQRS Light](/fa/patterns/cqrs) · [الگوهای Cache](/fa/patterns/cache-patterns) · [Outbox](/fa/patterns/outbox)

---

## نام‌ها و شکل‌ها

نام‌های رایج: `OrderDirectory`، `OrderQuery`، `UserFinder`، `FilterBuilder`.

دو شکل مفید (برای هر نیاز یکی؛ هر دو «query class»اند):

| شکل | بهترین برای |
|-----|-------------|
| **متدهای نام‌دار** | lookup پایدار دامنه (`paidForUser`، `findPayableOrFail`) |
| **Filter / apply builder** | لیست UI با `where`های اختیاری زیاد |

قانون هر دو: **فقط خواندن**. ایمیل، شارژ، enqueue داخلش نه.

---

## Laravel — lookupهای نام‌دار

```php
final class OrderDirectory
{
    public function __construct(private Order $model) {}

    /** @return Collection<int, Order> */
    public function paidForUser(int $userId, int $limit = 20): Collection
    {
        return $this->model->newQuery()
            ->with(['items:id,order_id,sku,qty'])
            ->where('user_id', $userId)
            ->where('status', 'paid')
            ->latest('id')
            ->limit($limit)
            ->get();
    }

    public function findPayableOrFail(int $id): Order
    {
        return $this->model->newQuery()
            ->where('status', 'pending')
            ->findOrFail($id);
    }
}
```

در container bind کن (یا type-hint). Caller زبان دامنه حرف می‌زند؛ Eloquent داخل Directory می‌ماند.

---

## Laravel — سبک filter builder

وقتی UI فیلتر اختیاری می‌فرستد (`status`، `from`، `q`):

```php
final class UserDirectoryQuery
{
    public function __construct(
        private ?string $email = null,
        private ?string $status = null,
        private ?string $search = null,
    ) {}

    public static function fromRequest(array $input): self
    {
        return new self(
            email: $input['email'] ?? null,
            status: $input['status'] ?? null,
            search: $input['q'] ?? null,
        );
    }

    public function apply($query)
    {
        return $query
            ->when($this->email, fn ($q, $email) => $q->where('email', $email))
            ->when($this->status, fn ($q, $status) => $q->where('status', $status))
            ->when($this->search, function ($q, $search) {
                $q->where(function ($inner) use ($search) {
                    $inner->where('name', 'like', "%{$search}%")
                          ->orWhere('email', 'like', "%{$search}%");
                });
            });
    }
}

$users = UserDirectoryQuery::fromRequest($request->all())
    ->apply(User::query())
    ->paginate(20);
```

---

## Controller نازک

```php
public function index(OrderDirectory $orders)
{
    return OrderResource::collection(
        $orders->paidForUser(auth()->id())
    );
}
```

Controller: auth + نگاشت HTTP. Directory: چطور load. Resource: شکل JSON. Write در Action / Service / Command Handler بماند — اینجا نه.

---

## ارتباط با CQRS

| سمت CQRS | نقش Directory / Query class |
|----------|------------------------------|
| **Query** | خواندن قابل reuse؛ جفت با read model |
| **Command** | **اینجا نباشد** — mutation جای دیگر |

در CQRS light، Directory اغلب جدول write را می‌خواند *یا* جدول read جدا (`order_summaries`). همان ایده: کپسول معیارها.

---

## کی استفاده / کی نه

**استفاده وقتی**

- همان query در بیش از یک جا  
- بیش از حدود ۲–۳ قانون `where` / `with` / ترتیب  
- نیت نام‌دار می‌خواهی (`findPayableOrFail`) به‌جای سوپ builder  

**رد کن وقتی**

- dump یک‌بارهٔ ادمین که reuse نمی‌شود  
- فقط `Model::findOrFail($id)` بدون قانون اضافه  

---

## قانون تصمیم

```
query تکراری یا پیچیده‌تر از ۲–۳ where؟
  بله → کلاس Query / Directory
  خیر → Eloquent اینلاین کافی

write → Action / Service / Command Handler
query → Directory / Query class
هرگز side effect داخل query class نگذار
```

1. از دامنه نام بگذار (`OrderDirectory`)، نه `QueryHelper`.  
2. فقط ستون‌هایی را eager-load کن که caller لازم دارد.  
3. Controller نازک؛ Directory را inject کن.

---

## ضدالگوها

- God Directory با پنجاه فیلتر بی‌ربط برای همهٔ aggregateها  
- raw SQL / concat رشته بدون binding  
- Side effect (ایمیل، پرداخت، صف) داخل query class  
- تکرار همان منطق Directory در repository *و* controller  
- مخفی کردن write پشت متدی شبیه query (`savePaid`)

---

## تمرین ذهنی

1. جریان پرداخت «سفارش pending با id یا 404» می‌خواهد. `findPayableOrFail` کجا زندگی کند — controller، scope مدل، یا Directory؟ چرا؟  
2. لیست ادمین هشت فیلتر اختیاری دارد که فقط یک‌بار استفاده می‌شود. متد نام‌دار یا filter-builder؟  
3. از قبل `OrderSummaryQuery` در CQRS داری. هنوز به `OrderDirectory` نیاز داری؟

::: tip راهنما
1. Directory (یا query اختصاصی) — نیت قابل reuse + قابل تست · 2. Filter builder / `fromRequest` · 3. شاید یک کلاس کافی؛ اگر همان جدول/شکل است ادغام کن — تکرار نکن
:::
