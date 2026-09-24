# CQRS و الگوهای سبک نرم‌افزار

## CQRS چیست؟

**CQRS** = *Command Query Responsibility Segregation*  
یعنی **نوشتن (Command)** و **خواندن (Query)** را از هم جدا می‌کنی.

| طرف | نقش | مثال |
|-----|-----|------|
| Command | تغییر state | `CreateOrder`, `CancelPayment` |
| Query | فقط خواندن | `GetOrderById`, `ListUserOrders` |

در نسخهٔ **سبک (light)** لازم نیست دو دیتابیس جدا داشته باشی. کافی است مدل‌ها، سرویس‌ها یا حتی جدول‌های read/write را از هم جدا کنی.

---

## چرا؟

در سیستم‌های واقعی:

- مسیر write قوانین سخت دارد (validation، concurrency، side-effect).  
- مسیر read اغلب denormalized، cache‌شده و سریع می‌خواهد باشد.

یک مدل واحد برای هر دو → یا write پیچیده می‌شود، یا read کند.

---

## نسخهٔ سبک در عمل (Laravel/PHP)

```php
// Command — تغییر می‌دهد
final class PlaceOrder
{
    public function __construct(
        public readonly string $userId,
        public readonly array $items,
    ) {}
}

final class PlaceOrderHandler
{
    public function handle(PlaceOrder $command): string
    {
        // validate, persist, dispatch events
        return $orderId;
    }
}

// Query — فقط می‌خواند
final class GetOrderQuery
{
    public function __construct(public readonly string $orderId) {}
}

final class GetOrderHandler
{
    public function handle(GetOrderQuery $query): ?array
    {
        return DB::table('order_read_models')
            ->where('id', $query->orderId)
            ->first();
    }
}
```

::: tip نکته
در CQRS سبک، هر دو می‌توانند همان MySQL را ببینند؛ فقط **کد و مدل ذهنی** جداست. Event Sourcing اجباری نیست.
:::

---

## الگوها و پروتکل‌های مرتبط

| مفهوم | نقش کوتاه |
|-------|-----------|
| **DTO** | شکل داده بین لایه‌ها |
| **Repository** | abstraction روی persistence |
| **Specification** | قوانین فیلتر/جستجو قابل ترکیب |
| **Protocol / Interface** | قرارداد بین سرویس‌ها (نه implementation) |
| **Data structure مناسب** | مثلاً map برای lookup، queue برای کارها |

---

## Data Structure — انتخاب سریع

| نیاز | ساختار |
|------|--------|
| دسترسی با کلید | HashMap / associative array |
| FIFO کارها | Queue |
| LIFO / undo | Stack |
| ترتیب + uniqueness | TreeSet / sorted set |
| گراف وابستگی | Graph / adjacency list |

انتخاب اشتباه ساختار → پیچیدگی الگوریتمی بد، حتی با کد تمیز.

---

## Trade-off

| مزیت | هزینه |
|------|-------|
| scale جدا برای read/write | پیچیدگی بیشتر کد |
| مدل read بهینه | احتمال inconsistency کوتاه‌مدت |
| تست‌پذیری بهتر | boilerplate بیشتر |

---

## قانون تصمیم

1. اگر read و write نیازهای متفاوت دارند → CQRS سبک را در نظر بگیر.  
2. اگر سیستم کوچک و CRUD ساده است → یک مدل کافی است؛ over-engineer نکن.  
3. اول **جداسازی کد**، بعد در صورت نیاز **جداسازی ذخیره‌سازی**.
