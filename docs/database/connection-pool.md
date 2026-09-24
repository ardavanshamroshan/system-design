# Connection Pooling — What and Why?

## The problem

Opening a database connection is **expensive**:

- TCP handshake  
- Authentication  
- Server-side memory allocation  

If every HTTP request opens and closes a new connection, you melt under load.

---

## What is a connection pool?

A **ready set of connections** the app borrows and returns:

```
Request → borrow conn → query → release conn → Pool
```

Instead of:

```
Request → open → query → close  (from scratch every time)
```

---

## Why it matters

| Without pool | With pool |
|--------------|-----------|
| High latency | Fast reuse |
| Pressure on DB with too many connections | Controlled ceiling (`max_connections`) |
| Thundering herd on spikes | Clear wait queue / timeout |

Databases have a `max_connections` limit. 100 apps × 50 raw connections = disaster.

---

## Common parameters

| Parameter | Meaning |
|-----------|---------|
| `min` / idle size | Warm connections ready |
| `max` | Concurrent ceiling |
| `idle timeout` | Close idle connections |
| `max lifetime` | Rotate before network/NAT issues |
| `acquire timeout` | How long to wait if the pool is empty |

Conceptual PDO note:

```ini
; PHP-FPM workers × connections_per_worker ≈ total to DB
; Align max pool with worker count
```

In Laravel this is often managed via persistent connections / proxies like **PgBouncer** / **ProxySQL**.

---

## External pooler

Very common for Postgres:

```
App → PgBouncer → PostgreSQL
```

Benefit: hundreds of app clients map to fewer real DB connections (transaction pooling).

---

## Antipatterns

- Huge `max` per instance without totaling across the fleet  
- Holding a connection across a long job without need  
- Leak: borrow without release on error paths  
- Assuming “Laravel always pools optimally” without measuring

---

## Decision rule

1. Compute workers/processes × connections; stay under `max_connections`.  
2. For horizontal scale, take an external pooler seriously.  
3. Metrics: wait for connection, acquire time, active connection count.
