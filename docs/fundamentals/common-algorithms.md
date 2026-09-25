# More Common Algorithms

> Module A — Fundamentals & Algorithms · Section 3

Patterns that show up constantly in interviews and backend work after Big O and Sort/Search.

## Outline

1. [Hashing / Map](#hashing--map)  
2. [Two Pointers](#two-pointers)  
3. [Sliding Window](#sliding-window)  
4. [BFS & DFS](#bfs--dfs)  
5. [Heap (Priority Queue)](#heap-priority-queue)  
6. [Quick decision table](#quick-decision-table)

---

## Hashing / Map

**Idea:** key → bucket. Average **O(1)** insert/lookup/delete; worst case (bad collisions) O(n).

```php
$byEmail = [];
foreach ($users as $u) {
    $byEmail[$u['email']] = $u;
}
$user = $byEmail[$email] ?? null;
```

```python
seen = set()
for x in nums:
    if x in seen:
        return True
    seen.add(x)
```

| Use when | Avoid when |
|----------|------------|
| Exact lookup, counts, dedupe | Range queries, global order (without extra structure) |

In systems: Redis hashes, some DB hash indexes, cache keys.

---

## Two Pointers

Two indexes move over a (usually) sorted array — often **O(n)** instead of O(n²).

### Example: two-sum on a sorted array

```php
function twoSumSorted(array $a, int $target): ?array
{
    $lo = 0;
    $hi = count($a) - 1;

    while ($lo < $hi) {
        $sum = $a[$lo] + $a[$hi];
        if ($sum === $target) {
            return [$lo, $hi];
        }
        if ($sum < $target) {
            $lo++;
        } else {
            $hi--;
        }
    }

    return null;
}
```

Other patterns: in-place dedupe, palindrome check, merge two sorted arrays.

Common prerequisite: sorted data (or sort first → O(n log n) + O(n)).

---

## Sliding Window

A moving subarray/substring with fixed or variable size — usually **O(n)**.

### Example: max sum of a window of length `k`

```php
function maxSumWindow(array $a, int $k): int
{
    $n = count($a);
    $window = array_sum(array_slice($a, 0, $k));
    $best = $window;

    for ($i = $k; $i < $n; $i++) {
        $window += $a[$i] - $a[$i - $k];
        $best = max($best, $window);
    }

    return $best;
}
```

```python
def longest_unique_substring(s: str) -> int:
    seen = {}
    left = best = 0
    for right, ch in enumerate(s):
        if ch in seen and seen[ch] >= left:
            left = seen[ch] + 1
        seen[ch] = right
        best = max(best, right - left + 1)
    return best
```

Used for: windowed rate limits, moving averages, longest substring with a constraint.

---

## BFS & DFS

On graphs/trees.

| | BFS | DFS |
|--|-----|-----|
| Structure | Queue | Stack / recursion |
| Intuition | Level by level | Go deep, then backtrack |
| Shortest path (unit edges) | Yes (unweighted) | Not necessarily |
| Use | Simple shortest path, tree levels | Cycle detect, topo sort, backtracking |

### BFS — unweighted shortest path (conceptual PHP)

```php
function bfsShortest(array $adj, int $start, int $goal): int
{
    $q = new SplQueue();
    $q->enqueue([$start, 0]);
    $seen = [$start => true];

    while (!$q->isEmpty()) {
        [$node, $dist] = $q->dequeue();
        if ($node === $goal) {
            return $dist;
        }
        foreach ($adj[$node] ?? [] as $next) {
            if (!isset($seen[$next])) {
                $seen[$next] = true;
                $q->enqueue([$next, $dist + 1]);
            }
        }
    }

    return -1;
}
```

### DFS — recursion

```python
def dfs(node, seen, adj):
    seen.add(node)
    for nxt in adj.get(node, []):
        if nxt not in seen:
            dfs(nxt, seen, adj)
```

In systems: service dependency graphs, bounded crawls, connected components.

Typical complexity: **O(V + E)** for both (adjacency lists).

---

## Heap (Priority Queue)

Nearly complete tree; root is always min or max.

| Op | Complexity |
|----|------------|
| peek min/max | O(1) |
| insert / extract | O(log n) |
| build from n items | O(n) |

### PHP with SplPriorityQueue

```php
$heap = new SplPriorityQueue();
$heap->insert('job-a', 10);
$heap->insert('job-b', 5);
$top = $heap->extract();
```

Used for: top-K, Dijkstra, job scheduling, merge K sorted lists, heapsort O(n log n).

---

## Quick decision table

| Problem | Pattern |
|---------|---------|
| “Have I seen this?” / counts | Hash / Set |
| Two ends of a sorted array | Two pointers |
| Contiguous subarray with a constraint | Sliding window |
| Shortest path, unweighted graph | BFS |
| Deep traversal / backtrack | DFS |
| Always next largest/smallest | Heap |
| Search in sorted data | Binary search ([previous page](/fundamentals/sorting-search)) |
| Stable sort with a bound | Merge sort |

### Decision rule

1. Classify the problem: search, sort, graph, or window.  
2. The right pattern often drops a full complexity class (n² → n).  
3. After picking a pattern, write Big O and edge cases.

### Practice

1. Find duplicates in an array — hash or sort? What’s the trade-off?  
2. Shortest path in a positively weighted graph — is BFS enough?  
3. Max average over `k` consecutive days — which pattern?
