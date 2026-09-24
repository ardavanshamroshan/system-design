# Profiling در Docker Compose و مدیریت چند محیط

## مسئله

می‌خواهی **یک** `docker-compose.yml` داشته باشی، ولی:

- لوکال: app + mysql + mailpit + debugger  
- CI: app + mysql (بدون UI اضافه)  
- staging-like: + redis + worker  

کپی کردن سه فایل compose → drift و دردسر.

---

## راه‌حل: Compose Profiles

سرویس‌ها را با `profiles` علامت بزن؛ فقط وقتی profile فعال است بالا می‌آیند.

```yaml
services:
  app:
    build: .
    ports: ["8000:8000"]
    depends_on: [db]

  db:
    image: mysql:8.4
    environment:
      MYSQL_DATABASE: app
      MYSQL_ROOT_PASSWORD: secret
    volumes: [db_data:/var/lib/mysql]

  redis:
    image: redis:7
    profiles: ["cache", "full"]

  worker:
    build: .
    command: php artisan queue:work
    profiles: ["worker", "full"]
    depends_on: [app, redis]

  mailpit:
    image: axllent/mailpit
    ports: ["8025:8025"]
    profiles: ["dev"]

volumes:
  db_data:
```

### اجرا

```bash
# فقط سرویس‌های بدون profile + پیش‌فرض
docker compose up

# محیط توسعه با میل و کش
docker compose --profile dev --profile cache up

# همه چیز
docker compose --profile full up
```

---

## چند محیط در یک فایل — الگوها

### ۱) Profiles (بالا)

بهترین برای روشن/خاموش کردن سرویس‌های اختیاری.

### ۲) Override files

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

`docker-compose.dev.yml` فقط تفاوت‌ها را دارد (volume bind، Xdebug، ...).

### ۳) متغیر محیطی

```yaml
services:
  app:
    environment:
      APP_ENV: ${APP_ENV:-local}
      DB_HOST: ${DB_HOST:-db}
```

فایل‌های `.env`, `.env.ci`, `.env.staging` را جدا نگه دار.

---

## مثال ترکیب عملی

| محیط | فرمان تقریبی |
|------|----------------|
| Local dev | `compose --profile dev --profile cache up` |
| Queue testing | `+ --profile worker` |
| CI | بدون profile اضافه؛ فقط `app` + `db` |
| Full stack | `--profile full` |

---

## Profiling اپ داخل Docker

«Profile» در Compose با **performance profiling** فرق دارد، ولی در کانتینر هم رایج است:

```yaml
# مثال Xdebug فقط در profile=dev
  app:
    profiles: ["dev"]
    environment:
      XDEBUG_MODE: ${XDEBUG_MODE:-off}
```

برای CPU/memory:

```bash
docker stats
docker compose top
```

---

## ضدالگو

- یک compose غول‌آسا بدون profile که همه باید همه سرویس‌ها را بالا بیاورند  
- secret داخل yaml committed  
- bind mount سنگین بدون توجه به عملکرد روی macOS

---

## قانون تصمیم

1. سرویس‌های اجباری بدون profile؛ اختیاری‌ها با profile.  
2. تفاوت محیط را با `.env` + override بیان کن، نه سه فایل کاملاً جدا.  
3. در README دقیقاً بنویس هر محیط کدام profile را می‌خواهد.
