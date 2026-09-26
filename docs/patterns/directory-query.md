# Directory / Query Class

> Module D — System Architecture · Section 13

## Mental outline

1. [What and why](#what-and-why)  
2. [Names and shapes](#names-and-shapes)  
3. [Laravel — named lookups](#laravel--named-lookups)  
4. [Laravel — filter builder style](#laravel--filter-builder-style)  
5. [Thin controller](#thin-controller)  
6. [Relation to CQRS](#relation-to-cqrs)  
7. [When to use / skip](#when-to-use--skip)  
8. [Decision rule](#decision-rule)  
9. [Antipatterns](#antipatterns)

---

## What and why

Instead of scattering `Order::with(...)->where...` across controllers, a **Query Object** (also called **Directory** / **Finder**) encapsulates read criteria — aligned with the **Query** side of [CQRS Light](/patterns/cqrs).

| Without | With |
|---------|------|
| Same joins/filters copy-pasted in API, CLI, jobs | One place owns the lookup |
| Controllers know SQL shape | Controllers name *intent* (`paidForUser`) |
| Hard to unit-test filters | Test the Directory in isolation |

Idea from older platforms (class queries, query managers): **predefined lookups** by domain criteria — not by digging for internal IDs in every caller.

Related: [CQRS Light](/patterns/cqrs) · [Cache patterns](/patterns/cache-patterns) · [Outbox](/patterns/outbox)

---

## Names and shapes

Common names: `OrderDirectory`, `OrderQuery`, `UserFinder`, `FilterBuilder`.

Two useful shapes (pick one per need; both are “query classes”):

| Shape | Best for |
|-------|----------|
| **Named methods** | Stable domain lookups (`paidForUser`, `findPayableOrFail`) |
| **Filter / apply builder** | Ad-hoc list UIs with many optional `where`s |

Rule for both: **read only**. No email, charge, or enqueue inside.

---

## Laravel — named lookups

```php
final class OrderDirectory
{
    public function __construct(private Order $model) {}

    /** @return Collection<int, Order> */
    public function paidForUser(int $userId, int $limit = 20): Collection
    {
        return $this->model->newQuery()
            ->with(['items:id,order_id,sku,qty'])
            ->where('user_id', $userId)
            ->where('status', 'paid')
            ->latest('id')
            ->limit($limit)
            ->get();
    }

    public function findPayableOrFail(int $id): Order
    {
        return $this->model->newQuery()
            ->where('status', 'pending')
            ->findOrFail($id);
    }
}
```

Bind in the container (or resolve via type-hint). Callers speak domain language; Eloquent stays inside the Directory.

---

## Laravel — filter builder style

When the UI sends optional filters (`status`, `from`, `q`):

```php
final class UserDirectoryQuery
{
    public function __construct(
        private ?string $email = null,
        private ?string $status = null,
        private ?string $search = null,
    ) {}

    public static function fromRequest(array $input): self
    {
        return new self(
            email: $input['email'] ?? null,
            status: $input['status'] ?? null,
            search: $input['q'] ?? null,
        );
    }

    public function apply($query)
    {
        return $query
            ->when($this->email, fn ($q, $email) => $q->where('email', $email))
            ->when($this->status, fn ($q, $status) => $q->where('status', $status))
            ->when($this->search, function ($q, $search) {
                $q->where(function ($inner) use ($search) {
                    $inner->where('name', 'like', "%{$search}%")
                          ->orWhere('email', 'like', "%{$search}%");
                });
            });
    }
}

$users = UserDirectoryQuery::fromRequest($request->all())
    ->apply(User::query())
    ->paginate(20);
```

---

## Thin controller

```php
public function index(OrderDirectory $orders)
{
    return OrderResource::collection(
        $orders->paidForUser(auth()->id())
    );
}
```

Controller: auth + HTTP mapping. Directory: how to load. Resource: JSON shape. Write stays in Action / Service / Command Handler — not here.

---

## Relation to CQRS

| CQRS side | Role of Directory / Query class |
|-----------|----------------------------------|
| **Query** | Owns reusable reads; pairs with read models |
| **Command** | Must **not** live here — mutations elsewhere |

On light CQRS, Directory often queries write tables *or* a dedicated read table (`order_summaries`). Same idea: encapsulate criteria.

---

## When to use / skip

**Use when**

- Same query appears in more than one place  
- More than ~2–3 `where` / `with` / ordering rules  
- You want named intent (`findPayableOrFail`) instead of raw builder soup  

**Skip when**

- One-off admin dump never reused  
- Simple `Model::findOrFail($id)` with no extra rules  

---

## Decision rule

```
Repeated or >2–3 where/with rules?
  Yes → Query / Directory class
  No  → inline Eloquent is fine

Writes → Action / Service / Command Handler
Queries → Directory / Query class
Never mix side effects into a query class
```

1. Name from the domain (`OrderDirectory`), not `QueryHelper`.  
2. Prefer **eager-load only columns the caller needs**.  
3. Keep controllers thin; inject the Directory.

---

## Antipatterns

- God Directory with fifty unrelated filters for every aggregate  
- Unsafe raw SQL / string concat without bindings  
- Side effects (mail, payment, queue) inside a query class  
- Duplicating the same Directory logic in repositories *and* controllers  
- Hiding writes behind a method named like a query (`savePaid`)

---

## Mental drill

1. Payment flow needs “pending order by id or 404”. Where does `findPayableOrFail` live — controller, model scope, or Directory? Why?  
2. Admin list has eight optional filters used only once. Named methods or filter-builder?  
3. You already have CQRS `OrderSummaryQuery`. Do you still need `OrderDirectory`?

::: tip Hints
1. Directory (or a dedicated query) — reusable intent + testable · 2. Filter builder / `fromRequest` · 3. Maybe one class is enough; merge if they hit the same table/shape — don’t duplicate
:::
