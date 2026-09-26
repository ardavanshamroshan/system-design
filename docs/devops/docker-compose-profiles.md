# Docker Compose Profiles & Profiling

> Module E — Ops & Environments · Section 14

## Mental outline

1. [What and why](#what-and-why)  
2. [Compose profiles — group services](#compose-profiles--group-services)  
3. [Sample: local / test / profiling](#sample-local--test--profiling)  
4. [Commands](#commands)  
5. [App profiling inside Laravel](#app-profiling-inside-laravel)  
6. [Other ways to split environments](#other-ways-to-split-environments)  
7. [When to use / skip](#when-to-use--skip)  
8. [Decision rule](#decision-rule)  
9. [Antipatterns](#antipatterns)

---

## What and why

**Compose profiles** group services so **one** `docker-compose.yml` can drive local / test / profiling without a pile of nearly identical files.

**Profiling** (different word, related ops concern): measure CPU / RAM / queries (Blackfire, Xdebug, Telescope) **without** forcing that stack onto every developer every day.

| Need | Profile idea |
|------|----------------|
| Day-to-day coding | `dev` — app, mysql, redis, mailhog |
| Automated tests | `test` — lighter app + mysql |
| Deep performance | `profiling` — Blackfire / Xdebug extras |

Copying three full compose files → config drift. Profiles keep optional services dark until you ask.

Related: [Connection pooling](/database/connection-pool) · learning path Module E (ops)

---

## Compose profiles — group services

Tag a service with `profiles`. It starts **only** when that profile is active. Services with **no** profile always start (good for the true baseline — or put everything behind profiles if you prefer explicit `--profile`).

```
docker compose --profile X up
        │
        ▼
 only services tagged X (+ untagged, if any)
```

---

## Sample: local / test / profiling

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

  # only when you want profiling
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

  # lighter test environment
  app-test:
    build: .
    environment:
      APP_ENV: testing
      DB_DATABASE: app_test
    depends_on: [mysql]
    profiles: ["test"]
```

| Profile | Typical services |
|---------|------------------|
| `dev` | app, mysql, redis, mailhog |
| `test` | app-test, mysql |
| `profiling` | blackfire (+ whatever else you tag) |
| `full` | kitchen-sink local stack |

::: tip
Put secrets in `.env` / a secret store — never commit `BLACKFIRE_SERVER_TOKEN` into the yaml.
:::

---

## Commands

```bash
docker compose --profile dev up -d
docker compose --profile profiling up -d   # bring blackfire (and anything else tagged)
docker compose --profile test run --rm app-test php artisan test
```

Combine profiles when needed:

```bash
docker compose --profile dev --profile profiling up -d
```

Host-level checks (not Compose profiles, but useful while profiling):

```bash
docker stats
docker compose top
```

---

## App profiling inside Laravel

Compose profile starts the **tools**. App code still decides what runs in `local`:

```php
// Telescope only local
if ($this->app->environment('local')) {
    $this->app->register(TelescopeServiceProvider::class);
}

// Debugbar / Clockwork for request timeline
```

| Tool | Role | Keep behind |
|------|------|-------------|
| **Telescope** | Request / job / query timeline | `local` (or staging with care) |
| **Debugbar / Clockwork** | Per-request timeline in browser | `local` |
| **Xdebug** | Step debug / some profiling | Compose `dev` + `XDEBUG_MODE=off` by default |
| **Blackfire** | Production-grade CPU/wall profiles | Compose `profiling` |

Heavy agents always-on → slow laptops and noisy CI. Profile on demand.

---

## Other ways to split environments

Profiles are one tool. Mix as needed:

### 1) Profiles (above)

Best for optional sidecars (mail, profiler, workers).

### 2) Override files

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

`docker-compose.dev.yml` holds only diffs (bind mounts, Xdebug ports, …).

### 3) Environment variables

```yaml
services:
  app:
    environment:
      APP_ENV: ${APP_ENV:-local}
      DB_HOST: ${DB_HOST:-mysql}
```

Keep `.env`, `.env.ci`, `.env.staging` separate from the compose structure.

| Approach | Strength |
|----------|----------|
| Profiles | Toggle whole services |
| Overrides | Layer small diffs |
| Env files | Config without new containers |

---

## When to use / skip

**Use when**

- One repo, many “kinds” of local stack  
- Heavy tools (Xdebug, Blackfire, Mailhog) must not tax every `up`  
- CI needs a thinner profile than laptop `dev`  

**Skip / rethink when**

- Single tiny service forever — plain compose is enough  
- You need totally different networks/images (then separate files may be clearer)  

---

## Decision rule

```
Heavy / optional tool?
  Yes → put service behind a Compose profile
       + gate app providers with APP_ENV / local checks
  No  → untagged baseline or always-on core deps

Day-to-day `dev` stays light.
Never: everyone must start Blackfire + Mailhog + Xdebug to run the app.
```

1. Required baseline: no profile (or document the default `--profile`).  
2. Optional / heavy: `profiles: [...]`.  
3. Diffs of config: `.env` + override files.  
4. README: which profiles each environment needs.

---

## Antipatterns

- One giant compose with no profiles — every laptop starts every sidecar  
- Secrets committed in yaml  
- Xdebug / Blackfire always `on` in the default image  
- Three full duplicate compose files that drift weekly  
- Heavy bind mounts on macOS without caring about I/O cost  

---

## Mental drill

1. New hire runs `docker compose up` and gets Blackfire errors (missing tokens). What should the default profile set look like?  
2. CI only needs mysql + `php artisan test`. Which profile and which service?  
3. Telescope registered in `production` by mistake — Compose profiles alone enough to stop that?

::: tip Hints
1. Don’t put blackfire on the default `dev` path; use `profiling` · 2. `--profile test` + `app-test` · 3. No — also gate with `environment('local')` / config; Compose ≠ PHP provider registration
:::
