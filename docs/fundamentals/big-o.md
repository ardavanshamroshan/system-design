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

---

::: tip Deeper version
[Algorithm analysis and time complexity](/fundamentals/algorithm-analysis) continues this topic with an interactive growth chart, a "how long does it actually take" table, an everyday analogy for every class, the Master theorem, amortized analysis and the complexity of Go, PHP, SQL and Redis operations.
:::

## Questions & answers {#qa}

<QaControls />

### Q1 — What is the formal definition of Big O? Show that `3n² + 2n + 1000 log n + 5000 = O(n²)`. <Badge type="danger" text="Must-know" /> {#q-1}

::: details Answer {open}
**Answer:** `f(n) = O(g(n))` means positive constants `c` and `n₀` **exist** such that `f(n) ≤ c·g(n)` for every `n ≥ n₀`. Finding one pair `c`, `n₀` is enough; it does not have to be the smallest.

Proof: for `n ≥ 1` we have `log n ≤ n ≤ n²` and `1 ≤ n²`. So:

```text
3n² + 2n + 1000 log n + 5000  ≤  3n² + 2n² + 1000n² + 5000n²  =  6005 n²
=> c = 6005, n0 = 1
```

**Real-world example:** `n₀` is the "for large enough `n`" part. The `5000` term (a fixed setup cost, such as opening a connection) dominates at `n = 10` and is invisible at `n = 10⁶`; that is why on small data you are measuring the fixed cost, not the algorithm.

<strong class="qa-trap">Interview trap:</strong> thinking `c` has to be 1 or small. The definition only asks for a constant to *exist*; `c = 6005` is perfectly valid, which is exactly why Big O says nothing about absolute speed.
:::

### Q2 — If `O(n¹⁰⁰)` is also "true" for a linear algorithm, why do we not say it? What is a tight bound? <Badge type="warning" text="Important" /> {#q-2}

::: details Answer {open}
**Answer:** Big O is only an upper bound, so any larger function is a valid upper bound too: a linear algorithm is `O(n)`, `O(n²)` and `O(2ⁿ)`. A loose bound carries no information, though. A tight bound (`Θ`) means the same function is both an upper and a lower bound; in practice always state the **smallest** upper bound you can prove.

**Real-world example:** "this query takes at most an hour" is true of a 3 ms query and worthless for capacity planning. An `O(n²)` bound on code that is really `O(n log n)` is an estimate that is 50 thousand times too pessimistic at `n = 10⁶`.

**Use case:** when the exact analysis is hard, give the loose upper bound but say explicitly that it is not tight: "at most `O(n²)`; probably better, but I have not proved it".

<strong class="qa-trap">Interview trap:</strong> the interviewer asks "is binary search `O(n)`?". The right answer: "by the definition yes, but its tight bound is `Θ(log n)`".
:::

### Q3 — Is `2ⁿ⁺¹ = O(2ⁿ)`? What about `2²ⁿ = O(2ⁿ)`? Why does the base of a logarithm not matter while the base of an exponential does? <Badge type="warning" text="Important" /> {#q-3}

::: details Answer {open}
**Answer:** `2ⁿ⁺¹ = 2·2ⁿ`, just a constant factor: yes, `O(2ⁿ)`. But `2²ⁿ = 4ⁿ = 2ⁿ·2ⁿ`; its ratio to `2ⁿ` is `2ⁿ` itself, which goes to infinity: no. The rule: a constant **added to** the exponent is a constant factor; a constant **multiplying** the exponent changes the order. Changing a logarithm's base is an outer constant factor (`log₂ n = 3.32·log₁₀ n`); changing an exponential's base is the same as multiplying the exponent by a constant (`3ⁿ = 2^(1.585n)`).

**Real-world example:** backtracking with a branching factor of 2 versus 3 at `n = 30`: about 10⁹ states (one second) versus about 2×10¹⁴ states (more than two days). That is why pruning even one branch per level turns an infeasible problem into a feasible one.

<strong class="qa-trap">Interview trap:</strong> simplifying `O(2²ⁿ)` or `O(3ⁿ)` to `O(2ⁿ)` on the grounds that "we drop constants".
:::

### Q4 — When must you say `O(n + m)` or `O(n·m)`, and when may you simplify to `O(n)` or `O(n²)`? <Badge type="danger" text="Must-know" /> {#q-4}

::: details Answer {open}
**Answer:** Every independent input gets its own variable. Two loops **in sequence** over two inputs are `O(n + m)` and two **nested** loops are `O(n·m)`. You may simplify only when you know how the variables relate: if `m ≤ n` then `O(n + m) = O(n)`; if `m ≈ n` then `O(n·m) = O(n²)`.

| Situation | Complexity |
| --- | --- |
| `n` orders, `m` blocked users, `in_array` in the loop | `O(n·m)` |
| The same with `array_flip` + `isset` | `O(n + m)` |
| `n` strings of average length `k`, compared pairwise | `O(n²·k)` |

**Real-world example:** joining two tables of 10 million and 100 rows: `O(n·m)` is 10⁹ operations, which is acceptable. Call both sizes `n` and say `O(n²)`, and it looks like 10¹⁴ operations and you make the wrong decision.

<strong class="qa-trap">Interview trap:</strong> calling two nested loops over two different arrays `O(n²)` without thinking. Ask first how the sizes relate.
:::

### Q5 — How does little-o differ from Big O, and where is it used? <Badge type="info" text="Good to know" /> {#q-5}

::: details Answer {open}
**Answer:** `f = O(g)` means `f` is at most of the order of `g` (like ≤). `f = o(g)` means `f` grows **strictly** slower (like a strict "less than"): the ratio `f/g` tends to zero. So `n = O(n)` is true but `n = o(n)` is false; `n = o(n²)` and `log n = o(n)` are true. `ω` is its mirror image for a strict lower bound.

**Real-world example:** statements such as "the overhead of this index is `o(n)`" mean the overhead's share tends to zero as the data grows. Or in succinct data structures: `o(n)` extra bits.

**Use case:** rarely in day-to-day work; mostly in papers and data-structure documentation.

<strong class="qa-trap">Interview trap:</strong> treating `o` as "a more precise Big O" or a synonym for `Θ`. `Θ` means the same order; `o` means strictly smaller. The two are mutually exclusive.
:::

### Q6 — Order these functions from slowest to fastest growth: `n log n`, `n^1.5`, `(log n)³`, `√n`, `2^(log₂ n)`, `n!`, `2ⁿ`, `n^0.01`. <Badge type="warning" text="Important" /> {#q-6}

::: details Answer {open}
**Answer:**

```text
(log n)^3  <  n^0.01  <  sqrt(n)  <  2^(log2 n) = n  <  n log n  <  n^1.5  <  2^n  <  n!
```

The rules used: any positive power of `n` (even `n^0.01`) eventually outgrows any power of a logarithm; `2^(log₂ n)` is exactly `n`; `n log n` is smaller than `n^1.5` because `log n` is smaller than `√n`; a factorial outgrows any exponential with a constant base.

**Real-world example:** "eventually" can be very far away: `n^0.01` only overtakes `(log₂ n)³` for `n` larger than about 10¹⁰⁰⁰. For every real-world `n`, the `(log n)³` algorithm is slower than the `n^0.01` one. Take the word asymptotic in Big O seriously.

<strong class="qa-trap">Interview trap:</strong> counting `2^(log₂ n)` as exponential. Simplify the expressions before comparing them.
:::

### Q7 — What are the sum and product rules of Big O, and what trouble does the `=` sign cause? <Badge type="warning" text="Important" /> {#q-7}

::: details Answer {open}
**Answer:**

| Rule | Example |
| --- | --- |
| Sum: `O(f) + O(g) = O(max(f, g))` | validation `O(n)` + sort `O(n log n)` + dedup `O(n)` = `O(n log n)` |
| Product: `O(f) · O(g) = O(f·g)` | an `n`-iteration loop with an `O(log n)` body = `O(n log n)` |
| Constant factor: `c · O(f) = O(f)` | three passes over the data are still `O(n)` |

The `=` sign here means "is a member of the set" and is one-way: `n = O(n²)` is true but `O(n²) = n` is meaningless; and from `n = O(n²)` and `n² = O(n²)` you cannot conclude `n = n²`.

**Real-world example:** in a multi-stage pipeline the asymptotic bottleneck is the stage with the highest order; optimising the other stages does not change the overall order (though it may change the constant).

<strong class="qa-trap">Interview trap:</strong> the sum rule only holds for a **constant** number of terms. `O(n) + O(n) + … + O(n)` repeated `n` times is `O(n²)`, not `O(n)`.
:::

### Q8 — What exactly is `n`? Why is an `O(√N)` primality test actually exponential? <Badge type="info" text="Good to know" /> {#q-8}

::: details Answer {open}
**Answer:** Strictly, `n` is the **size of the input** (number of bits or number of elements), not its numeric *value*. A number `N` is written with `b = log₂ N` bits; a loop up to `√N` is `2^(b/2)` steps: exponential in the input length. Such an algorithm is called **pseudo-polynomial**: polynomial in the numeric value, exponential in the input length.

**Real-world example:** knapsack by DP is `O(n·W)`. If the capacity `W` is in cents and equals 10⁹, the DP table has a billion columns even though `W` is only 30 bits of input. The security of RSA rests on the same gap: factoring a 2048-bit number by trial division takes about `2¹⁰²⁴` steps.

**Use case:** always state what `n` is: the row count? the string length? a number's value? the total payload size?

<strong class="qa-trap">Interview trap:</strong> claiming "I solved knapsack in polynomial time, so P = NP". `O(n·W)` is not polynomial in the input size.
:::

### Q9 — Traffic or data grows 10×. What does Big O let you estimate, and how do you identify a piece of code's order empirically? <Badge type="danger" text="Must-know" /> {#q-9}

::: details Answer {open}
**Answer:** Big O gives you the growth factor of the cost directly. To identify the order empirically run the **doubling test**: measure the time for `n` and for `2n` and look at the ratio.

| Order | If `n` grows 10× | Ratio `T(2n) / T(n)` |
| --- | --- | --- |
| `O(1)` | no change | 1 |
| `O(log n)` | a few more steps | slightly above 1 |
| `O(n)` | 10× | 2 |
| `O(n log n)` | about 12× | slightly above 2 |
| `O(n²)` | 100× | 4 |
| `O(n³)` | 1000× | 8 |
| `O(2ⁿ)` | raised to the 10th power | the previous time squared |

**Real-world example:** a nightly job that takes 2 minutes on 100 thousand rows and 8 minutes on 200 thousand: a ratio of 4 means `O(n²)`. At a million rows it will take 200 minutes and overrun the nightly window; you learn that before the data gets there.

**Use case:** capacity planning: `O(n)` paths scale by adding servers; an `O(n²)` path needs 100× the resources for 10× the data and has to change algorithm.

<strong class="qa-trap">Interview trap:</strong> measuring at very small `n`. Fixed costs (startup, caches, JIT) dominate there and the ratios mislead; take several points at large `n`.
:::
