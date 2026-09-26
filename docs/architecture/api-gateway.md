# API Gateway

> Module D — System Architecture · Section 11

## Mental outline

1. [What and why](#what-and-why)  
2. [Mental model](#mental-model)  
3. [Request flow](#request-flow)  
4. [Responsibilities](#responsibilities)  
5. [BFF vs edge Gateway](#bff-vs-edge-gateway)  
6. [Laravel ecosystem](#laravel-ecosystem)  
7. [Scaling](#scaling)  
8. [Gateway vs neighbors](#gateway-vs-neighbors)  
9. [Interview notes](#interview-notes)  
10. [Decision rule](#decision-rule)  
11. [Antipatterns](#antipatterns)

---

## What and why

An **API Gateway** is a single entry point between clients and a set of backend services. It **encapsulates** internal topology and exposes a client-facing API, while handling cross-cutting concerns: routing, auth, rate limit, TLS termination, sometimes aggregation.

```
Clients (Web / Mobile / Partner)
              │
              ▼
        [ API Gateway ]
         │     │     │
         ▼     ▼     ▼
   AuthSvc  OrderSvc  CatalogSvc
```

**Why?** Microservices expose fine-grained APIs. Without a gateway, each client must know service URLs, auth, versions, retries. Gateway collapses that into one edge.

::: tip
In interviews the **primary** job is **request routing**. Middleware (auth, limit, TLS) is real — but don’t list twenty features and forget routing.
:::

Related: [CAP Theorem](/architecture/cap-theorem) · [Cache patterns](/patterns/cache-patterns) · [Outbox](/patterns/outbox)

---

## Mental model

Hotel front desk: guests never hunt housekeeping / maintenance rooms. Same for clients vs microservices.

| Without gateway | With gateway |
|-----------------|--------------|
| Client → many services | Client → one edge |
| Auth / TLS / limits duplicated | Policy centralized |
| Backend moves break clients | Clients stay stable |

Two planes (ops mental model):

| Plane | Job |
|-------|-----|
| **Control plane** | Routes, policies, certs, config |
| **Data plane** | Live request routing + enforce those policies |

---

## Request flow

Typical path:

1. **Validate** — URL, required headers, body shape (fail fast)  
2. **Middleware** — authN/Z, rate limit, IP allow/deny, CORS, logging  
3. **Route** — path / method / header → backend service  
4. **Backend** — service handles domain work  
5. **Transform** — optional protocol/format (HTTP↔gRPC, XML→JSON)  
6. **Cache** — optional for public, stable, non-user-specific responses  
7. **Return** — single response to client (sometimes aggregated)

```
Client → Gateway [validate → auth → limit → route]
              → OrderSvc / CatalogSvc / …
              ← response (± transform / cache)
```

---

## Responsibilities

### Must-have (edge)

| Responsibility | Notes |
|----------------|-------|
| **Routing** | `/orders/*` → Order Service |
| **AuthN / AuthZ** | JWT, API key, OAuth, mTLS |
| **Rate limit / throttle** | Abuse + noisy-neighbor control |
| **TLS termination** | Decrypt at edge; backends lighter |
| **Observability** | Request id, metrics, access logs |
| **Versioning** | `/v1` vs `/v2` |

### Often useful

| Responsibility | Notes |
|----------------|-------|
| Aggregation / composition | One client call → many backends (BFF-like) |
| Caching | GET / public catalogs; short TTL |
| Load balancing | Gateway→service instances (client→gateway usually separate LB) |
| Retry / circuit break | Careful with non-idempotent POSTs |
| Protocol translation | External REST, internal gRPC |

### Design patterns at the edge

| Pattern | One-liner |
|---------|-----------|
| **Gatekeeper** | Only authenticated/authorized traffic reaches backends |
| **Gateway offloading** | Push TLS, auth, logging, throttle off services |
| **Throttling** | Cap per client / key / IP |
| **Circuit breaker** | Stop hammering a sick dependency |
| **Valet key** | Short-lived scoped token for one resource |
| **Health monitor** | Route away from unhealthy backends |

---

## BFF vs edge Gateway

**Backend for Frontend (BFF)** (Sam Newman): a backend shaped for **one** client type (web / iOS / Android). Aggregates and reshapes so the UI doesn’t stitch five microservices.

| | Edge API Gateway | BFF |
|--|------------------|-----|
| Audience | All / many clients | One client surface |
| Focus | Shared policy + routing | Client-specific shape |
| Risk | God Gateway | Many BFFs to maintain |

GraphQL often works well **as** a BFF layer (client asks for exactly the fields it needs).

::: tip
Same Laravel app can act as a **light BFF**. At scale, prefer a dedicated gateway (Kong / AWS API Gateway / Traefik) in front, BFF only where client shape differs hard.
:::

---

## Laravel ecosystem

Common layout: **Nginx / Traefik / Kong / AWS API Gateway** at the edge; Laravel apps as services (or one Laravel as light BFF).

Light edge in one Laravel (routing + middleware ≈ gateway duties):

```php
// routes/api.php — thin edge: throttle + auth, then domain controllers
Route::middleware(['throttle:api', 'auth:sanctum'])->group(function () {
    Route::get('/orders', [OrderController::class, 'index']);
    Route::post('/orders', [OrderController::class, 'store']);
});
```

```php
// AppServiceProvider / RouteServiceProvider
RateLimiter::for('api', function (Request $request) {
    return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
});
```

Nginx-style routing (real dedicated gateway / reverse proxy):

```nginx
location /api/users/ {
  proxy_pass http://users-service:8080/;
}

location /api/orders/ {
  proxy_pass http://orders-service:8080/;
  limit_req zone=api burst=20;
}
```

**Rule:** cross-cutting (auth, TLS, limit) at gateway; **business logic stays in services**.

---

## Scaling

Gateways are usually **stateless** → scale horizontally behind a load balancer.

| Dimension | Approach |
|-----------|----------|
| **Load** | N gateway replicas + LB (ALB / Nginx) |
| **Global** | Regional gateways + GeoDNS; sync route/policy config |
| **Client→Gateway LB** | Dedicated LB in front of gateway fleet |
| **Gateway→Service LB** | Gateway (or mesh) across service instances |

::: warning
Gateway can become a **bottleneck** and a **single point of failure**. Design for HA (multi-AZ / multi-instance) from day one.
:::

Popular options: **AWS API Gateway**, **Azure APIM**, **Kong**, **Tyk**, **Apigee**, ingress-style stacks (Nginx / Traefik) with plugins.

---

## Gateway vs neighbors

| Component | Traffic | Role |
|-----------|---------|------|
| **API Gateway** | North–south (client → system) | Entry + policy + route |
| **Service mesh** | East–west (service ↔ service) | mTLS, retries, observability inside cluster |
| **Ingress controller** | Into a K8s cluster | Cluster-native reverse proxy; narrower than full API mgmt |

They **complement** each other; mesh does not replace a public API Gateway.

---

## Interview notes

- Microservices + multiple clients → **propose a Gateway**; say “routing + basic middleware,” then move on.  
- Simple monolith / one client → Gateway may be overkill; reverse proxy enough.  
- Don’t burn 10 minutes listing plugins — core product paths matter more.  
- Call out SPOF + HA if asked about risks.  
- BFF when client shapes diverge (web vs mobile payloads).

---

## Decision rule

1. **Many services + many clients** → Gateway nearly required.  
2. **Monolith / one API surface** → reverse proxy may be enough.  
3. Keep Gateway **thin**: route, security, limits — not domain rules.  
4. Client-specific aggregation → **BFF**, not one God Gateway.  
5. Internal service traffic → mesh / LB; don’t force all east–west through the public gateway.

---

## Antipatterns

- Dumping all business logic into the Gateway (**God Gateway**)  
- One unreplicated gateway instance (SPOF)  
- Hiding backend errors with no **correlation / request id**  
- Aggressive retry on non-idempotent writes without idempotency keys  
- Caching personalized responses and serving them to other users  
- Treating Gateway as a substitute for a service mesh (or vice versa)
