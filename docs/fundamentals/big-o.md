# Big O Notation — Lesson 1

> Module A — Fundamentals & Algorithms · Section 1

## Mental outline

1. [What and why](#what-and-why)  
2. [Practical definition](#practical-definition)  
3. [Notation family](#notation-family-o-θ-ω)  
4. [Common orders](#common-orders)  
5. [Reading complexity from code](#reading-complexity-from-code)  
6. [PHP / Python examples](#php--python-examples)  
7. [Notes and antipatterns](#notes-and-antipatterns)  
8. [Decision rule](#decision-rule)

---

## What and why

**Big O** describes how an algorithm’s cost (time or space) grows with input size `n` — not milliseconds on your laptop.

| View | Question |
|------|----------|
| Absolute time | “How many ms on my Mac?” |
| Big O | “If `n` grows 10×, about how many times does cost grow?” |

Shared language in interviews and system design: “At 10× traffic, how does CPU/DB/cost scale?”

Drop lower terms quickly:

1. Keep only the highest-order term  
2. Drop its constant coefficient  

```
f(n) = 3n² + 2n + 1000 log n + 5000  →  O(n²)
```

---

## Practical definition

`f(n) = O(g(n))` means for large enough `n`, some constant `c` exists such that:

```
|f(n)| ≤ c · g(n)
```

So `f` does **not grow faster** than `c·g` (upper bound).  
Prefer tighter bounds: `O(n¹⁰⁰)` may be true, but for `73n³+…` say `O(n³)` or better `Θ(n³)`.

The `=` in Big O is conventional “set membership” — one-way: from `n = O(n²)` you cannot conclude `n² = O(n)`.

---

## Notation family (O, Θ, Ω)

| Symbol | CS meaning | Intuition |
|--------|------------|-----------|
| **O** | Upper bound | “No worse than this” (up to a constant) |
| **Ω** (Knuth) | Lower bound | “At least this much” |
| **Θ** | Tight bound | Both sides — same order |
| **o** (little-o) | Strictly slower | `f/g → 0` |
| **ω** | Strictly faster | `f/g → ∞` |

Example: `2n² − 10n = Θ(n²)` for large `n`.  
In casual talk people often say “Big O” even when they mean Θ.

Growth ladder (better → worse for time, roughly):

```
O(1) < O(log n) < O(√n) < O(n) < O(n log n) < O(n²) < O(2ⁿ) < O(n!)
```

Useful rules:

- Larger powers dominate smaller: `n² = O(n³)`  
- Powers dominate logs: `(log n)¹⁰⁰ = O(n)`  
- Exponentials dominate polynomials: `n¹⁰⁰ = O(2ⁿ)`  
- Log base doesn’t matter: `O(log₂ n) = O(log₁₀ n)`  
- Exponential base does: `2ⁿ` and `3ⁿ` are not the same order  

---

## Common orders

| Notation | Name | Example |
|----------|------|---------|
| **O(1)** | Constant | Hash lookup, indexed array access |
| **O(log n)** | Logarithmic | Binary search, balanced BST height, B-Tree |
| **O(n)** | Linear | Single scan, max in unsorted array |
| **O(n log n)** | Linearithmic | Merge sort, heap sort, average quicksort |
| **O(n²)** | Quadratic | Naive bubble/selection/insertion |
| **O(n³)** | Cubic | Naive matrix multiply |
| **O(2ⁿ)** | Exponential | All subsets, naive branching recursion |
| **O(n!)** | Factorial | All permutations, brute-force TSP |

Two input sizes: nested loops over `n` and `m` → **O(n·m)**, not necessarily `O(n²)`.

---

## Reading complexity from code

| Pattern | Approx. complexity |
|---------|-------------------|
| No loop depending on `n` | O(1) |
| One loop over `n` | O(n) |
| Halving the search space each step | O(log n) |
| Loop + recursive halving (merge sort) | O(n log n) |
| Nested loops over same `n` | O(n²) |
| Two-way recursion without memo | Often O(2ⁿ) |

Simplify constants: `O(2n)` and `O(100n)` are both **O(n)** — shape of growth matters.

---

## PHP / Python examples

### O(1)

```php
return $arr[0];
```

```python
return arr[0]
```

### O(n)

```php
function findMax(array $arr): mixed {
    $max = $arr[0];
    foreach ($arr as $x) {
        if ($x > $max) $max = $x;
    }
    return $max;
}
```

### O(log n)

```python
def binary_search(arr, target):
    lo, hi = 0, len(arr) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if arr[mid] == target:
            return mid
        if arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1
```

### O(n²)

```php
for ($i = 0; $i < $n; $i++) {
    for ($j = 0; $j < $n; $j++) { /* ... */ }
}
```

### O(n) time + O(n) space

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

### O(2ⁿ)

```python
for mask in range(1 << n):
    ...
```

---

## Notes and antipatterns

1. **Worst case** is usually implied unless you say average/amortized.  
2. **Time ≠ space** — you can trade one for the other.  
3. **I/O** often dominates CPU: N+1 queries = O(n) network round-trips.  
4. Micro-optimizing a loop while the algorithm is O(n²) is usually the wrong priority.  
5. “Fast on 10 rows” ≠ “fast on 10 million.”  
6. Average hash is O(1); adversarial collisions can make it O(n).

---

## Quick drill

1. Max in unsorted array?  
2. Binary search on sorted?  
3. Nested loops over arrays of size `n` and `m`?  
4. `isset($map[$key])`?  
5. All subsets of `n` items?  

::: tip Answers
1. O(n) · 2. O(log n) · 3. O(n·m) · 4. O(1) average · 5. O(2ⁿ)
:::

---

## Decision rule

1. Check algorithmic complexity + I/O first.  
2. Micro-optimize only after that.  
3. Use the growth ladder to compare options; for real SLAs, measure constants too.
