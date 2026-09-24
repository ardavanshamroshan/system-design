# Cache Aside، Read-Through و Write-Through

## چرا Cache؟

دیتابیس گران و کندتر از حافظه است. Cache لایهٔ سریع جلوی دادهٔ پرتکرار می‌گذارد.

سه الگوی کلاسیک:

| الگو | خواندن | نوشتن |
|------|--------|-------|
| **Cache-Aside** | اپلیکیشن مسئول | اپلیکیشن مسئول |
| **Read-Through** | cache lib مسئول | معمولاً جدا |
| **Write-Through** | — | همزمان cache + DB |

---

## Cache-Aside (Lazy Loading)

رایج‌ترین الگو در وب‌اپ‌ها:

```
1. بخوان از cache
2. اگر miss → بخوان از DB
3. بنویس داخل cache
4. برگردان به کلاینت
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

### هنگام Update

```php
function updateUser(string $id, array $data): void
{
    DB::table('users')->where('id', $id)->update($data);
    Redis::del("user:{$id}"); // invalidate
}
```

::: tip
Invalidate ساده‌تر از update کردن cache است و کمتر stale می‌ماند اشتباه.
:::

---

## Read-Through

کلاینت فقط با cache حرف می‌زند. اگر miss شود، **خودِ لایهٔ cache** از DB می‌خواند و پر می‌کند.

```
App → Cache → (miss) → DB → Cache → App
```

مزیت: منطق miss در یک جا.  
هزینه: نیاز به cache provider که loader داشته باشد.

---

## Write-Through

هر write همزمان به **cache و DB** می‌رود.

```
App → Cache + DB (با هم)
```

| مزیت | هزینه |
|------|-------|
| cache همیشه تازه | latency بیشتر روی write |
| miss کمتر بعد از write | اگر cache down شود، پیچیده‌تر |

نزدیک: **Write-Behind** — اول cache، بعد async به DB (سریع‌تر، خطر از دست رفتن داده).

---

## مقایسهٔ سریع

| معیار | Cache-Aside | Read-Through | Write-Through |
|-------|-------------|--------------|---------------|
| کنترل اپ | زیاد | کمتر | متوسط |
| پیچیدگی | کم | متوسط | متوسط |
| تازگی داده | وابسته به invalidate | خوب روی read | خوب روی write |
| استفاده رایج | Redis + Laravel | CDN / libهای ORM cache | session / config store |

---

## ضدالگو

- TTL خیلی بلند بدون invalidate → دادهٔ کهنه  
- cache کردن نتیجهٔ queryهای شخصی‌سازی‌شده بدون کلید درست  
- stampede: هزار درخواست همزمان بعد از expire یک کلید

برای stampede: lock کوتاه، soft TTL، یا probabilistic early expiration.

---

## قانون تصمیم

1. بیشتر APIهای CRUD → **Cache-Aside + invalidate**.  
2. اگر می‌خواهی app از loader بی‌خبر باشد → Read-Through.  
3. اگر consistency روی write حیاتی است → Write-Through (یا اصلاً cache نکن).
