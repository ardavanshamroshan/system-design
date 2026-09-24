# Directory Query Class

## مسئله

وقتی فیلترها زیاد می‌شوند، controller یا repository پر از شرط می‌شود:

```php
if ($request->status) { ... }
if ($request->from) { ... }
if ($request->q) { ... }
```

این الگو، **ساخت query** را در یک کلاس مشخص جمع می‌کند — مثل «دفترچهٔ راهنمای فیلترها».

---

## ایده

یک کلاس که:

1. پارامترهای ورودی را می‌گیرد.  
2. روی یک Query Builder پایه اعمال می‌کند.  
3. نتیجهٔ آمادهٔ اجرا برمی‌گرداند.

نام‌های رایج: `OrderQuery`, `UserDirectory`, `FilterBuilder`.

---

## مثال PHP / Laravel

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

// استفاده
$users = UserDirectoryQuery::fromRequest($request->all())
    ->apply(User::query())
    ->paginate(20);
```

---

## چرا مفید است؟

| بدون Query Class | با Query Class |
|------------------|----------------|
| منطق فیلتر پخش در چند جا | یک منبع حقیقت |
| تست سخت | تست واحد روی فیلترها آسان |
| تکرار شرط‌ها | reuse در API، CLI، job |

---

## ارتباط با CQRS

در سمت **Query**، Directory/Query Class دقیقاً همان «خواندن با فیلتر» را تمیز نگه می‌دارد و با Commandها قاطی نمی‌شود.

---

## ضدالگو

- تبدیل شدن به God Object با ۵۰ فیلتر نامرتبط  
- SQL خام خطرناک داخل کلاس بدون parameter binding  
- قاطی کردن side-effect (مثل ارسال ایمیل) داخل query class

---

## قانون تصمیم

1. اگر بیش از ۲–۳ فیلتر تکرارشونده داری → Query Class بساز.  
2. فقط **خواندن/فیلتر**؛ نوشتن را جدا نگه دار.  
3. نام کلاس را از دامنه بگیر (`OrderDirectory`)، نه `QueryHelper`.
