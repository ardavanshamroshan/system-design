# API Gateway

## What is it?

An **API Gateway** is a single entry point for clients: it receives requests, handles auth, and **routes** them to backend services.

```
Mobile / Web / Partner
         │
         ▼
   [ API Gateway ]
      │    │    │
      ▼    ▼    ▼
   Users Orders Payments
```

Without a Gateway, every client must know addresses, auth, and versions for every service.

---

## Common responsibilities

| Responsibility | Notes |
|----------------|-------|
| Routing | `/orders/*` → Order Service |
| AuthN/AuthZ | JWT, API Key, mTLS |
| Rate limiting | Abuse protection |
| SSL termination | TLS at the edge |
| Aggregation | Combine responses (BFF-like) |
| Observability | Request id, metrics, logs |
| Versioning | `/v1` vs `/v2` |

---

## Conceptual example (Nginx / Kong-like)

```nginx
location /api/users/ {
  proxy_pass http://users-service:8080/;
}

location /api/orders/ {
  proxy_pass http://orders-service:8080/;
  limit_req zone=api burst=20;
}
```

In the Laravel world, a “Gateway” is sometimes a separate app with Sanctum/Passport that proxies to microservices.

---

## Related patterns

- **BFF (Backend for Frontend):** a Gateway tailored per client (web/mobile)  
- **Edge Gateway:** shared entry for everyone  
- **Service Mesh:** service-to-service traffic inside the cluster (complements Gateway; doesn’t fully replace it)

---

## Trade-offs

| Upside | Cost |
|--------|------|
| Simpler clients | Central failure point → needs HA |
| Unified policy | Extra latency |
| Change backends without clients | Risk of becoming a God Gateway |

---

## Antipatterns

- Putting all business logic in the Gateway  
- One giant Gateway without horizontal scale  
- Hiding service errors without a correlation id

---

## Decision rule

1. Multiple services + multiple clients → Gateway is nearly required.  
2. Simple monolith → a reverse proxy may be enough.  
3. Keep the Gateway thin: route, security, limits — not domain logic.
