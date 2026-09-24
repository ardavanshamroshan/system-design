# Optimistic vs Pessimistic Locking

## The problem

Two concurrent requests update the same row (e.g. inventory). Without control:

```
A reads qty=5
B reads qty=5
A writes qty=4
B writes qty=4  ← one decrement was lost
```

Two classic approaches: **Optimistic** and **Pessimistic**.

---

## Pessimistic locking

“Lock first, then work.”

```sql
SELECT * FROM products WHERE id = 1 FOR UPDATE;
-- others wait on this row
UPDATE products SET qty = qty - 1 WHERE id = 1;
COMMIT;
```

```php
DB::transaction(function () {
    $product = Product::whereKey(1)->lockForUpdate()->first();
    $product->qty -= 1;
    $product->save();
});
```

| Upside | Cost |
|--------|------|
| Fewer conflicts at commit time | Waiting / lock contention |
| Fits high-conflict paths | Deadlock risk if lock order is bad |

---

## Optimistic locking

“Read without a lock; at write time check the version hasn’t changed.”

Usually a `version` or `updated_at` column:

```sql
UPDATE products
SET qty = 4, version = version + 1
WHERE id = 1 AND version = 3;
-- if 0 rows → someone wrote first; retry
```

```php
$product = Product::find(1);
$affected = Product::where('id', $product->id)
    ->where('version', $product->version)
    ->update([
        'qty' => $product->qty - 1,
        'version' => $product->version + 1,
    ]);

if ($affected === 0) {
    throw new ConflictException('Retry');
}
```

| Upside | Cost |
|--------|------|
| No long-held locks | Many retries under high conflict |
| Scales better for read-heavy paths | UX must handle conflict |

---

## When to use which

| Scenario | Common choice |
|----------|---------------|
| Limited inventory, concert seats | Pessimistic or atomic `UPDATE ... WHERE qty > 0` |
| Low-conflict profile edits | Optimistic |
| Sensitive financial txs with related rows | Pessimistic with fixed lock order |
| Collaborative docs with rare overlap | Optimistic + merge |

---

## Atomic updates without “mental locks”

Sometimes you don’t name either pattern, but an atomic condition is enough:

```sql
UPDATE wallets
SET balance = balance - 100
WHERE id = 9 AND balance >= 100;
```

This pattern is simple and powerful.

---

## Decision rule

1. Estimate conflict rate. High → pessimistic / atomic. Low → optimistic.  
2. Always budget for deadlock and retry.  
3. Keep locks short; don’t do external HTTP inside a transaction.
