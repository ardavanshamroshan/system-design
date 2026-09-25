# Cache Aside، Read-Through و Write-Through

## چرا cache؟

دیتابیس از حافظه گران‌تر و کندتر است. Cache جلوی دادهٔ داغ می‌نشیند.

سه الگوی کلاسیک:

| الگو | خواندن | نوشتن |
|------|--------|-------|
| **Cache-Aside** | مسئولیت با اپ | مسئولیت با اپ |
| **Read-Through** | لایهٔ cache لود می‌کند | معمولاً جدا |
| **Write-Through** | — | Cache + DB با هم |

---

## Cache-Aside (lazy loading)

رایج‌ترین در وب‌اپ‌ها:

```
1. از cache بخوان
2. روی miss → از DB بخوان
3. داخل cache بنویس
4. به کلاینت برگردان
```

```php
function getUser(string $id): array
{
    $key = "user:{$id}";
    $cached = Redis::get($key);
    if ($cached) {
        return json_decode($cached, true);
    }

    $user = DB::table('users')->where('id', $id)->first();
    Redis::setex($key, 3600, json_encode($user));

    return (array) $user;
}
```

### روی update

```php
function updateUser(string $id, array $data): void
{
    DB::table('users')->where('id', $id)->update($data);
    Redis::del("user:{$id}"); // invalidate
}
```

::: tip
Invalidation ساده‌تر از به‌روز کردن entry در cache است و وقتی اشتباه شود، معمولاً دادهٔ stale کمتری می‌گذارد.
:::

---

## Read-Through

کلاینت فقط با cache حرف می‌زند. روی miss، **خود لایهٔ cache** از DB لود می‌کند و خودش را پر می‌کند.

```
App → Cache → (miss) → DB → Cache → App
```

مزیت: منطق miss یک‌جا می‌ماند.  
هزینه: به cache providerی نیاز داری که loader پشتیبانی کند.

---

## Write-Through

هر write همزمان به **cache و DB** می‌رود.

```
App → Cache + DB (با هم)
```

| مزیت | هزینه |
|------|-------|
| Cache تازه می‌ماند | latency نوشتن بالاتر |
| بعد از write miss کمتر | اگر cache پایین باشد سخت‌تر |

مرتبط: **Write-Behind** — اول cache، بعد flush ناهمزمان به DB (سریع‌تر، ریسک از دست رفتن داده).

---

## مقایسهٔ سریع

| معیار | Cache-Aside | Read-Through | Write-Through |
|-------|-------------|--------------|---------------|
| کنترل اپ | بالا | کمتر | متوسط |
| پیچیدگی | کم | متوسط | متوسط |
| تازگی | وابسته به invalidate | خوب روی read | خوب روی write |
| کاربرد رایج | Redis + Laravel | CDN / کتابخانه‌های ORM cache | Session / config store |

---

## Antipatternها

- TTL خیلی بلند بدون invalidate → دادهٔ stale  
- Cache کردن نتیجهٔ query شخصی با key بد  
- Stampede: هزاران request بعد از expire یک کلید

برای stampede: short lock، soft TTL، یا انقضای زودهنگام احتمالی.

---

## قاعدهٔ تصمیم

1. بیشتر APIهای CRUD → **Cache-Aside + invalidate**.  
2. اگر اپ نباید از loader خبر داشته باشد → Read-Through.  
3. اگر consistency نوشتن حیاتی است → Write-Through (یا اصلاً cache نکن).
