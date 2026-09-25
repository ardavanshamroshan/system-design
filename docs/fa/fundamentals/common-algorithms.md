# الگوریتم‌های پرکاربرد بیشتر

> ماژول A — مبانی و الگوریتم‌ها · بخش ۳

الگوهایی که بعد از Big O و Sort/Search مدام در مصاحبه و بک‌اند ظاهر می‌شوند.

## فهرست

1. [Hashing / Map](#hashing--map)  
2. [Two Pointers](#two-pointers)  
3. [Sliding Window](#sliding-window)  
4. [BFS و DFS](#bfs-و-dfs)  
5. [Heap (Priority Queue)](#heap-priority-queue)  
6. [جدول تصمیم سریع](#جدول-تصمیم-سریع)

---

## Hashing / Map

**ایده:** کلید → سطل. متوسط **O(1)** insert/lookup/delete؛ بدترین (collision بد) O(n).

```php
// Equality lookup — O(1) متوسط
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

| کی؟ | کی نه؟ |
|-----|--------|
| lookup دقیق، شمارش، dedupe | range query، ترتیب سراسری (بدون ساختار اضافه) |

در سیستم: Redis hash، ایندکس hash در بعضی DBها، cache key.

---

## Two Pointers

دو ایندکس روی آرایهٔ (معمولاً) مرتب حرکت می‌کنند — اغلب **O(n)** به‌جای O(n²).

### مثال: دو مجموع روی آرایهٔ مرتب

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

الگوهای دیگر: حذف duplicate درجا، palindrome check، merge دو آرایهٔ مرتب.

پیش‌نیاز رایج: داده مرتب باشد (یا اول sort → O(n log n) + O(n)).

---

## Sliding Window

زیرآرایه/زیررشتهٔ متحرک با اندازهٔ ثابت یا متغیر — معمولاً **O(n)**.

### مثال: بیشینهٔ مجموع پنجرهٔ طول `k`

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

کاربرد: rate limit پنجره‌ای، میانگین متحرک، longest substring با قید.

---

## BFS و DFS

روی گراف/درخت.

| | BFS | DFS |
|--|-----|-----|
| ساختار | صف (queue) | پشته / recursion |
| شهود | سطح به سطح | عمیق برو، بعد برگرد |
| کوتاه‌ترین مسیر (یال یکسان) | بله (unweighted) | لزوماً نه |
| کاربرد | shortest path ساده، سطح درخت | cycle detect، topo sort، backtracking |

### BFS — کوتاه‌ترین مسیر در گراف بدون وزن (PHP مفهومی)

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

در سیستم: وابستگی سرویس‌ها، crawl محدود، پیدا کردن connected component.

پیچیدگی معمول: **O(V + E)** برای هر دو (با لیست همسایگی).

---

## Heap (Priority Queue)

درخت تقریباً کامل؛ ریشه همیشه min یا max.  

| عمل | پیچیدگی |
|-----|----------|
| peek min/max | O(1) |
| insert / extract | O(log n) |
| ساخت از n عنصر | O(n) |

### PHP با SplPriorityQueue

```php
$heap = new SplPriorityQueue();
$heap->insert('job-a', 10);
$heap->insert('job-b', 5);
$top = $heap->extract(); // اولویت بالاتر اول (بسته به تنظیم)
```

کاربرد: top-K، Dijkstra، زمان‌بندی job، merge K لیست مرتب، heapsort O(n log n).

---

## جدول تصمیم سریع

| مسئله | الگو |
|--------|------|
| «آیا قبلاً دیدم؟» / شمارش | Hash / Set |
| دو سر آرایهٔ مرتب | Two pointers |
| زیرآرایهٔ پیوسته با قید | Sliding window |
| کوتاه‌ترین در گراف بدون وزن | BFS |
| پیمایش عمیق / backtrack | DFS |
| همیشه بزرگ‌ترین/کوچک‌ترین بعدی | Heap |
| جست در مرتب | Binary search ([صفحهٔ قبل](/fa/fundamentals/sorting-search)) |
| مرتب‌سازی پایدار با کران | Merge sort |

### قاعده

1. اول ببین مسئله **جست‌وجو، مرتب، گراف، یا پنجره** است.  
2. الگوی درست اغلب پیچیدگی را یک مرتبه پایین می‌آورد (n² → n).  
3. بعد از انتخاب الگو، Big O و edge case را بنویس.

### تمرین

1. پیدا کردن duplicate در آرایه — hash یا sort؟ trade-off؟  
2. کوتاه‌ترین مسیر در گراف وزن‌دار مثبت — BFS کافی است؟  
3. حداکثر میانگین `k` روز متوالی — کدام الگو؟
