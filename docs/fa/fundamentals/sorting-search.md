# Quick Sort و Binary Search

## چرا این دو تا؟

در مصاحبه و طراحی سیستم، دو پایه مدام ظاهر می‌شوند:

| الگوریتم | کار | پیچیدگی متوسط |
|----------|-----|---------------|
| **Binary Search** | پیدا کردن در دادهٔ **مرتب** | O(log n) |
| **Quick Sort** | مرتب‌سازی با divide and conquer | O(n log n) |

بدون این‌ها، بحث ایندکس DB، range query و مقیاس‌پذیری نصفه می‌ماند.

---

## Binary Search — ایده

آرایه باید **مرتب** باشد. هر گام نصف فضای جست‌وجو را دور می‌اندازد.

```
[1, 3, 5, 7, 9, 11, 13]  target = 11
 mid → 7  → برو راست
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

### نکات سیستمی

- B-Tree / ایندکس دیتابیس عملاً جست‌وجوی لگاریتمی است.
- اگر داده مرتب نیست، یک‌بار sort کن (هزینهٔ یک‌باره) یا از hash استفاده کن.
- برای داده‌های بزرگ و پویا، ساختار درخت/ایندکس از sort مکرر کل مجموعه بهتر است.

---

## Quick Sort — ایده

1. یک **pivot** بردار.  
2. Partition: کوچک‌ترها چپ، بزرگ‌ترها راست.  
3. روی هر دو طرف recurse کن.

```
[5, 2, 8, 1, 9]  pivot=5
→ [2, 1] + [5] + [8, 9]
→ نصفه‌ها را مرتب کن
```

### پیچیدگی

| حالت | زمان | یادداشت |
|------|------|---------|
| متوسط | O(n log n) | pivot خوب |
| بدترین | O(n²) | از قبل مرتب + همیشه اولین/آخرین pivot |
| حافظه | O(log n) | عمق recursion (متوسط) |

::: tip جلوگیری از worst case
- Random pivot  
- یا median-of-three  
- برای کران تضمینی: mergesort / heapsort
:::

### PHP (مفهومی)

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

(نسخه‌های in-place در production بهترند؛ این یکی برای فهم partition است.)

---

## مقایسهٔ سریع با ساختارهای واقعی

| نیاز | ابزار رایج |
|------|------------|
| Lookup با کلید دقیق | Hash / Map → متوسط O(1) |
| جست‌وجوی بازه‌ای / مرتب | ایندکس B-Tree → ~O(log n) |
| Sort یک‌باره در حافظه | sort زبان / quicksort |
| دیتاست عظیم روی دیسک | Merge-based / external sort |

---

## قاعدهٔ تصمیم

1. داده **مرتب** است و فقط جست‌وجو می‌خواهی → Binary Search / ایندکس.  
2. باید sort کنی و `n` بزرگ است → O(n log n)، نه bubble O(n²).  
3. فقط lookup کلید دقیق → معمولاً hash از sort + binary search بهتر است.

---

## تمرین

1. چرا binary search روی linked list معمولاً بی‌معناست؟  
2. اگر pivot همیشه کوچک‌ترین عنصر باشد، برای Quick Sort چه می‌شود؟  
3. ایندکس MySQL روی `email` به کدام ایده نزدیک‌تر است؟
