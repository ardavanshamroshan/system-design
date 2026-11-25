# Design Patterns

> Software Design · Lessons + Q&A · Question bank part 8 · 15 questions · [All questions](/interview/)

<QaControls />

## Lessons {#lessons}

A design pattern is a "named solution to a recurring problem". Its main value is shared vocabulary: when you say "this is a decorator over the repository", your teammate understands the structure without reading the code. The right order is always: the problem first (this `switch` keeps growing; this object has ten optional parameters), then the pattern. Someone who starts from the pattern writes code with three layers of abstraction and one implementation.

Hands-on **Laravel + FastAPI** walkthroughs for each SOLID letter and GoF pattern: [GoF & SOLID catalog](/design/gof/).

You use most of these patterns every day in your framework and standard library; that is what the "where you already see it" column is for.

### Creational patterns <Badge type="danger" text="Must-know" />

The shared problem: separating "what gets built and how" from the code that consumes it.

| Pattern | Intent | Everyday analogy | Where you already see it | When not to |
| --- | --- | --- | --- | --- |
| Singleton | exactly one instance | one building manager for the whole complex | `sync.Once`; `$app->singleton()`; a connection pool | when you only want it for "easy access from everywhere"; that is global state |
| Factory Method | choosing the concrete type behind a function | a counter where you order and do not know which cook prepares it | `sql.Open("pgx", …)`; `Storage::disk('s3')` | when you have a single type; `new` is enough |
| Abstract Factory | building a *family* of matching objects | a furniture set from one brand | `database/sql/driver` (Driver → Conn → Stmt); Laravel's Managers | when the objects do not depend on each other |
| Builder | assembling a complex object step by step | ordering a sandwich layer by layer | Query Builder; `strings.Builder`; Functional Options | an object with two or three required fields |
| Prototype | creating by copying a ready instance | photocopying a filled-in form | `clone` in PHP; copying a struct in Go | when a deep copy is expensive or ambiguous |
| Object Pool | reusing an expensive object | a shared bicycle | `sync.Pool`; the database connection pool | a cheap object; the pool itself brings complexity and bugs |

### Structural patterns <Badge type="danger" text="Must-know" />

The shared problem: how to put objects together without welding them to each other. Almost all of them are "an object that wraps another object"; the difference is the *intent*.

| Pattern | Intent | Everyday analogy | Where you already see it | When not to |
| --- | --- | --- | --- | --- |
| Adapter | converting one interface into the expected one | a plug adapter | Flysystem; wrapping a gateway SDK behind `PaymentGateway`; `http.HandlerFunc` | when you can change the interface itself |
| Decorator | adding behaviour while keeping the interface | putting a jacket on over your clothes | `bufio.NewReader`, `gzip.NewReader`; middleware; `CachedUserRepository` | when the wrapping order becomes unclear or fragile |
| Proxy | controlling access to the real object | a secretary who screens calls | lazy objects in PHP; gRPC stubs; a reverse proxy | when it only adds a useless layer |
| Facade | one simple door onto a complex subsystem | a hotel front desk | a `CheckoutService` over ten classes; Laravel Facades (really a static proxy) | when it turns into a God Object |
| Composite | treating leaf and branch alike | folders and files | nested menus; composite validation rules; `io.MultiWriter` | non-tree structures |
| Bridge | two independent dimensions of change | a remote control and a TV | `database/sql` and drivers; `log/slog` and `slog.Handler` | when only one dimension varies |

```go
f, err := os.Open("events.json.gz")
if err != nil {
	return err
}
defer f.Close()

zr, err := gzip.NewReader(bufio.NewReader(f)) // file -> buffered -> gunzip
if err != nil {
	return err
}
defer zr.Close()

dec := json.NewDecoder(io.LimitReader(zr, 10<<20)) // -> capped at 10 MiB -> JSON
```

Each layer takes an `io.Reader` and returns an `io.Reader`; that is the decorator, without a single line of inheritance.

### Behavioural patterns <Badge type="danger" text="Must-know" />

The shared problem: who decides, and how responsibility is divided among objects.

| Pattern | Intent | Everyday analogy | Where you already see it | When not to |
| --- | --- | --- | --- | --- |
| Strategy | a swappable algorithm | choosing a route on a map: fastest or shortest | `sort.Slice` with a `less` function; cache and queue drivers | two fixed cases; an `if` reads better |
| Observer | notifying whoever is interested | a news alert for subscribers | Events and Listeners in Laravel; Eloquent model events | when the main flow gets hidden behind listeners |
| Command | a request as a storable object | a restaurant order slip | a queued Job; an Artisan command; a command bus | a plain synchronous call |
| Chain of Responsibility | passing a request through a chain of handlers | the approval steps of an office letter | middleware in `net/http` and Laravel; Pipeline | when the order of the links creates hidden dependencies |
| State | behaviour that depends on state | a traffic light | an order state machine; a circuit breaker | two or three states with simple transitions |
| Template Method | a fixed skeleton with variable steps | a form with blanks | `FormRequest` (`rules`, `authorize`); `sort.Interface` | when the inheritance hierarchy gets deep |
| Iterator | traversal without exposing the structure | the "next" button on a player | `rows.Next()`; generators in PHP; `LazyCollection` | a small in-memory collection |
| Mediator | a central coordinator instead of everyone talking to everyone | an airport control tower | the orchestrator in a Saga; a command bus | when it becomes a God Object itself |
| Null Object | a do-nothing implementation instead of `nil` | a reserved empty seat | `io.Discard`; `NullLogger` in PSR-3 | when absence should be an error |
| Specification | a composable business rule | the search filters of a listings site | Eloquent scopes; Criteria in Doctrine | a single simple condition |

```php
// Manager = Factory + Strategy: the driver is picked by name from config
Storage::disk('s3')->put('invoices/42.pdf', $pdf);
Cache::store('redis')->remember("user:{$id}", 600, fn () => User::findOrFail($id));

// Pipeline = Chain of Responsibility: each pipe passes the payload on or stops
$order = app(Pipeline::class)
    ->send($order)
    ->through([ValidateStock::class, ApplyDiscount::class, CalculateTax::class])
    ->thenReturn();
```

### Same pattern, two languages <Badge type="warning" text="Important" />

The GoF book was written for class-based languages with inheritance. In Go half of the patterns collapse into a function or a single-method interface; in modern PHP, closures and enums have shortened many of them too.

| Pattern | Idiomatic Go | Idiomatic PHP / Laravel |
| --- | --- | --- |
| Strategy | a function value (`func(a, b T) bool`) or a small interface | a class behind an interface; a closure; a Manager with drivers |
| Singleton | `sync.Once`, or better: one instance built in `main` and injected | `singleton` or `scoped` in the container |
| Builder | Functional Options | a fluent builder; named arguments |
| Decorator | a wrapper with the same interface; middleware | a wrapper class; `extend()` on the container |
| Observer | a channel or a list of callbacks | Events and Listeners; model observers |
| Template Method | a function that takes a function or an interface | an abstract class with hooks |
| Iterator | `for range` over a channel or an iterator function | a generator with `yield` |
| Factory | a `NewX(...)` function | a static factory; the container |
| State | an `enum`-like type with `iota` plus a transition table | a backed enum with methods |
| Inheritance | none; embedding and composition | available; but `final` and composition are the better default |

### Data-access patterns <Badge type="warning" text="Important" />

These are not GoF (most come from Fowler's PoEAA) but backend interviews ask about them more than about GoF.

| Pattern | One-liner | Read more |
| --- | --- | --- |
| Repository | an in-memory-like collection per aggregate | question 8.4 |
| Query Object / Directory | named, side-effect-free reads | <span class="vip-locked" title="VIP members only">Directory / Query class <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> |
| CQRS light | a rich write path, a flat read path | <span class="vip-locked" title="VIP members only">CQRS Light <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> |
| Unit of Work | tracking changes and one commit | question 8.6 |
| Active Record / Data Mapper | the object saves itself vs a separate mapper | question 8.12 |
| Cache-Aside, Read/Write-Through | where the cache sits relative to the source of truth | <span class="vip-locked" title="VIP members only">Cache patterns <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> |
| DTO / Value Object / Entity | data carrier, identity-less value, object with identity | question 8.13 |

### Concurrency patterns in Go

| Pattern | Problem | Tool |
| --- | --- | --- |
| Worker Pool | a ceiling on concurrent work | N goroutines on one channel; `errgroup` with `SetLimit` |
| Fan-out / Fan-in | spreading work and collecting results | several goroutines and one result channel |
| Pipeline | sequential stages with backpressure | chained channels and `context` for cancellation |
| Semaphore | limiting access to a resource | a buffered channel or `semaphore.Weighted` |
| Singleflight | collapsing identical concurrent requests | `singleflight.Group`; prevents a cache stampede |

### Anti-patterns <Badge type="warning" text="Important" />

| Anti-pattern | Symptom | Cure |
| --- | --- | --- |
| God Object | a class that knows everything; `Helper`, `Manager`, `Utils` | split by reason to change (SRP) |
| Service Locator | `app()` or a Facade deep in the domain; the dependency is not visible in the signature | constructor injection |
| Anemic Domain Model | the model is only getters and setters; rules are scattered across services | move invariants into the model |
| Singleton as a global | tests are sensitive to execution order | injection; let the container or `main` manage the lifetime |
| Golden Hammer | every problem gets the same favourite pattern | start from the problem |
| Lasagna code | ten thin layers that only pass things along | remove the layer that makes no decision |
| Distributed Monolith | separate services that must be deployed together | redraw the boundaries or merge |

### Quick summary

| If you have this problem … | Reach for |
| --- | --- |
| a `switch` on type that keeps growing | Strategy (or State if the object itself changes state) |
| a constructor with many optional parameters | Builder / Functional Options |
| an external library with an awkward interface | Adapter |
| cache, log, retry or metrics without touching the core code | Decorator / middleware |
| several independent reactions to one occurrence | Observer; Pub/Sub between services |
| work that must run later, in a queue or with retries | Command (Job) |
| sequential stages where each can stop the flow | Chain of Responsibility |
| `if x != nil` everywhere | Null Object |
| the same `where` clauses in several places | Query Object / Specification |
| the domain must not know SQL | Repository |

## Questions & answers {#qa}

### 8.1 — Creational patterns <Badge type="danger" text="Must-know" /> {#q-8-1}

::: details Answer {open}
- **Singleton:** one instance for the whole program. In Go with `sync.Once`; in PHP with a `singleton` binding. Trap: in a long-lived worker it survives across requests.
- **Factory Method and Abstract Factory:** object creation behind an interface; like `NewNotifier("sms")`.
- **Builder:** step-by-step construction; the Query Builder in Laravel; in Go the equivalent is Functional Options.
- **Prototype:** creation by copying; `clone` in PHP and "Clone With" in 8.5.
- **Object Pool:** reuse; `sync.Pool`.

```go
var (
    once sync.Once
    cfg  *Config
)

func GetConfig() *Config {
    once.Do(func() { cfg = load() }) // thread-safe lazy init
    return cfg
}
```
:::

### 8.2 — Structural patterns <Badge type="danger" text="Must-know" /> {#q-8-2}

::: details Answer {open}
- **Adapter:** converting an incompatible interface; wrapping a bank's SDK behind `PaymentGateway`; Flysystem in PHP.
- **Decorator:** adding behaviour; middleware in Go; `CachedUserRepository`.
- **Facade:** a simple interface over a complex subsystem. Trap: a Facade in Laravel is really a static proxy to the container.
- **Proxy:** a stand-in with access control or lazy loading; lazy objects in PHP 8.4, stubs in gRPC.
- **Composite:** the same behaviour for leaf and branch; a nested menu.
- **Bridge:** separating the abstraction from the implementation; `database/sql` and drivers.
:::

### 8.3 — Behavioural patterns <Badge type="danger" text="Must-know" /> {#q-8-3}

::: details Answer {open}
- **Strategy:** a swappable algorithm; calculating the shipping cost.
- **Observer:** Events in Laravel, the EventDispatcher in Symfony.
- **Command:** a request as an object; a queued Job, a command bus.
- **Chain of Responsibility:** the middleware pipeline.
- **State:** the order state machine; the circuit breaker itself.
- **Template Method:** a fixed skeleton, swappable steps.
- **Iterator:** generators in PHP, range-over-func in Go.
- **Mediator:** the orchestrator in a Saga.
- **Null Object and Specification:** `NopLogger` and composable rules.
:::

### 8.4 — The Repository pattern? <Badge type="danger" text="Must-know" /> {#q-8-4}

::: details Answer {open}
**Answer:** A collection-like abstraction over persistence for each aggregate; the domain stays unaware of SQL and the ORM, and testing with a fake becomes easy.

```go
type OrderRepository interface {
    ByID(ctx context.Context, id OrderID) (*Order, error)
    Save(ctx context.Context, o *Order) error
}
```

<strong class="qa-trap">Interview trap:</strong> a generic repository over every table, or leaking the Query Builder to the outside.
:::

### 8.5 — The Query Object pattern (Directory / Finder)? <Badge type="warning" text="Important" /> {#q-8-5}

::: details Answer {open}
**Answer:** A read-only class that keeps the criteria of one read in one place, so that the same `where` clauses are not copied into the controller, the CLI and the job. It has two shapes: named methods for stable domain lookups, and a filter builder for lists with many optional filters.

```php
final class InvoiceFinder
{
    public function overdueFor(int $customerId, int $limit = 20): Collection
    {
        return Invoice::query()
            ->where('customer_id', $customerId)
            ->where('status', 'unpaid')
            ->where('due_date', '<', now())
            ->orderBy('due_date')
            ->limit($limit)
            ->get(['id', 'number', 'total', 'due_date']);
    }
}
```

**Use case:** when a query is repeated in more than one place or has more than two or three conditions. The Query side of light CQRS is exactly this; writes stay in the Action or Command Handler.

<strong class="qa-trap">Interview trap:</strong> a side effect (email, payment, queue) inside the query class, or a "God Directory" with fifty unrelated filters.
:::

### 8.6 — Data and concurrency patterns <Badge type="warning" text="Important" /> {#q-8-6}

::: details Answer {open}
- **Unit of Work:** collecting changes and committing them at once; `flush` in Doctrine.
- **Active Record and Data Mapper:** Eloquent versus Doctrine; in Go, GORM versus sqlc.
- **DTO and Value Object:** immutable objects such as `Money`.
- **Concurrency in Go:** Worker Pool, Fan-out/Fan-in, Pipeline, Semaphore and Singleflight.
:::

### 8.7 — Frequently asked comparisons <Badge type="warning" text="Important" /> {#q-8-7}

::: details Answer {open}
- **Adapter, Decorator, Proxy:** the first changes the interface; the second adds behaviour; the third controls access.
- **Strategy and State:** in the first the client chooses; in the second the object does, by changing state.
- **Factory and Builder:** "which type" versus "how, step by step".
- **Anti-patterns:** God Object, Anemic Domain Model, Service Locator, Distributed Monolith.
:::

### 8.8 — What is wrong with Singleton and what is the alternative? <Badge type="warning" text="Important" /> {#q-8-8}

::: details Answer {open}
**Answer:** The classic Singleton mixes two things: "have only one instance" (sometimes necessary) and "be reachable from everywhere" (global state). The problems come from the second:

- hidden dependencies: the function signature does not show what it depends on;
- testing: state survives between tests and replacing it with a fake is hard;
- concurrency: shared mutable state between goroutines;
- long-lived PHP runtimes (Octane, Swoole): the instance stays alive across requests and the previous user's data leaks.

**Alternative:** keep "one instance" and drop "global access". Build the instance once in the composition root (`main` in Go, a Service Provider in Laravel) and inject it.

```go
// instead of a package-level GetDB(): built once in main, passed explicitly
func main() {
	pool, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	users := NewUserRepository(pool) // still a single pool, but visible in the signature
	_ = users
}
```

**Real-world example:** in Laravel a `singleton` that cached the current user made the next request see the previous user's data under Octane; `scoped` fixed it. **Use case:** for thread-safe lazy initialisation in Go use `sync.Once` or `sync.OnceValue`.

<strong class="qa-trap">Interview trap:</strong> "Singleton is always bad". A connection pool, a logger and config really should be single instances; the objection is to global access and mutable state, not to the instance count.
:::

### 8.9 — The Functional Options pattern in Go? <Badge type="warning" text="Important" /> {#q-8-9}

::: details Answer {open}
**Answer:** Go has no default arguments, named arguments or overloading. Functional Options is the idiomatic way to write a constructor with optional settings: each option is a function that modifies the object, and the constructor applies them in order after setting safe defaults.

```go
type Server struct {
	addr    string
	timeout time.Duration
	logger  *slog.Logger
}

type Option func(*Server)

func WithTimeout(d time.Duration) Option { return func(s *Server) { s.timeout = d } }
func WithLogger(l *slog.Logger) Option   { return func(s *Server) { s.logger = l } }

func NewServer(addr string, opts ...Option) *Server {
	s := &Server{addr: addr, timeout: 30 * time.Second, logger: slog.Default()} // safe defaults
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// srv := NewServer(":8080", WithTimeout(5*time.Second))
```

| Approach | Good | Bad |
| --- | --- | --- |
| a config struct (`Config{...}`) | simple, serializable, readable | the zero value gets confused with "not set" (what does `Timeout: 0` mean?) |
| Functional Options | safe defaults, adding an option without breaking the API, validation per option | more code; options are harder to discover |
| a chained Builder | familiar to people coming from Java or PHP | uncommon in Go; error handling in the middle of the chain is ugly |

**Real-world example:** `grpc.NewServer(grpc.MaxRecvMsgSize(...))` and `grpc.WithTransportCredentials(...)` are this pattern. **Use case:** for a library's public API with many, growing options; for internal code with three settings a plain struct is enough.

<strong class="qa-trap">Interview trap:</strong> do not turn a required field into an option; required values are direct constructor parameters. If an option can be invalid, make the type `func(*Server) error` and return the error from the constructor.
:::

### 8.10 — Which pattern is middleware, and how does it work in Go and Laravel? <Badge type="danger" text="Must-know" /> {#q-8-10}

::: details Answer {open}
**Answer:** A combination of two patterns: structurally it is a **Decorator** (each middleware wraps a handler and returns the same interface) and behaviourally a **Chain of Responsibility** (each link can reject the request, modify it or pass it to the next). Code before the call to `next` runs on the way in and code after it runs on the way out; like the layers of an onion.

```go
type Middleware func(http.Handler) http.Handler

func Chain(h http.Handler, mws ...Middleware) http.Handler {
	for i := len(mws) - 1; i >= 0; i-- {
		h = mws<span class="vip-locked" title="VIP members only">i <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> // wrap from the inside out so mws[0] runs first
	}
	return h
}

func Logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		slog.Info("request", "method", r.Method, "path", r.URL.Path, "took", time.Since(start))
	})
}

func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return // short-circuit: the chain stops here
		}
		next.ServeHTTP(w, r)
	})
}

// handler := Chain(mux, Logging, RequireAuth)
```

```php
final class RequireJsonBody
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->isJson()) {
            return response()->json(['error' => 'json_required'], 415); // stop the chain
        }

        $response = $next($request);            // code above this line runs on the way in
        $response->headers->set('X-Api', 'v1'); // code below it runs on the way out

        return $response;
    }
}
```

**Real-world example:** the usual order from the outside in: panic recovery → request id and tracing → logging and metrics → rate limit → authentication → authorization → handler. If logging sits inside auth, 401 requests are never logged.

**Use case:** cross-cutting concerns that have nothing to do with business logic. The same pattern is used on the HTTP client (`http.RoundTripper`), gRPC interceptors and queue consumers.

<strong class="qa-trap">Interview trap:</strong> putting business logic in middleware (for example calculating a discount); it gets hidden and does not run from the CLI or a queued job. Second trap, in Go: reading `r.Body` in a middleware without restoring it, so the next handler sees an empty body.
:::

### 8.11 — How do Observer, Pub/Sub and Mediator differ? <Badge type="info" text="Good to know" /> {#q-8-11}

::: details Answer {open}
**Answer:** All three separate the sender from the receiver, but to different degrees.

| | Observer | Pub/Sub | Mediator |
| --- | --- | --- | --- |
| Who knows whom | the subject holds the list of observers | neither; both only know the broker and the topic | everyone only knows the mediator |
| Direction | one-way: notification | one-way: publication | two-way: coordination and decisions |
| Boundary | inside one process | usually between processes | inside one process or one orchestrator service |
| Where the logic lives | in the observers | in the subscribers | in the mediator itself |
| Example | Eloquent model events | Kafka, RabbitMQ, Redis Pub/Sub | the orchestrator in a Saga; a command bus |

**Real-world example:** `OrderPaid` in Laravel with sync listeners inside the same request is Observer; the same event going from the outbox to RabbitMQ and being picked up by the inventory service is Pub/Sub; a class that says "payment first, then reserve stock, refund if that fails" is a Mediator.

**Use case:** Observer or Pub/Sub when the reactions are independent; Mediator when order and decisions among several participants matter, because the flow stays readable in one place.

<strong class="qa-trap">Interview trap:</strong> a synchronous listener that throws also fails the main operation, and rolls it back if it runs inside the transaction. "Decoupled" does not mean "isolated in failure", unless the listener runs on a queue and is dispatched after commit.
:::

### 8.12 — Active Record or Data Mapper? (Eloquent vs Doctrine) <Badge type="warning" text="Important" /> {#q-8-12}

::: details Answer {open}
**Answer:** In Active Record each object is a table row and knows how to persist itself. In Data Mapper the domain object knows nothing about the database and a separate mapper reads and writes it; usually together with a Unit of Work and an Identity Map.

```php
// Active Record (Eloquent): the object knows how to save itself
$order = Order::findOrFail($id);
$order->status = 'paid';
$order->save();

// Data Mapper (Doctrine): a plain object; the EntityManager tracks and flushes it
$order = $em->find(Order::class, $id);
$order->markPaid();
$em->flush();
```

| | Active Record | Data Mapper |
| --- | --- | --- |
| Speed of getting started | very high | lower; mapping and more concepts |
| Shape of the model | the shape of the table | independent of the table; a rich model is easier |
| Unit-testing the domain | hard without a database | easy; it is a plain object |
| Writes | explicit; every `save()` is a query | `flush()` writes all tracked changes at once |
| Risk | persistence leaking everywhere; fat models | complexity; surprising flush and lazy-loading behaviour |
| In Go | GORM (close to this style) | sqlc or raw `pgx` plus a hand-written repository |

**Real-world example:** an admin panel and CRUD come up in a few days with Eloquent. The invoicing core with complex rules is better off with an independent domain model; even in Laravel you can keep Eloquent inside the repository only and hand out a domain object or a DTO.

<strong class="qa-trap">Interview trap:</strong> "Active Record is an anti-pattern". For a simple domain it is the best choice. The problem starts when you put complex logic into a model whose every property is public and can be `save()`d from anywhere in the code.
:::

### 8.13 — How do DTO, Value Object and Entity differ? <Badge type="warning" text="Important" /> {#q-8-13}

::: details Answer {open}
**Answer:**

| | Entity | Value Object | DTO |
| --- | --- | --- | --- |
| Identity | has one (`id`); stays the same when fields change | none; only its value matters | none |
| Equality | by `id` | by all fields | irrelevant |
| Mutability | has a lifecycle and changes | immutable | preferably immutable |
| Behaviour and rules | yes (invariants) | yes (validation, calculation) | none; it only carries data |
| Where it lives | the domain layer | the domain layer | the boundaries: HTTP, queue, between layers |
| Example | `Order`, `User` | `Money`, `Email`, `DateRange` | `CreateOrderRequest`, `OrderResponse` |

```go
// value object: validated once, compared by value, never mutated
type Email struct{ value string }

func NewEmail(s string) (Email, error) {
	s = strings.ToLower(strings.TrimSpace(s))
	if !strings.Contains(s, "@") {
		return Email{}, errors.New("invalid email")
	}
	return Email{value: s}, nil
}

func (e Email) String() string { return e.value }
```

**Real-world example:** `amount int` and `currency string` are scattered everywhere as two separate fields and somewhere rials get added to tomans. With `Money` as a Value Object, adding two different currencies is simply impossible.

**Use case:** cure "primitive obsession" with Value Objects: wherever a `string` or `int` has rules (email, national id, amount, date range). Keep DTOs at the boundary so that changing the domain model does not break the API contract.

<strong class="qa-trap">Interview trap:</strong> returning an Entity or an Eloquent model straight from the API; every new column is exposed by accident and the database schema becomes the public contract.
:::

### 8.14 — Template Method or Strategy? <Badge type="info" text="Good to know" /> {#q-8-14}

::: details Answer {open}
**Answer:** Both separate the "fixed part" of an algorithm from the "variable part". Template Method does it with inheritance: the parent class holds the skeleton and the child fills in the steps (chosen at compile time, one dimension of change). Strategy does it with composition: the variable part is a separate object or function that is injected (chosen at runtime, composable and testable on its own).

| | Template Method | Strategy |
| --- | --- | --- |
| Mechanism | inheritance and hooks | composition and injection |
| Control flow | the parent calls the child | the context calls the strategy |
| Swappable at runtime | no | yes |
| Several dimensions of change | subclass explosion | several independent strategies |
| PHP example | `FormRequest`, `Migration` (`up` and `down`), a Job with `handle` | a driver in a Manager |
| Go example | `sort.Sort` with `sort.Interface` | `sort.Slice` with a `less` function |

**Real-world example:** a file importer with the skeleton "open → parse → validate → store". With Template Method you have two subclasses for CSV and Excel; once the "storage target" also varies (DB or S3) the number of subclasses multiplies. With two Strategies (`Parser` and `Sink`) any combination is built without a new class.

**Use case:** because Go has no inheritance, Template Method always takes the shape of "a function that accepts an interface or a function", which is effectively Strategy. In PHP frameworks, Template Method is natural for extension points that the framework calls.

<strong class="qa-trap">Interview trap:</strong> an abstract base class with ten optional hooks that no child needs in full; that is the fragile base class.
:::

### 8.15 — Tell Factory Method, Abstract Factory and Builder apart with examples. <Badge type="info" text="Good to know" /> {#q-8-15}

::: details Answer {open}
**Answer:** They answer different questions:

| Pattern | The question it answers | Output | Example |
| --- | --- | --- | --- |
| Simple Factory / Factory Method | *which* type gets built? | one object of one interface | `NewNotifier("sms")`; `Cache::store('redis')` |
| Abstract Factory | which *family* of compatible objects? | several related objects that work together | a database driver: matching connection, grammar and processor |
| Builder | *how*, and in which steps, is it assembled? | one complex object | Query Builder; Functional Options |

```go
// factory: picks the concrete type; callers only see the interface
func NewNotifier(kind string, cfg Config) (Notifier, error) {
	switch kind {
	case "sms":
		return &SMSNotifier{apiKey: cfg.SMSKey}, nil
	case "email":
		return &EmailNotifier{smtp: cfg.SMTPAddr}, nil
	default:
		return nil, fmt.Errorf("unknown notifier %q", kind)
	}
}
```

**Real-world example:** in Laravel, when you get `DB::connection('pgsql')`, the connection, the query grammar and the schema grammar are all built for PostgreSQL; you cannot mix the MySQL grammar with the PostgreSQL connection. That guarantee of a "compatible family" is the Abstract Factory.

**Use case:** in practice a simple factory (a function with a `switch`, or a map of constructors) is enough ninety percent of the time. Abstract Factory only when several objects really must come from one family.

<strong class="qa-trap">Interview trap:</strong> this `switch` does not violate Open/Closed; one central point for choosing the type is exactly where a `switch` belongs. The problem is when the same `switch` is repeated in ten other places.
:::

## Related {#related}

- <span class="vip-locked" title="VIP members only">Directory / Query class <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>
- <span class="vip-locked" title="VIP members only">CQRS Light <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>
- [Design Principles](/design/principles)
