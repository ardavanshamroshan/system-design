# Directory Query Class

## The problem

When filters multiply, controllers or repositories fill with conditionals:

```php
if ($request->status) { ... }
if ($request->from) { ... }
if ($request->q) { ... }
```

This pattern gathers **query construction** into one dedicated class — a single “directory” of filters.

---

## Idea

A class that:

1. Accepts input parameters.  
2. Applies them to a base Query Builder.  
3. Returns something ready to execute.

Common names: `OrderQuery`, `UserDirectory`, `FilterBuilder`.

---

## PHP / Laravel example

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

// Usage
$users = UserDirectoryQuery::fromRequest($request->all())
    ->apply(User::query())
    ->paginate(20);
```

---

## Why it helps

| Without Query Class | With Query Class |
|---------------------|------------------|
| Filter logic scattered | One source of truth |
| Hard to test | Unit-test filters easily |
| Repeated conditions | Reuse in API, CLI, jobs |

---

## Relation to CQRS

On the **Query** side, a Directory/Query Class keeps “read with filters” clean and out of Command handlers.

---

## Antipatterns

- Becoming a God Object with 50 unrelated filters  
- Unsafe raw SQL without parameter binding  
- Side effects (sending email) inside a query class

---

## Decision rule

1. More than 2–3 recurring filters → build a Query Class.  
2. **Read/filter only**; keep writes elsewhere.  
3. Name from the domain (`OrderDirectory`), not `QueryHelper`.
