# Quick Sort، Merge Sort و Binary Search

> ماژول A — مبانی و الگوریتم‌ها · بخش ۲

## فهرست ذهنی

1. [چرا این‌ها؟](#چرا-اینها)  
2. [Binary Search](#binary-search)  
3. [Quick Sort](#quick-sort)  
4. [Merge Sort](#merge-sort)  
5. [اتصال Quick Sort ↔ BST](#اتصال-quick-sort--bst)  
6. [مقایسه و قاعدهٔ تصمیم](#مقایسه-و-قاعدهٔ-تصمیم)

---

## چرا این‌ها؟

| الگوریتم | کار | متوسط |
|----------|-----|--------|
| **Binary Search** | پیدا کردن در دادهٔ **مرتب** | O(log n) |
| **Quick Sort** | مرتب‌سازی divide & conquer (اغلب in-place) | O(n log n) |
| **Merge Sort** | مرتب‌سازی پایدار با کران تضمینی | O(n log n) همیشه |

بدون این‌ها، بحث ایندکس DB، range query و مقیاس نصفه است.

---

## Binary Search

آرایه باید **مرتب** باشد. هر گام نصف فضای جست‌وجو را دور می‌اندازد → **O(log n)**.

```
[1, 3, 5, 7, 9, 11, 13]  target = 11
 mid → 7  → راست
 mid → 11 → پیدا شد
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

### Python / JS (ایدهٔ یکسان)

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

### نکات سیستمی

- B-Tree / ایندکس DB ≈ جست‌وجوی لگاریتمی  
- داده مرتب نیست → یک‌بار sort، یا hash برای equality  
- روی **linked list** معمولاً بی‌معناست (دسترسی mid خطی است)  
- برای دادهٔ پویا و بزرگ: درخت/ایندکس > sort مکرر کل مجموعه  

---

## Quick Sort

### ایده

1. یک **pivot** بردار  
2. **Partition**: کوچک‌ترها چپ، بزرگ‌ترها راست  
3. روی دو طرف recurse کن  

سه بخش divide-and-conquer (combine را فراموش نکن):

| بخش | کار | هزینهٔ معمول |
|-----|-----|---------------|
| Divide | partition | O(n) |
| Conquer | دو recurse | وابسته به تعادل |
| Combine | in-place: تقریباً O(1)؛ out-of-place: concat O(n) | |

### پیچیدگی

| حالت | زمان | یادداشت |
|------|------|---------|
| بهترین / متوسط | O(n log n) | pivot تعادل نسبی |
| بدترین | O(n²) | همیشه کوچک‌ترین/بزرگ‌ترین (مثلاً از قبل مرتب + pivot اول/آخر) |
| فضا (in-place) | O(log n) متوسط stack | بدترین O(n) عمق |

::: tip جلوگیری از worst case
- Random pivot  
- Median-of-three  
- برای کران تضمینی: **Merge Sort** / Heap Sort  
:::

### انتخاب pivot

| روش | نکته |
|-----|------|
| اول/آخر | ساده؛ روی دادهٔ مرتب → worst case |
| تصادفی | الگوی worst مشخص ندارد — رایج در عمل |
| میانه | ایده‌آل برای تعادل؛ پیدا کردن میانه هزینه دارد |

### نسخهٔ آموزشی out-of-place (PHP)

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

### Lomuto partition (مفهوم in-place)

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

(Hoare معمولاً سریع‌تر؛ Lomuto ساده‌تر برای آموزش.)

### Python فشرده

```python
def qsort(a):
    if not a:
        return []
    pivot = a[0]
    left = [x for x in a[1:] if x < pivot]
    right = [x for x in a[1:] if x >= pivot]
    return qsort(left) + [pivot] + qsort(right)
```

### مزایا / معایب

| + | − |
|---|---|
| سریع در عمل روی دادهٔ بزرگ | worst O(n²) |
| cache-friendly (in-place) | ناپایدار (stable نیست) |
| کم‌هزینهٔ حافظهٔ کمکی | برای n خیلی کوچک گاهی insertion بهتر است |

کاربرد: کتابخانه‌های sort (اغلب hybrid)، Quickselect برای k-امین عنصر، پیش‌پردازش برای binary search.

---

## Merge Sort

همیشه **O(n log n)** — کران تضمینی. پایدار (stable). حافظهٔ کمکی **O(n)**.

```
Divide: آرایه را نصف کن تا تک‌عنصر (O(log n) سطح)
Conquer/Merge: دو نیمهٔ مرتب را ادغام کن (هر سطح O(n))
→ O(n log n)
```

### PHP مفهومی

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

مناسب: نیاز به stable sort، کران بدترین حالت، external sort روی دیسک (ایدهٔ merge).

---

## اتصال Quick Sort ↔ BST

درخت recursion مربوط به Quick Sort از نظر مقایسه‌ها به **ساخت BST با همان ترتیب pivotها** گره خورده است:

| | Quick Sort | BST |
|--|------------|-----|
| عنصر کلیدی | pivot | root |
| متعادل | O(n log n) | ارتفاع O(log n) → جست‌وجو O(log n) |
| نامتعادل شدید | O(n²) | زنجیره → جست‌وجو O(n) |

Shuffle تصادفی قبل از insert/pivot → احتمال worst کمتر.

«Buggy quicksort» که نتیجهٔ recurse را داخل براکت تو در تو می‌گذارد، عملاً BST را به‌صورت `[left, root, right]` encode می‌کند — همان ساختار پنهان partition.

---

## مقایسه و قاعدهٔ تصمیم

| نیاز | ابزار |
|------|--------|
| Lookup کلید دقیق | Hash → متوسط O(1) |
| جست‌وجوی بازه / مرتب | B-Tree / binary search → O(log n) |
| Sort در حافظه، سرعت عملی | Quick / timsort زبان |
| Stable + کران بد | Merge Sort |
| دیتاست عظیم روی دیسک | External merge sort |

### قاعده

1. داده مرتب + فقط جست‌وجو → Binary Search / ایندکس  
2. باید sort کنی و `n` بزرگ → O(n log n)، نه bubble O(n²)  
3. فقط equality lookup → معمولاً hash بهتر از sort+binary است  
4. از worst quicksort بترس → random pivot یا mergesort  

### تمرین

1. چرا binary search روی linked list معمولاً بی‌معناست؟  
2. اگر pivot همیشه کوچک‌ترین باشد چه می‌شود؟  
3. ایندکس MySQL روی `email` به کدام ایده نزدیک است؟  
4. Merge Sort چه چیزی را Quick Sort تضمین نمی‌کند؟  

::: tip راهنما
1. دسترسی mid خطی است · 2. O(n²) · 3. جست‌وجوی لگاریتمی / درخت · 4. O(n log n) بدترین حالت (+ stability)
:::
