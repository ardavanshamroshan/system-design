# Design Principles

> Software Design · Lessons + Q&A · Question bank part 7 · 15 questions · [All questions](/interview/)

<QaControls />

## Lessons {#lessons}

Design principles serve one goal: **keeping change cheap**. Code that works today but breaks three unrelated files on every small change is badly designed, even if it follows every pattern. Learn each principle through the "smell" it removes, not through its definition.

### SOLID, one by one <Badge type="danger" text="Must-know" />

| Principle | One-liner | The smell it removes |
| --- | --- | --- |
| **S** — Single Responsibility | each unit has one reason (one stakeholder) to change | the thousand-line class; constant merge conflicts on one file |
| **O** — Open/Closed | new behaviour through new code, not by editing old code | a `switch` on type repeated in ten places |
| **L** — Liskov Substitution | a subtype works wherever the parent did, without surprises | `if ($x instanceof Special)`; a method that throws `not supported` |
| **I** — Interface Segregation | a consumer does not depend on methods it never calls | a mock with twenty empty methods |
| **D** — Dependency Inversion | policy does not depend on details; both depend on an abstraction | a use case that cannot be tested without a real database |

**S — Single Responsibility.** "One job" means "one reason to change". Pricing is changed by the finance team, the email text by marketing; if both live in one method, changing one puts the other at risk.

```php
// before: pricing, persistence and email change for three different reasons
final class OrderService
{
    public function place(Cart $cart): Order
    {
        $total = 0;
        foreach ($cart->items as $item) {
            $total += $item->price * $item->qty;
        }
        $order = Order::create(['total' => $total]);
        Mail::to($cart->email)->send(new OrderPlaced($order));

        return $order;
    }
}

// after: each collaborator has one reason to change; the use case only coordinates
final class PlaceOrder
{
    public function __construct(
        private PriceCalculator $prices,
        private OrderRepository $orders,
        private OrderNotifier $notifier,
    ) {}

    public function handle(Cart $cart): Order
    {
        $order = $this->orders->save(Order::fromCart($cart, $this->prices->total($cart)));
        $this->notifier->placed($order);

        return $order;
    }
}
```

**O — Open/Closed.** Put the point you know will vary (gateway, carrier, output format) behind an interface, so that adding a new case does not mean editing previously tested code.

```go
// before: every new carrier edits this function (and every other switch like it)
func ShippingCost(carrier string, kg float64) (float64, error) {
	switch carrier {
	case "post":
		return 50_000 + 8_000*kg, nil
	case "tipax":
		return 90_000 + 5_000*kg, nil
	default:
		return 0, fmt.Errorf("unknown carrier %q", carrier)
	}
}

// after: a new carrier is a new type registered in one place
type Carrier interface {
	Cost(kg float64) float64
}

type Post struct{}

func (Post) Cost(kg float64) float64 { return 50_000 + 8_000*kg }

type Tipax struct{}

func (Tipax) Cost(kg float64) float64 { return 90_000 + 5_000*kg }

var carriers = map[string]Carrier{"post": Post{}, "tipax": Tipax{}}
```

A single `switch` is fine; OCP pays off when the same `switch` is repeated in several places or cases keep being added.

**L — Liskov Substitution.** A contract is not just the method signature; preconditions, postconditions and the errors that may come back are part of it. A subtype must not demand more or promise less.

```php
// violation: callers of Repository::save() now need to know about the subtype
interface Repository
{
    public function find(int $id): ?Order;
    public function save(Order $order): void;
}

final class ReplicaRepository implements Repository
{
    public function find(int $id): ?Order { /* read from the replica */ return null; }

    public function save(Order $order): void
    {
        throw new LogicException('read-only'); // breaks the contract of the parent type
    }
}

// fix: do not promise what you cannot do
interface OrderReader { public function find(int $id): ?Order; }
interface OrderWriter { public function save(Order $order): void; }
```

**I — Interface Segregation.** Cut the interface to the size the consumer needs. In Go this principle is almost free because interfaces are implemented implicitly.

```go
// before: the report only reads, yet its tests must fake every method
type UserStore interface {
	ByID(ctx context.Context, id int64) (User, error)
	ByEmail(ctx context.Context, email string) (User, error)
	Create(ctx context.Context, u User) error
	Update(ctx context.Context, u User) error
	Delete(ctx context.Context, id int64) error
}

// after: declared in the consumer package, sized to what it actually calls
type userFinder interface {
	ByID(ctx context.Context, id int64) (User, error)
}

func BuildReport(ctx context.Context, users userFinder, id int64) (Report, error) {
	u, err := users.ByID(ctx, id)
	if err != nil {
		return Report{}, fmt.Errorf("load user %d: %w", id, err)
	}
	return Report{Name: u.Name}, nil
}
```

**D — Dependency Inversion.** "Inversion" means the interface belongs to the policy layer (the use case) and the details (SDK, database, HTTP client) implement it; the direction of the code dependency becomes the opposite of the direction of the runtime call.

```php
// before: the use case is welded to one vendor's client
final class SendOtp
{
    public function handle(string $phone, string $code): void
    {
        (new KavenegarClient(config('sms.key')))->send($phone, "Code: {$code}");
    }
}

// after: the policy owns the interface; the detail implements it
interface SmsSender
{
    public function send(string $phone, string $text): void;
}

final class SendOtpViaSender
{
    public function __construct(private SmsSender $sms) {}

    public function handle(string $phone, string $code): void
    {
        $this->sms->send($phone, "Code: {$code}");
    }
}

// AppServiceProvider::register()
$this->app->bind(SmsSender::class, KavenegarSmsSender::class);
```

### DRY, KISS, YAGNI and the "wrong abstraction" <Badge type="danger" text="Must-know" />

- **DRY** is about duplicated *knowledge*, not duplicated *text*. A tax rate hard-coded in three places violates DRY. Two functions that happen to look alike today but change for two different reasons do not.
- **KISS**: the simplest thing that solves the current problem. Simple means the fewest concepts the reader has to hold in their head, not the fewest lines.
- **YAGNI**: do not write code for a need that has not arrived. The real cost is not just writing it; it is maintaining it, testing it and constraining future design.

The classic warning (Sandi Metz): "duplication is far cheaper than the wrong abstraction". The cycle goes like this: you merge two similar pieces of code; the third need is slightly different and a `bool` parameter is added; then another; a few months later you have a function with six flags that nobody dares to touch. The cure: undo the abstraction (inline it), accept the duplication and wait until the real shared shape shows itself. The rule of three: write it the first time, duplicate reluctantly the second time, extract the third time.

### Cohesion and Coupling <Badge type="warning" text="Important" />

Cohesion means things that change together live together; coupling is how much one module knows about another. The goal: high cohesion inside, low and explicit coupling outside.

| Coupling kind (worst first) | Meaning | Example | Better |
| --- | --- | --- | --- |
| content | reaching inside another module | reading another service's table directly | an API or an event |
| common (global) | sharing global state | a package-level variable, `config()` deep in the domain | inject the value |
| control | passing a flag to steer the other's behaviour | `save($order, true, false)` | two methods or a Strategy |
| stamp | passing a whole object when one field is needed | handing over the whole `User` to send an email | only `email`, or a small DTO |
| data | only the data that is needed | `charge(amount, token)` | this is the good one |
| temporal | both must be up at the same time | chained sync calls | a queue or an event |

Two simple metrics to see it in real code: **fan-in** (how many places depend on this module; high means changing it is expensive, so it must be stable) and **fan-out** (how many places this module depends on; high means it is fragile). A practical cohesion test: can you state the module's job in one sentence without "and"?

### Dependency injection: Go vs PHP <Badge type="danger" text="Must-know" />

The idea is the same: an object does not build its dependency, it is handed it. The execution differs between the two languages.

| | Go | PHP / Laravel |
| --- | --- | --- |
| Dominant style | manual constructor injection in `main` (the composition root) | a container autowiring from type-hints |
| Where the interface is declared | at the consumer, small | usually next to the domain; binding in a Service Provider |
| When an error shows up | compile time | resolve time (runtime) |
| Tooling | none; `wire` or `fx` for a large graph | `bind`, `singleton`, `scoped`, contextual binding |
| Trap | package-level variables and `init()` | Facades and `app()` in the middle of the domain (Service Locator) |

```go
func main() {
	db, err := sql.Open("pgx", os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	orders := postgres.NewOrderRepository(db) // concrete types are built here...
	gateway := zarinpal.NewClient(os.Getenv("ZARINPAL_MERCHANT"))
	checkout := app.NewCheckout(orders, gateway) // ...and handed in as interfaces

	log.Fatal(http.ListenAndServe(":8080", httpapi.NewRouter(checkout)))
}
```

```php
// Laravel resolves the whole graph from constructor type-hints
final class CheckoutController
{
    public function __construct(private Checkout $checkout) {}
}

// AppServiceProvider::register(): only interfaces need an explicit binding
$this->app->bind(PaymentGateway::class, ZarinpalGateway::class);
$this->app->scoped(CartContext::class); // one instance per request, safe under Octane
```

A note for long-lived runtimes (Octane, Swoole, RoadRunner): a `singleton` stays alive across requests. Anything that holds request-specific state must be `scoped`, otherwise one user's data leaks into the next request.

### Composition over inheritance <Badge type="warning" text="Important" />

Inheritance is the strongest form of coupling: the subclass depends on the parent's implementation details and a change in the parent breaks every child (fragile base class). With composition, behaviour is assembled from small parts behind interfaces, and each part is tested and swapped on its own.

```go
// behaviour is assembled, not inherited: a retrying sender wraps any sender
type Sender interface {
	Send(ctx context.Context, to, text string) error
}

type RetryingSender struct {
	next     Sender
	attempts int
}

func (s RetryingSender) Send(ctx context.Context, to, text string) error {
	var err error
	for i := 0; i < s.attempts; i++ {
		if err = s.next.Send(ctx, to, text); err == nil {
			return nil
		}
	}
	return err
}
```

Go has no inheritance at all; embedding only promotes methods and does not create an "is-a" relationship (an embedded method cannot call the outer type's overriding method). In PHP keep inheritance for a genuine "is a kind of" relationship and share code through composition or, as a last resort, traits; make classes `final` by default.

### Law of Demeter and Tell, Don't Ask

`$order->customer->address->city->name` means this code knows the internal structure of four objects and breaks when any of them changes. Instead of "asking and deciding", "tell" the object what you want: `$order->shippingCity()`. Exceptions: DTOs and plain data structures that have no behaviour; a fluent chain such as a Query Builder is not a violation either, because you keep talking to the same object.

### Quick summary

| Principle | The question to ask yourself | Sign of overdoing it |
| --- | --- | --- |
| SRP | for how many different reasons does this class change? | a hundred three-line classes you must all open to follow one flow |
| OCP | can the next case be added without editing old code? | an interface with one implementation "for the future" |
| LSP | does substituting the subtype surprise anyone? | — |
| ISP | does the consumer call every method of this interface? | a single-method interface for everything |
| DIP | can the use case be tested without a database or the network? | abstractions over things that never change |
| DRY | in how many places is this *knowledge* written? | a shared function with six flags |
| YAGNI | who needs this today? | ignoring irreversible decisions (schema, public API) |
| Coupling | how many other modules does a change here force open? | — |
| DI | are the dependencies visible in the constructor signature? | a magic container whose graph nobody understands |
| Composition | is this really an "is a kind of" relationship? | — |

## Questions & answers {#qa}

### 7.1 — The SOLID principles? <Badge type="danger" text="Must-know" /> {#q-7-1}

::: details Answer {open}
- **S — Single Responsibility:** each module has one reason to change. Example: an `OrderService` that both calculates the price and sends the email; split it.
- **O — Open/Closed:** a new gateway by implementing `PaymentGateway`, not by a new `switch`.
- **L — Liskov:** a subtype replaces its parent without breaking behaviour. Violation: a `ReadOnlyRepository` whose `Save()` throws an exception.
- **I — Interface Segregation:** small interfaces; like `io.Reader` and `io.Writer`.
- **D — Dependency Inversion:** the use case depends on `UserRepository`, not on `*sql.DB` or Eloquent.

```go
type PaymentGateway interface {
    Charge(ctx context.Context, amount Money, token string) (TxID, error)
}

type Checkout struct{ gw PaymentGateway } // depends on the abstraction

func NewCheckout(gw PaymentGateway) *Checkout { return &Checkout{gw: gw} }
```

<strong class="qa-trap">Interview trap:</strong> overdoing SOLID means premature abstraction; in Go, define the interface on the consumer side.
:::

### 7.2 — DRY, KISS, YAGNI, Law of Demeter and Composition over Inheritance? <Badge type="warning" text="Important" /> {#q-7-2}

::: details Answer {open}
**Answer:** Remove duplicated knowledge; the simplest solution; do not build what is not needed; talk only to your direct neighbour; build behaviour by composition.

**Real-world example:** Go has no inheritance and we have embedding; in PHP, traits and dependency injection.
:::

### 7.3 — Cohesion and Coupling? <Badge type="warning" text="Important" /> {#q-7-3}

::: details Answer {open}
**Answer:** High cohesion means the parts of a module share one purpose; low coupling means changing one does not break the other.
:::

### 7.4 — Dependency Injection and IoC? <Badge type="danger" text="Must-know" /> {#q-7-4}

::: details Answer {open}
**Answer:** An object receives its dependencies from the outside. In Go usually by hand in `main`; in PHP the Laravel and Symfony containers.

**Real-world example:** swapping `SmtpMailer` for `FakeMailer` in a test. <strong class="qa-trap">Interview trap:</strong> Service Locator is an anti-pattern.
:::

### 7.5 — Why is global state bad? <Badge type="warning" text="Important" /> {#q-7-5}

::: details Answer {open}
**Answer:** Hidden dependencies and hard testing. In Go it is a source of data races; in PHP with a long-lived runtime it leaks between requests.
:::

### 7.6 — What does "Accept interfaces, return structs" mean in Go? <Badge type="danger" text="Must-know" /> {#q-7-6}

::: details Answer {open}
**Answer:** A function should accept the smallest interface it needs as input and return a concrete type as output. The interface is defined by the consumer, not by the package that holds the implementation; because implementation is implicit in Go, the producer does not need to know in advance who wants what.

```go
// package postgres: returns the concrete type, exports no interface
func NewOrderRepository(db *sql.DB) *OrderRepository { return &OrderRepository{db: db} }

// package app: declares only what it needs
type orderSaver interface {
	Save(ctx context.Context, o Order) error
}

func NewCheckout(orders orderSaver) *Checkout { return &Checkout{orders: orders} }
```

Why a concrete return type: the caller has access to every method, adding a new method breaks nobody (adding a method to an interface is a breaking change) and the reader gets to the implementation in one click.

**Real-world example:** `io.Copy(dst io.Writer, src io.Reader)` works with files, sockets, buffers and gzip because it asks for a single method. **Use case:** the exceptions: `error` is always returned as an interface; a factory that chooses between several implementations has to return an interface.

<strong class="qa-trap">Interview trap:</strong> the Java habit: an `interfaces.go` with a big interface next to the implementation, before a second consumer exists. Second trap: returning a `nil` pointer of a concrete type as an interface; the result is `!= nil`.
:::

### 7.7 — What does a Liskov violation look like in real code? <Badge type="warning" text="Important" /> {#q-7-7}

::: details Answer {open}
**Answer:** Wherever the caller is forced to know the real type, LSP is broken. Common shapes:

| Violation | Example |
| --- | --- |
| an unsupported method | `save()` on a read-only repository throws an exception |
| a stricter precondition | the parent accepts any amount, the child only above 1000 |
| a weaker postcondition | the parent promises "sorted", the child returns unsorted |
| a new error | a cache decorator that hands a Redis error to a caller that only knows DB errors |
| a changed side effect | an async implementation of an interface whose caller assumes sync and completed |
| square and rectangle | `Square::setWidth()` changes the height too and the `Rectangle` tests break |

A practical test: the contract test suite written for the interface must be green on *every* implementation; including the test fake.

**Real-world example:** a `FakePaymentGateway` in tests always succeeds and never times out; the code is green in tests and breaks in production on the first timeout. The fake must honour the error contract too.

<strong class="qa-trap">Interview trap:</strong> "Go has no inheritance so LSP does not apply". Every implementation of an interface is a subtype of it; an `io.Reader` that returns `0, nil` and never `io.EOF` has broken the documented contract and keeps the caller in a loop.
:::

### 7.8 — When does DRY hurt? <Badge type="danger" text="Must-know" /> {#q-7-8}

::: details Answer {open}
**Answer:** When you mistake surface similarity for shared knowledge. Three common places:

- **The wrong abstraction:** two similar pieces of code are merged and then kept apart with flags and `if`s. Signs: a `bool` parameter, generic names like `process` or `handle`, and callers that each need only half of the function.
- **Sharing across boundaries:** a `common` or `shared` package that shares DTOs and models between several services or bounded contexts. Result: no service can be deployed on its own (a distributed monolith). Between services the contract is shared, not the code.
- **DRY in tests:** nested helpers where you have to open five files to understand one test. A test should tell its own story; there, readability matters more than DRY (DAMP).

**Real-world example:** validation for the user sign-up form and for the admin's edit-profile form is identical at first and gets merged; six months later the admin rules differ and the shared class is full of `if ($isAdmin)`. Two separate classes with ten duplicated lines would have been cheaper.

**Use case:** before extracting, ask: "if one changes, *must* the other change too?" If not, it is not duplication; it is coincidence.

<strong class="qa-trap">Interview trap:</strong> defining DRY as "do not write duplicated code". The original definition is: every piece of *knowledge* has a single, authoritative representation in the system.
:::

### 7.9 — Why do people say that code that is hard to test is badly designed? <Badge type="warning" text="Important" /> {#q-7-9}

::: details Answer {open}
**Answer:** A test is the code's first consumer. If building an object in a test needs a database, the system clock, an environment variable and five mocks, the same coupling exists in production and is merely invisible.

| Pain in the test | Design problem | Cure |
| --- | --- | --- |
| long setup with many mocks | too many dependencies, SRP | split the class; separate pure logic from I/O |
| needing `sleep` or the real date | time as a hidden dependency | inject a clock |
| tests are sensitive to execution order | global state | inject the state; remove the singleton |
| mocking a static method or a Facade | Service Locator | constructor injection |
| tests break on every refactor | tests are glued to the implementation, not the behaviour | test through the public boundary |

```go
type Clock func() time.Time

type TokenIssuer struct{ now Clock }

func (t TokenIssuer) ExpiresAt() time.Time { return t.now().Add(15 * time.Minute) }

// production: TokenIssuer{now: time.Now}
// test:       TokenIssuer{now: func() time.Time { return time.Unix(1_700_000_000, 0) }}
```

**Real-world example:** the "functional core, imperative shell" pattern: the discount calculation is a pure function whose hundreds of cases are tested in milliseconds; the thin outer layer only reads and writes data and is covered by a few integration tests.

<strong class="qa-trap">Interview trap:</strong> treating "more mocks" as the solution. Many mocks are a symptom of the same problem and produce tests that lock in the implementation.
:::

### 7.10 — How does immutability help, and how do you get it in Go and PHP? <Badge type="info" text="Good to know" /> {#q-7-10}

::: details Answer {open}
**Answer:** An immutable object is always valid after construction: validation happens once in the constructor, sharing it between goroutines or requests is safe, and "who changed this?" is no longer a question. The cost is more allocation, which only matters on hot paths.

```php
final readonly class Money
{
    public function __construct(public int $amount, public string $currency)
    {
        if ($amount < 0) {
            throw new InvalidArgumentException('amount must not be negative');
        }
    }

    public function add(Money $other): self
    {
        if ($other->currency !== $this->currency) {
            throw new InvalidArgumentException('currency mismatch');
        }

        return new self($this->amount + $other->amount, $this->currency);
    }
}
```

Go has no keyword for it; you get it by convention: unexported fields, a constructor that validates, value-receiver methods that return a new value, and defensive copies of slices and maps on the way in and out.

**Real-world example:** `Carbon` in Laravel is mutable and `$date->addDay()` changes the original date too; a classic source of bugs in reports. `CarbonImmutable` or `DateTimeImmutable` removes it.

<strong class="qa-trap">Interview trap:</strong> `readonly` in PHP is shallow: if a property is a mutable object or an array of objects, its contents can still change. In Go, too, copying a struct does not copy the slices and maps inside it.
:::

### 7.11 — Encapsulation and "Tell, Don't Ask"? <Badge type="info" text="Good to know" /> {#q-7-11}

::: details Answer {open}
**Answer:** Encapsulation means the rule lives next to the data it protects, so that an invalid state cannot be constructed at all. A getter and setter for every field is not encapsulation; it is the same public field with more ceremony.

```go
// ask: the rule is repeated (and eventually forgotten) in every caller
if acct.Balance >= amount && !acct.Frozen {
	acct.Balance -= amount
}

// tell: the rule lives next to the data it protects
func (a *Account) Withdraw(amount int64) error {
	if a.frozen {
		return ErrFrozen
	}
	if a.balance < amount {
		return ErrInsufficientFunds
	}
	a.balance -= amount
	return nil
}
```

**Real-world example:** `$order->status = 'shipped'` in ten places in the code versus `$order->ship()`, which checks that the order is paid, changes the status and records the `OrderShipped` event. The former is the Anemic Domain Model.

**Use case:** for models that have invariants. For DTOs, read models and simple CRUD, an open data structure is perfectly right.

<strong class="qa-trap">Interview trap:</strong> overdoing it: an object that, in order to be "told", has to send an email or write to the database. Domain behaviour inside the object; I/O outside it.
:::

### 7.12 — What do you do about technical debt, and how do you drive a large refactor? <Badge type="danger" text="Must-know" /> {#q-7-12}

::: details Answer {open}
**Answer:** Technical debt is like a loan: sometimes you take it knowingly to arrive sooner, but you pay its interest (every later change is slower). You do not have to pay all of it off; only the part with high interest.

**Steps:**

- **Prioritise with data:** where the code is both complex and frequently changed (a hotspot). Ugly code that nobody has touched for three years carries no interest.
- **Safety net first:** before changing old code, write characterization tests that pin down the current behaviour (bugs included).
- **Small, mergeable steps:** separate refactoring from behaviour change; each PR changes either structure or behaviour, not both.
- **No long-lived branch:** stay on trunk with branch by abstraction (an interface in front of the old implementation, the new implementation behind a feature flag).
- **Compare in production:** run the new path in shadow and compare its output with the old one, then shift traffic gradually.
- **Talk to the business in its own language:** not "the code is dirty" but "every change to invoicing currently takes two weeks, and with this work it will take two days".

**Real-world example:** a fee-calculation module with 3000 lines and no tests; instead of a rewrite, 200 real production inputs were stored as golden tests, the calculation was moved piece by piece into pure functions and each piece was verified with the same golden tests.

<strong class="qa-trap">Interview trap:</strong> "we will rewrite it from scratch". A full rewrite throws away the knowledge hidden in the old code (years of edge cases) and delivers no value until the last day; a gradual migration (Strangler Fig) is almost always better.
:::

### 7.13 — What do you look at in a code review, and in what order? <Badge type="warning" text="Important" /> {#q-7-13}

::: details Answer {open}
**Answer:** From the most expensive mistake to the cheapest; whatever is hard to undo after the merge comes first.

| Priority | What | Sample question |
| --- | --- | --- |
| 1 | correctness and data | is a race, a partial transaction or data loss possible? Does a retry run it twice? |
| 2 | security | is the input validated? Is authorization checked on this very resource? No secrets in logs? |
| 3 | irreversible things | can the migration be rolled back? Are the API and the event schema backward-compatible? |
| 4 | design | is the responsibility in the right place? Does the new dependency point the right way? |
| 5 | behaviour under failure | timeouts, dependency errors, empty or very large input; N+1 queries |
| 6 | tests and observability | does the test check behaviour or implementation? Are the logs and metrics enough to debug in production? |
| 7 | readability | names, function size, "why" comments |
| 8 | style | leave it to the formatter and the linter, not to a human |

**Real-world example:** a PR with a migration that adds a `NOT NULL` column with a default to a 200-million-row table and deploys the new code at the same time; the review point is not a variable name, it is the deploy order and the table lock.

**Use case:** a small PR (under a few hundred lines) is the best tool for review quality; for a large PR read the design description first, then the code.

<strong class="qa-trap">Interview trap:</strong> talking only about style and naming. The interviewer wants to see that you spot risk: concurrency, backward compatibility and behaviour under failure.
:::

### 7.14 — Error handling as part of API design? <Badge type="warning" text="Important" /> {#q-7-14}

::: details Answer {open}
**Answer:** The errors a function returns are part of its contract. Three design decisions: which errors the caller must be able to tell apart (not found, conflict, transient, permanent), where a lower-layer error is translated into a domain error, and who logs (one place only, at the boundary).

```go
var ErrNotFound = errors.New("order: not found")

func (r *Repo) ByID(ctx context.Context, id int64) (Order, error) {
	var o Order
	err := r.db.QueryRowContext(ctx,
		`SELECT id, status FROM orders WHERE id = $1`, id).Scan(&o.ID, &o.Status)
	if errors.Is(err, sql.ErrNoRows) {
		return Order{}, ErrNotFound // translate the storage detail into a domain error
	}
	if err != nil {
		return Order{}, fmt.Errorf("order by id %d: %w", id, err)
	}
	return o, nil
}
```

| | Go | PHP |
| --- | --- | --- |
| Mechanism | an `error` return value; `errors.Is` and `errors.As` | exceptions; a class hierarchy |
| Adding context | `fmt.Errorf("...: %w", err)` | a new exception with `previous` |
| Domain error | a sentinel or an error type | a dedicated domain exception class |
| Translating to HTTP | one place in the handler or middleware | a central exception handler |

**Real-world example:** the use case returns `ErrInsufficientStock`; the HTTP layer translates it to `409` with the stable error code `insufficient_stock`. The client branches on the code, not on the message text.

<strong class="qa-trap">Interview trap:</strong> leaking an infrastructure error (`sql.ErrNoRows`, `QueryException`) all the way to the HTTP layer; it both creates coupling and shows internals to the user. Second trap: "log and rethrow" in every layer, which writes one error into the log five times.
:::

### 7.15 — What does "premature optimisation" mean and where is the line? <Badge type="info" text="Good to know" /> {#q-7-15}

::: details Answer {open}
**Answer:** It means complicating code for speed you have not measured and may not need. The right order: make it correct → make it readable → measure → optimise only the bottleneck. Most execution time is spent in a small part of the code, and human guesses about which part are usually wrong.

Things that are not "premature" and must be right from the start, because changing them later is expensive:

- algorithmic complexity on large data (a nested loop over a million rows);
- N+1 queries and missing indexes;
- schema design and the partition key;
- network calls inside a loop;
- missing timeouts and limits (pagination, batch size).

**Real-world example:** a team spent a week optimising serialization with `sync.Pool` and hand-written code; the profile showed 90% of request time going into one query without an index. **Use case:** measurement tools: `pprof` and benchmarks in Go; in PHP a profiler (such as Xdebug or Blackfire) and `EXPLAIN ANALYZE` for queries.

<strong class="qa-trap">Interview trap:</strong> using the phrase as an excuse to ignore performance. The rest of Knuth's quote says that the critical few percent must not be passed up.
:::

## Related {#related}

- [Design Patterns](/design/design-patterns)
- [Architecture Styles](/design/architecture-styles)
