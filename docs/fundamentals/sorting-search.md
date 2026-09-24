# Quick Sort & Binary Search

## Why these two?

In interviews and system design, two basics show up constantly:

| Algorithm | Job | Average complexity |
|-----------|-----|--------------------|
| **Binary Search** | Find in **sorted** data | O(log n) |
| **Quick Sort** | Sort via divide and conquer | O(n log n) |

Without them, conversations about DB indexes, range queries, and scalability stay incomplete.

---

## Binary Search — idea

The array must be **sorted**. Each step discards half the search space.

```
[1, 3, 5, 7, 9, 11, 13]  target = 11
 mid → 7  → go right
 mid → 11 → found
```

### PHP

```php
function binarySearch(array $sorted, int $target): int
{
    $lo = 0;
    $hi = count($sorted) - 1;

    while ($lo <= $hi) {
        $mid = intdiv($lo + $hi, 2);
        if ($sorted[$mid] === $target) {
            return $mid;
        }
        if ($sorted[$mid] < $target) {
            $lo = $mid + 1;
        } else {
            $hi = $mid - 1;
        }
    }

    return -1;
}
```

### Systems notes

- B-Trees / database indexes are effectively logarithmic search.
- If data isn’t sorted, sort once (one-time cost) or use a hash.
- For large, dynamic data, tree/index structures beat repeated full sorts.

---

## Quick Sort — idea

1. Pick a **pivot**.  
2. Partition: smaller left, larger right.  
3. Recurse on both sides.

```
[5, 2, 8, 1, 9]  pivot=5
→ [2, 1] + [5] + [8, 9]
→ sort the halves
```

### Complexity

| Case | Time | Notes |
|------|------|-------|
| Average | O(n log n) | Good pivots |
| Worst | O(n²) | Already sorted + always first/last pivot |
| Memory | O(log n) | Recursion depth (average) |

::: tip Avoiding worst case
- Random pivot  
- Or median-of-three  
- For guaranteed bounds: mergesort / heapsort
:::

### PHP (conceptual)

```php
function quickSort(array $arr): array
{
    if (count($arr) < 2) {
        return $arr;
    }

    $pivot = $arr[0];
    $left = $right = [];

    for ($i = 1; $i < count($arr); $i++) {
        if ($arr[$i] < $pivot) {
            $left[] = $arr[$i];
        } else {
            $right[] = $arr[$i];
        }
    }

    return [...quickSort($left), $pivot, ...quickSort($right)];
}
```

(In-place versions are better in production; this one is for understanding partition.)

---

## Quick compare with real structures

| Need | Common tool |
|------|-------------|
| Exact key lookup | Hash / Map → average O(1) |
| Range / ordered search | B-Tree index → ~O(log n) |
| One-shot in-memory sort | Language sort / quicksort |
| Huge on-disk datasets | Merge-based / external sort |

---

## Decision rule

1. Data is **sorted** and you only need search → Binary Search / index.  
2. You must sort and `n` is large → O(n log n), not bubble O(n²).  
3. Exact key lookup only → hash usually beats sort + binary search.

---

## Practice

1. Why is binary search usually pointless on a linked list?  
2. If the pivot is always the smallest element, what happens to Quick Sort?  
3. A MySQL index on `email` is closest to which idea?
