# Connection Pooling — چیست و چرا؟

## مسئله

باز کردن اتصال به دیتابیس **گران** است:

- handshake TCP  
- احراز هویت  
- تخصیص حافظه سمت سرور  

اگر برای هر HTTP request یک اتصال جدید باز و بسته کنی، زیر بار می‌سوزی.

---

## Connection Pool چیست؟

یک **مجموعهٔ آماده از اتصال‌ها** که برنامه قرض می‌گیرد و برمی‌گرداند:

```
Request → borrow conn → query → release conn → Pool
```

به‌جای:

```
Request → open → query → close  (هر بار از صفر)
```

---

## چرا مهم است؟

| بدون pool | با pool |
|-----------|---------|
| latency بالا | reuse سریع |
| فشار به DB با اتصال زیاد | سقف کنترل‌شده (`max_connections`) |
| thundering herd هنگام spike | صف انتظار / timeout مشخص |

دیتابیس معمولاً حد `max_connections` دارد. ۱۰۰ اپ × ۵۰ اتصال خام = فاجعه.

---

## پارامترهای رایج

| پارامتر | معنی |
|---------|------|
| `min` / idle size | اتصال‌های گرم آماده |
| `max` | سقف همزمان |
| `idle timeout` | بستن اتصال بیکار |
| `max lifetime` | چرخش اتصال قبل از مشکل شبکه/NAT |
| `acquire timeout` | اگر pool خالی بود چقدر صبر کن |

مثال PDO / مفهومی:

```ini
; PHP-FPM workers × connections_per_worker ≈ total to DB
; پس max pool را با تعداد worker هماهنگ کن
```

در Laravel اغلب از طریق persistent connections / proxyهایی مثل **PgBouncer** / **ProxySQL** مدیریت می‌شود.

---

## External Pooler

برای Postgres خیلی رایج است:

```
App → PgBouncer → PostgreSQL
```

مزیت: صدها کلاینت اپ به تعداد کمتری اتصال واقعی روی DB نگاشت می‌شوند (transaction pooling).

---

## ضدالگو

- `max` خیلی بزرگ روی هر instance بدون حساب کل  
- نگه داشتن اتصال داخل job طولانی بدون نیاز  
- leak: borrow بدون release در path خطا  
- فرض اینکه «Laravel خودش همیشه بهینه pool می‌کند» بدون اندازه‌گیری

---

## قانون تصمیم

1. تعداد worker/process × اتصال را حساب کن؛ از `max_connections` کمتر بمان.  
2. برای مقیاس افقی، pooler بیرونی را جدی بگیر.  
3. متریک: انتظار برای اتصال، زمان acquire، تعداد اتصال فعال.
