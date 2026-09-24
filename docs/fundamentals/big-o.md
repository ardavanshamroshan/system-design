# Big O Notation

## What is it and why?

**Big O** describes how an algorithm’s cost (time or memory) grows with **input size `n`** — not how many milliseconds it takes on your laptop.

| Lens | Question |
|------|----------|
| Absolute time | “How long does this function take on my Mac?” |
| Big O | “If `n` grows 10×, roughly how much does the cost grow?” |

In interviews and system design, Big O is the shared language: “With 10× traffic, how much do DB / CPU / cost grow?”

---

## Mental model

Think of `n` as the number of items (users, rows, keys).

| Symbol | Rough meaning | When `n` ×10 | Example |
|--------|---------------|--------------|---------|
| **O(1)** | Constant | Cost stays about the same | hash lookup, `$arr[$i]` |
| **O(log n)** | Logarithmic | A bit more (not 10×) | binary search on sorted data |
| **O(n)** | Linear | ≈ 10× | one `foreach` over a list |
| **O(n log n)** | Quasi-linear | A bit more than 10× | mergesort / average quicksort |
| **O(n²)** | Quadratic | ≈ 100× | nested loops over the same set |
| **O(2ⁿ)** | Exponential | Catastrophe | subsets without memoization |

Typical order from better to worse (for time):

```
O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(2ⁿ)
```

---

## Important points people miss

1. **It hides constants**  
   `O(2n)` and `O(100n)` are both **O(n)**. Great for comparing algorithms; for “this API is slow right now,” constants sometimes matter.

2. **Worst case is the default**  
   When people say Big O, they usually mean **worst case** (unless they say average).

3. **Time ≠ memory**  
   You can trade time for memory: e.g. duplicates with a `seen` set → **O(n) time + O(n) memory**.

4. **I/O is often more expensive than CPU**  
   N+1 queries = **O(n) network requests**; even if each query is “fast,” scalability dies.

---

## PHP examples

### O(1) — direct access

```php
$user = $usersById[$id] ?? null;
```

If `$usersById` is a map/hash, one lookup is roughly constant (average).

### O(n) — linear scan

```php
function findByEmail(array $users, string $email): ?array {
    foreach ($users as $user) {
        if ($user['email'] === $email) return $user;
    }
    return null;
}
```

Worst case you scan everyone → linear.  
If you call this often, build an index: `email → user` → each lookup **O(1)**.

### O(n²) — antipattern: pairwise compare

```php
function hasDuplicateNaive(array $ids): bool {
    $n = count($ids);
    for ($i = 0; $i < $n; $i++) {
        for ($j = $i + 1; $j < $n; $j++) {
            if ($ids[$i] === $ids[$j]) return true;
        }
    }
    return false;
}
```

Comparisons ≈ `n(n-1)/2` → **O(n²)**.  
For `n = 10_000`, that’s about 50 million comparisons.

### O(n) time, O(n) memory — better

```php
function hasDuplicate(array $ids): bool {
    $seen = [];
    foreach ($ids as $id) {
        if (isset($seen[$id])) return true;
        $seen[$id] = true;
    }
    return false;
}
```

One pass + memory for a set. Classic trade-off: **more memory, much less time**.

---

## Trade-offs / antipatterns

- Saying “Eloquent is slow” without Big O is vague.  
  Sometimes it isn’t the ORM — e.g. **N+1** means one query per row → network cost **O(n)**.
- Micro-optimizing an inner loop when the algorithm is **O(n²)** is usually the wrong priority.
- “Fast on 10 rows” ≠ “stays fast on 10 million.”

---

## Decision rule

1. First look at **algorithm complexity + I/O** (how many queries? how many full dataset scans?).  
2. Only then micro-optimize if needed (local cache, fewer allocations, …).

---

## Quick practice

For each, what’s the approximate time?

1. Find max in an unsorted array  
2. Search a sorted array with binary search  
3. Nested loops over two separate arrays of length `n` and `m`  
4. `isset($map[$key])` in PHP  
5. All subsets of an `n`-element set

::: tip Answers
1. **O(n)** · 2. **O(log n)** · 3. **O(n·m)** · 4. **O(1)** average · 5. **O(2ⁿ)**
:::
