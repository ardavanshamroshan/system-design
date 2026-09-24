# Cache Aside, Read-Through & Write-Through

## Why cache?

Databases are more expensive and slower than memory. A cache sits in front of hot data.

Three classic patterns:

| Pattern | Reads | Writes |
|---------|-------|--------|
| **Cache-Aside** | App is responsible | App is responsible |
| **Read-Through** | Cache layer loads | Usually separate |
| **Write-Through** | — | Cache + DB together |

---

## Cache-Aside (lazy loading)

Most common in web apps:

```
1. Read from cache
2. On miss → read from DB
3. Write into cache
4. Return to client
```

```php
function getUser(string $id): array
{
    $key = "user:{$id}";
    $cached = Redis::get($key);
    if ($cached) {
        return json_decode($cached, true);
    }

    $user = DB::table('users')->where('id', $id)->first();
    Redis::setex($key, 3600, json_encode($user));

    return (array) $user;
}
```

### On update

```php
function updateUser(string $id, array $data): void
{
    DB::table('users')->where('id', $id)->update($data);
    Redis::del("user:{$id}"); // invalidate
}
```

::: tip
Invalidation is simpler than updating the cache entry and tends to leave less stale data when done wrong.
:::

---

## Read-Through

The client only talks to the cache. On miss, the **cache layer itself** loads from the DB and fills itself.

```
App → Cache → (miss) → DB → Cache → App
```

Upside: miss logic lives in one place.  
Cost: you need a cache provider that supports a loader.

---

## Write-Through

Every write goes to **cache and DB** together.

```
App → Cache + DB (together)
```

| Upside | Cost |
|--------|------|
| Cache stays fresh | Higher write latency |
| Fewer misses after writes | Harder if the cache is down |

Related: **Write-Behind** — write cache first, flush to DB async (faster, risk of data loss).

---

## Quick comparison

| Criterion | Cache-Aside | Read-Through | Write-Through |
|-----------|-------------|--------------|---------------|
| App control | High | Lower | Medium |
| Complexity | Low | Medium | Medium |
| Freshness | Depends on invalidate | Good on read | Good on write |
| Common use | Redis + Laravel | CDN / ORM cache libs | Session / config stores |

---

## Antipatterns

- Very long TTL without invalidate → stale data  
- Caching personalized query results with bad keys  
- Stampede: thousands of requests after one key expires

For stampedes: short lock, soft TTL, or probabilistic early expiration.

---

## Decision rule

1. Most CRUD APIs → **Cache-Aside + invalidate**.  
2. If the app shouldn’t know about loaders → Read-Through.  
3. If write consistency is critical → Write-Through (or don’t cache).
