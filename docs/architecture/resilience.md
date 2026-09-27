# Resilience Patterns

> Module D — System Architecture · Section 14

## Mental outline

1. [What and why](#what-and-why)  
2. [Mental model — budgets](#mental-model--budgets)  
3. [Timeouts](#timeouts)  
4. [Retry + jitter](#retry--jitter)  
5. [Circuit breaker](#circuit-breaker)  
6. [Bulkhead & backpressure](#bulkhead--backpressure)  
7. [Graceful degradation](#graceful-degradation)  
8. [Laravel / PHP samples](#laravel--php-samples)  
9. [Real challenges](#real-challenges)  
10. [Interview notes](#interview-notes)  
11. [Decision rule](#decision-rule)  
12. [Antipatterns](#antipatterns)  
13. [Mental drill](#mental-drill)

---

## What and why

**Resilience** = keep serving *something useful* when dependencies fail, slow down, or flap — without melting your own process.

Distributed calls fail. The [fallacies](/architecture/fallacies-pacelc) guarantee it. Resilience patterns bound the blast radius.

| Pattern | One-line job |
|---------|----------------|
| **Timeout** | Stop waiting |
| **Retry + jitter** | Survive blips — carefully |
| **Circuit breaker** | Stop calling a sick dependency |
| **Bulkhead** | Isolate pools so one failure doesn’t sink all |
| **Backpressure** | Slow producers when consumers drown |
| **Degradation** | Return partial / cached / default |

Related: [Fallacies & PACELC](/architecture/fallacies-pacelc) · [Saga](/patterns/saga) · [DLQ](/messaging/dlq) · [API Gateway](/architecture/api-gateway) · [Ack](/messaging/acknowledgment)

---

## Mental model — budgets

Every request has a **time budget**. Each hop spends from it.

```
Client budget 300ms
  Gateway  20ms
  Order    80ms
  Inventory timeout ≤ remaining (e.g. 120ms)
  Fraud    timeout ≤ remaining
```

Without budgets: each layer uses a default 30s → retry storms → total outage.

```
Deadline = start + budget
remaining = deadline - now
child_timeout = min(policy_max, remaining - safety_margin)
```

---

## Timeouts

| Layer | Typical mistake | Better |
|-------|-----------------|--------|
| HTTP client | No timeout / 30s default | Explicit connect + total |
| Queue job | Runs forever | `timeout` + `retryUntil` |
| DB | `wait_timeout` ignored | Statement + lock timeouts |
| Saga step | Infinite “pending” | Business deadline + compensate |

```php
Http::connectTimeout(0.05)
    ->timeout(0.2) // total seconds
    ->withHeaders(['Idempotency-Key' => $key])
    ->post($url, $body);
```

```python
import httpx
httpx.Client(timeout=httpx.Timeout(0.2, connect=0.05))
```

::: tip
Timeout without a **fallback or error path** just turns hangs into spikes of 503 — still design the user/ saga reaction.
:::

---

## Retry + jitter

Retry only when:

1. Error is **transient** (timeout, 503, connection reset)  
2. Operation is **idempotent** (or you have an idempotency key)  
3. You still have **budget**  
4. Attempts are **bounded**

**Exponential backoff + jitter** avoids synchronized stampedes:

```
sleep = min(cap, base * 2^attempt) * random(0.5, 1.0)
```

```php
function retryIdempotent(callable $fn, string $key, int $max = 3): mixed
{
    $delayMs = 50;
    for ($attempt = 0; $attempt <= $max; $attempt++) {
        try {
            return $fn($key);
        } catch (TransientHttpException $e) {
            if ($attempt === $max) {
                throw $e;
            }
            usleep(random_int((int) ($delayMs * 500), $delayMs * 1000));
            $delayMs = min(2000, $delayMs * 2);
        }
    }
}
```

**Do not retry:** `400` validation, `401/403`, most `409` business conflicts, non-idempotent `POST` without a key.

---

## Circuit breaker

States:

```
Closed ──(too many failures)──► Open ──(cooldown)──► Half-open ──(probe OK)──► Closed
                                     ▲                    │
                                     └────(probe fail)────┘
```

| State | Behavior |
|-------|----------|
| **Closed** | Calls flow; count failures |
| **Open** | Fail fast — no call to dependency |
| **Half-open** | Allow few probes |

Protects your threads/workers while Inventory is dead. Pair with fallback (cache, default, queue for later).

```php
final class CircuitBreaker
{
    public function __construct(
        private string $name,
        private int $failureThreshold = 5,
        private int $openSeconds = 30,
    ) {}

    public function call(callable $fn): mixed
    {
        $state = Cache::get("cb:{$this->name}:state", 'closed');
        if ($state === 'open') {
            $openedAt = (int) Cache::get("cb:{$this->name}:opened_at", 0);
            if (time() < $openedAt + $this->openSeconds) {
                throw new CircuitOpenException($this->name);
            }
            Cache::put("cb:{$this->name}:state", 'half_open', 60);
        }

        try {
            $result = $fn();
            Cache::put("cb:{$this->name}:failures", 0, 120);
            Cache::put("cb:{$this->name}:state", 'closed', 120);
            return $result;
        } catch (Throwable $e) {
            $failures = (int) Cache::increment("cb:{$this->name}:failures");
            if ($failures >= $this->failureThreshold || $state === 'half_open') {
                Cache::put("cb:{$this->name}:state", 'open', 120);
                Cache::put("cb:{$this->name}:opened_at", time(), 120);
            }
            throw $e;
        }
    }
}
```

Production note: use a shared store (Redis) so all app nodes share breaker state — or accept per-node breakers.

---

## Bulkhead & backpressure

**Bulkhead:** separate resource pools so one flood cannot exhaust everything.

| Isolation | Example |
|-----------|---------|
| Thread / worker pools | Checkout workers ≠ report export workers |
| Connection pools | [Pool](/database/connection-pool) per dependency |
| Queue partitions | Priority / tenant queues |
| Containers | Separate deployments for critical path |

**Backpressure:** when the consumer is slow, signal the producer to slow or drop according to policy.

```
Producer → bounded queue (N) → Consumer
              │ full
              ▼
         reject / block / sample-drop
```

In HTTP: `429` + `Retry-After`. In messaging: pause consume / lag alerts / refuse publish when lag > SLO.

---

## Graceful degradation

| Dependency down | Degraded behavior |
|-----------------|-------------------|
| Recommendations | Hide rail; keep PDP |
| Fraud (optional) | Fail-open with review flag **or** fail-closed — product call |
| Pricing promo service | Show base price |
| Search cluster | Cached top queries / “try later” |

Degradation is a **product** decision encoded in code — not an accident.

```php
try {
    $recs = $breaker->call(fn () => $recsClient->forUser($userId));
} catch (Throwable) {
    $recs = []; // degrade: empty rail, page still 200
}
```

---

## Laravel / PHP samples

### Deadline propagation

```php
final class Deadline
{
    public function __construct(private float $unixDeadline) {}

    public static function fromBudgetMs(int $ms): self
    {
        return new self(microtime(true) + $ms / 1000);
    }

    public function remainingSeconds(float $margin = 0.02): float
    {
        return max(0.01, $this->unixDeadline - microtime(true) - $margin);
    }
}

$deadline = Deadline::fromBudgetMs(300);
Http::timeout($deadline->remainingSeconds())->get($inventoryUrl);
```

### Queue job resilience

```php
class ChargeOrderJob implements ShouldQueue
{
    public int $tries = 5;
    public array $backoff = [1, 5, 15, 30]; // still add jitter in middleware if possible

    public function retryUntil(): DateTime
    {
        return now()->addMinutes(15);
    }

    public function handle(PaymentsClient $payments): void
    {
        $payments->charge(
            orderId: $this->orderId,
            idempotencyKey: "order.charge:{$this->orderId}",
        );
    }
}
```

Failed after budget → [DLQ](/messaging/dlq) / `failed_jobs` + alert — not silent drop.

---

## Real challenges

### Challenge A — Retry storm takes down Inventory

Inventory slow. Gateway retries 3×. App retries 3×. Users refresh. 1 overload → 20× load → permanent outage.

| Fix | Detail |
|-----|--------|
| Budgets | One deadline end-to-end |
| Jitter | Break sync retries |
| Breaker | Open when error rate high |
| Load shed | `429` at edge |

### Challenge B — Retry non-idempotent refund

Support tool retries `POST /refund` on timeout → double refund.

| Fix | Idempotency-Key per refund intent; status lookup before create |

### Challenge C — Breaker flaps

Threshold too low → open on blips → half-open → success → closed → fail → flap; UX worse than slow dependency.

| Fix | Higher threshold, longer open, health on p99 not single errors |

### Challenge D — Bulkhead missing in Octane / workers

One heavy report query saturates DB pool; checkout starves.

| Fix | Separate pools / queues / `max` workers; statement timeouts ([pool](/database/connection-pool)) |

### Challenge E — Saga + retry interaction

Saga step retries `ship` while compensation already started → shipment created after cancel.

| Fix | Saga state machine gates; idempotent ship; never retry forward after `compensating` ([Saga](/patterns/saga)) |

---

## Interview notes

1. Order patterns: **timeout → idempotent retry → breaker → bulkhead → degrade**.  
2. Say **jitter** and **budget** — not “just retry”.  
3. Distinguish fail-open vs fail-closed with a product example.  
4. Connect to messaging: retries + [DLQ](/messaging/dlq) + [ack](/messaging/acknowledgment).  
5. Circuit breaker without fallback = faster failure, still angry users.  

---

## Decision rule

1. Every remote call: **timeout** ≤ remaining budget.  
2. Retry only **transient + idempotent + bounded + jittered**.  
3. Shared dependency sick → **circuit open** + explicit fallback.  
4. Isolate critical path with **bulkheads** (pools/queues).  
5. Define **degradation** per feature before the incident.  
6. Persist poison messages to **DLQ**; page humans.  
7. Money / refunds: idempotency keys non-negotiable.  

---

## Antipatterns

- Infinite retries / no timeout  
- Retrying `POST` without idempotency  
- Synchronized retries (thundering herd)  
- Circuit breaker with no metrics / shared state story  
- One giant worker pool for all job types  
- Swallowing errors and returning `200` with empty body silently  
- Copy-pasting 30s timeouts on every internal hop  

---

## Mental drill

Checkout calls Pricing, Inventory, Fraud (optional), Pay.

1. Total client budget 400 ms — assign timeouts.  
2. Fraud down — fail-open or fail-closed for high-value orders?  
3. Inventory returns 503 — retry how many times? with what key?  
4. After breaker opens on Inventory — what does the user see?  
5. How does this join a [Saga](/patterns/saga) compensation path?
