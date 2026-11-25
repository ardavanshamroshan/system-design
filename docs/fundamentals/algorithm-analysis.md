# Algorithm analysis and time complexity

> Fundamentals & Algorithms · Docs + Q&A · [All questions](/interview/)

This page is the deeper, hands-on version of [Big O notation](/fundamentals/big-o): that page gives you the definitions, this one teaches you to read complexity off code, translate it into seconds, and spot it in production code. Every complexity class comes with one everyday analogy so that it sticks.

## Why analyse at all? <Badge type="danger" text="Must-know" /> {#why}

A true story that almost every backend team lives through once: the order-report endpoint has to skip orders from blocked users.

```php
// Before: O(n·m) — in_array scans the whole blocklist for every order
foreach ($orders as $order) {
    if (in_array($order->userId, $blockedIds)) {
        continue;
    }
    $report[] = $order;
}

// After: O(n + m) — build a hash set once, then O(1) lookups
$blocked = array_flip($blockedIds);
foreach ($orders as $order) {
    if (isset($blocked[$order->userId])) {
        continue;
    }
    $report[] = $order;
}
```

| When | Orders (`n`) | Blocked (`m`) | `in_array` version | `isset` version |
| --- | --- | --- | --- | --- |
| Launch day | 1,000 | 500 | up to 5×10⁵ comparisons ≈ under 1 ms | 1,500 operations |
| A year later | 1,000,000 | 50,000 | up to 5×10¹⁰ comparisons ≈ tens of seconds to minutes → timeout | 1.05×10⁶ operations ≈ a few ms |

The code did not change, the tests were green, the code review passed; only **the data grew**. Algorithm analysis means seeing this *before* the incident: "if the input grows 1000×, how many times does the cost grow?"

### What do we count?

Not seconds. We count **basic operations** as a function of the input size `n`. The reference model is the **RAM model**: an imaginary machine where every simple operation (add, compare, assign, read a memory cell by index, jump) takes one unit of time and memory is unlimited.

| Question | Answer in algorithm analysis |
| --- | --- |
| What is `n`? | The input size: number of elements, string length, table rows, vertices and edges |
| Unit of cost? | A basic operation; in real systems often "a comparison", "a disk page read" or "a network round-trip" |
| Result of the analysis? | A growth function such as `3n² + 2n`, simplified to `O(n²)` |

### Why wall-clock benchmarks alone mislead

- **They depend on the data size:** a benchmark on 1,000 rows says nothing about 10 million; an `O(n)` and an `O(n²)` algorithm look equally fast on small data.
- **They depend on the machine:** CPU, caches, runtime version, JIT and GC change the number, not the shape of growth.
- **They depend on the data shape:** test data is usually well-behaved; the worst case shows up in production (sorted input for naive quicksort, deliberate collisions for a hash table).

So: analysis tells you the **shape of the curve**; a benchmark tells you the **constant factor**. You need both, in that order.

## The interactive growth chart <Badge type="danger" text="Must-know" /> {#chart}

The chart below draws the growth curves of `O(1)`, `O(log n)`, `O(n)`, `O(n log n)`, `O(n²)`, `O(2ⁿ)` and `O(n!)`. Drag the range slider and watch `2ⁿ` and `n!` shoot off the top within the first few units, flattening everything else into a straight line. Then pick `n = 1,000,000` in the table under the chart and compare the operation count and approximate time of each class (at roughly 10⁹ simple operations per second).

<ComplexityChart />

## How long does it actually take? <Badge type="danger" text="Must-know" /> {#how-long}

Assumption: 10⁹ simple operations per second (one modern CPU core, compiled code, no I/O). Read this table carefully once; it is the thing worth memorising.

| Complexity | n = 10 | n = 100 | n = 1 000 | n = 10⁶ | n = 10⁹ |
| --- | --- | --- | --- | --- | --- |
| `O(1)` | 1 ns | 1 ns | 1 ns | 1 ns | 1 ns |
| `O(log n)` | 3 ns | 7 ns | 10 ns | 20 ns | 30 ns |
| `O(√n)` | 3 ns | 10 ns | 32 ns | 1 µs | 32 µs |
| `O(n)` | 10 ns | 100 ns | 1 µs | 1 ms | 1 s |
| `O(n log n)` | 33 ns | 0.66 µs | 10 µs | 20 ms | 30 s |
| `O(n²)` | 100 ns | 10 µs | 1 ms | 16.7 min | 31.7 years |
| `O(n³)` | 1 µs | 1 ms | 1 s | 31.7 years | 3.2×10¹⁰ years |
| `O(2ⁿ)` | 1 µs | 4×10¹³ years | ≈10²⁸⁴ years | — | — |
| `O(n!)` | 3.6 ms | ≈10¹⁴¹ years | — | — | — |

A few numbers to memorise:

- `log₂(10⁶) ≈ 20` and `log₂(10⁹) ≈ 30`. Binary search over a billion elements is just 30 comparisons.
- `n²` at `n = 10⁶` is 10¹² operations ≈ 16.7 minutes; `n log n` at the same `n` is 2×10⁷ operations ≈ 20 ms. That fifty-thousand-fold gap is the difference between "sort it properly" and "two nested loops".
- The universe is about 1.4×10¹⁰ years old; `2¹⁰⁰` operations take roughly 3000 times that.
- `20! ≈ 2.4×10¹⁸`, about 77 years; permutation brute force is effectively closed above about `n = 12` (`12!` is about half a second, `15!` about 22 minutes).

## The complexity classes, one by one <Badge type="danger" text="Must-know" /> {#classes}

### O(1) — constant: the numbered locker

**Definition:** the cost does not depend on the input size.

**Analogy:** you hold the key to gym locker 42; you walk straight to it whether the gym has 50 lockers or 50,000.

```go
price := prices["sku-42"]   // one hash + one bucket probe, whatever len(prices) is
last := items[len(items)-1] // index arithmetic: base address + i*size
```

**In the backend:** a lookup in a Go `map` or a PHP array by key, Redis `GET`, reading `len(slice)`. Note that O(1) means "constant", not "fast": a high-cost `bcrypt` is O(1) too and takes 200 ms.

### O(log n) — logarithmic: the paper dictionary

**Definition:** every step discards a constant fraction of the problem (usually half).

**Analogy:** the guess-the-number game between 1 and 1000 with "higher/lower" answers: guessing the middle needs at most 10 guesses. Or finding a word in a paper dictionary: open it in the middle and throw half of the book away.

```go
func lowerBound(a []int, target int) int {
    lo, hi := 0, len(a)
    for lo < hi {
        mid := lo + (hi-lo)/2
        if a[mid] < target {
            lo = mid + 1
        } else {
            hi = mid
        }
    }
    return lo // first index with a[i] >= target
}
```

**In the backend:** a B-tree index lookup in PostgreSQL/MySQL (a 100-million-row table is usually only 3–4 levels deep, because each node holds hundreds of keys), Redis `ZADD`/`ZRANK` (skip list), push/pop on a heap or priority queue.

### O(√n) — square root: only halfway there

**Definition:** the loop runs up to `√n`. It sits between `log n` and `n`: only 1000 steps for `n = 10⁶`.

**Analogy:** to find the divisors of a number you do not need to count up to the number itself; divisors come in pairs and one of each pair is always at most `√n`.

```go
func isPrime(n int) bool {
    if n < 2 {
        return false
    }
    for d := 2; d*d <= n; d++ {
        if n%d == 0 {
            return false
        }
    }
    return true
}
```

**In the backend:** rare; mostly numeric problems and sqrt decomposition (splitting an array into blocks of `√n`).

### O(n) — linear: reading the attendance list

**Definition:** every element is visited a constant number of times.

**Analogy:** you look for one name on an *unsorted* attendance list; in the worst case you read to the end. Twice the list, twice the work.

```go
func indexOf(names []string, want string) int {
    for i, name := range names {
        if name == want {
            return i
        }
    }
    return -1
}
```

**In the backend:** a full table scan when the filtered column has no index:

```sql
EXPLAIN SELECT * FROM orders WHERE customer_email = 'a@example.com';
-- Seq Scan on orders  (no index on customer_email: every row is read)
```

Also `in_array` in PHP, `slices.Contains` in Go, `KEYS *` in Redis and `COUNT(*)` in PostgreSQL. O(n) is fine when it runs once; the disaster is when it lands *inside another loop*.

### O(n log n) — linearithmic: sorting exam papers

**Definition:** `log n` rounds, each doing linear work over all the data.

**Analogy:** you sort 64 exam papers by grade: first build sorted pairs, then keep merging sorted piles two at a time (2s, 4s, 8s …). It takes 6 merge rounds (`log₂ 64 = 6`) and every round touches all 64 papers once.

```text
64 papers:  [1][1][1][1] ... [1]        64 piles of 1
round 1:    [2][2][2] ... [2]           32 piles   (64 papers touched)
round 2:    [4][4] ... [4]              16 piles   (64 papers touched)
...
round 6:    [64]                         1 pile    (64 papers touched)
total = 6 rounds x 64 papers = n log2 n
```

```go
slices.Sort(scores) // O(n log n) comparisons
sort.Slice(users, func(i, j int) bool { return users[i].Age < users[j].Age })
```

**In the backend:** `ORDER BY` on a column without a suitable index, PHP `sort()`, building a B-tree index, a merge join whose inputs are not already sorted. Rule of thumb: `n log n` is "almost linear" and is fine in memory up to tens of millions of elements.

### O(n²) — quadratic: everyone shakes hands with everyone

**Definition:** for every element you do work over (almost) all the other elements.

**Analogy:** at a party everyone shakes hands with everyone: 10 guests make 45 handshakes, 100 make 4,950, 1000 make 499,500. Ten times the guests, a hundred times the handshakes.

```php
// n(n-1)/2 comparisons: 10 000 items -> ~50 million
for ($i = 0; $i < $n; $i++) {
    for ($j = $i + 1; $j < $n; $j++) {
        if ($items[$i] === $items[$j]) {
            return true;
        }
    }
}
return false;
```

**In the backend:** a nested-loop join without an index, `in_array` or `array_search` inside a `foreach`, `array_merge` or string concatenation inside a loop, pairwise duplicate removal. This is the most dangerous class because nobody notices it until `n ≈ 5000`.

### O(n³) — cubic: three nested loops

**Definition:** three nested loops over the same input. At `n = 500` that is about 1.25×10⁸ operations (acceptable); at `n = 10⁴` it is 10¹².

**Analogy:** for every pair of cities you try every intermediate city to see whether going through it is shorter.

```go
// Floyd–Warshall: shortest path between every pair of n nodes
for k := 0; k < n; k++ {
    for i := 0; i < n; i++ {
        for j := 0; j < n; j++ {
            if dist[i][k]+dist[k][j] < dist[i][j] {
                dist[i][j] = dist[i][k] + dist[k][j]
            }
        }
    }
}
```

**In the backend:** naive matrix multiplication, Floyd–Warshall, and three nested `foreach` loops over three collections that are "small for now".

### O(2ⁿ) — exponential: every combination of switches

**Definition:** every element has two states (in/out) and all combinations are examined. Adding **one** element **doubles** the work.

**Analogy:** a pizza with 10 optional toppings has 1,024 combinations; 20 toppings give over a million and 30 over a billion. Or a panel of `n` light switches where you must try every on/off pattern.

```go
// every subset of n feature flags: 2^n combinations (n·2^n work in total)
for mask := 0; mask < 1<<n; mask++ {
    var enabled []string
    for i := 0; i < n; i++ {
        if mask&(1<<i) != 0 {
            enabled = append(enabled, flags[i])
        }
    }
    runTestSuite(enabled)
}
```

**In the backend:** testing every feature-flag combination (20 flags is over a million runs), recursive Fibonacci without memoization, brute-force subset sum and knapsack, catastrophic regex backtracking (ReDoS).

### O(n!) — factorial: the courier and every delivery order

**Definition:** every possible ordering of `n` elements is examined.

**Analogy:** a courier with 10 parcels wants the shortest route by trying every order: 3,628,800 routes. With 15 parcels it is about 1.3×10¹² and with 20 parcels 2.4×10¹⁸.

```go
func permute(route []int, k int, visit func([]int)) {
    if k == len(route) {
        visit(route)
        return
    }
    for i := k; i < len(route); i++ {
        route[k], route[i] = route[i], route[k]
        permute(route, k+1, visit)
        route[k], route[i] = route[i], route[k]
    }
}
```

**In the backend:** brute-force TSP, trying every join order (which is why query planners give up exhaustive search past a threshold and switch to heuristics; `geqo_threshold` in PostgreSQL), trying every execution order of a set of jobs.

### Several variables: O(n + m), O(n·m), O(V + E)

Not every input is one `n`. Keep the variables separate; collapsing them into a single `n` throws information away.

| Notation | Means | Example |
| --- | --- | --- |
| `O(n + m)` | each input is walked once, separately | merging two sorted lists, hash join, building a set from `m` then looking up `n` |
| `O(n·m)` | for each element of the first, all of the second | nested-loop join, `in_array` over an `m`-item list inside an `n`-item loop, comparing two strings with DP |
| `O(V + E)` | every vertex and every edge once | BFS and DFS over an adjacency list |
| `O(E log V)` | one heap operation per edge | Dijkstra with a binary heap |
| `O(n·k)` | `n` items, each costing `k` | hashing `n` strings of length `k`, `n` users with `k` roles |

`O(V + E)` depends on graph density: in a sparse graph `E ≈ V` and the cost is linear; in a complete graph `E ≈ V²`.

## Best, average, worst case and O / Θ / Ω <Badge type="danger" text="Must-know" /> {#cases}

There are two **independent** axes that people constantly mix up:

1. **Which input?** Best case, average case, worst case. Each one is a separate *function* of `n`.
2. **Which kind of bound on that function?** `O` is an upper bound, `Ω` a lower bound, `Θ` a tight bound (both).

| Algorithm | Best case | Average case | Worst case |
| --- | --- | --- | --- |
| Linear search | `Θ(1)` — it is the first element | `Θ(n)` — about `n/2` comparisons | `Θ(n)` — last, or absent |
| Quicksort (fixed pivot) | `Θ(n log n)` | `Θ(n log n)` | `Θ(n²)` — sorted input |
| Merge sort | `Θ(n log n)` | `Θ(n log n)` | `Θ(n log n)` |
| Insertion sort | `Θ(n)` — sorted input | `Θ(n²)` | `Θ(n²)` — reversed input |
| Hash table lookup | `Θ(1)` | `Θ(1)` | `Θ(n)` — everything in one bucket |

Every cell of that table can be described with any of the three symbols. All of these statements about linear search are true:

- Its worst case is `O(n)`, and also `Ω(n)`, hence `Θ(n)`.
- Its best case is `Θ(1)`.
- The algorithm as a whole (over all inputs) is `O(n)` and `Ω(1)`; it has no single `Θ` for "the algorithm", because its best and worst cases are of different orders.
- Its worst case is also `O(n²)`. True but useless, because the bound is not tight.

::: warning Common misconception
"Big-O means worst case" is **wrong**. Big-O is an upper bound on a function, and that function can be the cost of the best, the average or the worst case. The industry convention is that when you name no case you mean the worst case, and people say `O` where they mean `Θ`; that is a speaking convention, not the definition.
:::

Which case matters in practice?

| Situation | Case that matters |
| --- | --- |
| A system with an SLA and a p99, input from users or attackers | worst case |
| Batch processing of large, random-looking data | average case |
| Repeated operations on one data structure (append, resize) | amortized |
| Best case | almost never; only to recognise friendly inputs (insertion sort on nearly sorted data) |

## Reading complexity off code <Badge type="danger" text="Must-know" /> {#reading-code}

### The basic rules

| Code structure | Rule | Result |
| --- | --- | --- |
| Sequential statements | add; the largest dominates | `O(n) + O(n²) = O(n²)` |
| Loop | iterations × cost of the body | an `n`-iteration loop with an `O(1)` body is `O(n)` |
| Nested loops | multiply | `n × m` |
| `if/else` | the more expensive branch | `max` of the two |
| Function call | count the cost of the callee | `in_array` in a loop is `O(n·m)` |
| Loop that halves/doubles | `log n` iterations | `O(log n)` |

The eternal trap: **the hidden cost of calls**. One line of `if (in_array(...))`, `strings.Contains(...)` or `list.index(x)` is itself a loop.

### Loops: count, do not guess

```go
for i := 1; i < n; i *= 2 {      // i = 1, 2, 4, 8, ...      -> O(log n)
}

for i := 0; i < n; i++ {         // n iterations
    for j := 1; j < n; j *= 2 {  // log n each               -> O(n log n)
    }
}

for i := 0; i < n; i++ {         // 0 + 1 + 2 + ... + (n-1)
    for j := 0; j < i; j++ {     // = n(n-1)/2               -> O(n²)
    }
}

for i := 1; i <= n; i++ {        // n/1 + n/2 + n/3 + ... + n/n
    for j := 0; j < n; j += i {  // = n · H(n) ≈ n ln n      -> O(n log n)
    }
}
```

Three sums that show up everywhere:

| Sum | Value | Order |
| --- | --- | --- |
| `1 + 2 + 3 + … + n` | `n(n+1)/2` | `O(n²)` |
| `1 + 2 + 4 + … + n` (geometric) | less than `2n` | `O(n)` |
| `1 + 1/2 + 1/3 + … + 1/n` (harmonic) | about `ln n` | `O(log n)` |

### Two pointers: looks nested, is O(n)

Do not count the nesting depth; count **how many times each variable moves over the whole run**.

```go
// looks nested, but `left` only ever moves forward: at most n increments in total
func longestWindow(a []int, limit int) int {
    best, sum, left := 0, 0, 0
    for right := 0; right < len(a); right++ {
        sum += a[right]
        for sum > limit {
            sum -= a[left]
            left++
        }
        best = max(best, right-left+1)
    }
    return best
}
```

Assuming non-negative elements, `right` advances exactly `n` times and `left` at most `n` times, and neither ever moves back; the total work is at most `2n`: `O(n)`. The same argument covers sliding windows, merging two sorted lists and monotonic-stack algorithms (each element is pushed once and popped once).

### Recursion and recurrence relations

For a recursive function you write a recurrence: `T(n) = (number of calls) × T(subproblem size) + non-recursive work`.

| Recurrence | Solution | Example |
| --- | --- | --- |
| `T(n) = T(n-1) + 1` | `O(n)` | recursive factorial, recursive linked-list walk |
| `T(n) = T(n-1) + n` | `O(n²)` | quicksort worst case, recursive selection sort |
| `T(n) = T(n/2) + 1` | `O(log n)` | binary search |
| `T(n) = T(n/2) + n` | `O(n)` | quickselect on average |
| `T(n) = 2T(n/2) + 1` | `O(n)` | traversing a balanced binary tree |
| `T(n) = 2T(n/2) + n` | `O(n log n)` | merge sort |
| `T(n) = 2T(n-1) + 1` | `O(2ⁿ)` | Tower of Hanoi |
| `T(n) = T(n-1) + T(n-2) + 1` | `O(φⁿ) ≈ O(1.618ⁿ)` | naive recursive Fibonacci |

### Recursion-tree intuition

Draw the tree of calls, work out the cost of each level, and add the levels up.

```text
T(n) = 2T(n/2) + n            (merge sort)

level 0:               n                  -> n work
level 1:         n/2       n/2            -> n work
level 2:      n/4  n/4  n/4  n/4          -> n work
...                                          (log2 n levels)
leaves:     1 1 1 1  ...  1 1 1 1         -> n work
total = n work per level x (log2 n + 1) levels = O(n log n)


T(n) = 2T(n-1) + 1            (Tower of Hanoi)

level 0:               1                  -> 1 call
level 1:           1       1              -> 2 calls
level 2:         1   1   1   1            -> 4 calls
...                                          (n levels)
total = 1 + 2 + 4 + ... + 2^(n-1) = 2^n - 1 = O(2^n)
```

The key difference: when the subproblem is **divided** (`n/2`) the tree is `log n` deep; when it only shrinks **by one** (`n-1`) it is `n` deep. Branching with depth `n` means exponential.

### The Master theorem <Badge type="warning" text="Important" />

For recurrences of the form `T(n) = a·T(n/b) + f(n)` with `a ≥ 1` and `b > 1`, the critical quantity is `n^(log_b a)` (the number of leaves of the recursion tree). Compare `f(n)` with it:

| Case | Condition | Solution | Intuition |
| --- | --- | --- | --- |
| 1 | `f(n)` is polynomially **smaller** than `n^(log_b a)` | `Θ(n^(log_b a))` | the leaves dominate |
| 2 | `f(n)` is of the **same order** as `n^(log_b a)` | `Θ(n^(log_b a) · log n)` | all levels weigh the same |
| 3 | `f(n)` is polynomially **larger** (and the regularity condition holds) | `Θ(f(n))` | the root dominates |

| Recurrence | `a`, `b` | `n^(log_b a)` | `f(n)` | Case | Solution |
| --- | --- | --- | --- | --- | --- |
| `T(n) = T(n/2) + 1` (binary search) | 1, 2 | `n⁰ = 1` | `1` | 2 | `Θ(log n)` |
| `T(n) = 2T(n/2) + n` (merge sort) | 2, 2 | `n` | `n` | 2 | `Θ(n log n)` |
| `T(n) = 3T(n/2) + n` (Karatsuba multiplication) | 3, 2 | `n^1.585` | `n` | 1 | `Θ(n^1.585)` |
| `T(n) = 4T(n/2) + n` | 4, 2 | `n²` | `n` | 1 | `Θ(n²)` |
| `T(n) = 2T(n/2) + n²` | 2, 2 | `n` | `n²` | 3 | `Θ(n²)` |
| `T(n) = T(n/2) + n` (ideal quickselect) | 1, 2 | `1` | `n` | 3 | `Θ(n)` |

The Master theorem does not apply to "decrease" recurrences such as `T(n) = T(n-1) + n` or to uneven splits; draw the recursion tree there.

### Drop the constants — and when you must not

`O(3n² + 2n + 1000) = O(n²)`: coefficients and lower-order terms do not affect the *shape* of growth for large `n`. In these situations, though, constants decide:

| Situation | Why the constant matters |
| --- | --- |
| `n` is small and bounded | for `n ≤ 20` an `n²` algorithm with a small constant beats an `n log n` one with a large constant |
| Two options of the same order | two `O(n)` algorithms can differ 10× (one pass vs five, allocation vs in-place) |
| The "basic operation" is expensive | `n` DB queries vs `n` integer comparisons: both `O(n)`, 10⁵× apart |
| Hot path | in code that runs millions of times per second, 2× means half the servers |

## Amortized analysis <Badge type="warning" text="Important" /> {#amortized}

**Definition:** the *average cost per operation over a long sequence of operations*, in the worst case. Some operations are expensive, but they are rare enough that once their cost is spread over all operations, each one's share stays constant.

**Analogy:** you top up your metro card once a month (expensive) and just tap it every day (cheap); the cost per trip, with the top-up spread out, is still constant.

### A dynamic array that doubles

```text
append #:   1  2  3  4  5  6  7  8  9 ...
capacity:   1  2  4  4  8  8  8  8 16
copy cost:  0  1  2  0  4  0  0  0  8
total copies after n appends = 1 + 2 + 4 + ... < 2n   ->  O(1) amortized per append
```

**The accounting argument:** charge three coins per `append`. One coin pays for writing the element itself, two are saved. When an array of capacity `k` is full and `k` elements have to be copied, the `k/2` elements added since the previous resize each hold two saved coins: `k` coins in total, exactly the cost of the copy. With three coins per operation you never go into debt: `O(1)` amortized.

The key is **geometric growth**. If the capacity grew by a fixed amount (say 10 slots) instead of by a factor, the total copies would be `10 + 20 + 30 + …`, that is `O(n²)`.

```go
var s []int
for i := 0; i < 1_000_000; i++ {
    s = append(s, i) // amortized O(1); a few dozen reallocations in total
}

s2 := make([]int, 0, 1_000_000) // known size: allocate once, zero reallocations
```

Go's `append` doubles the capacity of small slices and grows large ones by a smaller factor (about 1.25); both are geometric, so the amortized cost stays `O(1)`. Resizing a hash table (a Go map, a PHP array) follows the same logic: rehashing the whole table is `O(n)` but only happens after the element count has doubled.

### Amortized is not average case

| | Amortized | Average case |
| --- | --- | --- |
| Averaged over what? | a sequence of operations | a distribution of inputs |
| Probabilistic assumption? | none; the guarantee is deterministic | yes; the input is assumed "random" |
| Can an attacker break it? | no | yes (adversarial input) |
| Example | `append`, hash table resize, union-find | quicksort, hash table lookup |

Practical warning: amortized says nothing about the **latency of a single operation**. The one `append` that resizes takes `O(n)`; in a p99-sensitive system, reserve the capacity up front.

## Space complexity <Badge type="warning" text="Important" /> {#space}

| Term | Means |
| --- | --- |
| Auxiliary space | memory *in addition to* the input: variables, temporary structures, the recursion stack |
| Total space | input + auxiliary space |
| In-place | `O(1)` auxiliary space (or `O(log n)` for the stack) |

In an interview "space complexity" usually means auxiliary space; ask if you are not sure.

**The recursion stack is memory.** Every open recursive call has a frame on the stack; the space used equals the **depth** of the recursion tree, not the total number of calls.

| Algorithm | Time | Auxiliary space | Why |
| --- | --- | --- | --- |
| Iterative binary search | `O(log n)` | `O(1)` | two indices |
| Recursive binary search | `O(log n)` | `O(log n)` | stack depth |
| Merge sort | `O(n log n)` | `O(n)` | temporary merge buffer |
| In-place quicksort | `O(n log n)` average | `O(log n)` average, `O(n)` worst | stack depth |
| Naive recursive Fibonacci | `O(φⁿ)` | `O(n)` | depth `n` despite an exponential number of calls |
| DFS on a graph | `O(V + E)` | `O(V)` | visited set + stack |

### Trading time for space

```go
func fib(n int, memo map[int]int) int {
    if n < 2 {
        return n
    }
    if v, ok := memo[n]; ok {
        return v
    }
    memo[n] = fib(n-1, memo) + fib(n-2, memo)
    return memo[n]
}
```

With `O(n)` memory the time drops from `O(φⁿ)` to `O(n)`. Common trade-offs:

| Problem | Fast, memory-hungry option | Low-memory option |
| --- | --- | --- |
| Finding a duplicate | hash set: `O(n)` time, `O(n)` space | sort in place: `O(n log n)` time, `O(1)` space |
| Repeated subproblems | memoization or a DP table | recompute (exponential) |
| Repeated lookups | index, cache, precomputed table | scan on every request |
| Processing a large file | load the whole file into memory | stream it line by line: `O(1)` space |

In the backend, memory has a hard ceiling (PHP `memory_limit`, the container limit): an `O(n)`-memory algorithm with `n = 10⁷` rows of 1 KB each means 10 GB and an OOM kill.

## Types of algorithms <Badge type="danger" text="Must-know" /> {#paradigms}

Most problems are solved with one of a handful of patterns. The core skill is **recognising the pattern from the problem statement**.

| Paradigm | Core idea | Typical complexity | Analogy | Classic problems | How to recognise it |
| --- | --- | --- | --- | --- | --- |
| Brute force | try every possibility | `O(n²)` to `O(n!)` | trying every key on the ring | linear search, all pairs, all permutations | `n` is tiny; or as the starting point to optimise from |
| <span class="vip-locked" title="VIP members only">Divide & conquer <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | halve, solve each half, combine | `O(n log n)` or `O(log n)` | sorting papers by merging piles | merge sort, quicksort, binary search | the problem splits into **independent** subproblems of the same shape |
| <span class="vip-locked" title="VIP members only">Greedy <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | take the best local choice at each step, never go back | `O(n log n)` (often sort + one pass) | giving change with the largest coin that fits | interval scheduling, Huffman, Dijkstra, MST | a locally optimal choice leads to a globally optimal answer (you must prove it) |
| <span class="vip-locked" title="VIP members only">Dynamic programming <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | store the answers to **overlapping** subproblems | `O(n)` to `O(n²)` or `O(n·W)` | writing earlier answers down instead of re-solving | knapsack, LCS, edit distance, coin change | "number of ways", "minimum/maximum" + repeated subproblems |
| Backtracking | build the answer step by step; prune dead branches | exponential worst case, far less in practice | solving a sudoku with pencil and eraser | N-Queens, sudoku, generating permutations and combinations | "all valid answers" with constraints that fail early |
| Two pointers / sliding window | two indices that only move forward | `O(n)` | two fingers on a ruler | pair with a given sum in a sorted array, longest substring without repeats | an array or string + "contiguous subarray" or sorted data |
| Binary search on the answer | the answer is monotonic; halve over the answer value | `O(n log(range))` | finding the smallest truck capacity by halving trial and error | minimum capacity to ship within `D` days, maximising the minimum distance | "the smallest `x` such that the condition holds" and checking one `x` is cheap |
| <span class="vip-locked" title="VIP members only">Graph traversal <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | BFS/DFS over vertices and edges | `O(V + E)` | exploring a maze: level by level, or to the end of one path | unweighted shortest path, connected components, topological sort | relations, dependencies, networks, grids, "can we get from A to B?" |
| Randomized / probabilistic | randomness to dodge the worst case, or an approximate answer | good on average; or very little space | polling a sample instead of a census | quicksort with a random pivot, Bloom filter, HyperLogLog, reservoir sampling | the data is huge and an approximate answer is enough; or adversarial input is likely |

Prerequisites and next steps: <span class="vip-locked" title="VIP members only">Recursion <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>, <span class="vip-locked" title="VIP members only">Arrays <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>, <span class="vip-locked" title="VIP members only">Hash table <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>, <span class="vip-locked" title="VIP members only">Tree <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>, <span class="vip-locked" title="VIP members only">Sorting and search <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>, <span class="vip-locked" title="VIP members only">Common algorithms <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>.

The usual optimisation path in an interview: state the brute force first and compute its complexity; then ask "which work is repeated?" (→ DP or a hash), "is the data sorted, or can I sort it?" (→ two pointers or binary search), "can I halve it?" (→ divide & conquer).

## From constraints to the required complexity <Badge type="warning" text="Important" /> {#constraints}

With a budget of about 10⁸ simple operations per second (conservative; take 10⁷ for PHP and Python), the input size itself tells you which algorithm is expected:

| Input size | Acceptable complexity | Typical algorithm |
| --- | --- | --- |
| `n ≤ 10` | `O(n!)` | all permutations |
| `n ≤ 20` | `O(2ⁿ)` or `O(n·2ⁿ)` | all subsets, bitmask DP |
| `n ≤ 500` | `O(n³)` | Floyd–Warshall, 3-D DP |
| `n ≤ 5 000` | `O(n²)` | 2-D DP, all pairs |
| `n ≤ 10⁶` | `O(n log n)` or `O(n)` | sort, hash, two pointers, heap |
| `n ≤ 10⁸` | `O(n)` with a small constant | one pass, no allocation |
| `n ≤ 10¹⁸` | `O(log n)` or `O(1)` | binary search, a closed formula, fast exponentiation |

The same table works on the job: "the table has 50 million rows and this job runs nightly" means `O(n log n)` is fine and `O(n²)` is impossible. "This function runs on every request and the list has 200 items" means even `O(n²)` at 4×10⁴ operations is harmless.

## Complexity in real production systems <Badge type="danger" text="Must-know" /> {#production}

### Go

| Operation | Complexity | Note |
| --- | --- | --- |
| `m[k]`, `m[k] = v`, `delete(m, k)` | `O(1)` average | map iteration order is randomised |
| `s[i]`, `len(s)`, `cap(s)` | `O(1)` | |
| `append(s, x)` | `O(1)` amortized | avoid resizes with `make([]T, 0, n)` |
| `slices.Contains`, `slices.Index` | `O(n)` | in a loop it is `O(n²)`; use a `map[T]struct{}` |
| `slices.Insert` / deleting from the middle | `O(n)` | elements are shifted |
| `slices.Sort`, `sort.Slice` | `O(n log n)` | |
| `slices.BinarySearch`, `sort.Search` | `O(log n)` | the data must be sorted |
| `s += x` in a loop | `O(n²)` in total | strings are immutable; use `strings.Builder` |
| `copy(dst, src)`, `[]byte(str)` | `O(n)` | converting a string to `[]byte` copies |
| `heap.Push` / `heap.Pop` | `O(log n)` | `container/heap` |

### PHP

| Operation | Complexity | Note |
| --- | --- | --- |
| `$a[$k]`, `isset($a[$k])`, `array_key_exists` | `O(1)` average | a PHP array is an ordered hash table |
| `$a[] = $x`, `array_push`, `array_pop` | `O(1)` amortized | |
| `count($a)` | `O(1)` | the size is stored |
| `in_array`, `array_search` | `O(n)` | in a loop it is `O(n·m)`; `array_flip` + `isset` |
| `array_shift`, `array_unshift` | `O(n)` | numeric keys are renumbered; for a queue use `SplQueue` or a head index |
| `array_unique` | between `O(n)` and `O(n log n)` depending on flags and version | `array_flip`, or using keys, is a guaranteed `O(n)` |
| `sort`, `usort`, `ksort` | `O(n log n)` | |
| `array_merge` in a loop | `O(n²)` in total | one `array_merge(...$chunks)` |
| `array_slice`, `array_reverse`, `array_map`, `array_filter` | `O(n)` | each builds a new array |
| `str_contains`, `strpos` | `O(n·m)` worst case | close to linear in practice |

### SQL

| Operation | Complexity | Note |
| --- | --- | --- |
| B-tree index lookup | `O(log n)` | in practice 3–4 page reads |
| Seq scan (no suitable index) | `O(n)` | |
| Index range scan | `O(log n + k)` | `k` rows returned |
| `ORDER BY` without an index | `O(n log n)` | with a suitable index and `LIMIT k`: `O(log n + k)` |
| `OFFSET k` | `O(k)` | page 10,000 means reading and discarding every earlier row; use keyset pagination |
| Nested-loop join without an index | `O(n·m)` | with an index on the inner table: `O(n log m)` |
| Hash join | `O(n + m)` | `O(min(n, m))` memory; equality only |
| Merge join | `O(n + m)` on sorted inputs | otherwise `O(n log n + m log m)` to sort |
| N+1 queries | `O(n)` **round-trips** | each round-trip is about 0.5–2 ms; get to one round-trip with `IN (...)` or a join |

### Redis

| Command | Complexity | Note |
| --- | --- | --- |
| `GET`, `SET`, `HGET`, `HSET`, `SADD`, `SISMEMBER`, `EXPIRE` | `O(1)` | |
| `LPUSH`, `RPUSH`, `LPOP`, `RPOP` | `O(1)` | |
| `LRANGE start stop` | `O(S + N)` | `S` is the offset from the nearer end of the list, `N` the number of elements returned |
| `LINDEX` | `O(n)` | a list is not an array |
| `ZADD`, `ZREM`, `ZRANK`, `ZSCORE` | `O(log n)` (`ZSCORE`: `O(1)`) | skip list + hash |
| `ZRANGE` | `O(log n + m)` | `m` elements returned |
| `SMEMBERS`, `HGETALL` | `O(n)` | on a million-member collection it blocks single-threaded Redis; `SSCAN`/`HSCAN` |
| `KEYS pattern` | `O(n)` over the **whole keyspace** | never in production; `SCAN` with a cursor |
| `DEL` on a big key | `O(n)` | `UNLINK` frees the memory in the background |
| `SINTER` | `O(n·m)` worst case | `n` is the size of the smallest set, `m` the number of sets |

## Where Big-O lies to you <Badge type="warning" text="Important" /> {#lies}

Big-O describes behaviour for large `n` in the RAM model. Real hardware is not the RAM model.

| The lie | The reality | Example |
| --- | --- | --- |
| "Every memory access costs the same" | a cache miss is about 100× a cache hit (about 100 ns vs 1 ns) | walking a contiguous slice is several times faster than a linked list with the same `O(n)` |
| "Constants do not matter" | a factor of 50 is 50 servers instead of one | an `O(1)` hash map is slower than a linear scan of an array for 8 elements |
| "`n log n` always beats `n²`" | for small `n` it is the other way round | sort libraries switch to insertion sort for small sub-arrays (ten to a few dozen elements) |
| "The basic operation is cheap" | I/O is orders of magnitude more expensive | one network round-trip (about 1 ms) equals a million CPU operations |
| "The average case is enough" | an attacker picks the worst case | HashDoS, ReDoS, sorted input for naive quicksort |

Orders of magnitude to compare against:

```text
CPU instruction / L1 cache hit      ~1 ns
main memory reference (cache miss)  ~100 ns
SSD random read                     ~100 µs      = 100 000 ns
network round-trip, same datacenter ~0.5 ms      = 500 000 ns
network round-trip, cross-region    ~50–150 ms
```

The backend takeaway: **count round-trips first, CPU operations second.** A loop with 100 queries (`O(n)` with a 1 ms constant) is far slower than an in-place sort of 100,000 elements (`O(n log n)` with a 1 ns constant, about 2 ms).

### ReDoS: accidental exponential time

Backtracking regex engines (PCRE in PHP, and the default engines of JavaScript, Python and Java), given patterns with nested repetition and inputs that *almost* match, try every way of splitting the string: `O(2ⁿ)`.

```php
// nested quantifier + a tail that can never match => catastrophic backtracking
$pattern = '/^(a+)+$/';
$input = str_repeat('a', 30) . '!';
preg_match($pattern, $input); // ~2^30 backtracking steps: burns CPU or gives up and returns false
```

```go
// Go's regexp package uses RE2 semantics: guaranteed linear time in len(input)
re := regexp.MustCompile(`^(a+)+$`)
re.MatchString(strings.Repeat("a", 30) + "!") // returns false immediately
```

In PHP, PCRE may give up when it hits the backtrack limit (`pcre.backtrack_limit`) or the JIT stack limit, and `preg_match` then returns `false`; if you treat `false` as "no match", validation is bypassed. Cloudflare's global outage in July 2019 was of this kind: one regex in a WAF rule backtracked heavily and saturated the CPU of every edge.

## Cheat sheet {#cheat-sheet}

| Class | Name | Analogy | Backend example | If `n` grows 10× |
| --- | --- | --- | --- | --- |
| `O(1)` | constant | numbered locker | map lookup, Redis `GET` | no change |
| `O(log n)` | logarithmic | paper dictionary | B-tree index, `ZADD` | about 3 more steps |
| `O(√n)` | square root | divisors, halfway there | primality test | 3.2× |
| `O(n)` | linear | attendance list | seq scan, `in_array` | 10× |
| `O(n log n)` | linearithmic | merging piles of papers | `ORDER BY`, sort | a bit more than 10× |
| `O(n²)` | quadratic | everyone shakes hands | nested loop, `in_array` in a loop | 100× |
| `O(n³)` | cubic | every pair of cities via every city | Floyd–Warshall | 1000× |
| `O(2ⁿ)` | exponential | pizza topping combinations | all flag combinations, ReDoS | raised to the 10th power |
| `O(n!)` | factorial | every delivery order | brute-force TSP | unimaginable |

```text
O(1) < O(log n) < O(√n) < O(n) < O(n log n) < O(n²) < O(n³) < O(2ⁿ) < O(n!)
|------------- scales --------------------|-- small n only --|-- n ≤ 20 / n ≤ 10 --|
```

## Decision rule <Badge type="danger" text="Must-know" /> {#decision}

1. **Pin down `n`.** What is it today, and what is a realistic ceiling two years from now? Without that number, a complexity discussion is meaningless.
2. **Count I/O first.** Is the number of queries and round-trips a function of `n`? If so, fix that first (batch, join, pipeline).
3. **Find the nested loops and the hidden calls.** `in_array`, `array_search`, `slices.Contains`, `array_merge` and string concatenation inside loops.
4. **Check against the "how long" table.** `n²` is harmless for `n ≤ 5000`; not for `n = 10⁶`.
5. **Change the data structure, not the loop.** Turning a list into a hash set or adding an index usually drops a whole class; micro-optimisation only shrinks the constant.
6. **Assume the worst case for user input.** Anything that comes from outside (a regex, hash keys, payload size) needs a cap.
7. **Measure last.** With production-sized data; a profiler and `EXPLAIN ANALYZE` show you the constants.

## Exercises {#exercises}

Determine the time complexity (and the space complexity where you can) of each snippet.

**1.**

```go
for i := 0; i < n; i++ {
    for j := 0; j < 100; j++ {
        count++
    }
}
```

::: details Answer
`O(n)`. The inner loop always runs 100 times and does not depend on `n`; `100n` is `O(n)`. A nested loop does not by itself mean `n²`.
:::

**2.**

```go
for i := n; i > 0; i /= 2 {
    for j := 0; j < i; j++ {
        count++
    }
}
```

::: details Answer
`O(n)`, not `O(n log n)`. The inner loop runs `n + n/2 + n/4 + … + 1` times, a geometric series that sums to less than `2n`.
:::

**3.**

```php
$result = [];
foreach ($chunks as $chunk) {
    $result = array_merge($result, $chunk);
}
```

::: details Answer
`O(n·k)` for `k` chunks holding `n` elements in total; effectively `O(n²)` when the chunks are small. Each `array_merge` copies the whole current `$result`: `s + 2s + 3s + … + ks`. The right way is `array_merge(...$chunks)`, which runs once in `O(n)`.
:::

**4.**

```go
func f(n int) int {
    if n <= 1 {
        return 1
    }
    return f(n/2) + f(n/2)
}
```

::: details Answer
`O(n)` time and `O(log n)` space. The recurrence is `T(n) = 2T(n/2) + 1` (Master theorem case 1: the leaves dominate). The trap: many people see `n/2` and say `O(log n)`, but there are **two** calls. If `f(n/2)` were computed once and used twice it would be `O(log n)`.
:::

**5.**

```go
sort.Ints(a)
for _, x := range b {
    i := sort.SearchInts(a, x)
    if i < len(a) && a[i] == x {
        hits++
    }
}
```

::: details Answer
`O(n log n + m log n)`, that is `O((n + m) log n)` with `n = len(a)` and `m = len(b)`. The hash-set alternative: `O(n + m)` time and `O(n)` space.
:::

**6.**

```go
for i := 0; i < len(s); i++ {
    for j := i; j < len(s); j++ {
        seen[s[i:j+1]] = true
    }
}
```

::: details Answer
`O(n³)` time: there are about `n²/2` substrings and hashing each key costs its length (up to `n`). The trap: you see two loops, but the operation inside them is not `O(1)`. In Go substrings share the original string's memory, so the map holds about `O(n²)` entries; in languages that copy substrings the space is `O(n³)` as well.
:::

**7.**

```php
function power(int $x, int $n): int {
    if ($n === 0) {
        return 1;
    }
    $half = power($x, intdiv($n, 2));
    return $n % 2 === 0 ? $half * $half : $half * $half * $x;
}
```

::: details Answer
`O(log n)` time and `O(log n)` space (stack depth). The recurrence is `T(n) = T(n/2) + 1`, because the half result is computed once and used twice; compare with exercise 4.
:::

## Questions & answers {#qa}

<QaControls />

### Q1 — What is time complexity, and why do we count operations instead of seconds? <Badge type="danger" text="Must-know" /> {#q-1}

::: details Answer {open}
**Answer:** Time complexity is a function describing how the number of basic operations of an algorithm grows as the input `n` grows. Seconds depend on the machine, the language, system load and the test data; the shape of growth depends on none of them. Big-O summarises that function up to a constant factor so that you can ask: "what happens when the data grows 100×?"

**Real-world example:** a report endpoint written with `in_array` inside a `foreach` takes under 1 ms with 1,000 orders and tens of seconds with a million orders and 50 thousand blocked users. No benchmark on day-one data showed that; the `O(n·m)` analysis did.

**Use case:** code review, capacity estimation, picking a data structure, deciding on an index.

<strong class="qa-trap">Interview trap:</strong> saying "it is O(n), so it is fast". Big-O is about *growth*, not absolute speed; `n` database queries are `O(n)` too.
:::

### Q2 — Where does `O(log n)` come from, and why do we not write the base of the logarithm? <Badge type="danger" text="Must-know" /> {#q-2}

::: details Answer {open}
**Answer:** Whenever each step removes a constant fraction of the problem, the number of steps is the logarithm of `n`: `n → n/2 → n/4 → … → 1` is `log₂ n` steps. The base does not matter because changing it is only a constant factor: `log₂ n = log₁₀ n × 3.32`, and Big-O drops constant factors.

**Real-world example:** a B-tree index with a fan-out of about 500 over 100 million rows: `log₅₀₀(10⁸) ≈ 3`. You reach the row in 3–4 page reads, versus 27 comparisons in a binary search. Both are `O(log n)`, but when each step is a disk I/O that "constant factor" decides everything.

**Use case:** binary search, balanced trees, heaps, the number of retries with exponential backoff before hitting the cap.

<strong class="qa-trap">Interview trap:</strong> `log n` is not only about halving; a loop with `i *= 2` or `i *= 3` is logarithmic too. Conversely, `i += 2` is linear.
:::

### Q3 — Is "Big-O means worst case" correct? How do O, Θ and Ω relate to best/average/worst case? <Badge type="danger" text="Must-know" /> {#q-3}

::: details Answer {open}
**Answer:** No; these are two independent axes. Best/average/worst case picks **which input** you analyse and gives one function for each. `O`, `Ω` and `Θ` are the kind of **bound** on that function: upper, lower and tight. You can say "the best case of insertion sort is `Θ(n)`" or "the worst case of quicksort is `Ω(n²)`".

**Real-world example:** quicksort with the first element as pivot: `Θ(n log n)` on average, `Θ(n²)` in the worst case on already sorted input. Saying just "quicksort is `O(n log n)`" without "on average" is a false statement.

| Statement | True? |
| --- | --- |
| The worst case of linear search is `O(n)` | yes |
| The best case of linear search is `Ω(1)` | yes |
| Linear search is `Θ(n)` | no; only its worst and average cases |
| Merge sort is `Θ(n log n)` | yes; in all three cases |

<strong class="qa-trap">Interview trap:</strong> the industry uses "O" where it means "Θ of the worst case". That is fine, but if the interviewer asks about the difference you must know it is a convention, not the definition.
:::

### Q4 — Why can a comparison sort not beat `O(n log n)`? Then how is counting sort `O(n)`? <Badge type="warning" text="Important" /> {#q-4}

::: details Answer {open}
**Answer:** `n` elements have `n!` possible orderings and each comparison yields one bit of information (yes/no). Telling one of `n!` cases apart needs at least `log₂(n!)` comparisons, and `log₂(n!) ≈ n log₂ n`. That is an `Ω(n log n)` lower bound on the worst case of **any** comparison-based algorithm.

Counting sort and radix sort do not compare; they use the key's value as an index. Counting sort is `O(n + k)` where `k` is the range of values; it only pays off when `k` is small.

**Real-world example:** sorting 10 million records by "age" (0 to 120) with counting sort is a single pass. Sorting by UUID or an arbitrary string leaves no option but `n log n`.

<strong class="qa-trap">Interview trap:</strong> "`O(n log n)` is the best possible sort" is wrong without the word "comparison".
:::

### Q5 — How does amortized differ from average case? Why do we call `append` `O(1)` when it sometimes copies the whole array? <Badge type="danger" text="Must-know" /> {#q-5}

::: details Answer {open}
**Answer:** Amortized is the average cost over **a sequence of operations** in the worst case, with no probabilistic assumption. Average case is the average over **a distribution of inputs** and depends on the input being random. With capacity doubling, `n` appends cause fewer than `2n` copies in total (`1 + 2 + 4 + … + n`), so each operation's share is `O(1)`: guaranteed, not probable.

**Real-world example:** building a one-million-element slice with `append` in Go reallocates only a few dozen times. But the single `append` that resizes takes a few milliseconds and shows up in your p99.

**Use case:** when you know the size, use `make([]T, 0, n)`; it removes the reallocations and lowers GC pressure.

<strong class="qa-trap">Interview trap:</strong> if the capacity grows by a fixed amount instead of doubling, the total cost becomes `O(n²)`. Amortized `O(1)` requires **geometric** growth.
:::

### Q6 — Is a hash map lookup really `O(1)`? <Badge type="danger" text="Must-know" /> {#q-6}

::: details Answer {open}
**Answer:** On average yes, given a good hash function and a controlled load factor. In the worst case, when every key lands in one bucket, it is `O(n)` (or `O(log n)` in implementations that turn a crowded bucket into a tree, such as Java's `HashMap`). There are two hidden costs as well: hashing a string key is `O(k)` (the key length), and the occasional resize is `O(n)`.

**Real-world example:** the HashDoS attack (2011): by sending thousands of POST parameters that all hashed to the same bucket, an attacker turned parsing one request from `O(n)` into `O(n²)` and kept a CPU core busy for minutes with a request of a few hundred kilobytes. The fixes: randomly seeded hashing (Go's map does this) and a cap on the number of parameters (`max_input_vars` in PHP).

**Use case:** for trusted data a hash map is the best default for equality lookups. For range queries or ordering you need a tree or a sorted index.

<strong class="qa-trap">Interview trap:</strong> saying `O(1)` without "average" or "amortized". The complete answer: "`O(1)` on average, `O(n)` worst case, and `O(k)` to hash the key".
:::

### Q7 — Solve `T(n) = 2T(n/2) + n`. What does the Master theorem say? <Badge type="warning" text="Important" /> {#q-7}

::: details Answer {open}
**Answer:** The solution is `Θ(n log n)`. By the recursion tree: every level does `n` work in total (2 subproblems of `n/2`, 4 of `n/4`, …) and there are `log₂ n` levels. By the Master theorem: `a = 2`, `b = 2`, so `n^(log_b a) = n`; `f(n) = n` is of the same order (case 2), so you multiply by `log n`.

The Master theorem in one sentence: compare the work at the leaves (`n^(log_b a)`) with the work at the root (`f(n)`); whichever dominates is the answer, and if they tie, multiply by `log n`.

| Recurrence | Dominant | Solution |
| --- | --- | --- |
| `T(n) = 8T(n/2) + n²` | leaves (`n³`) | `Θ(n³)` |
| `T(n) = 2T(n/2) + n` | tie | `Θ(n log n)` |
| `T(n) = 2T(n/2) + n²` | root | `Θ(n²)` |

**Real-world example:** merge sort, and external merge sort in a database (sorting on disk when the data does not fit in `work_mem`).

<strong class="qa-trap">Interview trap:</strong> the Master theorem does not apply to `T(n) = T(n-1) + n` or `T(n) = 2T(n-1) + 1` (that is subtraction, not division). Sum those directly: the first is `O(n²)`, the second `O(2ⁿ)`.
:::

### Q8 — What is the complexity of naive recursive Fibonacci, and how do you fix it? <Badge type="warning" text="Important" /> {#q-8}

::: details Answer {open}
**Answer:** Exponential time: the recurrence is `T(n) = T(n-1) + T(n-2) + 1`, whose exact solution is `Θ(φⁿ)` with `φ ≈ 1.618`; `O(2ⁿ)` is a correct but loose upper bound. The space is `O(n)` (stack depth), not exponential. The cause: overlapping subproblems; `fib(n-2)` is computed twice, `fib(n-3)` three times, and so on.

```go
func fibIter(n int) int {
    a, b := 0, 1
    for i := 0; i < n; i++ {
        a, b = b, a+b
    }
    return a
}
```

| Version | Time | Space |
| --- | --- | --- |
| Naive recursion | `Θ(φⁿ)` | `O(n)` |
| Memoization | `O(n)` | `O(n)` |
| Loop with two variables | `O(n)` | `O(1)` |

**Real-world example:** naive `fib(50)` makes about 4×10¹⁰ calls (tens of seconds to minutes); the loop takes 50 steps. The same pattern shows up in recursive price, permission or category-tree calculations without a cache.

<strong class="qa-trap">Interview trap:</strong> saying "the space is `O(2ⁿ)` too". At any moment only one root-to-leaf path is on the stack.
:::

### Q9 — Are two nested loops always `O(n²)`? <Badge type="warning" text="Important" /> {#q-9}

::: details Answer {open}
**Answer:** No. You have to sum the inner loop's iterations over the whole run. Three common cases that are not `n²`: an inner loop with a constant count (`O(n)`), a logarithmic inner loop (`O(n log n)`), and an inner loop whose variable is never reset (two pointers and sliding window: `O(n)`).

**Real-world example:** a sliding-window rate limiter over a sorted list of timestamps: for each new request the left pointer only moves forward to drop expired events. Every timestamp enters once and leaves once: `O(1)` amortized per request.

**Use case:** the standard argument: "each element enters at most once and leaves at most once, so the total work is `2n`". You say the same for a monotonic stack and for BFS (every vertex is enqueued once).

<strong class="qa-trap">Interview trap:</strong> the reverse exists too: **one** loop can be `O(n²)` if its body is `O(n)` (`in_array`, `array_shift`, `s += x`, `slices.Contains`).
:::

### Q10 — How do you compute the space complexity of a recursive function? <Badge type="warning" text="Important" /> {#q-10}

::: details Answer {open}
**Answer:** Stack space is the **maximum depth** of simultaneously open calls times the size of a frame, not the total number of calls. Add whatever memory each level allocates (for example merge sort's temporary array).

| Algorithm | Stack depth | Total auxiliary space |
| --- | --- | --- |
| Merge sort | `O(log n)` | `O(n)` (merge buffer) |
| In-place quicksort | `O(log n)` average, `O(n)` worst | the same |
| Recursive DFS on a tree | tree height: `O(log n)` balanced, `O(n)` skewed | the same |

**Real-world example:** a recursive DFS over a category tree that a bug has turned into a 100,000-level chain: in PHP it ends in a memory error or a segfault, and in Go it eats memory until it hits the stack limit (1 GB by default on 64-bit systems). The fix: an iterative version with an explicit stack, or a depth cap.

<strong class="qa-trap">Interview trap:</strong> saying "quicksort is in-place, so `O(1)` space". The recursion stack counts; to guarantee `O(log n)` you must recurse into the smaller half first and continue with the larger half in a loop.
:::

### Q11 — Can an `O(n²)` algorithm be faster than an `O(n log n)` one? <Badge type="warning" text="Important" /> {#q-11}

::: details Answer {open}
**Answer:** Yes, for small `n`. Big-O hides constants: if one does `2n²` operations and the other `50·n·log₂ n`, the first is faster up to about `n ≈ 190`. On top of that, simple algorithms tend to be cache-friendly and easier on the branch predictor.

**Real-world example:** the sort implementations in standard libraries (pdqsort in Go, PHP's hybrid sort, Timsort in Python and Java) switch to insertion sort for small sub-arrays. Or: for 5–10 elements a linear scan of a slice beats a map lookup, because no hash is computed and everything sits in one cache line.

**Use case:** when `n` has a small, *guaranteed* ceiling (a user's roles, the days of the week), write the simplest code.

<strong class="qa-trap">Interview trap:</strong> "`n` is small" must be guaranteed, not hoped for. "Each user has at most 10 addresses" holds until an enterprise customer shows up with 40 thousand.
:::

### Q12 — Explain the N+1 query problem in complexity terms. <Badge type="danger" text="Must-know" /> {#q-12}

::: details Answer {open}
**Answer:** To display `n` rows you run one query for the list and `n` queries for each row's related data: `O(n)` **round-trips**. In CPU operations it may be no different from a join, but the unit of cost has changed: each round-trip is about 0.5–2 ms, hundreds of thousands of times an in-memory comparison.

```php
// N+1: 1 query for orders + n queries for users
$orders = Order::all();
foreach ($orders as $order) {
    echo $order->user->name;
}

// 2 queries total, regardless of n
$orders = Order::with('user')->get();
```

**Real-world example:** a page with 500 orders: 501 queries × 1 ms ≈ 500 ms of pure network time. With eager loading: 2 queries ≈ 3 ms.

**Use case:** in any backend analysis ask first "is the number of round-trips a function of `n`?". The same pattern applies to HTTP calls to another service and to Redis commands inside a loop (the fix: a batch endpoint, a pipeline, `MGET`).

<strong class="qa-trap">Interview trap:</strong> "fetch them all with one `IN (...)`" has a ceiling too: a 100,000-item `IN` list is a problem of its own. Chunk it or join.
:::

### Q13 — The problem says `n ≤ 10⁵`. What do you conclude from that one number? <Badge type="warning" text="Important" /> {#q-13}

::: details Answer {open}
**Answer:** With a budget of about 10⁸ operations per second, `n²` is 10¹⁰ operations: rejected. The expected solution is therefore `O(n log n)` or `O(n)`: a sort, a hash map, two pointers, a heap, binary search or a one-dimensional DP. The input constraint is effectively a hint about the algorithm.

| Constraint | Target complexity |
| --- | --- |
| `n ≤ 20` | `O(2ⁿ)`: bitmask or backtracking |
| `n ≤ 5 000` | `O(n²)`: 2-D DP |
| `n ≤ 10⁵` to `10⁶` | `O(n log n)` or `O(n)` |
| `n ≤ 10¹⁸` | `O(log n)` or a formula |

**Real-world example:** the same reasoning in design: "each tenant has up to 10⁵ products and recommendations are computed in the request" means pairwise product comparison is out and you need precomputation or an index.

<strong class="qa-trap">Interview trap:</strong> forgetting the language's budget. The PHP and Python interpreters are 10–50× slower than Go; `O(n²)` at `n = 5000` (2.5×10⁷ operations) is about 25 ms in Go and can approach a second in PHP.
:::

### Q14 — Name some hidden `O(n²)` patterns in everyday Go and PHP code. <Badge type="warning" text="Important" /> {#q-14}

::: details Answer {open}
**Answer:** Anywhere an `O(n)` operation sits inside an `O(n)` loop:

| Code | Why `O(n²)` | Replacement |
| --- | --- | --- |
| `in_array` / `array_search` in a `foreach` | a linear scan per iteration | `array_flip` + `isset` |
| `array_merge` in a loop | copies the whole array per iteration | `array_merge(...$parts)` |
| `array_shift` in a `while` | renumbers on every call | `SplQueue` or a head index |
| `s += x` in a Go loop | a new string per iteration | `strings.Builder` |
| `slices.Contains` in a loop | a linear scan | `map[T]struct{}` |
| Deleting from the middle of a slice in a loop | a shift per deletion | filter in place with one write index |
| `Collection::contains` or `where` on a Collection in a loop (Laravel) | a linear scan | `keyBy` once, then `get` |

**Real-world example:** a CSV import of 200 thousand rows that deduplicates with `in_array($row['email'], $seen)`: 2×10¹⁰ string comparisons in the worst case, tens of minutes. With `isset($seen[$email])`: under a second.

<strong class="qa-trap">Interview trap:</strong> `array_unique` and `array_diff` are not free either; know the cost of every library function before you call it inside a loop.
:::

### Q15 — What is ReDoS, and what does it have to do with complexity? <Badge type="info" text="Good to know" /> {#q-15}

::: details Answer {open}
**Answer:** Backtracking regex engines, given patterns with nested repetition or overlapping alternation (`(a+)+`, `(a|a)*`, `(.*a){10}`) and an input that fails to match at the last moment, try an exponential (or high-degree polynomial) number of paths. An attacker locks a CPU core with a string of a few dozen characters.

**Real-world example:** the Cloudflare outage of July 2019 (one regex in a WAF rule) and the Stack Overflow outage of July 2016 (a trailing-whitespace regex applied to a post with about 20 thousand consecutive spaces; `O(n²)` behaviour).

**Use case / defence:** an engine with a linear-time guarantee (Go's `regexp` package, RE2), a cap on input length *before* the regex, no nested quantifiers, and in PHP a check of `preg_last_error()`.

<strong class="qa-trap">Interview trap:</strong> in PHP a `false` return from `preg_match` means "error", not "no match" (which is `0`). Code that conflates the two can let validation be bypassed.
:::

### Q16 — When a problem is NP-hard, what do you do in practice? <Badge type="info" text="Good to know" /> {#q-16}

::: details Answer {open}
**Answer:** NP-hard means we know no exact polynomial algorithm for it; it does not mean the problem cannot be solved. The practical options:

| Approach | When |
| --- | --- |
| Brute force or bitmask DP | `n` really is small (up to about 20) |
| Heuristic or greedy | a "good enough" answer will do |
| Approximation algorithm with a guarantee | you need a quality bound |
| Restricting the problem | your actual special case is polynomial (e.g. small capacity in knapsack: `O(n·W)`) |
| Off-the-shelf solver (ILP, SAT, OR-Tools) | an optimisation problem with many constraints |

**Real-world example:** courier routing (VRP, a generalisation of TSP): no company tries all `n!` routes; heuristics such as nearest neighbour plus local improvement (2-opt) get near-optimal answers in seconds. Bin packing for placing containers on nodes is likewise handled with first-fit decreasing.

<strong class="qa-trap">Interview trap:</strong> saying "NP means non-polynomial". NP means nondeterministic polynomial: a given answer can be **verified** in polynomial time.
:::

### Q17 — Where does the Master theorem fail? <Badge type="info" text="Good to know" /> {#q-17}

::: details Answer {open}
**Answer:** Three groups:

1. **The recurrence is not of the form `a·T(n/b) + f(n)`:** `T(n) = T(n-1) + n`, or `T(n) = T(n/3) + T(2n/3) + n` (an uneven split). For the latter the recursion tree says each level does at most `n` work and the depth is `log₁.₅ n`: `O(n log n)`.
2. **`f(n)` differs from `n^(log_b a)` only by a logarithmic factor:** `T(n) = 2T(n/2) + n log n`. It is neither case 2 nor case 3 (the gap is not polynomial). The extended version gives `Θ(n log² n)`.
3. **`a` is not a constant or is less than 1:** such as `T(n) = n·T(n/2) + 1`.

**Real-world example:** quicksort that always splits 10 to 90: `T(n) = T(n/10) + T(9n/10) + n`. The Master theorem does not apply, but the recursion tree shows it is still `O(n log n)`, just with a larger constant. That is why quicksort with a "not so good" pivot is still fast in practice.

<strong class="qa-trap">Interview trap:</strong> applying case 3 when `f(n)` is not larger by a positive power `n^ε`.
:::

### Q18 — A B-tree and a balanced binary tree are both `O(log n)`. Why do databases use the B-tree? <Badge type="info" text="Good to know" /> {#q-18}

::: details Answer {open}
**Answer:** Because the unit of cost in a database is "one page read from disk", not "one comparison". A binary tree over 100 million keys is about 27 levels deep and every level can be a separate page (a random I/O). A B-tree keeps hundreds of keys per node, so its depth is 3–4. Both are `O(log n)`, but the base of the logarithm (2 versus several hundred) is exactly the constant that Big-O hides.

```text
binary tree, 10^8 keys:  depth ≈ log2(10^8)   ≈ 27  -> up to 27 page reads
B-tree, fan-out 500:     depth ≈ log500(10^8) ≈ 3   -> 3–4 page reads
```

**Real-world example:** the same logic holds in memory: cache-friendly structures (an in-memory B-tree, a sorted array) are faster in practice than pointer-based trees (red-black), because they miss the cache less.

**Use case:** whenever you have two options of the same order, ask "what is my expensive basic operation?" and count that.

<strong class="qa-trap">Interview trap:</strong> "why not a hash index, which is `O(1)`?" Because a hash only supports equality; range queries, `ORDER BY` and prefix matches need order.
:::

## Related {#related}

- [Big O notation](/fundamentals/big-o) — the formal definitions and the notation family
- <span class="vip-locked" title="VIP members only">Recursion <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> · <span class="vip-locked" title="VIP members only">Divide & conquer <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> · <span class="vip-locked" title="VIP members only">Greedy <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> · <span class="vip-locked" title="VIP members only">Dynamic programming <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>
- <span class="vip-locked" title="VIP members only">Arrays <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> · <span class="vip-locked" title="VIP members only">Hash table <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> · <span class="vip-locked" title="VIP members only">Tree <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> · <span class="vip-locked" title="VIP members only">Graph <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>
- <span class="vip-locked" title="VIP members only">Sorting and search <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> · <span class="vip-locked" title="VIP members only">Common algorithms <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>
