---
description: A practical knowledge base and operating handbook for service boundaries, identity, messaging, runtimes, and telemetry.
---
# Service engineering handbook

Build a notification service without tying the architecture to a particular programming language. The running example receives business events from Espo or another application, waits two days, checks current eligibility, and may send an SMS. The same ideas apply to billing, order fulfillment, webhooks, and background reports.

> Reading path: understand the boundary → implement a contract → exercise failures → record the operating decision.

## Concept review

The supplied design is a sound starting point. The following distinctions make its guarantees precise:

| Concept | Conclusion and qualification |
| --- | --- |
| API gateway | Stable routing and shared edge policy. Business authorization still belongs in the service. |
| Traefik | Implements the reverse-proxy boundary. Docker discovery does not provide campaign orchestration or a complete identity platform. |
| mTLS | Authenticates certificate holders at a particular TLS hop. Trust in a CA does not automatically authorize every tenant or operation. |
| JWT / JWKS | Tokens carry claims; a JWKS distributes keys. The issuer, token profile, and permission policy remain separate decisions. |
| REST / AMQP | Use HTTP for request/response contracts and AMQP for event distribution here. HTTP can accept asynchronous work, and AMQP can implement RPC. |
| Docker / Octane | Packaging and worker lifetime are different concerns. Warm workers do not make external providers faster. |
| RabbitMQ / Redis | Cross-service events and internal job execution can have separate owners. This fills the missing number 7 in the supplied outline. |
| Telemetry | Sentry and ClickStack help diagnose behavior. Durable business records determine delivery state. |

The protocol distinction is a design choice rather than a transport limitation: HTTP defines `202 Accepted`, and RabbitMQ documents a request/reply pattern. See [HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html#name-202-accepted) and [RabbitMQ RPC](https://www.rabbitmq.com/tutorials/tutorial-six-python).

## Architecture map

A browser reaches the admin backend. The admin backend and calling sites use the internal API hostname with the appropriate credentials. Provider callbacks have a separate public boundary and signature verification. The notification database owns workflows, consent decisions, delivery attempts, and the inbox/outbox. RabbitMQ carries facts between applications; Redis may carry short-lived execution jobs within this service.

## Read and implement

The sidebar groups these guides by subject: API gateway under **System Architecture**; JWT/JWKS and mTLS under **Software Patterns → Authentication**; REST/AMQP and durable jobs under **Messaging**; and Traefik, Docker/Octane, and telemetry under **DevOps**. This overview keeps the sequential learning path.

| Chapter | Knowledge and procedure | Main example |
| --- | --- | --- |
| <span class="vip-locked" title="VIP members only">1. API gateway <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Routes, request budgets, BFF coordination, failure contracts | Concurrent Python/HTTPX aggregation |
| <span class="vip-locked" title="VIP members only">2. Traefik on Docker <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Discovery, router/service/middleware syntax, safe rollout | Compose and YAML |
| <span class="vip-locked" title="VIP members only">3. Site-to-site mTLS <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Trust, identity mapping, rotation, handshake diagnosis | OpenSSL, HTTPX, PHP |
| <span class="vip-locked" title="VIP members only">4. JWT and JWKS <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Issuers, claims, key rotation, permission enforcement | FastAPI/PyJWT and Laravel contracts |
| <span class="vip-locked" title="VIP members only">5. REST and AMQP <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Idempotent commands, event contracts, inbox/outbox | HTTP, JSON, Python/Pika |
| <span class="vip-locked" title="VIP members only">6. Docker and application workers <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Images, process roles, warm worker safety, deployment | FastAPI and Laravel Octane |
| <span class="vip-locked" title="VIP members only">7. Durable workflows and jobs <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Two-day timers, cancellation, Redis, reconciliation | SQL and a tested Python transaction lab |
| <span class="vip-locked" title="VIP members only">8. Operational telemetry <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | JSON logs, Sentry, ClickStack, traces, incident response | Python, PHP/Monolog, OpenTelemetry |

Each chapter contains implementation steps, failure cases, verification, and a knowledge record. Examples labeled **integration sketch** need application-specific adapters. The Python transaction lab is executable without third-party packages; configuration fragments are not a complete production stack. Version-sensitive examples target Traefik v3, Laravel 13, Python 3.10+, PyJWT 2, and AMQP 0-9-1. Select and lock maintained patch releases before deployment.

## Implementation order

1. Record tenant ownership, consent rules, callback semantics, and what “two days” means: 48 hours or local calendar days.
2. Specify identity provider, issuer, audience, client identities, permissions, and certificate owner.
3. Define API and event schemas, including idempotency scope and retention.
4. Implement transaction boundaries and failure exercises before connecting a real SMS provider.
5. Deploy separate HTTP, consumer, scheduler, relay, and job processes.
6. Add routing, mTLS, token verification, and callback verification. Test negative cases.
7. Establish SLOs, dashboards, restore procedures, and a staged rollout with a rollback release.

For a minimal first version, one service and one database can implement these boundaries. A separate microservice for every chapter is unnecessary.

## Knowledge management template

Use this record for each deployed capability. Store decisions alongside code; link secret **references**, never secret values.

```yaml
id: ADR-007
capability: notification-delivery
status: proposed # proposed | accepted | superseded
owner: notifications-team
review_trigger: provider-contract-or-identity-change
context: delivery may succeed even when the HTTP response is lost
decision: persist attempts and reconcile unknown outcomes
alternatives:
  - retry every timeout # rejected: possible duplicate SMS
invariants:
  - one stable provider idempotency key per logical send
verification:
  - lost-response exercise produces an unknown attempt
runbook: handbook/durable-jobs
rollback: pause dispatch; retain pending database records
evidence: link-to-test-run-and-staging-exercise
```

A useful runbook states the trigger, owner, preconditions, commands, expected results, stopping condition, and recovery steps. A successful deployment changes the record from “proposed” to “accepted” only after evidence exists.

## Practice and acceptance

From the repository root:

```bash
python3 -m unittest discover -s examples/notification-core -v
npm run build
```

The lab tests repeated writes, conflicting payloads, tenant isolation, inbox rollback, cancellation, due-time boundaries, restart, concurrent requests, broker failure, and a crash after publish. The site build checks document rendering and internal page links. Neither replaces integration tests against your actual identity provider, TLS boundary, queues, or provider sandbox.

Before a production launch, demonstrate that an untrusted certificate fails, an invalid token fails, a duplicate event is harmless, a paused workflow does not initiate a new send, a broker outage preserves intent, and an ambiguous provider response enters reconciliation.

## Existing knowledge to connect

Continue with <span class="vip-locked" title="VIP members only">API gateway foundations <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>, <span class="vip-locked" title="VIP members only">outbox <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>, <span class="vip-locked" title="VIP members only">acknowledgment <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>, <span class="vip-locked" title="VIP members only">dead-letter queues <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>, <span class="vip-locked" title="VIP members only">sagas <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>, <span class="vip-locked" title="VIP members only">resilience <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>, and <span class="vip-locked" title="VIP members only">Compose profiles <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>. The handbook supplies the implementation and operating context around those patterns.
