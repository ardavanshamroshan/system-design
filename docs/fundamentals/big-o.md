<p class="lang-switch" dir="ltr" lang="en">
  <a href="#english">English (LTR)</a>
  <span aria-hidden="true">·</span>
  <a href="#farsi" dir="rtl" lang="fa">فارسی (RTL)</a>
</p>

<div class="doc-lang doc-lang--en" dir="ltr" lang="en">

# Big O Notation {#english}

## What is it and why?

**Big O** describes how an algorithm’s cost (time or memory) grows with **input size `n`** — not how many milliseconds it takes on your laptop.

| Lens | Question |
|------|----------|
| Absolute time | “How long does this function take on my Mac?” |
| Big O | “If `n` grows 10×, roughly how much does the cost grow?” |

In interviews and system design, Big O is the shared language: “With 10× traffic, how much do DB / CPU / cost grow?”

---

## Mental model

Think of `n` as the number of items (users, rows, keys).

| Symbol | Rough meaning | When `n` ×10 | Example |
|--------|---------------|--------------|---------|
| **O(1)** | Constant | Cost stays about the same | hash lookup, `$arr[$i]` |
| **O(log n)** | Logarithmic | A bit more (not 10×) | binary search on sorted data |
| **O(n)** | Linear | ≈ 10× | one `foreach` over a list |
| **O(n log n)** | Quasi-linear | A bit more than 10× | mergesort / average quicksort |
| **O(n²)** | Quadratic | ≈ 100× | nested loops over the same set |
| **O(2ⁿ)** | Exponential | Catastrophe | subsets without memoization |

Typical order from better to worse (for time):

```
O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(2ⁿ)
```

---

## Important points people miss

1. **It hides constants**  
   `O(2n)` and `O(100n)` are both **O(n)**. Great for comparing algorithms; for “this API is slow right now,” constants sometimes matter.

2. **Worst case is the default**  
   When people say Big O, they usually mean **worst case** (unless they say average).

3. **Time ≠ memory**  
   You can trade time for memory: e.g. duplicates with a `seen` set → **O(n) time + O(n) memory**.

4. **I/O is often more expensive than CPU**  
   N+1 queries = **O(n) network requests**; even if each query is “fast,” scalability dies.

---

## PHP examples

### O(1) — direct access

```php
$user = $usersById[$id] ?? null;
```

If `$usersById` is a map/hash, one lookup is roughly constant (average).

### O(n) — linear scan

```php
function findByEmail(array $users, string $email): ?array {
    foreach ($users as $user) {
        if ($user['email'] === $email) return $user;
    }
    return null;
}
```

Worst case you scan everyone → linear.  
If you call this often, build an index: `email → user` → each lookup **O(1)**.

### O(n²) — antipattern: pairwise compare

```php
function hasDuplicateNaive(array $ids): bool {
    $n = count($ids);
    for ($i = 0; $i < $n; $i++) {
        for ($j = $i + 1; $j < $n; $j++) {
            if ($ids[$i] === $ids[$j]) return true;
        }
    }
    return false;
}
```

Comparisons ≈ `n(n-1)/2` → **O(n²)**.  
For `n = 10_000`, that’s about 50 million comparisons.

### O(n) time, O(n) memory — better

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

One pass + memory for a set. Classic trade-off: **more memory, much less time**.

---

## Trade-offs / antipatterns

- Saying “Eloquent is slow” without Big O is vague.  
  Sometimes it isn’t the ORM — e.g. **N+1** means one query per row → network cost **O(n)**.
- Micro-optimizing an inner loop when the algorithm is **O(n²)** is usually the wrong priority.
- “Fast on 10 rows” ≠ “stays fast on 10 million.”

---

## Decision rule

1. First look at **algorithm complexity + I/O** (how many queries? how many full dataset scans?).  
2. Only then micro-optimize if needed (local cache, fewer allocations, …).

---

## Quick practice

For each, what’s the approximate time?

1. Find max in an unsorted array  
2. Search a sorted array with binary search  
3. Nested loops over two separate arrays of length `n` and `m`  
4. `isset($map[$key])` in PHP  
5. All subsets of an `n`-element set

::: tip Answers
1. **O(n)** · 2. **O(log n)** · 3. **O(n·m)** · 4. **O(1)** average · 5. **O(2ⁿ)**
:::

</div>

<div class="doc-lang doc-lang--fa" dir="rtl" lang="fa">

# نماد Big O — درس ۱ {#farsi}

## چیست و چرا؟

**Big O** رشدِ هزینهٔ الگوریتم (زمان یا حافظه) را نسبت به **اندازهٔ ورودی `n`** توصیف می‌کند — نه اینکه روی لپ‌تاپ شما چند میلی‌ثانیه طول بکشد.

| نگاه | سؤال |
|------|------|
| زمان مطلق | «این تابع روی مک من چقدر طول می‌کشد؟» |
| Big O | «اگر `n` ده برابر شود، هزینه تقریباً چند برابر می‌شود؟» |

در مصاحبه و طراحی سیستم، Big O زبان مشترک است: «با ۱۰× ترافیک، DB/CPU/هزینه چند برابر می‌شود؟»

---

## مدل ذهنی

فرض کن `n` = تعداد آیتم‌ها (کاربرها، ردیف‌ها، کلیدها).

| نماد | معنی تقریبی | وقتی `n` ×۱۰ شود | مثال |
|------|-------------|------------------|------|
| **O(1)** | ثابت | هزینه تقریباً همان | hash lookup، `$arr[$i]` |
| **O(log n)** | لگاریتمی | کمی بیشتر (نه ۱۰×) | binary search روی دادهٔ مرتب |
| **O(n)** | خطی | ≈ ۱۰× | یک `foreach` روی لیست |
| **O(n log n)** | تقریباً خطی‌تر | کمی بیشتر از ۱۰× | mergesort / متوسط quicksort |
| **O(n²)** | درجه دو | ≈ ۱۰۰× | دو حلقه تو در تو روی همان مجموعه |
| **O(2ⁿ)** | نمایی | فاجعه | زیرمجموعه‌ها بدون memo |

ترتیب از خوب به بد (برای زمان، معمولاً):

```
O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(2ⁿ)
```

---

## چند نکتهٔ مهم که اغلب جا می‌افتد

1. **ثابت‌ها را پنهان می‌کند**  
   `O(2n)` و `O(100n)` هر دو **O(n)** هستند. برای مقایسهٔ الگوریتم‌ها خوب است؛ برای «این API الان کند است» گاهی ثابت‌ها مهم‌اند.

2. **بدترین حالت رایج است**  
   وقتی می‌گویند Big O، معمولاً **worst case** منظور است (مگر بگویند average).

3. **زمان ≠ حافظه**  
   می‌توانی زمان را با حافظه عوض کنی: مثلاً duplicate با `seen` → **O(n) زمان + O(n) حافظه**.

4. **I/O اغلب از CPU گران‌تر است**  
   N+1 query = **O(n) درخواست شبکه**؛ حتی اگر هر query «سریع» باشد، مقیاس‌پذیری می‌سوزد.

---

## مثال‌های PHP

### O(1) — دسترسی مستقیم

```php
$user = $usersById[$id] ?? null;
```

اگر `$usersById` یک map/hash باشد، یک lookup تقریباً ثابت است (متوسط).

### O(n) — اسکن خطی

```php
function findByEmail(array $users, string $email): ?array {
    foreach ($users as $user) {
        if ($user['email'] === $email) return $user;
    }
    return null;
}
```

در بدترین حالت همه را می‌بینی → خطی.  
اگر این را زیاد صدا بزنی، بهتر است ایندکس بسازی: `email → user` → هر lookup **O(1)**.

### O(n²) — ضدالگو: مقایسهٔ جفت‌ها

```php
function hasDuplicateNaive(array $ids): bool {
    $n = count($ids);
    for ($i = 0; $i < $n; $i++) {
        for ($j = $i + 1; $j < $n; $j++) {
            if ($ids[$i] === $ids[$j]) return true;
        }
    }
    return false;
}
```

تعداد مقایسه‌ها ≈ `n(n-1)/2` → **O(n²)**.  
برای `n = 10_000` یعنی حدود ۵۰ میلیون مقایسه.

### O(n) زمان، O(n) حافظه — بهتر

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

یک بار عبور + حافظه برای set. trade-off کلاسیک: **حافظه بیشتر، زمان خیلی کمتر**.

---

## Trade-off / ضدالگو

- گفتن «eloquent کند است» بدون Big O → مبهم است.  
  گاهی مشکل ORM نیست؛ مثلاً **N+1** یعنی برای هر ردیف یک query → هزینهٔ شبکه **O(n)**.
- micro-optimize کردن حلقهٔ داخلی وقتی الگوریتم **O(n²)** است → معمولاً اشتباه اولویت است.
- «روی ۱۰ رکورد سریع است» ≠ «روی ۱۰ میلیون هم سریع می‌ماند».

---

## قانون تصمیم

1. اول **پیچیدگی الگوریتم + I/O** را ببین (چند query؟ چند بار کل دیتاست را می‌خوانی؟).  
2. بعد اگر لازم بود، micro-optimize کن (cache محلی، کمتر allocate، …).

---

## تمرین سریع

برای هر کدام بگو زمان تقریباً چیست:

1. پیدا کردن max در یک آرایهٔ نامرتب  
2. جستجو در آرایهٔ مرتب با binary search  
3. دو حلقهٔ تو در تو روی دو آرایهٔ جدا با طول `n` و `m`  
4. `isset($map[$key])` در PHP  
5. همهٔ زیرمجموعه‌های یک مجموعهٔ `n` عضوی

::: tip جواب‌ها
1. **O(n)** · 2. **O(log n)** · 3. **O(n·m)** · 4. **O(1)** متوسط · 5. **O(2ⁿ)**
:::

</div>
