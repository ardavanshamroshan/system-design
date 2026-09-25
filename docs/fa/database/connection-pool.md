# Connection Pooling — چیست و چرا؟

> ماژول B — داده، همزمانی، پایداری · بخش ۴

## فهرست ذهنی

1. [چیست و چرا](#چیست-و-چرا)  
2. [پشت یک «query ساده» چه می‌گذرد](#پشت-یک-query-ساده-چه-میگذرد)  
3. [چرخهٔ عمر در pool](#چرخهٔ-عمر-یک-اتصال-در-pool)  
4. [Connection churn و thundering herd](#connection-churn-و-thundering-herd)  
5. [پارامترهای pool](#پارامترهای-رایج)  
6. [Laravel + PHP-FPM](#laravel--php-fpm)  
7. [Laravel Octane](#laravel-octane)  
8. [Pooler خارجی (PgBouncer / ProxySQL)](#pooler-خارجی)  
9. [FastAPI + SQLAlchemy](#fastapi--sqlalchemy-پایتون)  
10. [مقایسهٔ runtimeها](#مقایسهٔ-runtime--laravel-vs-fastapi)  
11. [ضدالگوها و قاعدهٔ تصمیم](#ضدالگوها)

---

## چیست و چرا

**Connection pool** یک cache از اتصالات باز است تا به‌جای open/close برای هر عملیات، اتصال **reuse** شود.

باز کردن اتصال **گران** است:

1. TCP handshake (و گاهی TLS)  
2. Authentication  
3. تخصیص حافظه و session state سمت سرور  

بدون pool، زیر بار: latency بالا، CPU دیتابیس صرف handshake، و خطای `too many connections`.

```
بدون pool:  Request → open → auth → query → close → (از صفر)
با pool:    Request → borrow → query → release → Pool
```

```
┌─────────────┐   borrow/release   ┌─────────────────┐  few real   ┌──────────┐
│ App Workers │ ─────────────────► │ Connection Pool │ ──────────► │ Database │
└─────────────┘                    └─────────────────┘             └──────────┘
     خیلی            multiplexing در اپ یا جلوی DB                    محدود
```

---

## پشت یک «query ساده» چه می‌گذرد

Mental model غلط: «فقط SQL بزن و جواب بگیر.»

Pipeline واقعی اغلب این است:

1. گرفتن/ساختن TCP connection  
2. Auth (+ گاهی encryption)  
3. شروع transaction (صریح یا ضمنی)  
4. Prepare / execute  
5. Commit یا rollback  
6. **Release** اتصال (به pool یا close)

اگر این pipeline زیر ترافیک مکرر از صفر تکرار شود، مشکل فقط «کندی کم» نیست — **connection churn** می‌گیری.

---

## چرخهٔ عمر یک اتصال در pool

| مرحله | معنی |
|--------|------|
| **Initialization** | موقع boot اپ/worker تعدادی اتصال ساخته و داخل pool می‌روند |
| **Request / borrow** | کد اپ یک اتصال آزاد می‌خواهد |
| **Usage** | query / transaction روی همان session |
| **Return / release** | برمی‌گردد به pool؛ معمولاً `CLOSE` واقعی به DB نیست |
| **Reuse** | request بعدی همان socket گرم را می‌گیرد |
| **Wait** | اگر همه مشغولند → صف تا `acquire timeout` |
| **Recycle / destroy** | idle timeout، max lifetime، یا failure → دور انداختن / reconnect |

فراموش کردن **release** در مسیر exception = **leak** = pool خالی = همه گیر می‌کنند.

---

## Connection churn و thundering herd

**Connection churn:** باز و بسته‌شدن زیاد TCP در بازهٔ کوتاه. CPU دو طرف (اپ + DB) می‌سوزد؛ timeout و کندی تصادفی ظاهر می‌شود.

**Thundering herd:** موج همزمان requestها که همه با هم connect می‌زنند — حتی اگر هر query سبک باشد.

علائم رایج:

- بعضی endpointها گاهی سریع، گاهی کند  
- CPU سرور اپ یا DB «عادی» است ولی latency نوسان دارد  
- لاگ: connect timeout / `too many connections`

گاهی مشکل SQL نیست — **مدیریت اتصال** است.

---

## پارامترهای رایج

| پارامتر | معنی | معادل تقریبی |
|---------|------|----------------|
| `min` / `pool_size` | اتصال‌های گرم آماده | SQLAlchemy `pool_size` |
| `max` / ceiling | سقف همزمانی | PgBouncer `default_pool_size`؛ SQLAlchemy `pool_size + max_overflow` |
| `max_overflow` | اتصال موقت اضافه زیر spike | فقط بعضی poolها (مثلاً SQLAlchemy) |
| `idle timeout` | بستن idle | `idleTimeoutMillis` در `pg` |
| `max lifetime` | چرخش اجباری قبل از stale | جلوگیری از NAT/LB silent drop |
| `acquire / connection timeout` | حداکثر انتظار برای borrow | بهتر از hang ابدی |

قانون ظرفیت:

```
Σ (max همهٔ کلاینت‌ها و سرویس‌ها)  <  max_connections(DB) − رزرو ops (۱۰–۲۰٪)
```

Horizon، queue، scheduler، staging را هم جمع بزن.

---

## Laravel + PHP-FPM

### Lifecycle درخواست

مدل کلاسیک:

```
Request شروع → boot Laravel → lazy DB connect روی اولین query → پایان request → process آزاد
```

- Laravel معمولاً **lazy connection** دارد: تا اولین query وصل نمی‌شود.  
- بین requestهای FPM، مگر persistent، اتصال «موتور جاودان» مثل FastAPI نیست.  
- **PDO connection pool سطح‌اپ مثل Hikari / SQLAlchemy ندارد.**

فرمول خطرناک:

```
کل اتصالات ≈ ماشین‌ها × pm.max_children × (اتصالات per worker)
```

مثال: `3 × 50 × 1 = 150` — بدون Horizon/queue.

### `config/database.php`

```php
'mysql' => [
    'driver' => 'mysql',
    'url' => env('DB_URL'),
    'host' => env('DB_HOST', '127.0.0.1'),
    'port' => env('DB_PORT', '3306'),
    'database' => env('DB_DATABASE', 'laravel'),
    'username' => env('DB_USERNAME', 'root'),
    'password' => env('DB_PASSWORD', ''),
    'charset' => 'utf8mb4',
    'collation' => 'utf8mb4_unicode_ci',
    'options' => extension_loaded('pdo_mysql') ? array_filter([
        // PDO::ATTR_PERSISTENT => true, // معمولاً در FPM غیرایده‌آل
        PDO::MYSQL_ATTR_SSL_CA => env('MYSQL_ATTR_SSL_CA'),
    ]) : [],
],

'pgsql' => [
    'driver' => 'pgsql',
    'host' => env('DB_HOST', '127.0.0.1'),
    'port' => env('DB_PORT', '5432'),
    'database' => env('DB_DATABASE', 'laravel'),
    'username' => env('DB_USERNAME', 'root'),
    'password' => env('DB_PASSWORD', ''),
    'charset' => 'utf8',
    // وقتی pooler داری، host را به PgBouncer بده (مثلاً :6432)
],
```

نکات PDO persistent در FPM:

- state کثیف بین requestها (`SET`، temp table، `LOCK`)  
- اتصال مرده که PDO فکر می‌کند زنده است  
- debugg سخت‌تر  

مشکل scale را با persistent «حل» نکن — **pooler** بگذار.

### استفادهٔ روزمره در کد

```php
// Lazy: تا اینجا هنوز ممکن است وصل نشده باشد
$users = DB::table('users')->where('active', 1)->get();

// تراکنش کوتاه — اتصال را dur کار خارجی نگه ندار
DB::transaction(function () use ($orderId) {
    $order = Order::lockForUpdate()->findOrFail($orderId);
    $order->update(['status' => 'paid']);
});

// بد: اتصال (+ قفل) گیر می‌کند
DB::beginTransaction();
$order = Order::lockForUpdate()->findOrFail($orderId);
Http::post('https://payment.example/charge', [...]); // I/O خارجی
$order->update(['status' => 'paid']);
DB::commit();
```

الگوی بهتر: اول کار خارجی (یا بعد از commit مرحلهٔ آماده‌سازی)، DB را کوتاه نگه دار.

### Read / Write connections

```php
// config/database.php
'mysql' => [
    'read' => [
        'host' => [
            env('DB_READ_HOST_1'),
            env('DB_READ_HOST_2'),
        ],
    ],
    'write' => [
        'host' => [env('DB_WRITE_HOST')],
    ],
    'sticky' => true,
    // ...
],
```

```php
// read معمولاً به replica
User::on('mysql')->where(...)->get(); // یا پیش‌فرض read برای SELECT

// write صریح
DB::connection('mysql')->table('orders')->insert([...]);
```

هر نام connection که استفاده شود می‌تواند یک PDO جدا باز کند. در FPM عمر کوتاه است؛ در Octane ممکن است **همهٔ آن‌ها روی worker زنده بمانند** → ضربدر تعداد worker حساب کن.

### سرویس‌هایی که فراموش می‌شوند

| منبع | اثر روی تعداد اتصال |
|------|---------------------|
| `php-fpm` workers | پایه |
| `horizon` / queue workers | اغلب مساوی یا بیشتر از HTTP |
| `schedule:run` / commands | spike کوتاه |
| feature test / CI موازی | غافلگیرکننده |

---

## Laravel Octane

### Octane pool نیست — اتصال گرم per worker است

جمع‌بندی رسمی/عملی (بحث Laravel `#42108` و توضیح Mohamed Said):

> Octane وقتی worker بالا می‌آید (یا روی اولین استفاده) به DB وصل می‌شود و **همان اتصال** برای requestهای بعدی همان worker reuse می‌شود.

یعنی:

| انتظار Java/Hikari | واقعیت Octane |
|--------------------|----------------|
| Pool با N اتصال داخل process، borrow/release بین coroutineها | معمولاً **۱ اتصال (per connection name) per worker** |
| Scale خودکار اندازهٔ pool داخل اپ | Scale = تعداد workerها × اتصالات باز |

پس Octane **connection churn را کم می‌کند** (دیگر هر request connect نمی‌زند)، ولی **جایگزین PgBouncer نیست**. اگر ۱۰۰ worker Swoole داشته باشی، DB می‌تواند ۱۰۰ اتصال ببیند — گزارش‌های واقعی همین را با Postgres دیده‌اند و با PgBouncer حل کرده‌اند.

### `config/octane.php` و listeners

به‌صورت پیش‌فرض، disconnect اجباری بعد از هر request اغلب **خاموش** است تا اتصال گرم بماند. اگر `DisconnectFromDatabases` را فعال کنی، رفتار به FPM نزدیک‌تر می‌شود (reconnect بیشتر = churn بیشتر، state کمتر).

مفهومی:

```php
// octane.php — listeners (نسخه‌ها فرق دارند؛ ایده مهم است)
'listeners' => [
    RequestReceived::class => [
        // ...
        // DisconnectFromDatabases::class, // اگر uncomment شود → قطع بعد از request
    ],
    RequestTerminated::class => [
        // پاکسازی state؛ مراقب transaction بازمانده باش
    ],
],
```

`warm` در Octane یعنی بعضی bindingها از قبل resolve شوند (مثلاً DatabaseManager) — **معنی‌اش pool با چند اتصال نیست**.

### دام‌های واقعی Octane

**۱) Transaction بازمانده بین requestها**

باگ: `beginTransaction` بدون commit/rollback → همان worker request بعدی را داخل snapshot ایزوله می‌بیند. رفتار «عجیب و ناهماهنگ»؛ timeout روی برخی سرویس‌ها (مثلاً PlanetScale) گزارش شده.

```php
// همیشه مرز تراکنش را ببند — حتی در exception
DB::beginTransaction();
try {
    // ...
    DB::commit();
} catch (\Throwable $e) {
    DB::rollBack();
    throw $e;
}

// یا:
DB::transaction(function () { /* ... */ });
```

**۲) State روی connection**

`DB::statement('SET search_path TO ...')` یا متغیرهای session → request بعدی همان worker آلوده می‌شود مگر reset کنی.

**۳) Read/write + چند host**

انتخاب تصادفی host موقع اولین connect، بعد sticky روی worker، می‌تواند همهٔ ترافیک read را به یک replica بچسباند. راه‌حل‌های عملی: round-robin در middleware با چند connection name، یا سپردن تعادل به proxy/pooler.

**۴) هنوز به pooler نیاز داری**

```
Octane workers (زیاد) → PgBouncer (سقف واقعی) → Postgres
```

بدون آن، Octane فقط churn را جابه‌جا می‌کند به «اتصالات بلندعمرِ بیش از حد».

---

## Pooler خارجی

وقتی runtime اپ pool داخلی قوی ندارد (FPM) یا worker زیاد است (Octane)، pooling را **جلوی DB** می‌گذاری:

```
Laravel / FastAPI / Node  →  PgBouncer / ProxySQL / RDS Proxy  →  Database
```

### PgBouncer

```ini
[databases]
app = host=127.0.0.1 port=5432 dbname=app

[pgbouncer]
listen_port = 6432
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
reserve_pool_size = 5
```

| `pool_mode` | رفتار | نکته |
|-------------|--------|------|
| session | تا قطع کلاینت | سازگار؛ multiplexing کم |
| transaction | بعد از commit آزاد | پیش‌فرض خوب |
| statement | بعد از هر statement | محدودیت زیاد |

در Laravel کافی است `DB_HOST`/`DB_PORT` به PgBouncer اشاره کند.

### ProxySQL / RDS Proxy

- **ProxySQL:** MySQL — multiplexing، routing، failover  
- **RDS Proxy:** managed — مناسب burst و serverless-like fan-out  

---

## FastAPI + SQLAlchemy (پایتون)

FastAPI (و عموماً uvicorn workerها) **long-running** است. SQLAlchemy Engine از اول یک **connection pool مدیر** است — برخلاف Laravel+FPM.

### ساخت engine با pool

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

engine = create_async_engine(
    "postgresql+asyncpg://user:pass@db:5432/app",
    pool_size=20,          # اتصال‌های پایدار در pool
    max_overflow=10,       # موقت زیر spike → سقف ۳۰
    pool_timeout=30,       # انتظار برای borrow
    pool_recycle=1800,     # جلوگیری از stale (ثانیه)
    pool_pre_ping=True,    # قبل از استفاده زنده بودن را چک کن
)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
```

معنی عملی:

- ۲۰ اتصال گرم آماده  
- تا ۱۰ اضافه زیر بار ناگهانی  
- هر request قرض می‌گیرد و برمی‌گرداند — برای هر query از صفر connect نمی‌زند  

### الگوی وابستگی در FastAPI

```python
from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

app = FastAPI()

async def get_db():
    async with SessionLocal() as session:
        yield session
        # خروج از context → release به pool

@app.get("/users")
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT id, email FROM users LIMIT 50"))
    return [dict(r._mapping) for r in result]
```

### چند worker uvicorn و ظرفیت

```
کل اتصالات ≈ (تعداد processهای uvicorn) × (pool_size + max_overflow)
```

مثال: ۴ worker × ۳۰ = ۱۲۰. باز هم می‌توانی جلوی Postgres یک PgBouncer بگذاری تا چند سرویس یک سقف مشترک داشته باشند.

### همگام (sync) برای مقایسه

```python
from sqlalchemy import create_engine

engine = create_engine(
    "postgresql+psycopg2://user:pass@db:5432/app",
    pool_size=10,
    max_overflow=5,
    pool_pre_ping=True,
)
```

ایده همان است؛ async فقط I/O غیرمسدود اضافه می‌کند.

---

## مقایسهٔ runtime — Laravel vs FastAPI

این جنگ فریمورک نیست — **مدل runtime** است.

| | Laravel (FPM) | Laravel (Octane) | FastAPI + SQLAlchemy |
|--|---------------|------------------|----------------------|
| عمر process | کوتاه per request | بلند per worker | بلند per worker |
| Pool داخل اپ | عملاً خیر | خیر (۱ conn گرم / worker) | بله (`pool_size` / `max_overflow`) |
| کجا pool می‌کنی؟ | معمولاً **بیرون** (PgBouncer) | worker گرم + ترجیحاً pooler | **داخل** engine (+ اختیاری pooler) |
| DX کانفیگ pool | ضعیف در `database.php` | listeners / مراقبت state | واضح روی engine |
| ریسک اصلی | churn + too many conn | leak / tx باز / sticky | overflow × workers |

جملهٔ کلیدی:

> FastAPI معمولاً داخل اپ pool می‌کند؛ Laravel (FPM) معمولاً بیرون اپ. هدف یکی است — لایه فرق دارد.

---

## ضدالگوها

1. بالا بردن بی‌فکر `max_connections` بدون RAM  
2. `FPM/Octane/Horizon workers × conn > ظرفیت`  
3. I/O خارجی وسط transaction  
4. فرض «Laravel خودش مثل SQLAlchemy pool دارد»  
5. Octane بدون pooler وقتی worker زیاد است  
6. Transaction/session state بدون پاکسازی در Octane  
7. در FastAPI: `pool_size` بزرگ × تعداد worker بدون جمع کل  
8. `pool.end()` بعد از هر query در Node/`pg` (مثال‌های بد آموزشی) — در prod اتصال/pool را per-query نابود نکن  

---

## چه چیزی را اندازه بگیریم؟

| متریک | سیگنال |
|-------|--------|
| `numbackends` / Threads_connected | نزدیک سقف DB |
| Acquire wait / pool timeout | pool تنگ |
| Connect errors | churn یا ظرفیت |
| p99 latency با query سبک | اغلب اتصال، نه SQL |
| Open tx مدت‌دار (Octane) | leak منطقی |

---

## قاعدهٔ تصمیم

1. **FPM + scale افقی** → PgBouncer / ProxySQL / RDS Proxy اجباری‌تر از persistent PDO.  
2. **Octane** → اتصال گرم per worker را بفهم؛ pool جاوا نیست؛ worker را محدود کن + ترجیحاً pooler.  
3. **FastAPI** → `pool_size` و `max_overflow` را صریح تنظیم کن؛ ضربدر workers را حساب کن.  
4. همیشه: borrow/تراکنش کوتاه؛ بدون HTTP خارجی وسط اتصال باز.  
5. کندی تصادفی زیر بار → اول connection churn را رد کن، بعد سراغ کوئری برو.
