# Architecture Styles

> Software Design · Lessons + Q&A · Question bank part 9 · 16 questions · [All questions](/interview/)

<QaControls />

## Lessons {#lessons}

Architecture is the set of decisions that are expensive to change later: module boundaries, the direction of dependencies, who owns each piece of data and how the parts talk to each other. No style is "the best"; each trades one cost for another. In an interview, too, the right answer always starts with "it depends on …" and ends with a specific choice.

### Layered: the starting point <Badge type="warning" text="Important" />

Three layers: presentation (controller) → logic (service) → data (ORM and database). Each layer calls only the one below it. Simple, familiar and enough for most CRUD; the default Laravel project is exactly this.

Its weakness is the direction of dependency: business logic depends on the data layer. In practice: the Eloquent model or database struct climbs up to the controller, a business rule cannot be tested without the database and the "service" slowly turns into one long transaction script.

### The dependency rule: Hexagonal, Onion, Clean <Badge type="danger" text="Must-know" />

All three are one idea with different naming: **source-code dependencies point inward only.** The domain sits in the centre and imports nothing from the outside; everything that does I/O (HTTP, database, queue, SDK) is in the outermost ring and implements an interface defined inside.

```text
            Layered                                Hexagonal / Onion / Clean

   ┌────────────────────┐              driving adapters            driven adapters
   │ Presentation (HTTP)│              (HTTP, CLI, consumer)       (Postgres, Redis, SMS)
   └─────────┬──────────┘                     │                          ▲
             ▼                                ▼                          │ implements
   ┌────────────────────┐              ┌──────────────── application ───────────────┐
   │ Business logic     │              │  use cases                                 │
   └─────────┬──────────┘              │     ┌──────────── domain ────────────┐     │
             ▼                         │     │ entities, value objects, rules │     │
   ┌────────────────────┐              │     │ ports (interfaces)             │     │
   │ Data access (ORM)  │              │     └────────────────────────────────┘     │
   └─────────┬──────────┘              └────────────────────────────────────────────┘
             ▼
         database                      source-code dependencies point inward only:
                                       adapters -> application -> domain
   business depends on the DB          the domain imports nothing from the outside
```

| | Hexagonal (Cockburn) | Onion (Palermo) | Clean (Martin) |
| --- | --- | --- | --- |
| Metaphor | a hexagon with ports and adapters | onion rings | concentric circles |
| Vocabulary | driving / driven adapter, port | domain model, domain service, application service | entity, use case, interface adapter, framework |
| Emphasis | symmetry of input and output; testability | the domain model at the centre | the dependency rule and the use-case boundary |
| In practice | the same: a pure domain, use cases, adapters outside | the same | the same |

Keep the two kinds of port apart: **driving** (inbound; whoever calls the application: a handler, the CLI, a queue consumer) and **driven** (outbound; whatever the application calls: a repository, a gateway, a publisher). An analogy: a game console and its controllers. The console (the domain) only defines the shape of the port; any controller that fits the port works, and the console does not know which company made it.

The cost is real: more files and more mapping (domain model ↔ database model ↔ DTO). For simple CRUD that cost never pays back.

### Folder layout in Go and Laravel <Badge type="warning" text="Important" />

```text
cmd/api/main.go                 # composition root: builds adapters, injects them
internal/
  order/                        # one module = one bounded context
    domain/
      order.go                  # aggregate + invariants, no imports from adapters
      money.go                  # value object
      events.go                 # OrderPlaced, OrderPaid
      repository.go             # port: type Repository interface { ... }
    app/
      place_order.go            # use case (command handler)
      order_queries.go          # read side
    adapters/
      httpapi/handler.go        # driving adapter
      postgres/repository.go    # driven adapter, implements domain.Repository
      amqp/publisher.go
  billing/
    ...
```

```text
app/
  Http/Controllers/Order/PlaceOrderController.php   # driving adapter (thin)
  Console/Commands/                                 # driving adapter
src/                                                # or app/Modules/, autoloaded via PSR-4
  Order/
    Domain/
      Order.php                 # aggregate (plain PHP, no Eloquent)
      Money.php                 # value object
      OrderRepository.php       # port (interface)
      Events/OrderPlaced.php
    Application/
      PlaceOrder.php            # use case / action
      OrderFinder.php           # query object
    Infrastructure/
      EloquentOrderRepository.php   # driven adapter
      OrderModel.php                # the Eloquent model stays here
      OrderServiceProvider.php      # binds port -> adapter
```

Organise folders first by *business capability* (`order`, `billing`) and then by layer; not the other way round. Top-level `controllers/`, `services/`, `repositories/` folders mean you have to open five different places for every feature and no boundary between modules is visible.

### Strategic DDD: boundaries and language <Badge type="danger" text="Must-know" />

Strategic DDD is not about code; it is about where to cut the system.

- **Ubiquitous Language:** the same word the business expert uses appears in the code, the table and the API. If the business says "shipment" and the code says `Package`, every conversation involves a mental translation, and bugs come from that translation.
- **Bounded Context:** a boundary inside which every word has exactly one meaning. "Customer" in sales means leads and contracts; in support it means tickets and SLAs; in finance it means invoices and debt. Trying to have a single `Customer` model with eighty columns is the God Object at organisation scale.
- **Subdomain:** core (where the competitive advantage is; your best people and a rich model), supporting (necessary but not differentiating; build it simply), generic (buy it or use a library: authentication, payments).
- **Context Map:** the relationships between contexts and who conforms to whom.

| Relationship pattern | Meaning | Example |
| --- | --- | --- |
| Customer / Supplier | upstream puts downstream's needs on its roadmap | the orders team adds a field for the reporting team |
| Conformist | downstream accepts upstream's model without argument | using an external SaaS's API model directly |
| Anti-Corruption Layer | a translation layer so the external model does not leak in | an adapter over a legacy system or a bank gateway |
| Open Host / Published Language | one public, documented API or event schema for everyone | `order.*.v1` events with a registered schema |
| Shared Kernel | a small shared part with joint ownership | the `Money` type between two contexts; dangerous if it grows |
| Separate Ways | do not integrate at all | two systems that are not worth connecting |

A good boundary is usually where the language changes, the team changes or the rate of change differs. A bounded context is not necessarily a microservice; it can be a module in a monolith.

### Tactical DDD: the building blocks <Badge type="danger" text="Must-know" />

| Block | Definition | Practical rule |
| --- | --- | --- |
| Entity | has identity and changes over time | equality by `id` |
| Value Object | no identity, immutable | equality by value; `Money`, `Email` |
| Aggregate | a cluster of entities and value objects with one root; the consistency boundary | one transaction = one aggregate; from outside only the root is reachable |
| Repository | loads and saves the *whole* aggregate | one repository per aggregate, not per table |
| Domain Event | a fact that happened in the domain, named in the past tense | `OrderPlaced`; published after commit |
| Domain Service | a rule that does not belong to one entity | a pricing policy across several aggregates; no state and no I/O |
| Application Service | the use case; coordination, transaction, authorization | has no business logic; it only orchestrates |
| Factory | builds a valid aggregate | when construction itself has rules |

```go
type Order struct {
	id     OrderID
	status Status
	lines  []Line
	events []Event
}

// every change goes through the root, so each invariant has exactly one home
func (o *Order) AddLine(sku SKU, qty int, price Money) error {
	if o.status != StatusDraft {
		return ErrOrderLocked
	}
	if qty <= 0 {
		return ErrInvalidQuantity
	}
	o.lines = append(o.lines, Line{sku: sku, qty: qty, price: price})
	return nil
}

func (o *Order) Place() error {
	if len(o.lines) == 0 {
		return ErrEmptyOrder
	}
	o.status = StatusPlaced
	o.events = append(o.events, OrderPlaced{ID: o.id})
	return nil
}
```

Spend the tactical patterns only on the core subdomain. Writing aggregates and domain events for the "manage categories" page is waste.

### CQRS and Event Sourcing at a glance <Badge type="warning" text="Important" />

```text
 command ──► write model (aggregate) ──► events ──► projector ──► read model(s) ──► query
                  │                         │
                  │ state-stored:           │ event-sourced:
                  │ UPDATE the row          │ append to the event store,
                  │                         │ state = fold(events), snapshot every N events
```

| Level | What is separated | Cost |
| --- | --- | --- |
| CQS | a method either changes something or answers | none |
| CQRS light | separate command and query classes, one database | low; <span class="vip-locked" title="VIP members only">CQRS Light <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> |
| Full CQRS | a separate read model (Elasticsearch, a denormalized table) | eventual consistency, projectors, rebuilds |
| Event Sourcing | the source of truth is the sequence of events, not the state | event versioning, snapshots, a different team mindset |

CQRS and Event Sourcing are independent: CQRS without Event Sourcing is common and low-risk. Choose Event Sourcing only when *the history itself is a business requirement* (a ledger, legal audit, "what was the state on date X?"), not to make the architecture more attractive.

### From Monolith to Serverless: the trade-off table <Badge type="danger" text="Must-know" />

| | Monolith | Modular Monolith | Microservices | Serverless (FaaS) |
| --- | --- | --- | --- | --- |
| Deployment unit | one | one | per service | per function |
| Boundaries | by convention (if any) | modules with a public API; enforced by tooling | the network | the network and events |
| Data | one DB, free joins | one DB, separate schema or tables per module | a DB per service | managed services |
| Consistency | ACID transactions | ACID transactions (with care across modules) | Saga, outbox, eventual | eventual |
| Operational cost | low | low | high: CI/CD, tracing, mesh, on-call | low for infrastructure; high for observability and testing |
| Scaling | the whole app together | the whole app together | each service separately | automatic, down to zero |
| Debugging | a stack trace | a stack trace | distributed traces | distributed traces and scattered logs |
| Suitable team size | 1 to 10 people | 5 to 50 people | several independent teams | any size, for irregular load |
| Main risk | big ball of mud | boundary erosion | distributed monolith | vendor lock-in; cold start; cost under steady load |

A sensible path: start with a modular monolith, discover and stabilise the boundaries inside one process and extract only the module that has a specific reason (different scaling, an independent team, a different release cycle, failure isolation). Moving a wrong boundary in a monolith is a refactor; in microservices it is a data-migration project.

### Twelve-Factor <Badge type="warning" text="Important" />

Twelve rules for a service that can be run, scaled and replaced in a container without trouble.

| # | Factor | In practice |
| --- | --- | --- |
| 1 | Codebase | one repo per service, many deploys from the same code |
| 2 | Dependencies | explicit and locked: `go.mod`, `composer.lock` |
| 3 | Config | in env, not in code or the image; the same image for staging and production |
| 4 | Backing services | DB, Redis and the queue are attached resources; swapped by changing a URL |
| 5 | Build, release, run | three separate stages; a release is immutable and can be rolled back |
| 6 | Processes | stateless; sessions and files in Redis and object storage |
| 7 | Port binding | the service listens on HTTP itself |
| 8 | Concurrency | scale by adding processes, of different types (web, worker) |
| 9 | Disposability | fast startup, graceful shutdown on `SIGTERM` |
| 10 | Dev/prod parity | the same kind of DB and broker in development; not SQLite instead of PostgreSQL |
| 11 | Logs | an event stream to stdout; collection is the platform's job |
| 12 | Admin processes | migrations and one-off scripts with the same code and the same config |

The three that are violated most: 3 (config in the image), 6 (uploaded files on the pod's local disk) and 9 (a worker that dies mid-job with `SIGKILL` because it has no graceful shutdown).

### Quick summary

| Concept | One-liner | When |
| --- | --- | --- |
| Layered | dependencies point down, all the way to the database | CRUD, a simple domain |
| Hexagonal / Clean | dependencies point inward, the domain is unaware of I/O | a complex domain, a long lifetime, changing infrastructure |
| Bounded Context | a boundary inside which every word has one meaning | always; the basis of every boundary decision |
| Aggregate | the consistency and transaction boundary | when an invariant spans several objects |
| CQRS light | separate read and write classes | reads have a different shape from writes |
| Event Sourcing | events are the source of truth | history is a business requirement |
| Modular Monolith | one deploy, enforced boundaries | the sensible default for most teams |
| Microservices | deployment independence in exchange for distributed complexity | several teams, stabilised boundaries |
| Twelve-Factor | a replaceable, stateless service | anything that runs in a container |

## Questions & answers {#qa}

### 9.1 — Layered versus Hexagonal, Onion and Clean? <Badge type="danger" text="Must-know" /> {#q-9-1}

::: details Answer {open}
**Answer:** Layered has three layers and dependencies point downward; so the business depends on the database. In Hexagonal (Ports &amp; Adapters) the domain is at the centre and defines ports; adapters are outside and dependencies point inward. Onion and Clean are the same idea with concentric rings.

```text
internal/order/
  domain/      # entities, value objects, ports (interfaces)
  app/         # use cases
  adapters/
    http/      # driving adapter
    postgres/  # driven adapter
```

**Real-world example:** swapping the payment gateway without touching the use cases. **Use case:** Layered for CRUD; Hexagonal for a complex domain.
:::

### 9.2 — DDD concepts? <Badge type="danger" text="Must-know" /> {#q-9-2}

::: details Answer {open}
**Answer:** Strategic: Ubiquitous Language, Bounded Context, Anti-Corruption Layer. Tactical: Entity, Value Object, Aggregate, Domain Event.

**Real-world example:** "Product" in the catalogue is not the same as "Product" in the warehouse.
:::

### 9.3 — CQRS and its relationship to Event Sourcing? <Badge type="danger" text="Must-know" /> {#q-9-3}

::: details Answer {open}
**Answer:** Separating the write model from the read model. "CQRS light" means the same database and only separate classes for commands and queries. The full form has a separate read model that is updated by events. Event Sourcing almost always needs CQRS, but CQRS without it is common.

**Real-world example:** placing an order in Postgres and searching from Elasticsearch. <strong class="qa-trap">Interview trap:</strong> the user does not see their own change immediately.
:::

### 9.4 — Event Sourcing? <Badge type="warning" text="Important" /> {#q-9-4}

::: details Answer {open}
**Answer:** Instead of the current state, a sequence of immutable events is stored and the state is obtained by replay.

**Real-world example:** a wallet ledger. **Use case:** financial and compliance domains.
:::

### 9.5 — Monolith, Modular Monolith, SOA, Microservice and Serverless? <Badge type="warning" text="Important" /> {#q-9-5}

::: details Answer {open}
- **Monolith:** one deployment unit and one DB; simple.
- **Modular Monolith:** one deployment with bounded modules; like Shopify.
- **SOA:** coarse-grained enterprise services with a central ESB.
- **Microservice:** small services with their own database and independent deployment.
- **Serverless:** event-driven functions that scale to zero.

**The difference between SOA and Microservice:** the former puts the intelligence in the ESB; the latter wants team and deployment independence.
:::

### 9.6 — When Microservices and when a Monolith? <Badge type="danger" text="Must-know" /> {#q-9-6}

::: details Answer {open}
**Answer:** Microservices when several independent teams slow each other down and the domain boundaries are clear. A monolith when the team is small and the domain is unknown.

**Real-world example:** in 2023 the Prime Video team moved a monitoring service back from distributed serverless to a monolith. <strong class="qa-trap">Interview trap:</strong> one service and one database can implement every boundary; you do not need a microservice for each concept.
:::

### 9.7 — Twelve-Factor and stateless? <Badge type="warning" text="Important" /> {#q-9-7}

::: details Answer {open}
**Answer:** Configuration in env, stateless processes, logs to stdout.

**Real-world example:** sessions in Redis instead of process memory.
:::

### 9.8 — How do you decide an Aggregate's boundary? <Badge type="danger" text="Must-know" /> {#q-9-8}

::: details Answer {open}
**Answer:** An Aggregate is the boundary of immediate consistency: everything that must be correct together *in the same transaction* is inside one aggregate, and the rest is outside. Four practical rules:

- find the real invariant ("the total of the lines must not exceed the credit limit"); only what that rule needs belongs inside the boundary;
- keep it small; a large aggregate means a large lock, heavy loading and concurrency conflicts;
- refer to other aggregates by id only (`customerID`), not by a pointer to the object;
- coordinate changes to several aggregates with domain events and eventual consistency, not in one transaction.

| Question | If yes |
| --- | --- |
| Must these two be consistent with each other at the same instant? | one aggregate |
| Does the business accept a few seconds of delay? | two aggregates and an event |
| Do two users change different parts of it at the same time? | it is probably too big |
| Does an inner collection grow without bound? | move that collection out |

**Real-world example:** `Order` and `OrderLine` are one aggregate (the order total depends on the lines). `Product` is outside; the price at the moment of purchase is copied into `OrderLine`. If `Customer` holds all of its orders, placing each order locks the whole customer and a busy customer becomes a bottleneck.

**Use case:** control concurrency with optimistic locking on the root (a `version` column); frequent conflicts on one aggregate are a sign of a wrong boundary.

<strong class="qa-trap">Interview trap:</strong> drawing the boundary from database relationships ("these have a foreign key, so they are one aggregate"). The invariant sets the boundary, not the ER diagram.
:::

### 9.9 — Anemic Domain Model versus Rich; is rich always better? <Badge type="warning" text="Important" /> {#q-9-9}

::: details Answer {open}
**Answer:** In an anemic model the objects are only data (getters and setters) and all the rules are written in service classes (Transaction Script). In a rich model the rule sits next to the data and the object does not allow itself to enter an invalid state.

| | Anemic / Transaction Script | Rich Domain Model |
| --- | --- | --- |
| Where the rule lives | in services; usually duplicated | in entities and value objects |
| Invalid state | any part of the code can produce it | cannot be constructed |
| Start-up cost | low | higher; mapping and design |
| Testing | with a database or many mocks | pure, fast unit tests |
| Suitable for | CRUD, reports, admin panels, supporting subdomains | a core subdomain with many rules |

```php
// anemic: any caller can produce an inconsistent order
$order->status = 'cancelled';
$order->save();

// rich: the rule and the state change are one operation
final class Order
{
    public function cancel(string $reason): void
    {
        if ($this->status === OrderStatus::Shipped) {
            throw new CannotCancelShippedOrder($this->id);
        }
        $this->status = OrderStatus::Cancelled;
        $this->recordThat(new OrderCancelled($this->id, $reason));
    }
}
```

**Real-world example:** the rule "a shipped order cannot be cancelled" was respected in the web controller but not in the auto-cancel job or the support panel; because three different places changed `status` directly.

<strong class="qa-trap">Interview trap:</strong> "anemic is an anti-pattern, always go rich". For a form that is only stored and displayed, a rich model is pure ceremony. It is an anti-pattern when you have a complex domain but your model is anemic.
:::

### 9.10 — In which layer does validation happen? <Badge type="warning" text="Important" /> {#q-9-10}

::: details Answer {open}
**Answer:** "Validation" is four different things and each has its own place:

| Kind | Question | Where | Result of failure |
| --- | --- | --- | --- |
| input shape | is the JSON valid? Is the required field there? Type and length? | the edge: `FormRequest`, a DTO in the handler | `400` or `422` |
| authorization | may this user do this to this resource? | the application service or a policy | `403` |
| domain rule | is this state change allowed? Is the amount non-negative? | value objects and aggregates | a domain error → `409` or `422` |
| cross-aggregate or global rule | is the email unique? Is there enough stock? | the application service plus a database constraint | `409` |

The guiding principle: the edge for user experience (a good, early error message), the domain for correctness (the rule holds even when called from the CLI, a job or a consumer) and the database as the last line of defence against races.

**Real-world example:** email uniqueness was checked only with "`SELECT` first, then `INSERT`"; two concurrent requests both passed and two users were created with one email. Correct: a `UNIQUE` constraint and translating its violation error into a domain error.

**Use case:** use value objects to remove repeated validation: when the parameter type is `Email`, no layer needs to check the email format again.

<strong class="qa-trap">Interview trap:</strong> "all validation goes in the FormRequest". Then the same use case runs from the queue or the CLI path with no rules at all.
:::

### 9.11 — How do you define and enforce module boundaries in a Modular Monolith? <Badge type="warning" text="Important" /> {#q-9-11}

::: details Answer {open}
**Answer:** A boundary that is only a "team agreement" erodes within six months. Each module needs three things: a small public API (interfaces, DTOs and events), unreachable internals, and exclusive ownership of its tables.

**Steps:**

- **Code:** in Go, everything under `internal/order/` and only one thin public package; in PHP, a dependency rule with Deptrac or an architecture test.
- **Data:** each module has its own schema or table prefix; no `JOIN` across modules and no foreign keys between them. Get another module's data from its API or from a local read model.
- **Communication:** sync calls only through the public API; side effects through events (in-process, preferably with an outbox) so that modules can be split off later.
- **CI:** an architecture test that turns the build red when a boundary is violated.

```php
// tests/Architecture/BoundariesTest.php (Pest)
arch('order domain is framework-free')
    ->expect('Src\Order\Domain')
    ->not->toUse(['Illuminate', 'Src\Order\Infrastructure']);

arch('billing does not reach into order internals')
    ->expect('Src\Billing')
    ->not->toUse('Src\Order\Domain');
```

**Real-world example:** the reporting module `JOIN`ed the `orders` table directly; when the orders team renamed a column, reports broke in production. After that, reporting reads from a projection table filled by order events.

<strong class="qa-trap">Interview trap:</strong> boundaries in code but a shared, open database. If every module can reach every table there is no real boundary, and splitting into microservices later is practically impossible.
:::

### 9.12 — What is an ADR and why does it matter? <Badge type="info" text="Good to know" /> {#q-9-12}

::: details Answer {open}
**Answer:** An Architecture Decision Record is a short document (one page) that records one architectural decision together with its context and consequences. The code says "what"; the ADR says "why this and not that". It is kept in the repo next to the code, is numbered and is immutable: a new decision "supersedes" the earlier ADR, it does not edit it.

```text
# ADR-0012: Use the outbox pattern for publishing order events

Status: Accepted (2026-02-10)   Supersedes: ADR-0007

Context
  Orders are written to PostgreSQL and events go to RabbitMQ. We lost events
  twice last quarter when the broker was unreachable after commit.

Decision
  Write events to an outbox table in the same transaction; a polling relay publishes them.

Alternatives considered
  - Publish after commit with retries: still loses events on process crash.
  - CDC with Debezium: no Kafka Connect expertise in the team today.

Consequences
  + No lost events; consumers must be idempotent (at-least-once).
  - Up to ~500 ms extra latency; outbox table needs cleanup and monitoring.
```

**Real-world example:** a new team member asks "why don't we have Kafka?" and, instead of a one-hour meeting, reads ADR-0005, which explains the constraints of the time; if those constraints have changed, there is a clear reason to revisit.

**Use case:** for decisions that are expensive to reverse: the choice of database and broker, service boundaries, the API contract, the authentication style. Not for choosing a variable name.

<strong class="qa-trap">Interview trap:</strong> an ADR without the "rejected alternatives" and "negative consequences" sections is just an announcement. Its value is in recording the trade-off.
:::

### 9.13 — What is Vertical Slice Architecture and how does it differ from layering? <Badge type="info" text="Good to know" /> {#q-9-13}

::: details Answer {open}
**Answer:** Instead of a horizontal cut (controller, service, repository), the code is cut by *use case*: each feature has one folder that contains everything it needs (request, handler, validation, query, response). Coupling between slices is low and cohesion inside each slice is high.

```text
internal/order/
  placeorder/        # POST /orders: request, handler, validation, SQL, tests
  cancelorder/
  listorders/        # may use raw SQL and a flat DTO; no need to share a model
  shared/            # only what at least three slices really share
```

| | Layered | Vertical Slice |
| --- | --- | --- |
| Adding a feature | touching four or five folders | one new folder |
| Code sharing | high (sometimes too high) | low; deliberate duplication |
| Uniformity | every feature has the same shape | each slice is as complex as it needs to be |
| Risk | fat, shared services | a domain rule duplicated across slices |

**Real-world example:** `listorders` is one direct SQL query and a flat DTO; `placeorder` uses the aggregate and the repository. Neither has to put up with the other's ceremony. This pairs well with CQRS light and with action classes in Laravel.

**Use case:** it does not conflict with Hexagonal: you can have a shared domain core and arrange the use cases as slices.

<strong class="qa-trap">Interview trap:</strong> if a domain rule (an invariant) is copied into several slices, you are back at the anemic model. Shared rules must stay in the domain model; only the *flow* of each use case is separate.
:::

### 9.14 — Conway's law and fitness functions in architecture? <Badge type="info" text="Good to know" /> {#q-9-14}

::: details Answer {open}
**Answer:** **Conway's law:** the structure of a system mirrors the communication structure of the organisation that builds it. Three teams building a compiler deliver a three-pass compiler. The practical consequence (the Inverse Conway Maneuver): if you want a particular architecture, arrange the teams in that shape first; each team fully owns one bounded context.

**Fitness function:** an automated check that continuously measures one architectural characteristic, so that the architecture is something executable that can fail in CI rather than a document.

| Characteristic | Example fitness function |
| --- | --- |
| dependency direction | an architecture test: the domain must not import an adapter |
| module boundaries | Deptrac or a dependency linter in CI |
| performance | a load test: p99 under 300 milliseconds on every release |
| contract compatibility | contract tests; an event-schema compatibility check |
| security | dependency and secret scanning in the pipeline |
| resilience | a periodic failure test: with Redis down the service must still respond |

**Real-world example:** two teams worked on one shared service and every release needed both to coordinate. Splitting the service did not help until ownership was split too; before that they had only built a distributed monolith.

<strong class="qa-trap">Interview trap:</strong> microservices with one five-person team. By Conway's law that team ends up building one entangled system anyway, only with the network cost added.
:::

### 9.15 — Where is Serverless a good fit and what is a cold start? <Badge type="info" text="Good to know" /> {#q-9-15}

::: details Answer {open}
**Answer:** In FaaS, code runs as a function in response to an event, the platform manages scaling from zero up to a concurrency limit and you pay only for execution time. A **cold start** is the delay of the first invocation when no warm instance exists: creating the execution environment, loading the code and initialising. Depending on the runtime and the package size it takes from tens of milliseconds to a few seconds.

| Good for | Bad for |
| --- | --- |
| irregular, spiky load; periodic work | steady, high load (an always-on server is cheaper) |
| event processing: file uploads, webhooks, queue messages | low, predictable latency (a strict p99) |
| glue between managed services | persistent connections: WebSocket, long-running work |
| a small team with no operations capacity | work that needs local state or a large connection pool |

**Real-world example:** a function that builds a thumbnail on every image upload; a hundred times a day or a hundred thousand, with no server management. By contrast, an API with steady traffic where every function instance opens a PostgreSQL connection fills the database's connection limit on a load spike; without a connection proxy (such as PgBouncer or RDS Proxy) it falls over.

**Use case:** reducing cold starts: a small binary (Go has an advantage here), initialisation outside the handler, fewer dependencies and, if needed, pre-warmed instances (which removes part of the cost advantage).

<strong class="qa-trap">Interview trap:</strong> "serverless means no operations". Operations move elsewhere: concurrency limits, timeouts, the platform's automatic retries (which make idempotency mandatory), scattered observability and hard local testing.
:::

### 9.16 — Multi-Tenant architecture: data isolation models? <Badge type="warning" text="Important" /> {#q-9-16}

::: details Answer {open}
**Answer:** Three main models, on a spectrum from "cheap and shared" to "expensive and isolated":

| | Shared tables (`tenant_id` column) | Schema per tenant | Database per tenant |
| --- | --- | --- | --- |
| Cost per tenant | very low | medium | high |
| Data isolation | logical; one forgotten `WHERE` is a leak | better | complete |
| Noisy neighbour | a serious problem | a problem | solved |
| Migrations | once | N times | N times, with tooling |
| Single-tenant backup and restore | hard | possible | easy |
| Ceiling on tenant count | millions | thousands (the catalog gets heavy) | hundreds to thousands |
| Suitable for | SaaS with many small customers | a medium count, a need for customisation | enterprise customers, legal requirements |

In the shared model the tenant filter must not depend on the programmer's memory. Use two layers: a global scope in the ORM or repository, and Row-Level Security in PostgreSQL as a safety net.

```sql
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON invoices
  USING (tenant_id = current_setting('app.tenant_id')::bigint);

-- per request, inside the transaction:
SET LOCAL app.tenant_id = '42';
```

**Real-world example:** a hybrid (bridge) model: most customers in shared tables and a few large customers on dedicated databases; a routing layer picks the right connection from the tenant. The same idea is needed for queues and caches: cache keys prefixed with the tenant and per-tenant rate limits, so that one customer does not starve the rest.

<strong class="qa-trap">Interview trap:</strong> by default RLS is not applied to the table owner or to superusers; the application must connect with a role other than the owner (or use `FORCE ROW LEVEL SECURITY`). Second trap: reading `tenant_id` from the request body; it must come from the authenticated identity (the token).
:::

## Related {#related}

- <span class="vip-locked" title="VIP members only">CQRS Light <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>
- <span class="vip-locked" title="VIP members only">Microservices and resilience <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>
- [Design Principles](/design/principles)
