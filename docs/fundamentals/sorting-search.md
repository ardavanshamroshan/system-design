# Quick Sort, Merge Sort & Binary Search

> Module A — Fundamentals & Algorithms · Section 2

## Mental outline

1. [Why these?](#why-these)  
2. [Binary Search](#binary-search)  
3. [Quick Sort](#quick-sort)  
4. [Merge Sort](#merge-sort)  
5. [Quick Sort ↔ BST link](#quick-sort--bst-link)  
6. [Compare and decide](#compare-and-decide)

---

## Why these?

| Algorithm | Job | Typical |
|-----------|-----|---------|
| **Binary Search** | Find in **sorted** data | O(log n) |
| **Quick Sort** | Divide & conquer sort (often in-place) | O(n log n) |
| **Merge Sort** | Stable sort with guaranteed bound | Always O(n log n) |

Without them, DB indexes, range queries, and scaling talks stay incomplete.

---

## Binary Search

Array must be **sorted**. Each step discards half the search space → **O(log n)**.

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

### Python

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

### Systems notes

- B-Tree / DB indexes ≈ logarithmic search  
- Unsorted data → one-time sort, or hash for equality  
- On a **linked list**, usually pointless (mid access is linear)  
- Large dynamic data: tree/index > repeatedly sorting everything  

---

## Quick Sort

### Idea

1. Pick a **pivot**  
2. **Partition**: smaller left, larger right  
3. Recurse on both sides  

Three divide-and-conquer parts (don’t forget combine):

| Part | Work | Typical cost |
|------|------|--------------|
| Divide | partition | O(n) |
| Conquer | two recursions | depends on balance |
| Combine | in-place ≈ O(1); out-of-place concat O(n) | |

### Complexity

| Case | Time | Note |
|------|------|------|
| Best / average | O(n log n) | reasonably balanced pivots |
| Worst | O(n²) | always min/max (e.g. sorted + first/last pivot) |
| Space (in-place) | O(log n) avg stack | O(n) depth worst |

::: tip Avoiding worst case
- Random pivot  
- Median-of-three  
- Guaranteed bound: **Merge Sort** / Heap Sort  
:::

### Pivot choice

| Method | Note |
|--------|------|
| First/last | Simple; sorted input → worst case |
| Random | No fixed worst pattern — common in practice |
| Median | Ideal balance; finding the median costs |

### Teaching out-of-place (PHP)

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

### Lomuto partition (in-place idea)

```php
function partition(array &$a, int $low, int $high): int
{
    $pivot = $a[$high];
    $i = $low - 1;

    for ($j = $low; $j < $high; $j++) {
        if ($a[$j] < $pivot) {
            $i++;
            [$a[$i], $a[$j]] = [$a[$j], $a[$i]];
        }
    }

    [$a[$i + 1], $a[$high]] = [$a[$high], $a[$i + 1]];
    return $i + 1;
}

function quickSortInPlace(array &$a, int $low, int $high): void
{
    if ($low < $high) {
        $p = partition($a, $low, $high);
        quickSortInPlace($a, $low, $p - 1);
        quickSortInPlace($a, $p + 1, $high);
    }
}
```

### Compact Python

```python
def qsort(a):
    if not a:
        return []
    pivot = a[0]
    left = [x for x in a[1:] if x < pivot]
    right = [x for x in a[1:] if x >= pivot]
    return qsort(left) + [pivot] + qsort(right)
```

### Pros / cons

| + | − |
|---|---|
| Fast in practice on large data | Worst O(n²) |
| Cache-friendly (in-place) | Unstable |
| Low extra memory | Tiny `n` may prefer insertion |

Used in: language sort hybrids, Quickselect for k-th element, prep for binary search.

---

## Merge Sort

Always **O(n log n)** — guaranteed. Stable. Extra memory **O(n)**.

```
Divide: split until single elements (O(log n) levels)
Merge: combine two sorted halves (O(n) per level)
→ O(n log n)
```

### Conceptual PHP

```php
function mergeSort(array $arr): array
{
    if (count($arr) <= 1) {
        return $arr;
    }

    $mid = intdiv(count($arr), 2);
    $left = mergeSort(array_slice($arr, 0, $mid));
    $right = mergeSort(array_slice($arr, $mid));

    return merge($left, $right);
}

function merge(array $left, array $right): array
{
    $out = [];
    $i = $j = 0;

    while ($i < count($left) && $j < count($right)) {
        if ($left[$i] <= $right[$j]) {
            $out[] = $left[$i++];
        } else {
            $out[] = $right[$j++];
        }
    }

    return array_merge($out, array_slice($left, $i), array_slice($right, $j));
}
```

Fits: need stable sort, worst-case bound, external / on-disk merge ideas.

---

## Quick Sort ↔ BST link

Quicksort’s recursion tree is tightly related to **building a BST with the same pivot/insertion order**:

| | Quick Sort | BST |
|--|------------|-----|
| Key element | pivot | root |
| Balanced | O(n log n) | height O(log n) → search O(log n) |
| Extremely skewed | O(n²) | chain → search O(n) |

Random shuffle before insert/pivot reduces worst-case odds.

A “buggy” quicksort that nests recursive results as `[left, root, right]` literally encodes that hidden BST.

---

## Compare and decide

| Need | Tool |
|------|------|
| Exact key lookup | Hash → average O(1) |
| Range / ordered search | B-Tree / binary search → O(log n) |
| In-memory sort, speed | Quick / language timsort |
| Stable + worst-case bound | Merge Sort |
| Huge on-disk data | External merge sort |

### Decision rule

1. Sorted data + search only → Binary Search / index  
2. Must sort large `n` → O(n log n), not bubble O(n²)  
3. Equality lookup only → hash usually beats sort + binary  
4. Fear quicksort worst case → random pivot or mergesort  

### Practice

1. Why is binary search on a linked list usually pointless?  
2. What if the pivot is always the smallest element?  
3. A MySQL index on `email` is closest to which idea?  
4. What does Merge Sort guarantee that Quick Sort does not?  

::: tip Hints
1. Mid access is linear · 2. O(n²) · 3. Logarithmic / tree search · 4. O(n log n) worst case (+ stability)
:::
