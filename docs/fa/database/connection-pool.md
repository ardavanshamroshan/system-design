# Connection Pooling — چیست و چرا؟

## مسئله

باز کردن اتصال دیتابیس **گران** است:

- TCP handshake  
- Authentication  
- تخصیص حافظه سمت سرور  

اگر هر HTTP request یک اتصال جدید باز و بسته کند، زیر بار ذوب می‌شوی.

---

## Connection pool چیست؟

یک **مجموعهٔ آماده از اتصال‌ها** که اپ قرض می‌گیرد و برمی‌گرداند:

```
Request → borrow conn → query → release conn → Pool
```

به‌جای:

```
Request → open → query → close  (هر بار از صفر)
```

---

## چرا مهم است

| بدون pool | با pool |
|-----------|---------|
| latency بالا | reuse سریع |
| فشار روی DB با اتصال زیاد | سقف کنترل‌شده (`max_connections`) |
| Thundering herd در spike | صف انتظار / timeout مشخص |

دیتابیس‌ها `max_connections` دارند. ۱۰۰ اپ × ۵۰ اتصال خام = فاجعه.

---

## پارامترهای رایج

| پارامتر | معنی |
|---------|------|
| `min` / idle size | اتصال‌های گرم آماده |
| `max` | سقف همزمانی |
| `idle timeout` | بستن اتصال‌های بیکار |
| `max lifetime` | چرخش قبل از مشکل شبکه/NAT |
| `acquire timeout` | چقدر منتظر بمانی اگر pool خالی است |

یادداشت مفهومی PDO:

```ini
; PHP-FPM workers × connections_per_worker ≈ total to DB
; Align max pool with worker count
```

در Laravel اغلب با persistent connection / پروکسی‌هایی مثل **PgBouncer** / **ProxySQL** مدیریت می‌شود.

---

## Pooler خارجی

برای Postgres خیلی رایج:

```
App → PgBouncer → PostgreSQL
```

فایده: صدها کلاینت اپ روی اتصال‌های واقعی کمتری از DB نگاشت می‌شوند (transaction pooling).

---

## Antipatternها

- `max` خیلی بزرگ per instance بدون جمع زدن روی کل ناوگان  
- نگه داشتن اتصال طی job طولانی بدون نیاز  
- Leak: borrow بدون release در مسیر خطا  
- فرض «Laravel همیشه بهینه pool می‌کند» بدون اندازه‌گیری

---

## قاعدهٔ تصمیم

1. workers/processes × connections را حساب کن؛ زیر `max_connections` بمان.  
2. برای scale افقی، pooler خارجی را جدی بگیر.  
3. Metrics: انتظار برای اتصال، زمان acquire، تعداد اتصال فعال.
