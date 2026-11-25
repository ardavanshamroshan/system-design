# System Design

Bilingual English/Persian knowledge base for system design and software architecture, published with VitePress.

**Public free samples:** [System Design](https://ardavanshamroshan.github.io/system-design/)  
**Full docs:** private repo `system-design-full` — owner/collaborators only (`npm run dev`). See [ACCESS.md](ACCESS.md).

## Service engineering handbook

Start with the [English handbook](docs/handbook/index.md) or [راهنمای فارسی](docs/fa/handbook/index.md). Each chapter explains the concept, implementation procedure, code/configuration, failure cases, verification, and the decisions to retain in an operational knowledge record.

| Concept | Guide | Examples |
| --- | --- | --- |
| API gateway | [Contracts and request coordination](docs/handbook/api-gateway.md) | Python, HTTPX, FastAPI |
| Traefik on Docker | [Discovery, routing, and rollout](docs/handbook/traefik-docker.md) | Compose, YAML |
| Site-to-site mTLS | [Trust and certificate lifecycle](docs/handbook/mtls.md) | OpenSSL, Python, PHP/cURL |
| JWT and JWKS | [Identity and resource authorization](docs/handbook/jwt-jwks.md) | FastAPI/PyJWT, Laravel policy contracts |
| REST and AMQP | [Commands, events, and delivery guarantees](docs/handbook/rest-amqp.md) | HTTP, JSON, Pika |
| Docker and Octane | [Images and long-lived workers](docs/handbook/docker-octane.md) | Dockerfile, FastAPI, Laravel |
| RabbitMQ and Redis jobs | [Durable timers and reconciliation](docs/handbook/durable-jobs.md) | PostgreSQL, Laravel, executable Python/SQLite lab |
| JSON logs, Sentry, ClickStack | [Telemetry and incident procedures](docs/handbook/observability.md) | Python, Monolog, OpenTelemetry |

The notification-service scenario connects the concepts without tying them to a single framework. Chapter 7 makes the RabbitMQ/Redis responsibility split explicit. Seven repository-native SVG diagrams show the boundaries and failure paths. Integration sketches identify their prerequisites and missing application adapters; they are not advertised as a complete production stack.

## Topic groups

The sidebar groups pages by subject; every topic has documentation **and** a questions-and-answers section. The handbook overview remains available from the top navigation as a sequential learning path, and [Interview Q&A](docs/interview/index.md) lists every question on the site.

| Group | Pages |
| --- | --- |
| Fundamentals & Algorithms | Algorithm Analysis (interactive complexity chart), Big O, Recursion, Divide & Conquer, Greedy, Dynamic Programming, Arrays, Linked List, Stack, Queue, Hash Table, Tree, Graph, Sort/Search, Common Algorithms, Data Structures Q&A |
| Database | ACID & Transactions, Isolation Levels, Locks & Concurrency, Locking, PostgreSQL, PostgreSQL Partitioning & Sharding, MySQL Storage Engines (InnoDB vs MyISAM), Connection Pool, NoSQL, Redis, MongoDB, Storage Engines & Query Algorithms, Storage & Data Scaling |
| Messaging | Messaging & Event-Driven Q&A, Brokers, Redis vs RabbitMQ vs Kafka (delivery, ack, verification), Acknowledgment, DLQ, Outbox, Saga, REST/AMQP, Durable Workflows and Jobs |
| Software Design & Patterns | Design Principles, Design Patterns, Architecture Styles, CQRS, Directory Query, Cache Patterns, Outbox, Saga |
| System Architecture | Distributed Systems Q&A, Microservices & Resilience Q&A, Fallacies & PACELC, CAP Theorem, Replication, Resilience, API Gateway (foundations and procedures) |
| Security | Security Q&A, Authentication (JWT/JWKS, mTLS) |
| Networking | IP/NAT/DNS, TCP/TLS/HTTP, Telnet/SSH & debugging tools, Container & Kubernetes networking, Networking Q&A |
| Languages | Go, PHP |
| AI & LLMs | LLM, RAG, agents |
| DevOps & Observability | Observability/Delivery/Testing Q&A, Health Checks, JSON Logs/Sentry/ClickStack, Docker/Octane/Workers, Traefik, Docker Compose Profiles |
| Case Studies & Scenarios | System Design Scenarios, Notification Service |

### Questions, answers and importance levels

Questions use a fixed shape so the site can list and filter them:

```md
### 3.1 — Question text? <Badge type="danger" text="Must-know" /> {#q-3-1}

::: details Answer {open}
**Answer:** …
:::
```

- Three levels: `danger` = Must-know / حیاتی, `warning` = Important / مهم, `info` = Good to know / تکمیلی. Sidebar dots use the same colours per page.
- `<QaControls />` (once per page) renders open/close-all for self-testing, a level filter and the legend.
- `<ComplexityChart />` renders the interactive growth chart used on the Algorithm Analysis page.
- After adding or editing questions, regenerate the hub pages: `python3 scripts/generate-qa-index.py`.

## Local development and verification

```bash
npm ci
npm run dev
npm run build
python3 -m unittest discover -s examples/notification-core -v
```

The [transaction lab](examples/notification-core/README.md) needs only Python 3.10+ and its standard library. It exercises concurrent request idempotency, tenant isolation, inbox rollback, cancellation, deadlines, restart, broker failure, and duplicate publication after a crash. External integrations still require staging tests against the actual issuer, gateway, broker, queue, and provider sandbox.

Regenerate architecture figures with:

```bash
python3 scripts/generate-handbook-diagrams.py
```

## Documentation design

The theme adapts the current design from the local Database Engineering project: sand surfaces, the original red accents, Instrument Sans/Geist Mono typography, compact expandable navigation, and an author profile. Code uses `github-light-high-contrast` and `github-dark`. Persian pages retain Rubik typography, mirrored navigation, and left-to-right code blocks. Every handbook page has a language counterpart.

## Knowledge maintenance

Use the decision-record template in the handbook overview. Keep owner, assumptions, supported versions, verification evidence, failure procedures, and review triggers beside the concept. Update both languages when changing contracts; never copy secrets or real customer data into examples.

## Deploy

Push to `main` deploys automatically through `.github/workflows/deploy.yml` to GitHub Pages at `/system-design/`. A local build is not evidence of a successful live deployment.
