# پروفایل‌های Docker Compose و راه‌اندازی چندمحیطی

## مسئله

یک `docker-compose.yml` می‌خواهی، اما:

- Local: app + mysql + mailpit + debugger  
- CI: app + mysql (بدون UI اضافه)  
- شبیه Staging: + redis + worker  

کپی سه فایل compose → drift و دردسر.

---

## راه‌حل: Compose profiles

سرویس‌ها را با `profiles` تگ کن؛ فقط وقتی آن profile فعال است بالا می‌آیند.

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
# Only services without a profile
docker compose up

# Dev with mail and cache
docker compose --profile dev --profile cache up

# Everything
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

`docker-compose.dev.yml` فقط اختلاف‌ها را دارد (bind mount، Xdebug، …).

### ۳) Environment variables

```yaml
services:
  app:
    environment:
      APP_ENV: ${APP_ENV:-local}
      DB_HOST: ${DB_HOST:-db}
```

`.env`، `.env.ci`، `.env.staging` را جدا نگه دار.

---

## ترکیب عملی

| محیط | فرمان تقریبی |
|------|--------------|
| Local dev | `compose --profile dev --profile cache up` |
| تست queue | `+ --profile worker` |
| CI | بدون profile اضافه؛ فقط `app` + `db` |
| Full stack | `--profile full` |

---

## پروفایلینگ اپ داخل Docker

«profiles» در Compose با **performance profiling** یکی نیست، ولی هر دو در container ظاهر می‌شوند:

```yaml
# Example: Xdebug only with profile=dev
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

## Antipatternها

- یک compose غول بدون profile تا همه مجبور شوند همه سرویس را بالا بیاورند  
- Secret داخل yaml commit شده  
- Bind mount سنگین بدون توجه به عملکرد macOS

---

## قاعدهٔ تصمیم

1. سرویس‌های ضروری بدون profile؛ اختیاری‌ها با profile.  
2. اختلاف محیط را با `.env` + override بیان کن، نه سه فایل کاملاً جدا.  
3. در README دقیق بنویس هر محیط کدام profile را لازم دارد.
