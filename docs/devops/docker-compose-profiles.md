# Docker Compose Profiles & Multi-Environment Setup

## The problem

You want **one** `docker-compose.yml`, but:

- Local: app + mysql + mailpit + debugger  
- CI: app + mysql (no extra UI)  
- Staging-like: + redis + worker  

Copying three compose files → drift and pain.

---

## Solution: Compose profiles

Tag services with `profiles`; they only start when that profile is active.

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

### Run

```bash
# Only services without a profile
docker compose up

# Dev with mail and cache
docker compose --profile dev --profile cache up

# Everything
docker compose --profile full up
```

---

## Multiple environments in one file — patterns

### 1) Profiles (above)

Best for toggling optional services.

### 2) Override files

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

`docker-compose.dev.yml` holds only the diffs (bind mounts, Xdebug, …).

### 3) Environment variables

```yaml
services:
  app:
    environment:
      APP_ENV: ${APP_ENV:-local}
      DB_HOST: ${DB_HOST:-db}
```

Keep `.env`, `.env.ci`, `.env.staging` separate.

---

## Practical combo

| Environment | Approximate command |
|-------------|---------------------|
| Local dev | `compose --profile dev --profile cache up` |
| Queue testing | `+ --profile worker` |
| CI | No extra profiles; just `app` + `db` |
| Full stack | `--profile full` |

---

## App profiling inside Docker

Compose “profiles” are not the same as **performance profiling**, but both show up in containers:

```yaml
# Example: Xdebug only with profile=dev
  app:
    profiles: ["dev"]
    environment:
      XDEBUG_MODE: ${XDEBUG_MODE:-off}
```

For CPU/memory:

```bash
docker stats
docker compose top
```

---

## Antipatterns

- One giant compose with no profiles so everyone must start every service  
- Secrets committed in yaml  
- Heavy bind mounts without caring about macOS performance

---

## Decision rule

1. Required services have no profile; optional ones do.  
2. Express environment diffs with `.env` + overrides, not three fully separate files.  
3. Document in the README exactly which profiles each environment needs.
