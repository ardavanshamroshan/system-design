# Fallacies of Distributed Computing & PACELC

> Module D — System Architecture · Section 9.5 (foundations before CAP)

## Mental outline

1. [What and why](#what-and-why)  
2. [The eight fallacies](#the-eight-fallacies)  
3. [Fallacy → failure → fix (with code)](#fallacy--failure--fix-with-code)  
4. [From CAP to PACELC](#from-cap-to-pacelc)  
5. [PACELC in practice](#pacelc-in-practice)  
6. [Real challenges](#real-challenges)  
7. [Interview notes](#interview-notes)  
8. [Decision rule](#decision-rule)  
9. [Antipatterns](#antipatterns)  
10. [Mental drill](#mental-drill)

---

## What and why

Distributed systems fail in ways a single process never does: messages vanish, clocks lie, “localhost latency” becomes 80 ms, and a “temporary” blip cascades into a partial outage.

Two complementary lenses:

| Lens | Question it answers |
|------|---------------------|
| **Eight Fallacies** (Deutsch / Sun, ~1994) | Which **assumptions** about the network are usually false? |
| **CAP** | Under **partition**, Consistency or Availability? |
| **PACELC** (Abadi, 2012) | Under partition **and** on the **healthy path**: Latency vs Consistency? |

Fallacies stop you from writing “happy-path only” glue. CAP/PACELC force an explicit tradeoff when that glue must still serve users.

Related: [CAP Theorem](/architecture/cap-theorem) · [Outbox](/patterns/outbox) · [Acknowledgment](/messaging/acknowledgment) · [API Gateway](/architecture/api-gateway)

---

## The eight fallacies

Classic list — every item is a **false default** until proven otherwise:

| # | Fallacy (false belief) | Reality |
|---|------------------------|---------|
| 1 | The network is reliable | Packets drop, links flap, clouds have AZ splits |
| 2 | Latency is zero | Cross-AZ / cross-region is tens–hundreds of ms |
| 3 | Bandwidth is infinite | NIC, NAT, and broker quotas are finite |
| 4 | The network is secure | Zero-trust; assume hostile path |
| 5 | Topology doesn’t change | IPs, peers, and routes churn |
| 6 | There is one administrator | Multiple teams / clouds / SLAs |
| 7 | Transport cost is zero | Egress $, serialization CPU, broker fees |
| 8 | The network is homogeneous | Mixed MTU, TLS versions, HTTP/1 vs HTTP/2 |

::: tip
Fallacies are **design smell detectors**. If a design only works when all eight are true, it is not a distributed design — it is a local script with hopium.
:::

---

## Fallacy → failure → fix (with code)

### 1 — Network is reliable

**Failure:** Order service publishes `OrderPaid` then crashes before inventory consumes it — or the broker accepts publish and the consumer never runs. Dual-write hell.

**Fix:** Durable intent in the same DB transaction ([Outbox](/patterns/outbox)) + at-least-once + idempotent consumer ([Ack](/messaging/acknowledgment)).

```php
// Laravel — do NOT publish outside the business transaction
DB::transaction(function () use ($order) {
    $order->markPaid();
    OutboxMessage::create([
        'type' => 'order.paid',
        'payload' => ['order_id' => $order->id],
        'idempotency_key' => "order.paid:{$order->id}",
    ]);
});
// Relay worker publishes later — network blip ≠ lost intent
```

### 2 — Latency is zero

**Failure:** Checkout handler calls Inventory, Pricing, Fraud, Loyalty **sequentially**. Each 40 ms p99 → user waits 160 ms+ on a good day; one slow dependency → timeout storm.

**Fix:** Timeouts per hop, parallelize independent calls, degrade non-critical paths.

```php
use Illuminate\Support\Facades\Http;
use Illuminate\Http\Client\Pool;

$responses = Http::pool(fn (Pool $pool) => [
    $pool->as('price')->timeout(0.2)->get($pricingUrl),
    $pool->as('fraud')->timeout(0.15)->post($fraudUrl, $payload),
]);

$price = $responses['price']->successful()
    ? $responses['price']->json()
    : throw new ServiceUnavailable('pricing');

// Fraud: fail-open or fail-closed is a product decision — never “wait forever”
$fraudOk = $responses['fraud']->successful()
    ? $responses['fraud']->json('ok')
    : false; // fail-closed example
```

```python
# Same idea — explicit budgets beat default HTTP clients
import httpx, asyncio

async with httpx.AsyncClient(timeout=httpx.Timeout(0.2)) as client:
    price, fraud = await asyncio.gather(
        client.get(pricing_url),
        client.post(fraud_url, json=payload),
        return_exceptions=True,
    )
```

### 3 — Bandwidth is infinite

**Failure:** Dump entire `orders` table into a webhook payload every sync. Broker disk / NAT fills; other tenants starve.

**Fix:** Compact events, pagination, compression only where CPU allows, backpressure.

```php
// Bad: full aggregate every time
// Good: small domain event + pull for details if needed
$event = [
    'type' => 'order.paid',
    'order_id' => $order->id,
    'total_cents' => $order->total_cents,
    'occurred_at' => now()->toIso8601String(),
];
```

### 4 — Network is secure

**Failure:** Internal “service mesh” URL is reachable from a compromised pod; no mTLS, shared static token forever.

**Fix:** Short-lived credentials, least privilege, never put secrets in query strings, treat east-west traffic as hostile.

```php
// Prefer signed service JWT / mTLS at the mesh — not a forever shared secret in .env alone
Http::withToken($tokenProvider->mint(audience: 'inventory', ttl: 60))
    ->timeout(0.3)
    ->post($inventoryUrl, $body);
```

### 5 — Topology doesn’t change

**Failure:** Hard-coded `http://10.0.1.47:8080` in config. Node dies; DNS/k8s reschedule → cascading 500s.

**Fix:** Service discovery / DNS names, retries with jitter to **new** endpoints, connection pools that refresh.

```php
// Use stable service DNS, not pod IPs
$url = config('services.inventory.base_url'); // https://inventory.svc.cluster.local
```

### 6 — One administrator

**Failure:** Team A bumps API to v2; Team B’s mobile still on v1; silent field rename breaks inventory.

**Fix:** Explicit versioning, schema evolution rules, consumer-driven contracts.

```php
// Version in path or header — never silently rename money fields
Route::prefix('v1')->group(function () {
    Route::post('/orders', PlaceOrderV1::class);
});
Route::prefix('v2')->group(function () {
    Route::post('/orders', PlaceOrderV2::class); // additive fields OK; breaking needs new version
});
```

### 7 — Transport cost is zero

**Failure:** Chatty N+1 microservice calls (“get order”, “get each line”, “get each SKU”) across regions. Bill and latency explode.

**Fix:** Coarse-grained APIs, BFF aggregation at the edge ([API Gateway](/architecture/api-gateway)), cache hot reads.

### 8 — Network is homogeneous

**Failure:** Assume every peer speaks HTTP/2 + same JSON decimal rules. One legacy partner truncates money as float → off-by-cents.

**Fix:** Canonical encodings (`total_cents` int), contract tests, tolerance for older protocols at the edge.

```php
// Money as integer minor units — not float JSON
'total_cents' => 1999, // $19.99
```

---

## From CAP to PACELC

[CAP](/architecture/cap-theorem): when a **partition** happens, you cannot keep perfect **C** and perfect **A**.

**PACELC** adds the everyday case:

> **if** Partition → choose **A** or **C**  
> **else** (no partition) → choose **Latency** or **Consistency**

| Mode | Choice | Meaning |
|------|--------|---------|
| **PA/EL** | Prefer A under P; Latency when healthy | Answer fast; may be stale (Dynamo-style lean) |
| **PA/EC** | Prefer A under P; Consistency when healthy | Rare combo; often awkward |
| **PC/EL** | Prefer C under P; Latency when healthy | Rare; “fast but refuse under split” |
| **PC/EC** | Prefer C under P; Consistency when healthy | Quorum / sync replication; slower happy path (Spanner-ish lean) |

Most real products are **mixed PACELC per feature**, not one sticker for the company.

```
         Partition?
        /          \
      yes           no
      / \           / \
    A   C         L   C
   (AP) (CP)   (fast) (strong)
```

::: warning
CAP does **not** say you must give up consistency every normal day. PACELC says: even with a healthy network, **synchronous quorum** buys stronger C at the cost of **L**.
:::

---

## PACELC in practice

### Wallet transfer (lean PC/EC)

Wrong balance is catastrophic → wait for quorum / single primary; accept higher latency.

```php
// Conceptual: strong path — primary write, confirm before ACK to client
DB::connection('pgsql_primary')->transaction(function () use ($from, $to, $cents) {
    $a = Account::whereKey($from)->lockForUpdate()->firstOrFail();
    $b = Account::whereKey($to)->lockForUpdate()->firstOrFail();
    if ($a->balance_cents < $cents) {
        throw new InsufficientFunds();
    }
    $a->decrement('balance_cents', $cents);
    $b->increment('balance_cents', $cents);
});
// Client sees success only after commit — latency cost is intentional
```

### Newsfeed like-counter (lean PA/EL)

Stale count for a few seconds is fine → async increment, cached read, eventual converge.

```php
// Fast path: write intent, return; counter converges via workers / Redis INCR
Redis::incr("post:{$postId}:likes");
dispatch(new PersistLike($postId, $userId)); // may lag — AP/EL OK
return response()->json(['ok' => true]); // low latency to client
```

### Checkout vs browse

| Surface | PACELC lean | Why |
|---------|-------------|-----|
| Product page read | PA/EL | Stale price banner better than blank page |
| Payment capture | PC/EC | Double charge worse than slow spinner |
| Inventory reserve | PC/EC or timed hold | Oversell is expensive |
| Analytics ingest | PA/EL | Drop/delay events beats blocking UX |

---

## Real challenges

### Challenge A — “It worked on staging”

Staging is one AZ, one digit of traffic, no packet loss. Production: cross-region read replica lag 2 s. Support tools read replica; customer just paid; agent sees “unpaid”.

| Root | Fallacy / PACELC |
|------|------------------|
| Assumed replica is “current” | Latency ≈ 0; ignored EL vs EC |
| No read-your-writes routing | CAP “C” ≠ replica lag |

**Mitigation:** sticky primary for post-write reads; `read_after_write` token; show “processing” not “failed”.

### Challenge B — Retry amplification

Inventory times out at 30 s. API gateway retries 3×. Client retries 3×. One user click → 9 inventory calls → thread pool exhaustion → full outage.

| Root | Fallacy |
|------|---------|
| Assumed reliable + cheap retries | #1 and #7 |
| No deadline propagation | Latency ≠ 0 |

**Mitigation:** budget timeouts (`total 300 ms`), idempotency keys, retry only on safe errors, jitter, circuit breaker (next doc: Resilience).

```php
// Propagate a deadline — do not restart a full 30s on every hop
$deadline = microtime(true) + 0.3;
$remaining = max(0.05, $deadline - microtime(true));
Http::timeout($remaining)->withHeaders([
    'Idempotency-Key' => $key,
])->post($url, $body);
```

### Challenge C — Split brain after “temporary” network glitch

Two primaries both accept writes during a partition (misconfigured failover). Merge later → lost updates / divergent balances.

| Root | Fallacy / CAP |
|------|---------------|
| Assumed network reliable + one admin who “knows” failover | #1, #6 |
| Chose availability without a merge story | AP without conflict rules |

**Mitigation:** fencing tokens, single writer via consensus (etcd/ZK), or explicit CRDT/LWW with domain rules — never silent dual primary for money.

---

## Interview notes

1. List **2–3 fallacies** tied to your design (not all eight as trivia).  
2. After CAP, add: **“On the healthy path, do we buy L or C?”** (PACELC).  
3. Say **per feature**, not “our company is AP”.  
4. Connect fallacies to concrete controls: timeout, idempotency, outbox, discovery, versioning.  
5. Trap: treating CAP as “always pick two” every day — PACELC exists because that story is incomplete.

---

## Decision rule

1. Walk the eight fallacies against the design — which assumptions must be false-safe?  
2. Under partition: **C or A** for this feature? ([CAP](/architecture/cap-theorem))  
3. On the healthy path: **Latency or Consistency**? (PACELC)  
4. If you retry: bound **time**, **attempts**, and require **idempotency**.  
5. Money / seats / stock → prefer PC/EC-ish paths. Feeds / counters → PA/EL-ish OK.  
6. Never hard-code topology or float money across service boundaries.

---

## Antipatterns

- Infinite default HTTP timeouts between services  
- Retries without idempotency keys or deadlines  
- Dual-write to DB + broker with no outbox  
- Reading lagging replicas for post-payment UX without sticky reads  
- One global “we are eventually consistent” stamp on checkout  
- Hard-coded IPs / assuming staging topology = production  
- Floats for currency in JSON APIs  

---

## Mental drill

You build `POST /checkout`:

1. Name **three fallacies** your handler must not assume.  
2. For **payment capture**, are you closer to **PC/EC** or **PA/EL**? Why?  
3. For **“items in cart” badge**, same question.  
4. Where does an **outbox** remove fallacy #1 from the critical path?  
5. What happens if Inventory is slow — **fail-open, fail-closed, or degrade** — and who decides?

If you can answer without hand-waving, foundations are solid — next: [Replication](/architecture/replication) (lag, failover, split-brain).
