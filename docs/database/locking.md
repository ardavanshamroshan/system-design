# Optimistic vs Pessimistic Locking

> Module B — Data, Concurrency, Durability · Section 3

## Mental outline

1. [What and why](#what-and-why)  
2. [Lost update](#lost-update)  
3. [Pessimistic in Laravel](#pessimistic-locking-in-laravel)  
4. [Optimistic in Laravel](#optimistic-locking-in-laravel)  
5. [Atomic updates](#atomic-updates-without-mental-locks)  
6. [Practical example](#practical-example--cancel-an-order-item)  
7. [When to use which](#when-to-use-which)  
8. [Gotchas and best practices](#gotchas-and-best-practices)  
9. [Decision rule](#decision-rule)

---

## What and why

**Locking** is concurrency control: stop multiple processes/requests from reading/writing the same data in ways that break correctness.

Two main strategies:

| | Slogan | Idea |
|--|--------|------|
| **Pessimistic** | “Nobody touches this while I work” | Lock before you change |
| **Optimistic** | “Conflict is unlikely; check at save” | Proceed without a lock; validate on write |

Without one of these (or an equivalent atomic pattern): double spend, double coupon claims, negative stock, model overwrites.

---

## Lost update

Two transactions update the same row concurrently:

```
A reads qty=5
B reads qty=5
A writes qty=4
B writes qty=4  ← one decrement was lost (lost update)
```

Locking’s job: either one waits (pessimistic), or the second discovers the world changed at write time (optimistic).

---

## Pessimistic locking in Laravel

Assumption: conflicts are likely → lock the row for the transaction duration. Others wait on writes (and, depending on lock type, certain reads).

“Lock first, then work.”

### `lockForUpdate()` — `SELECT … FOR UPDATE`

Exclusive lock on selected rows until the transaction ends. Other `FOR UPDATE` / updates on those rows **wait** (or hit `innodb_lock_wait_timeout` / Postgres lock timeout).

```php
DB::transaction(function () {
    $user = DB::table('users')
        ->where('id', 1)
        ->lockForUpdate()
        ->first();

    // Safe to modify $user here
});
```

With Eloquent:

```php
DB::transaction(function () use ($orderId) {
    $order = Order::whereKey($orderId)
        ->lockForUpdate()
        ->firstOrFail();

    $order->status = 'paid';
    $order->save();
});
```

Equivalent SQL:

```sql
BEGIN;
SELECT * FROM orders WHERE id = 1 FOR UPDATE;
UPDATE orders SET status = 'paid' WHERE id = 1;
COMMIT;
```

Critical rules:

1. **Only meaningful inside a transaction.** Outside one, the lock is useless/effectively gone.  
2. Call order matters — the lock must be applied **before the query runs**:

```php
// Correct: lock before execution
$model = User::lockForUpdate()->find(1);

// Wrong: find already ran; lockForUpdate on the model instance does nothing useful
$model = User::find(1)->lockForUpdate();
```

### `sharedLock()` — `SELECT … FOR SHARE` / `LOCK IN SHARE MODE`

Shared lock: others may **read**, but update/delete on the row must wait. Useful for “consistent read without intending an immediate write.”

```php
DB::transaction(function () {
    $user = DB::table('users')
        ->where('id', 1)
        ->sharedLock()
        ->first();
});
```

| Method | Approx. behavior | When |
|--------|------------------|------|
| `lockForUpdate()` | Exclusive — safe read-then-write | Payments, coupon claims, inventory |
| `sharedLock()` | Shared — stable reads | When you only need a consistent snapshot |

### Classic use case

Two users redeem the same **one-time coupon**. Without a lock both succeed. With pessimistic locking: the first locks and redeems; the second waits and then sees the code is gone.

```php
DB::transaction(function () use ($code, $userId) {
    $coupon = Coupon::where('code', $code)
        ->whereNull('redeemed_by')
        ->lockForUpdate()
        ->firstOrFail();

    $coupon->update([
        'redeemed_by' => $userId,
        'redeemed_at' => now(),
    ]);
});
```

---

## Optimistic locking in Laravel

Assumption: conflicts are rare. You don’t take a DB row lock; at write time you check that version/timestamp hasn’t changed.

Laravel has **no built-in** optimistic locking — implement it with a `version` column (preferred) or `updated_at`. Because `updated_at` also drives Eloquent timestamps, a dedicated `version` column is clearer and less brittle.

### Conflict flow

```
WriterA                Database                WriterB
   |                      |                       |
   |-- read version=1 --->|                       |
   |                      |<--- read version=1 ---|
   |-- update if v=1 ---->|                       |
   |   set version=2      |                       |
   |<----- OK ------------|                       |
   |                      |<--- update if v=1 ----|
   |                      |---- 0 rows / conflict>|
```

### Version column migration

```php
Schema::table('orders', function (Blueprint $table) {
    $table->unsignedInteger('version')->default(1);
});
```

### With `version`

```php
DB::transaction(function () use ($orderId, $payload) {
    $order = Order::findOrFail($orderId);

    $affected = Order::whereKey($order->id)
        ->where('version', $order->version)
        ->update([
            ...$payload,
            'version' => $order->version + 1,
        ]);

    if ($affected === 0) {
        throw new \RuntimeException('Conflict: order changed by another request');
    }
});
```

### With `updated_at` (simpler, more fragile)

```php
$product = Product::findOrFail($id);
$originalUpdatedAt = $product->updated_at;

// ... business logic ...

$success = Product::whereKey($id)
    ->where('updated_at', $originalUpdatedAt)
    ->update(['stock' => $newStock]);

if (! $success) {
    throw new \RuntimeException('Stale model');
}
```

Warning: another path that `touch`es the row without a logical change causes false conflicts. For serious domains → use `version`.

### Simple optimistic retry

```php
use Illuminate\Support\Facades\DB;

function updateOrderOptimistic(int $orderId, array $payload, int $attempts = 3): void
{
    for ($i = 0; $i < $attempts; $i++) {
        $done = DB::transaction(function () use ($orderId, $payload) {
            $order = Order::findOrFail($orderId);

            $affected = Order::whereKey($order->id)
                ->where('version', $order->version)
                ->update([
                    ...$payload,
                    'version' => $order->version + 1,
                ]);

            return $affected === 1;
        });

        if ($done) {
            return;
        }
    }

    throw new \RuntimeException('Optimistic lock failed after retries');
}
```

Common fits: profile edits, collaborative docs with rare overlap, low-contention carts — not 100 concert seats in one second.

---

## Atomic updates without “mental locks”

Sometimes you name neither pattern — a conditional `UPDATE … WHERE` is enough:

```sql
UPDATE wallets
SET balance = balance - 100
WHERE id = 9 AND balance >= 100;
-- affected = 0 → insufficient funds
```

```php
$affected = DB::table('wallets')
    ->where('id', $walletId)
    ->where('balance', '>=', 100)
    ->decrement('balance', 100);

if ($affected === 0) {
    throw new \RuntimeException('Insufficient funds');
}
```

Simple, fast, and strong for counters/inventory — often better than unlocked read→calculate→write.

---

## Practical example — cancel an order item

Scenario: cancel a line item; the Order must be locked so price/status don’t race.

```php
final class OrderItemCancelAction
{
    public function handle(string $orderItemId, int $userId): void
    {
        $orderItem = OrderItem::query()
            ->where('is_canceled', false)
            ->findOrFail($orderItemId);

        DB::transaction(function () use ($userId, $orderItem) {
            $order = Order::query()
                ->lockForUpdate()
                ->whereKey($orderItem->order_id)
                ->where('user_id', $userId)
                ->whereIn('status', ['processing', 'suspended'])
                ->firstOrFail();

            $orderItem->update([
                'is_canceled' => true,
                'canceled_at' => now(),
            ]);

            $remaining = $order->items()->where('is_canceled', false);

            $attributes = [
                'price' => (clone $remaining)->sum(DB::raw('price * quantity')),
            ];

            if (! $remaining->exists()) {
                $attributes['status'] = 'cancelled';
            }

            $order->update($attributes);
        });
    }
}
```

Notes:

- `lockForUpdate` on the **Order** (correctness root), not only the item  
- everything inside one `DB::transaction`  
- no external HTTP inside the transaction  

---

## When to use which

| Scenario | Choice |
|----------|--------|
| Bank transfer / critical stock / coupon claim | **Pessimistic** |
| Profile edits, settings, rare overlap | **Optimistic** |
| Long-running work with user in the middle | **Optimistic** (long locks are risky) |
| Strict update ordering required | **Pessimistic** |
| Simple conditional counter | **Atomic update** |
| Concert seats / overselling | Pessimistic or atomic `WHERE qty > 0` |

Trade-off summary:

| | Pessimistic | Optimistic |
|--|-------------|------------|
| Assumption | High conflict | Low conflict |
| Cost | Wait / deadlock | Retry / conflict UX |
| Under high contention | More stable for correctness | Retry thrash |
| Under low contention | Extra locking cost | Scales better |

---

## Gotchas and best practices

### Deadlocks

Two transactions take locks in different orders:

```
T1: lock order → lock payment
T2: lock payment → lock order  → deadlock
```

**Always use a fixed order** (e.g. always `orders` then `payments`, by ascending id).

### Timeouts and long locks

Long transactions block others. Keep locks **short**; do external I/O (HTTP, email, S3) outside the transaction.

### Granularity

Row locks > table locks. Lock only the rows you must change.

### Retries

Optimistic locking without retry = raw errors to users. Budget retries + short backoff.

### Octane reminder

Leftover open transactions on a worker leak across requests — always `commit`/`rollBack` or `DB::transaction`. (See [Connection Pooling](/database/connection-pool).)

### Best practices (short)

1. Hold locks for the minimum time  
2. Lock at the finest needed level (row)  
3. Fixed lock acquisition order  
4. Call `lockForUpdate` / `sharedLock` **before** the query executes  
5. Rare conflict → optimistic + retry  
6. Financial/inventory correctness → pessimistic + short transactions  

---

## Decision rule

1. **Rare conflict** → optimistic (+ retry).  
2. **Financial / inventory correctness + heavy races** → pessimistic (+ short transactions).  
3. If a conditional `UPDATE … WHERE` solves it — often the simplest path.  
4. Always budget for deadlocks and lock wait timeouts.  
5. Keep locks short; don’t do external HTTP inside a transaction.
