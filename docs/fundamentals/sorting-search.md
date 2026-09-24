# Quick Sort و Binary Search

## چرا این دو؟

در مصاحبه و طراحی سیستم، دو ابزار پایه زیاد تکرار می‌شوند:

| الگوریتم | کار | پیچیدگی متوسط |
|----------|-----|----------------|
| **Binary Search** | پیدا کردن در دادهٔ **مرتب** | O(log n) |
| **Quick Sort** | مرتب‌سازی با تقسیم و غلبه | O(n log n) |

بدون درک این‌ها، بحث ایندکس دیتابیس، range query و مقیاس‌پذیری ناقص می‌ماند.

---

## Binary Search — ایده

آرایه باید **مرتب** باشد. هر بار نصف فضای جستجو را حذف می‌کنی.

```
[1, 3, 5, 7, 9, 11, 13]  هدف = 11
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

### نکته‌های سیستم

- B-Tree / ایندکس دیتابیس عملاً جستجوی لگاریتمی است.
- اگر داده مرتب نیست، اول sort کن (هزینهٔ یک‌باره) یا از hash استفاده کن.
- برای دادهٔ پویا و زیاد، ساختارهای درخت/ایندکس بهتر از sort مکرر هستند.

---

## Quick Sort — ایده

1. یک **pivot** انتخاب کن.  
2. عناصر کوچک‌تر را چپ، بزرگ‌تر را راست بگذار (partition).  
3. روی دو نیمهٔ بازگشتی تکرار کن.

```
[5, 2, 8, 1, 9]  pivot=5
→ [2, 1] + [5] + [8, 9]
→ مرتب کن نیمه‌ها
```

### پیچیدگی

| حالت | زمان | توضیح |
|------|------|-------|
| متوسط | O(n log n) | pivot خوب |
| بدترین | O(n²) | دادهٔ از قبل مرتب + pivot همیشه اول/آخر |
| حافظه | O(log n) | عمق recursion (متوسط) |

::: tip جلوگیری از worst case
- pivot تصادفی  
- یا median-of-three  
- برای پایداری قطعی: mergesort / heapsort
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

(نسخهٔ in-place در production بهتر است؛ این نسخه برای فهم partition است.)

---

## مقایسهٔ سریع با ساختارهای واقعی

| نیاز | ابزار رایج |
|------|------------|
| lookup با کلید دقیق | Hash / Map → O(1) متوسط |
| جستجو در بازه / مرتب | ایندکس B-Tree → ~O(log n) |
| مرتب‌سازی یک‌باره در حافظه | sort زبان / quicksort |
| داده‌های خیلی بزرگ روی دیسک | merge-based / external sort |

---

## قانون تصمیم

1. اگر داده **مرتب** است و فقط جستجو می‌خواهی → Binary Search / ایندکس.  
2. اگر باید مرتب شود و n بزرگ است → الگوریتم O(n log n)، نه حبابی O(n²).  
3. اگر فقط lookup با کلید داری → hash معمولاً از sort+binary بهتر است.

---

## تمرین

1. چرا binary search روی لیست لینک‌دار معمولاً بی‌فایده است؟  
2. اگر pivot همیشه کوچک‌ترین عنصر باشد، Quick Sort چه می‌شود؟  
3. ایندکس MySQL روی ستون `email` به کدام ایده نزدیک‌تر است؟
