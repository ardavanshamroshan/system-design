# Connection Pooling — What and Why?

> Module B — Data, Concurrency, Durability · Section 4

## Mental outline

1. [What and why](#what-and-why)  
2. [What sits behind a “simple query”](#what-sits-behind-a-simple-query)  
3. [Pool lifecycle](#connection-lifecycle-in-a-pool)  
4. [Connection churn and thundering herd](#connection-churn-and-thundering-herd)  
5. [Pool parameters](#common-parameters)  
6. [Laravel + PHP-FPM](#laravel--php-fpm)  
7. [Laravel Octane](#laravel-octane)  
8. [External poolers](#external-poolers)  
9. [FastAPI + SQLAlchemy](#fastapi--sqlalchemy-python)  
10. [Runtime comparison](#runtime-comparison--laravel-vs-fastapi)  
11. [Antipatterns and decision rule](#antipatterns)

---

## What and why

A **connection pool** is a cache of open database connections so work can **reuse** them instead of open/close per operation.

Opening a connection is **expensive**:

1. TCP handshake (sometimes TLS)  
2. Authentication  
3. Server-side memory and session state  

Without a pool under load: higher latency, DB CPU wasted on handshakes, and `too many connections`.

```
Without pool:  Request → open → auth → query → close → (from scratch)
With pool:     Request → borrow → query → release → Pool
```

```
┌─────────────┐   borrow/release   ┌─────────────────┐  few real   ┌──────────┐
│ App Workers │ ─────────────────► │ Connection Pool │ ──────────► │ Database │
└─────────────┘                    └─────────────────┘             └──────────┘
     many         multiplexing in-app or in front of DB              limited
```

---

## What sits behind a “simple query”

Wrong mental model: “just run SQL and return.”

Real pipeline often includes:

1. Obtain/create a TCP connection  
2. Auth (+ sometimes encryption)  
3. Begin a transaction (explicit or implicit)  
4. Prepare / execute  
5. Commit or rollback  
6. **Release** the connection (to the pool, or close)

If that pipeline repeats from scratch under traffic, you don’t just get “a bit slower” — you get **connection churn**.

---

## Connection lifecycle in a pool

| Stage | Meaning |
|-------|---------|
| **Initialization** | On app/worker boot, create N connections and put them in the pool |
| **Request / borrow** | App code asks for a free connection |
| **Usage** | Query / transaction on that session |
| **Return / release** | Back to the pool; usually not a real DB `CLOSE` |
| **Reuse** | Next request gets the warm socket |
| **Wait** | If all busy → queue until `acquire timeout` |
| **Recycle / destroy** | Idle timeout, max lifetime, or failure → drop / reconnect |

Skipping **release** on an exception path = **leak** = empty pool = everything stalls.

---

## Connection churn and thundering herd

**Connection churn:** many TCP open/close cycles in a short window. Both sides burn CPU; timeouts and “random slowness” appear.

**Thundering herd:** a spike of concurrent requests all trying to connect at once — even if each query is light.

Common symptoms:

- endpoints sometimes fast, sometimes slow  
- CPU looks fine but latency flaps  
- logs: connect timeout / `too many connections`

Sometimes the bug isn’t SQL — it’s **connection management**.

---

## Common parameters

| Parameter | Meaning | Rough equivalent |
|-----------|---------|------------------|
| `min` / `pool_size` | Warm ready connections | SQLAlchemy `pool_size` |
| `max` / ceiling | Concurrency cap | PgBouncer `default_pool_size`; SQLAlchemy `pool_size + max_overflow` |
| `max_overflow` | Temporary extras under spike | Some pools only (e.g. SQLAlchemy) |
| `idle timeout` | Close idle sockets | `idleTimeoutMillis` in `pg` |
| `max lifetime` | Forced rotation before stale | Helps with NAT/LB silent drops |
| `acquire / connection timeout` | Max wait to borrow | Better than infinite hang |

Capacity rule:

```
Σ (max of all clients and services)  <  max_connections(DB) − ops reserve (10–20%)
```

Include Horizon, queues, schedulers, and staging in the sum.

---

## Laravel + PHP-FPM

### Request lifecycle

Classic model:

```
Request starts → boot Laravel → lazy DB connect on first query → request ends → process freed
```

- Laravel usually uses **lazy connections**: no connect until the first query.  
- Across FPM requests, unless persistent, there is no “forever engine” like FastAPI.  
- **PDO has no app-level pool like Hikari / SQLAlchemy.**

Dangerous formula:

```
total connections ≈ machines × pm.max_children × (connections per worker)
```

Example: `3 × 50 × 1 = 150` — before Horizon/queues.

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
        // PDO::ATTR_PERSISTENT => true, // usually non-ideal under FPM
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
    // With a pooler, point host at PgBouncer (e.g. :6432)
],
```

PDO persistent pitfalls under FPM:

- dirty state across requests (`SET`, temp tables, `LOCK`)  
- dead sockets PDO still treats as alive  
- harder debugging  

Don’t “fix” scale with persistent — put a **pooler** in front.

### Day-to-day Laravel code

```php
// Lazy: may still be disconnected until here
$users = DB::table('users')->where('active', 1)->get();

// Short transaction — don’t hold the connection across external work
DB::transaction(function () use ($orderId) {
    $order = Order::lockForUpdate()->findOrFail($orderId);
    $order->update(['status' => 'paid']);
});

// Bad: connection (+ locks) stuck
DB::beginTransaction();
$order = Order::lockForUpdate()->findOrFail($orderId);
Http::post('https://payment.example/charge', [...]); // external I/O
$order->update(['status' => 'paid']);
DB::commit();
```

Better: keep DB work short; do external I/O outside the transaction.

### Read / write connections

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
User::on('mysql')->where(...)->get();

DB::connection('mysql')->table('orders')->insert([...]);
```

Each connection name can open its own PDO. Under FPM lifetime is short; under Octane those sockets may **stay alive on the worker** — multiply by worker count.

### Easy-to-forget connection sources

| Source | Effect |
|--------|--------|
| `php-fpm` workers | baseline |
| `horizon` / queue workers | often equal or worse than HTTP |
| `schedule:run` / commands | short spikes |
| parallel feature tests / CI | surprise load |

---

## Laravel Octane

### Octane is not a pool — it’s a warm connection per worker

Practical takeaway (Laravel discussion `#42108`, Mohamed Said’s explanation):

> Octane opens a DB connection when a worker starts (or on first use) and **reuses that same connection** for later requests on that worker.

So:

| Java / Hikari expectation | Octane reality |
|---------------------------|----------------|
| In-process pool of N connections with borrow/release | Usually **1 connection (per connection name) per worker** |
| Autoscale pool size inside the app | Scale = worker count × open connections |

Octane **cuts connection churn** (no connect-per-request), but it is **not a PgBouncer replacement**. 100 Swoole workers can mean 100 DB connections — real reports hit Postgres `max_connections` and fixed it with PgBouncer.

### `config/octane.php` and listeners

By default, forced disconnect after each request is often **disabled** so the connection stays warm. Enabling `DisconnectFromDatabases` moves behavior closer to FPM (more reconnects = more churn, less leftover state).

Conceptual:

```php
// octane.php — listeners (versions differ; the idea matters)
'listeners' => [
    RequestReceived::class => [
        // ...
        // DisconnectFromDatabases::class, // if enabled → disconnect after request
    ],
    RequestTerminated::class => [
        // state cleanup; watch leftover transactions
    ],
],
```

Octane **warm** means some bindings are pre-resolved (e.g. DatabaseManager) — **not** “a multi-connection pool.”

### Real Octane pitfalls

**1) Leftover transactions across requests**

Bug: `beginTransaction` without commit/rollback → the same worker serves the next request inside an isolated snapshot. Weird inconsistency; transaction timeouts reported on some hosts.

```php
DB::beginTransaction();
try {
    // ...
    DB::commit();
} catch (\Throwable $e) {
    DB::rollBack();
    throw $e;
}

// or:
DB::transaction(function () { /* ... */ });
```

**2) Connection session state**

`DB::statement('SET search_path TO ...')` or session vars → next request on that worker stays polluted unless you reset.

**3) Read/write + multiple hosts**

Random host pick on first connect, then sticky per worker, can pin all reads to one replica. Practical mitigations: round-robin middleware with multiple connection names, or let a proxy/pooler balance.

**4) You still want a pooler**

```
Octane workers (many) → PgBouncer (real ceiling) → Postgres
```

Without it, Octane only trades churn for “too many long-lived connections.”

---

## External poolers

When the app runtime lacks a strong in-app pool (FPM) or workers multiply (Octane), put pooling **in front of the DB**:

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

| `pool_mode` | Behavior | Note |
|-------------|----------|------|
| session | Until client disconnect | Compatible; weak multiplexing |
| transaction | Free after commit | Good default |
| statement | Free after each statement | Many limitations |

In Laravel, point `DB_HOST` / `DB_PORT` at PgBouncer.

### ProxySQL / RDS Proxy

- **ProxySQL:** MySQL — multiplexing, routing, failover  
- **RDS Proxy:** managed — good for burst / fan-out  

---

## FastAPI + SQLAlchemy (Python)

FastAPI (and uvicorn workers) is **long-running**. The SQLAlchemy Engine is a **connection pool manager** from day one — unlike Laravel + FPM.

### Engine with an explicit pool

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

engine = create_async_engine(
    "postgresql+asyncpg://user:pass@db:5432/app",
    pool_size=20,          # steady connections in the pool
    max_overflow=10,       # temporary extras under spike → cap 30
    pool_timeout=30,       # wait to borrow
    pool_recycle=1800,     # avoid stale sockets (seconds)
    pool_pre_ping=True,    # validate before use
)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
```

In practice:

- 20 warm connections ready  
- up to 10 more under sudden load  
- each request borrows and returns — no connect-from-scratch per query  

### FastAPI dependency pattern

```python
from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

app = FastAPI()

async def get_db():
    async with SessionLocal() as session:
        yield session
        # leaving the context → release back to the pool

@app.get("/users")
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT id, email FROM users LIMIT 50"))
    return [dict(r._mapping) for r in result]
```

### Multiple uvicorn workers and capacity

```
total connections ≈ (uvicorn processes) × (pool_size + max_overflow)
```

Example: 4 workers × 30 = 120. You can still put PgBouncer in front so several services share one real ceiling.

### Sync variant for comparison

```python
from sqlalchemy import create_engine

engine = create_engine(
    "postgresql+psycopg2://user:pass@db:5432/app",
    pool_size=10,
    max_overflow=5,
    pool_pre_ping=True,
)
```

Same idea; async mainly adds non-blocking I/O.

---

## Runtime comparison — Laravel vs FastAPI

This is not a framework war — it’s a **runtime model** lesson.

| | Laravel (FPM) | Laravel (Octane) | FastAPI + SQLAlchemy |
|--|---------------|------------------|----------------------|
| Process lifetime | Short per request | Long per worker | Long per worker |
| In-app pool | Effectively no | No (1 warm conn / worker) | Yes (`pool_size` / `max_overflow`) |
| Where you pool | Usually **outside** (PgBouncer) | Warm worker + preferably pooler | **Inside** the engine (+ optional pooler) |
| Pool config DX | Weak in `database.php` | Listeners / state discipline | Explicit on the engine |
| Main risk | Churn + too many conn | Leak / open tx / sticky | overflow × workers |

Key line:

> FastAPI usually pools inside the app; Laravel (FPM) usually pools outside the app. Same goal — different layer.

---

## Antipatterns

1. Raising `max_connections` without RAM headroom  
2. `FPM/Octane/Horizon workers × conn > capacity`  
3. External I/O inside a transaction  
4. Assuming “Laravel pools like SQLAlchemy”  
5. Octane without a pooler when workers are many  
6. Uncleaned transaction/session state under Octane  
7. In FastAPI: large `pool_size` × worker count with no fleet math  
8. Calling `pool.end()` after every query in Node/`pg` toy examples — don’t destroy the pool per request in production  

---

## What to measure

| Metric | Signal |
|--------|--------|
| `numbackends` / Threads_connected | Near DB ceiling |
| Acquire wait / pool timeout | Pool too tight |
| Connect errors | Churn or capacity |
| p99 latency on light queries | Often connecting, not SQL |
| Long-lived open txs (Octane) | Logical leak |

---

## Decision rule

1. **FPM + horizontal scale** → PgBouncer / ProxySQL / RDS Proxy beats persistent PDO.  
2. **Octane** → understand warm-per-worker; it isn’t a Java pool; cap workers + prefer a pooler.  
3. **FastAPI** → set `pool_size` / `max_overflow` explicitly; multiply by workers.  
4. Always: short borrow/transactions; no external HTTP while holding a connection.  
5. Random slowness under load → rule out connection churn before rewriting queries.
