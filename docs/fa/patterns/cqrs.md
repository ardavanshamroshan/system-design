# CQRS و الگوهای سبک نرم‌افزاری

## CQRS چیست؟

**CQRS** = *Command Query Responsibility Segregation*  
**نوشتن (Command)** را از **خواندن (Query)** جدا می‌کنی.

| سمت | نقش | مثال |
|-----|-----|------|
| Command | تغییر state | `CreateOrder`، `CancelPayment` |
| Query | فقط خواندن | `GetOrderById`، `ListUserOrders` |

در نسخهٔ **سبک** لازم نیست دو دیتابیس داشته باشی. جدا کردن model، سرویس، یا حتی جدول‌های read/write کافی است.

---

## چرا؟

در سیستم واقعی:

- مسیر write قوانین سخت دارد (validation، concurrency، side effect).  
- مسیر read اغلب viewهای denormalized، cached و سریع می‌خواهد.

یک model برای هر دو → یا write شلوغ می‌شود، یا read کند.

---

## نسخهٔ سبک در عمل (Laravel/PHP)

```php
// Command — state را عوض می‌کند
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
در CQRS سبک هر دو سمت می‌توانند همان MySQL را شریک شوند؛ فقط **کد و مدل ذهنی** جداست. Event Sourcing اختیاری است.
:::

---

## الگوها و پروتکل‌های مرتبط

| مفهوم | نقش کوتاه |
|-------|-----------|
| **DTO** | شکل داده بین لایه‌ها |
| **Repository** | انتزاع روی persistence |
| **Specification** | قوانین فیلتر/جست‌وجوی قابل ترکیب |
| **Protocol / Interface** | قرارداد بین سرویس‌ها (نه پیاده‌سازی) |
| **ساختار دادهٔ درست** | مثلاً map برای lookup، queue برای کار |

---

## ساختار داده — انتخاب سریع

| نیاز | ساختار |
|------|--------|
| دسترسی با کلید | HashMap / associative array |
| کار FIFO | Queue |
| LIFO / undo | Stack |
| ترتیب + یکتایی | TreeSet / sorted set |
| گراف وابستگی | Graph / adjacency list |

ساختار اشتباه → حتی با کد تمیز، پیچیدگی الگوریتمی بد می‌شود.

---

## بده‌بستان‌ها

| مزیت | هزینه |
|------|-------|
| scale جدا برای read/write | پیچیدگی کد بیشتر |
| read model بهینه | احتمال inconsistency کوتاه‌مدت |
| تست‌پذیری بهتر | boilerplate بیشتر |

---

## قاعدهٔ تصمیم

1. اگر نیازهای read و write از هم فاصله گرفتند → CQRS سبک را در نظر بگیر.  
2. اگر سیستم CRUD کوچک است → یک model کافی است؛ over-engineer نکن.  
3. اول **کد** را جدا کن؛ storage را فقط وقتی لازم شد.
