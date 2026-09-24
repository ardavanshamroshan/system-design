# CQRS & Light Software Patterns

## What is CQRS?

**CQRS** = *Command Query Responsibility Segregation*  
You separate **writes (Commands)** from **reads (Queries)**.

| Side | Role | Example |
|------|------|---------|
| Command | Change state | `CreateOrder`, `CancelPayment` |
| Query | Read only | `GetOrderById`, `ListUserOrders` |

In the **light** version you don’t need two databases. It’s enough to separate models, services, or even read/write tables.

---

## Why?

In real systems:

- The write path has hard rules (validation, concurrency, side effects).  
- The read path often wants denormalized, cached, fast views.

One model for both → either writes get messy, or reads get slow.

---

## Light version in practice (Laravel/PHP)

```php
// Command — mutates state
final class PlaceOrder
{
    public function __construct(
        public readonly string $userId,
        public readonly array $items,
    ) {}
}

final class PlaceOrderHandler
{
    public function handle(PlaceOrder $command): string
    {
        // validate, persist, dispatch events
        return $orderId;
    }
}

// Query — reads only
final class GetOrderQuery
{
    public function __construct(public readonly string $orderId) {}
}

final class GetOrderHandler
{
    public function handle(GetOrderQuery $query): ?array
    {
        return DB::table('order_read_models')
            ->where('id', $query->orderId)
            ->first();
    }
}
```

::: tip Note
In light CQRS both sides can share the same MySQL; only the **code and mental model** are split. Event Sourcing is optional.
:::

---

## Related patterns and protocols

| Concept | Short role |
|---------|------------|
| **DTO** | Data shape between layers |
| **Repository** | Abstraction over persistence |
| **Specification** | Composable filter/search rules |
| **Protocol / Interface** | Contract between services (not implementation) |
| **Right data structure** | e.g. map for lookup, queue for work |

---

## Data structures — quick picks

| Need | Structure |
|------|-----------|
| Access by key | HashMap / associative array |
| FIFO work | Queue |
| LIFO / undo | Stack |
| Order + uniqueness | TreeSet / sorted set |
| Dependency graph | Graph / adjacency list |

Wrong structure → bad algorithmic complexity even with clean code.

---

## Trade-offs

| Upside | Cost |
|--------|------|
| Scale read/write separately | More code complexity |
| Optimized read models | Short-lived inconsistency possible |
| Better testability | More boilerplate |

---

## Decision rule

1. If read and write needs diverge → consider light CQRS.  
2. If the system is small CRUD → one model is fine; don’t over-engineer.  
3. Split **code first**, then storage only if needed.
