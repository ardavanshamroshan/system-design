# کلاس Directory Query

## مسئله

وقتی فیلترها زیاد می‌شوند، controller یا repository پر از شرط می‌شود:

```php
if ($request->status) { ... }
if ($request->from) { ... }
if ($request->q) { ... }
```

این الگو **ساخت query** را در یک کلاس اختصاصی جمع می‌کند — یک «directory» واحد برای فیلترها.

---

## ایده

کلاسی که:

1. پارامترهای ورودی را می‌گیرد.  
2. آن‌ها را روی یک Query Builder پایه اعمال می‌کند.  
3. چیزی آمادهٔ اجرا برمی‌گرداند.

نام‌های رایج: `OrderQuery`، `UserDirectory`، `FilterBuilder`.

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

// Usage
$users = UserDirectoryQuery::fromRequest($request->all())
    ->apply(User::query())
    ->paginate(20);
```

---

## چرا کمک می‌کند

| بدون Query Class | با Query Class |
|------------------|----------------|
| منطق فیلتر پراکنده | یک منبع حقیقت |
| سخت برای تست | unit-test آسان فیلترها |
| شرط‌های تکراری | reuse در API، CLI، job |

---

## ارتباط با CQRS

در سمت **Query**، یک Directory/Query Class «خواندن با فیلتر» را تمیز نگه می‌دارد و از Command handler دور می‌کند.

---

## Antipatternها

- تبدیل شدن به God Object با ۵۰ فیلتر بی‌ربط  
- raw SQL ناامن بدون parameter binding  
- side effect (ارسال ایمیل) داخل query class

---

## قاعدهٔ تصمیم

1. بیش از ۲–۳ فیلتر تکراری → Query Class بساز.  
2. **فقط read/filter**؛ write را جای دیگر نگه دار.  
3. از دامنه نام بگذار (`OrderDirectory`)، نه `QueryHelper`.
