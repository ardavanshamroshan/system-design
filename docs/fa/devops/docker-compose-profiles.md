# پروفایل‌های Docker Compose و Profiling

> ماژول E — عملیات و محیط · بخش ۱۴

## فهرست ذهنی

1. [چیست و چرا](#چیست-و-چرا)  
2. [Compose profiles — گروه‌بندی سرویس](#compose-profiles--گروه‌بندی-سرویس)  
3. [نمونه: local / test / profiling](#نمونه-local--test--profiling)  
4. [دستورها](#دستورها)  
5. [پروفایلینگ اپ داخل Laravel](#پروفایلینگ-اپ-داخل-laravel)  
6. [راه‌های دیگر جدا کردن محیط](#راه‌های-دیگر-جدا-کردن-محیط)  
7. [کی استفاده / کی نه](#کی-استفاده--کی-نه)  
8. [قانون تصمیم](#قانون-تصمیم)  
9. [ضدالگوها](#ضدالگوها)

---

## چیست و چرا

**Compose profiles** سرویس‌ها را گروه‌بندی می‌کند تا با **یک** فایل، محیط local / test / profiling را بدون فایل‌های پراکنده مدیریت کنی.

**Profiling** (کلمهٔ دیگر، دغدغهٔ ops مرتبط): اندازه‌گیری CPU / RAM / query (Blackfire، Xdebug، Telescope) **بدون** اینکه همیشه روی همهٔ developerها روشن باشد.

| نیاز | ایدهٔ profile |
|------|----------------|
| کدنویسی روزمره | `dev` — app، mysql، redis، mailhog |
| تست خودکار | `test` — app سبک‌تر + mysql |
| عملکرد عمیق | `profiling` — Blackfire / Xdebug اضافه |

کپی سه فایل compose کامل → drift. Profile سرویس اختیاری را خاموش نگه می‌دارد تا بخواهی.

مرتبط: [Connection pooling](/fa/database/connection-pool) · مسیر یادگیری ماژول E (ops)

---

## Compose profiles — گروه‌بندی سرویس

سرویس را با `profiles` تگ کن. فقط وقتی آن profile فعال است بالا می‌آید. سرویس **بدون** profile همیشه start می‌شود (خوب برای baseline واقعی — یا اگر ترجیح می‌دهی همه پشت `--profile` صریح باشند، همه را تگ کن).

```
docker compose --profile X up
        │
        ▼
 فقط سرویس‌های تگ‌شده با X (+ بدون‌تگ، اگر باشد)
```

---

## نمونه: local / test / profiling

```yaml
services:
  app:
    build: .
    volumes: [.:/var/www]
    environment:
      APP_ENV: local
    depends_on: [mysql, redis]
    profiles: ["dev", "full"]

  mysql:
    image: mysql:8.4
    environment:
      MYSQL_DATABASE: app
      MYSQL_ROOT_PASSWORD: secret
    profiles: ["dev", "test", "full"]

  redis:
    image: redis:7-alpine
    profiles: ["dev", "full"]

  # فقط وقتی پروفایل می‌خواهی
  blackfire:
    image: blackfire/blackfire:2
    environment:
      BLACKFIRE_SERVER_ID: ${BLACKFIRE_SERVER_ID}
      BLACKFIRE_SERVER_TOKEN: ${BLACKFIRE_SERVER_TOKEN}
    profiles: ["profiling"]

  mailhog:
    image: mailhog/mailhog
    ports: ["8025:8025"]
    profiles: ["dev"]

  # محیط تست سبک‌تر
  app-test:
    build: .
    environment:
      APP_ENV: testing
      DB_DATABASE: app_test
    depends_on: [mysql]
    profiles: ["test"]
```

| Profile | سرویس‌های معمول |
|---------|------------------|
| `dev` | app، mysql، redis، mailhog |
| `test` | app-test، mysql |
| `profiling` | blackfire (+ هرچه تگ کنی) |
| `full` | کل stack محلی |

::: tip
Secretها در `.env` / secret store — هرگز `BLACKFIRE_SERVER_TOKEN` را داخل yaml commit نکن.
:::

---

## دستورها

```bash
docker compose --profile dev up -d
docker compose --profile profiling up -d   # blackfire (و هرچه تگ شده)
docker compose --profile test run --rm app-test php artisan test
```

ترکیب profile وقتی لازم:

```bash
docker compose --profile dev --profile profiling up -d
```

چک سطح host (Compose profile نیست، ولی هنگام profiling مفید است):

```bash
docker stats
docker compose top
```

---

## پروفایلینگ اپ داخل Laravel

Compose profile ابزار را بالا می‌آورد. کد اپ هنوز تصمیم می‌گیرد در `local` چه چیزی ثبت شود:

```php
// Telescope فقط local
if ($this->app->environment('local')) {
    $this->app->register(TelescopeServiceProvider::class);
}

// Debugbar / Clockwork برای request timeline
```

| ابزار | نقش | پشت چه بماند |
|-------|-----|----------------|
| **Telescope** | timeline درخواست / job / query | `local` (یا staging با احتیاط) |
| **Debugbar / Clockwork** | timeline هر request در مرورگر | `local` |
| **Xdebug** | step debug / کمی profiling | Compose `dev` + پیش‌فرض `XDEBUG_MODE=off` |
| **Blackfire** | پروفایل CPU/wall سطح production | Compose `profiling` |

Agent سنگین همیشه روشن → لپ‌تاپ کند و CI شلوغ. Profile را on-demand بگیر.

---

## راه‌های دیگر جدا کردن محیط

Profile یک ابزار است. در صورت نیاز مخلوط کن:

### ۱) Profiles (بالا)

بهترین برای sidecar اختیاری (mail، profiler، worker).

### ۲) Override files

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

`docker-compose.dev.yml` فقط اختلاف‌ها (bind mount، پورت Xdebug، …).

### ۳) Environment variables

```yaml
services:
  app:
    environment:
      APP_ENV: ${APP_ENV:-local}
      DB_HOST: ${DB_HOST:-mysql}
```

`.env`، `.env.ci`، `.env.staging` را از ساختار compose جدا نگه دار.

| رویکرد | قدرت |
|--------|------|
| Profiles | روشن/خاموش کل سرویس |
| Overrides | لایهٔ اختلاف کوچک |
| Env files | کانفیگ بدون کانتینر جدید |

---

## کی استفاده / کی نه

**استفاده وقتی**

- یک repo، چند «جور» stack محلی  
- ابزار سنگین (Xdebug، Blackfire، Mailhog) نباید هر `up` را سنگین کند  
- CI به profile نازک‌تر از `dev` لپ‌تاپ نیاز دارد  

**رد / بازنگری وقتی**

- برای همیشه یک سرویس ریز — compose ساده کافی است  
- شبکه/ایمیج کاملاً متفاوت لازم است (آن‌وقت فایل‌های جدا گاهی شفاف‌ترند)  

---

## قانون تصمیم

```
ابزار سنگین / اختیاری؟
  بله → سرویس را پشت Compose profile بگذار
       + providerهای اپ را با APP_ENV / چک local محدود کن
  خیر → baseline بدون‌تگ یا وابستگی هستهٔ همیشه روشن

dev روزمره سبک بماند.
هرگز: همه برای بالا آوردن اپ باید Blackfire + Mailhog + Xdebug را start کنند.
```

1. Baseline لازم: بدون profile (یا `--profile` پیش‌فرض را در README بنویس).  
2. اختیاری / سنگین: `profiles: [...]`.  
3. اختلاف کانفیگ: `.env` + override.  
4. README: هر محیط کدام profile را می‌خواهد.

---

## ضدالگوها

- یک compose غول بدون profile — هر لپ‌تاپ همهٔ sidecar را start می‌کند  
- Secret داخل yaml commit‌شده  
- Xdebug / Blackfire همیشه `on` در ایمیج پیش‌فرض  
- سه فایل compose کامل تکراری که هفتگی drift می‌کنند  
- Bind mount سنگین روی macOS بدون توجه به هزینهٔ I/O  

---

## تمرین ذهنی

1. نیروی جدید `docker compose up` می‌زند و خطای Blackfire (token نیست) می‌گیرد. مجموعهٔ profile پیش‌فرض باید چطور باشد؟  
2. CI فقط mysql + `php artisan test` می‌خواهد. کدام profile و کدام سرویس؟  
3. Telescope اشتباه در `production` ثبت شد — فقط Compose profiles کافی است جلویش را بگیرد؟

::: tip راهنما
1. blackfire را روی مسیر پیش‌فرض `dev` نگذار؛ `profiling` · 2. `--profile test` + `app-test` · 3. نه — با `environment('local')` / config هم محدود کن؛ Compose ≠ ثبت provider در PHP
:::
