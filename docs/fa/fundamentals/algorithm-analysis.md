# تحلیل Algorithm و Time Complexity

> مبانی و Algorithm · مستند + پرسش و پاسخ · [فهرست همهٔ سؤال‌ها](/fa/interview/)

این صفحه نسخهٔ عمیق و کاربردی [نماد Big O](/fa/fundamentals/big-o) است: آن‌جا تعریف‌ها را می‌خوانی، این‌جا یاد می‌گیری Complexity را از روی کد بخوانی، آن را به «ثانیه» ترجمه کنی و در کد production تشخیصش بدهی. هر کلاس Complexity یک تشبیه روزمره دارد تا در ذهن بماند.

## چرا اصلاً تحلیل کنیم؟ <Badge type="danger" text="حیاتی" /> {#why}

یک داستان واقعی که تقریباً هر تیم backend یک‌بار تجربه‌اش می‌کند: endpoint گزارش سفارش‌ها باید سفارش کاربران مسدود را حذف کند.

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

| زمان | سفارش‌ها (`n`) | مسدودها (`m`) | نسخهٔ `in_array` | نسخهٔ `isset` |
| --- | --- | --- | --- | --- |
| روز Release | ۱٬۰۰۰ | ۵۰۰ | حداکثر ۵×۱۰⁵ مقایسه ≈ زیر ۱ ms | ۱٬۵۰۰ عمل |
| یک سال بعد | ۱٬۰۰۰٬۰۰۰ | ۵۰٬۰۰۰ | حداکثر ۵×۱۰¹⁰ مقایسه ≈ ده‌ها ثانیه تا چند دقیقه → timeout | ۱٫۰۵×۱۰⁶ عمل ≈ چند ms |

کد عوض نشده، تست‌ها سبز بوده‌اند، code review هم رد شده؛ فقط **داده بزرگ شده**. تحلیل Algorithm یعنی همین را *قبل از* حادثه ببینی: «اگر ورودی ۱۰۰۰ برابر شود، هزینه چند برابر می‌شود؟»

### چه چیزی را می‌شماریم؟

ثانیه را نمی‌شماریم؛ **تعداد عمل‌های پایه** را به‌صورت تابعی از اندازهٔ ورودی `n` می‌شماریم. مدل مرجع **RAM model** است: یک ماشین فرضی که در آن هر عمل ساده (جمع، مقایسه، انتساب، خواندن یک خانهٔ حافظه با Index، پرش) یک واحد زمان می‌برد و حافظه نامحدود است.

| سؤال | جواب در تحلیل Algorithm |
| --- | --- |
| `n` چیست؟ | اندازهٔ ورودی: تعداد عناصر، طول String، تعداد ردیف جدول، تعداد Vertex و Edge |
| واحد هزینه؟ | عمل پایه؛ در سیستم واقعی اغلب «مقایسه»، «خواندن page از دیسک» یا «round-trip شبکه» |
| خروجی تحلیل؟ | یک تابع رشد مثل `3n² + 2n` که سادهٔ آن `O(n²)` است |

### چرا benchmark به‌تنهایی گمراه می‌کند؟

- **به اندازهٔ داده وابسته است:** benchmark روی ۱٬۰۰۰ ردیف دربارهٔ ۱۰ میلیون ردیف چیزی نمی‌گوید؛ دو Algorithm `O(n)` و `O(n²)` روی دادهٔ کوچک هم‌سرعت دیده می‌شوند.
- **به ماشین وابسته است:** CPU، cache، نسخهٔ runtime، JIT و GC عدد را عوض می‌کنند؛ شکل رشد را نه.
- **به شکل داده وابسته است:** دادهٔ تست معمولاً «خوش‌رفتار» است؛ Worst Case در production پیدا می‌شود (دادهٔ مرتب برای quicksort ساده، collision عمدی برای hash).

نتیجه: تحلیل می‌گوید **شکل منحنی** چیست؛ benchmark می‌گوید **ضریب ثابت** چقدر است. به هر دو نیاز داری، به همین ترتیب.

## نمودار تعاملی رشد <Badge type="danger" text="حیاتی" /> {#chart}

نمودار زیر منحنی رشد `O(1)`، `O(log n)`، `O(n)`، `O(n log n)`، `O(n²)`، `O(2ⁿ)` و `O(n!)` را رسم می‌کند. اسلایدر بازه را بکش تا ببینی `2ⁿ` و `n!` چطور در همان چند واحد اول از صفحه بیرون می‌زنند و بقیه را به خط صاف تبدیل می‌کنند. بعد در جدول زیر نمودار `n = 1,000,000` را انتخاب کن و تعداد عمل و زمان تقریبی هر کلاس را (با حدود ۱۰⁹ عمل ساده در ثانیه) کنار هم ببین.

<ComplexityChart />

## واقعاً چقدر طول می‌کشد؟ <Badge type="danger" text="حیاتی" /> {#how-long}

فرض: ۱۰⁹ عمل ساده در ثانیه (یک هستهٔ CPU امروزی، کد compile‌شده، بدون I/O). این جدول را یک‌بار با دقت بخوان؛ همان چیزی است که باید در ذهن بماند.

| Complexity | n = 10 | n = 100 | n = 1 000 | n = 10⁶ | n = 10⁹ |
| --- | --- | --- | --- | --- | --- |
| `O(1)` | 1 ns | 1 ns | 1 ns | 1 ns | 1 ns |
| `O(log n)` | 3 ns | 7 ns | 10 ns | 20 ns | 30 ns |
| `O(√n)` | 3 ns | 10 ns | 32 ns | 1 µs | 32 µs |
| `O(n)` | 10 ns | 100 ns | 1 µs | 1 ms | 1 s |
| `O(n log n)` | 33 ns | 0.66 µs | 10 µs | 20 ms | 30 s |
| `O(n²)` | 100 ns | 10 µs | 1 ms | 16.7 min | 31.7 سال |
| `O(n³)` | 1 µs | 1 ms | 1 s | 31.7 سال | 3.2×10¹⁰ سال |
| `O(2ⁿ)` | 1 µs | 4×10¹³ سال | ≈10²⁸⁴ سال | — | — |
| `O(n!)` | 3.6 ms | ≈10¹⁴¹ سال | — | — | — |

چند عدد برای حفظ‌کردن:

- `log₂(10⁶) ≈ 20` و `log₂(10⁹) ≈ 30`. یعنی binary search روی یک میلیارد عنصر فقط ۳۰ مقایسه است.
- `n²` با `n = 10⁶` یعنی ۱۰¹² عمل ≈ ۱۶٫۷ دقیقه؛ `n log n` با همان `n` یعنی ۲×۱۰⁷ عمل ≈ ۲۰ ms. تفاوت «Sorting درست» و «دو حلقهٔ تو در تو» همین پنجاه‌هزار برابر است.
- سن کیهان حدود ۱٫۴×۱۰¹⁰ سال است؛ `2¹⁰⁰` عمل حدود ۳۰۰۰ برابر آن طول می‌کشد.
- `20! ≈ 2.4×10¹⁸` یعنی حدود ۷۷ سال؛ brute force جایگشتی بالاتر از حدود `n = 12` عملاً تعطیل است (`12!` حدود نیم ثانیه، `15!` حدود ۲۲ دقیقه).

## کلاس‌های Complexity، یکی‌یکی <Badge type="danger" text="حیاتی" /> {#classes}

### O(1) — ثابت: کمد شماره‌دار

**تعریف:** هزینه به اندازهٔ ورودی بستگی ندارد.

**تشبیه:** کلید کمد شمارهٔ ۴۲ باشگاه دستت است؛ مستقیم سراغ همان کمد می‌روی، چه باشگاه ۵۰ کمد داشته باشد چه ۵۰ هزار.

```go
price := prices["sku-42"]   // one hash + one bucket probe, whatever len(prices) is
last := items[len(items)-1] // index arithmetic: base address + i*size
```

**در backend:** lookup در `map` زبان Go یا PHP Array با کلید، `GET` در Redis، خواندن `len(slice)`. دقت کن: O(1) یعنی «ثابت»، نه «سریع»؛ یک `bcrypt` با cost بالا هم O(1) است و ۲۰۰ ms طول می‌کشد.

### O(log n) — لگاریتمی: دیکشنری کاغذی

**تعریف:** با هر گام، بخش ثابتی از مسئله (معمولاً نصف) حذف می‌شود.

**تشبیه:** بازی حدس عدد بین ۱ تا ۱۰۰۰ با جواب «بالاتر/پایین‌تر»: با حدس‌زدن وسط، حداکثر ۱۰ حدس کافی است. یا پیداکردن یک واژه در دیکشنری کاغذی: وسط را باز می‌کنی و نصف کتاب را کنار می‌گذاری.

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

**در backend:** lookup با B-tree Index در PostgreSQL/MySQL (جدول ۱۰۰ میلیون ردیفی معمولاً فقط ۳ تا ۴ سطح Depth دارد، چون هر node صدها کلید نگه می‌دارد)، `ZADD`/`ZRANK` در Redis (skip list)، push/pop در heap و priority queue.

### O(√n) — ریشهٔ دوم: فقط تا نیمهٔ راه

**تعریف:** حلقه تا `√n` جلو می‌رود. بین `log n` و `n` قرار دارد: برای `n = 10⁶` فقط ۱۰۰۰ گام.

**تشبیه:** برای پیداکردن مقسوم‌علیه‌های یک عدد لازم نیست تا خودش بشماری؛ مقسوم‌علیه‌ها جفت‌جفت‌اند و یکی از هر جفت حتماً از `√n` کوچک‌تر یا مساوی آن است.

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

**در backend:** کمتر دیده می‌شود؛ بیشتر در مسائل عددی و تکنیک sqrt decomposition (تقسیم Array به بلوک‌های `√n` تایی).

### O(n) — خطی: خواندن لیست حضور و غیاب

**تعریف:** هر عنصر به تعداد ثابتی بار دیده می‌شود.

**تشبیه:** دنبال یک اسم در لیست حضور و غیابِ نامرتب می‌گردی؛ در Worst Case باید تا آخر لیست بخوانی. لیست دو برابر شود، کار دو برابر می‌شود.

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

**در backend:** full table scan وقتی ستون شرط Index ندارد:

```sql
EXPLAIN SELECT * FROM orders WHERE customer_email = 'a@example.com';
-- Seq Scan on orders  (no index on customer_email: every row is read)
```

همچنین `in_array` در PHP، `slices.Contains` در Go، `KEYS *` در Redis و `COUNT(*)` در PostgreSQL. O(n) برای یک‌بار اجرا خوب است؛ فاجعه وقتی است که *داخل یک حلقهٔ دیگر* قرار بگیرد.

### O(n log n) — خطی‌لگاریتمی: مرتب‌کردن برگه‌های امتحان

**تعریف:** `log n` مرحله، و در هر مرحله کاری خطی روی کل داده.

**تشبیه:** ۶۴ برگهٔ امتحان را به ترتیب نمره مرتب می‌کنی: اول جفت‌های مرتب می‌سازی، بعد دسته‌های مرتب را دوتا دوتا ادغام می‌کنی (۲تایی، ۴تایی، ۸تایی …). ۶ دور ادغام لازم است (`log₂ 64 = 6`) و در هر دور همهٔ ۶۴ برگه یک‌بار دست می‌خورند.

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

**در backend:** `ORDER BY` روی ستونی که Index مناسب ندارد، `sort()` در PHP، ساخت B-tree Index، merge join وقتی ورودی‌ها مرتب نیستند. قاعدهٔ سرانگشتی: `n log n` «تقریباً خطی» است و تا چند ده میلیون عنصر در حافظه مشکلی ندارد.

### O(n²) — درجهٔ دو: دست‌دادن همه با همه

**تعریف:** برای هر عنصر، روی (تقریباً) همهٔ عناصر دیگر کار می‌کنی.

**تشبیه:** در یک مهمانی همه با همه دست می‌دهند: ۱۰ نفر ۴۵ دست‌دادن، ۱۰۰ نفر ۴٬۹۵۰، ۱۰۰۰ نفر ۴۹۹٬۵۰۰. مهمان ده برابر، دست‌دادن صد برابر.

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

**در backend:** nested loop join بدون Index، `in_array` یا `array_search` داخل `foreach`، `array_merge` یا الحاق String داخل حلقه، حذف duplicate با مقایسهٔ جفتی. این کلاس خطرناک‌ترین است چون تا `n ≈ 5000` هیچ‌کس متوجهش نمی‌شود.

### O(n³) — مکعبی: سه حلقهٔ تو در تو

**تعریف:** سه حلقهٔ تو در تو روی همان ورودی. با `n = 500` حدود ۱٫۲۵×۱۰⁸ عمل است (قابل‌قبول)؛ با `n = 10⁴` به ۱۰¹² می‌رسد.

**تشبیه:** برای هر جفت شهر، همهٔ شهرهای میانی را امتحان می‌کنی تا ببینی مسیر از راه آن کوتاه‌تر می‌شود یا نه.

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

**در backend:** ضرب ماتریس ساده، Floyd–Warshall، و سه `foreach` تو در تو روی سه مجموعه‌ای که «فعلاً کوچک‌اند».

### O(2ⁿ) — نمایی: همهٔ ترکیب‌های کلیدها

**تعریف:** هر عنصر دو حالت دارد (هست/نیست) و همهٔ ترکیب‌ها بررسی می‌شوند. اضافه‌شدن **یک** عنصر، کار را **دو برابر** می‌کند.

**تشبیه:** پیتزا با ۱۰ نوع تاپینگ اختیاری ۱٬۰۲۴ ترکیب دارد؛ با ۲۰ نوع بیش از یک میلیون و با ۳۰ نوع بیش از یک میلیارد. یا تابلویی با `n` کلید برق که باید همهٔ حالت‌های روشن/خاموش را امتحان کنی.

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

**در backend:** تست همهٔ ترکیب‌های feature flag (با ۲۰ flag بیش از یک میلیون اجرا)، فیبوناچی Recursive بدون memo، subset sum و knapsack با brute force، regex با backtracking فاجعه‌بار (ReDoS).

### O(n!) — فاکتوریل: پیک و همهٔ ترتیب‌های تحویل

**تعریف:** همهٔ ترتیب‌های ممکن `n` عنصر بررسی می‌شوند.

**تشبیه:** پیک موتوری با ۱۰ بسته می‌خواهد کوتاه‌ترین مسیر را با امتحان همهٔ ترتیب‌ها پیدا کند: ۳٬۶۲۸٬۸۰۰ مسیر. با ۱۵ بسته حدود ۱٫۳×۱۰¹² و با ۲۰ بسته ۲٫۴×۱۰¹⁸ مسیر.

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

**در backend:** TSP با brute force، امتحان همهٔ ترتیب‌های join (به همین دلیل query plannerها از یک آستانه به بعد جست‌وجوی کامل را کنار می‌گذارند و سراغ روش‌های heuristic می‌روند؛ در PostgreSQL پارامتر `geqo_threshold`)، امتحان همهٔ ترتیب‌های اجرای چند job.

### چند متغیره: O(n + m)، O(n·m)، O(V + E)

همهٔ ورودی‌ها یک `n` نیستند. متغیرها را جدا نگه دار؛ ادغام‌کردنشان در یک `n` اطلاعات را دور می‌ریزد.

| نماد | یعنی | مثال |
| --- | --- | --- |
| `O(n + m)` | هر ورودی جداگانه یک‌بار Traverse می‌شود | ادغام دو لیست مرتب، hash join، ساخت set از `m` و lookup برای `n` |
| `O(n·m)` | برای هر عنصر اولی، کل دومی | nested loop join، `in_array` روی لیست `m`تایی داخل حلقهٔ `n`تایی، مقایسهٔ دو String با DP |
| `O(V + E)` | هر Vertex و هر Edge یک‌بار | BFS و DFS روی Graph با adjacency list |
| `O(E log V)` | هر Edge یک عمل روی heap | Dijkstra با binary heap |
| `O(n·k)` | `n` عنصر، هرکدام هزینهٔ `k` | hash‌کردن `n` String با طول `k`، `n` کاربر با `k` نقش |

`O(V + E)` بسته به تراکم Graph فرق می‌کند: در Graph تُنُک `E ≈ V` است و هزینه خطی می‌شود؛ در Graph کامل `E ≈ V²`.

## Best، Average، Worst Case و O / Θ / Ω <Badge type="danger" text="حیاتی" /> {#cases}

دو محور **مستقل** داریم که دائماً با هم قاطی می‌شوند:

1. **کدام ورودی؟** Best Case، Average Case، Worst Case. هرکدام یک *تابع* جدا از `n` است.
2. **چه نوع کرانی روی آن تابع؟** `O` کران بالا، `Ω` کران پایین، `Θ` کران تنگ (هر دو).

| Algorithm | Best Case | Average Case | Worst Case |
| --- | --- | --- | --- |
| Linear Search | `Θ(1)` — عنصر اول است | `Θ(n)` — حدود `n/2` مقایسه | `Θ(n)` — آخر است یا نیست |
| Quicksort (pivot ثابت) | `Θ(n log n)` | `Θ(n log n)` | `Θ(n²)` — ورودی مرتب |
| Merge sort | `Θ(n log n)` | `Θ(n log n)` | `Θ(n log n)` |
| Insertion sort | `Θ(n)` — ورودی مرتب | `Θ(n²)` | `Θ(n²)` — ورودی معکوس |
| lookup در hash table | `Θ(1)` | `Θ(1)` | `Θ(n)` — همه در یک bucket |

هر خانهٔ جدول را می‌شود با هر سه نماد توصیف کرد. همهٔ این جمله‌ها دربارهٔ Linear Search درست‌اند:

- Worst Caseاش `O(n)` است، `Ω(n)` هم هست، پس `Θ(n)` است.
- Best Caseاش `Θ(1)` است.
- خود Algorithm (روی همهٔ ورودی‌ها) `O(n)` و `Ω(1)` است؛ `Θ` واحدی برای «کل Algorithm» ندارد، چون Best و Worst Caseاش هم‌مرتبه نیستند.
- Worst Caseاش `O(n²)` هم هست. درست است ولی بی‌فایده، چون کران تنگ نیست.

::: warning سوءبرداشت رایج
«Big-O یعنی Worst Case» **غلط** است. Big-O یک کران بالا روی یک تابع است و آن تابع می‌تواند هزینهٔ Best، Average یا Worst Case باشد. عرف صنعت این است که وقتی حالتی را نام نمی‌بری، منظور Worst Case است و به‌جای `Θ` می‌گویند `O`؛ این یک قرارداد گفتاری است، نه تعریف.
:::

کدام حالت در عمل مهم است؟

| وضعیت | حالت مهم |
| --- | --- |
| سیستم با SLA و p99، ورودی از کاربر یا مهاجم | Worst Case |
| پردازش batch با دادهٔ تصادفی و حجم بالا | Average Case |
| عملیات تکراری روی یک Data Structure (append، resize) | amortized |
| Best Case | تقریباً هیچ‌وقت؛ فقط برای شناخت ورودی‌های خوش‌رفتار (insertion sort روی دادهٔ تقریباً مرتب) |

## خواندن Complexity از روی کد <Badge type="danger" text="حیاتی" /> {#reading-code}

### قاعده‌های پایه

| ساختار کد | قاعده | نتیجه |
| --- | --- | --- |
| دستورهای پشت‌سرهم | جمع می‌شوند؛ بزرگ‌ترین غالب است | `O(n) + O(n²) = O(n²)` |
| حلقه | تعداد تکرار × هزینهٔ بدنه | حلقهٔ `n`تایی با بدنهٔ `O(1)` می‌شود `O(n)` |
| حلقهٔ تو در تو | ضرب می‌شوند | `n × m` |
| شرط `if/else` | شاخهٔ گران‌تر | `max` دو شاخه |
| فراخوانی تابع | هزینهٔ خود تابع را حساب کن | `in_array` داخل حلقه یعنی `O(n·m)` |
| حلقه‌ای که نصف/دو برابر می‌کند | `log n` تکرار | `O(log n)` |

دام همیشگی: **هزینهٔ پنهان فراخوانی‌ها**. یک خط `if (in_array(...))` یا `strings.Contains(...)` یا `list.index(x)` خودش یک حلقه است.

### حلقه‌ها: بشمار، حدس نزن

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

سه مجموع که همه‌جا تکرار می‌شوند:

| مجموع | مقدار | Order |
| --- | --- | --- |
| `1 + 2 + 3 + … + n` | `n(n+1)/2` | `O(n²)` |
| `1 + 2 + 4 + … + n` (هندسی) | کمتر از `2n` | `O(n)` |
| `1 + 1/2 + 1/3 + … + 1/n` (هارمونیک) | حدود `ln n` | `O(log n)` |

### Two Pointers: تو در تو به نظر می‌رسد، ولی O(n) است

تعداد حلقه‌های تو در تو را نشمار؛ بشمار که **هر متغیر در کل چند بار حرکت می‌کند**.

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

با فرض عناصر نامنفی، `right` دقیقاً `n` بار و `left` حداکثر `n` بار جلو می‌رود و هیچ‌کدام عقب برنمی‌گردند؛ پس مجموع کار حداکثر `2n` است: `O(n)`. همین استدلال برای sliding window، ادغام دو لیست مرتب و Algorithmهای مبتنی بر stack یکنوا (هر عنصر یک‌بار push و یک‌بار pop) کار می‌کند.

### Recursion و Recurrence Relation

برای تابع Recursive یک رابطه می‌نویسی: `T(n) = (تعداد فراخوانی‌ها) × T(اندازهٔ زیرمسئله) + کار غیربازگشتی`.

| رابطه | جواب | مثال |
| --- | --- | --- |
| `T(n) = T(n-1) + 1` | `O(n)` | فاکتوریل Recursive، Recursive linked list Traversal |
| `T(n) = T(n-1) + n` | `O(n²)` | Worst Case quicksort، Recursive selection sort |
| `T(n) = T(n/2) + 1` | `O(log n)` | binary search |
| `T(n) = T(n/2) + n` | `O(n)` | quickselect در Average Case |
| `T(n) = 2T(n/2) + 1` | `O(n)` | Balanced Binary Tree Traversal |
| `T(n) = 2T(n/2) + n` | `O(n log n)` | merge sort |
| `T(n) = 2T(n-1) + 1` | `O(2ⁿ)` | برج هانوی |
| `T(n) = T(n-1) + T(n-2) + 1` | `O(φⁿ) ≈ O(1.618ⁿ)` | فیبوناچی Recursive خام |

### شهود Recursion Tree

Tree فراخوانی‌ها را بکش، کار هر سطح را حساب کن و سطح‌ها را جمع بزن.

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

تفاوت کلیدی: وقتی زیرمسئله **تقسیم** می‌شود (`n/2`) Tree Depth `log n` است؛ وقتی فقط **یکی کم** می‌شود (`n-1`) Depth `n` است. شاخه‌شدن با Depth `n` یعنی نمایی.

### Master Theorem <Badge type="warning" text="مهم" />

برای رابطه‌هایی به شکل `T(n) = a·T(n/b) + f(n)` با `a ≥ 1` و `b > 1`: مقدار بحرانی `n^(log_b a)` است (تعداد Leafهای Recursion Tree). `f(n)` را با آن مقایسه کن:

| حالت | شرط | جواب | شهود |
| --- | --- | --- | --- |
| ۱ | `f(n)` چندجمله‌ای **کوچک‌تر** از `n^(log_b a)` | `Θ(n^(log_b a))` | Leafها غالب‌اند |
| ۲ | `f(n)` **هم‌مرتبهٔ** `n^(log_b a)` | `Θ(n^(log_b a) · log n)` | همهٔ سطح‌ها هم‌وزن‌اند |
| ۳ | `f(n)` چندجمله‌ای **بزرگ‌تر** (و شرط نظم برقرار) | `Θ(f(n))` | Root غالب است |

| رابطه | `a`، `b` | `n^(log_b a)` | `f(n)` | حالت | جواب |
| --- | --- | --- | --- | --- | --- |
| `T(n) = T(n/2) + 1` (binary search) | ۱، ۲ | `n⁰ = 1` | `1` | ۲ | `Θ(log n)` |
| `T(n) = 2T(n/2) + n` (merge sort) | ۲، ۲ | `n` | `n` | ۲ | `Θ(n log n)` |
| `T(n) = 3T(n/2) + n` (ضرب Karatsuba) | ۳، ۲ | `n^1.585` | `n` | ۱ | `Θ(n^1.585)` |
| `T(n) = 4T(n/2) + n` | ۴، ۲ | `n²` | `n` | ۱ | `Θ(n²)` |
| `T(n) = 2T(n/2) + n²` | ۲، ۲ | `n` | `n²` | ۳ | `Θ(n²)` |
| `T(n) = T(n/2) + n` (quickselect ایده‌آل) | ۱، ۲ | `1` | `n` | ۳ | `Θ(n)` |

Master Theorem برای رابطه‌های «کم‌شونده» مثل `T(n) = T(n-1) + n` یا تقسیم نامساوی کاربرد ندارد؛ آن‌جا Recursion Tree را بکش.

### ثابت‌ها را دور بریز — و وقتی که نباید

`O(3n² + 2n + 1000) = O(n²)`: ضریب و جمله‌های Order پایین‌تر برای `n` بزرگ اثری روی *شکل* رشد ندارند. ولی در این موارد ثابت‌ها تعیین‌کننده‌اند:

| وضعیت | چرا ثابت مهم است |
| --- | --- |
| `n` کوچک و ثابت است | برای `n ≤ 20` Algorithm `n²` با ثابت کوچک از `n log n` با ثابت بزرگ سریع‌تر است |
| دو گزینهٔ هم‌مرتبه | دو Algorithm `O(n)` می‌توانند ۱۰ برابر اختلاف داشته باشند (یک pass در برابر پنج pass، allocation در برابر in-place) |
| «عمل پایه» گران است | `n` DB Query در برابر `n` مقایسهٔ عدد صحیح: هر دو `O(n)`، با اختلاف ۱۰⁵ برابر |
| مسیر داغ (hot path) | در کدی که میلیون‌ها بار در ثانیه اجرا می‌شود، ۲ برابر یعنی نصف Serverها |

## تحلیل Amortized <Badge type="warning" text="مهم" /> {#amortized}

**تعریف:** هزینهٔ *میانگین هر عمل در یک دنبالهٔ طولانی از عمل‌ها*، در Worst Case. بعضی عمل‌ها گران‌اند ولی آن‌قدر کم پیش می‌آیند که وقتی هزینه‌شان بین همهٔ عمل‌ها پخش شود، سهم هرکدام ثابت می‌ماند.

**تشبیه:** کارت مترو را ماهی یک‌بار شارژ می‌کنی (گران) و هر روز فقط کارت می‌زنی (ارزان)؛ هزینهٔ هر سفر با سرشکن‌کردن شارژ همچنان ثابت است.

### Dynamic Array با دو برابرشدن

```text
append #:   1  2  3  4  5  6  7  8  9 ...
capacity:   1  2  4  4  8  8  8  8 16
copy cost:  0  1  2  0  4  0  0  0  8
total copies after n appends = 1 + 2 + 4 + ... < 2n   ->  O(1) amortized per append
```

**استدلال حسابداری (accounting):** برای هر `append` سه سکه بگیر. یک سکه خرج نوشتن همان عنصر می‌شود و دو سکه پس‌انداز. وقتی Array با ظرفیت `k` پر شد و باید `k` عنصر کپی شود، `k/2` عنصری که بعد از resize قبلی اضافه شده‌اند هرکدام دو سکه پس‌انداز دارند: مجموعاً `k` سکه، دقیقاً هزینهٔ کپی. پس با سه سکه برای هر عمل هیچ‌وقت بدهکار نمی‌شوی: `O(1)` Amortized.

نکتهٔ کلیدی **رشد هندسی** است. اگر ظرفیت به‌جای ضرب، هر بار به اندازهٔ ثابتی (مثلاً ۱۰ خانه) زیاد شود، مجموع کپی‌ها `10 + 20 + 30 + …` یعنی `O(n²)` می‌شود.

```go
var s []int
for i := 0; i < 1_000_000; i++ {
    s = append(s, i) // amortized O(1); a few dozen reallocations in total
}

s2 := make([]int, 0, 1_000_000) // known size: allocate once, zero reallocations
```

`append` در Go برای sliceهای کوچک ظرفیت را دو برابر می‌کند و برای sliceهای بزرگ با ضریب کوچک‌تری (حدود ۱٫۲۵) رشد می‌دهد؛ هر دو هندسی‌اند، پس Amortized `O(1)` می‌ماند. resize کردن hash table (map در Go، Array در PHP) همین منطق را دارد: rehash کل جدول `O(n)` است ولی فقط بعد از دو برابرشدن تعداد عناصر رخ می‌دهد.

### Amortized با Average Case یکی نیست

| | Amortized | Average Case |
| --- | --- | --- |
| میانگین روی چه؟ | روی دنباله‌ای از عمل‌ها | روی توزیع ورودی‌ها |
| فرض احتمالاتی؟ | ندارد؛ تضمین قطعی است | دارد؛ ورودی «تصادفی» فرض می‌شود |
| مهاجم می‌تواند خرابش کند؟ | نه | بله (ورودی بدخیم) |
| مثال | `append`، resize Hash Table، union-find | quicksort، lookup در hash table |

هشدار عملی: amortized دربارهٔ **latency تک‌عمل** چیزی نمی‌گوید. همان یک `append` که resize می‌کند `O(n)` طول می‌کشد؛ در سیستم حساس به p99 ظرفیت را از قبل رزرو کن.

## Space Complexity <Badge type="warning" text="مهم" /> {#space}

| اصطلاح | یعنی |
| --- | --- |
| فضای کمکی (auxiliary) | حافظهٔ *اضافه* بر ورودی: متغیرها، ساختارهای موقت، Recursion stack |
| فضای کل | ورودی + فضای کمکی |
| in-place | فضای کمکی `O(1)` (یا `O(log n)` برای stack) |

در مصاحبه معمولاً منظور از «space complexity» فضای کمکی است؛ اگر مطمئن نیستی، بپرس.

**Recursion stack حافظه است.** هر فراخوانی Recursive باز یک frame روی stack دارد؛ فضای مصرفی برابر **Depth** Recursion Tree است، نه تعداد کل فراخوانی‌ها.

| Algorithm | زمان | فضای کمکی | چرا |
| --- | --- | --- | --- |
| binary search حلقه‌ای | `O(log n)` | `O(1)` | فقط دو Index |
| Recursive binary search | `O(log n)` | `O(log n)` | Stack Depth |
| merge sort | `O(n log n)` | `O(n)` | Array موقت ادغام |
| quicksort in-place | `O(n log n)` متوسط | `O(log n)` متوسط، `O(n)` بدترین | Stack Depth |
| فیبوناچی Recursive خام | `O(φⁿ)` | `O(n)` | Depth `n` با وجود تعداد نمایی فراخوانی |
| DFS روی Graph | `O(V + E)` | `O(V)` | مجموعهٔ visited + stack |

### بده‌بستان زمان و حافظه

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

با `O(n)` حافظه، زمان از `O(φⁿ)` به `O(n)` می‌رسد. بده‌بستان‌های رایج:

| مسئله | گزینهٔ سریع، حافظه‌بر | گزینهٔ کم‌حافظه |
| --- | --- | --- |
| پیداکردن duplicate | hash set: زمان `O(n)`، فضا `O(n)` | In-place sort: زمان `O(n log n)`، فضا `O(1)` |
| زیرمسئله‌های تکراری | memoization یا جدول DP | محاسبهٔ مجدد (نمایی) |
| lookup مکرر | Index، cache، جدول precompute | اسکن در هر درخواست |
| پردازش فایل بزرگ | بارکردن کل فایل در حافظه | stream کردن خط‌به‌خط: فضا `O(1)` |

در backend حافظه سقف سخت دارد (`memory_limit` در PHP، محدودیت container): Algorithm `O(n)` حافظه با `n = 10⁷` ردیفِ ۱ کیلوبایتی یعنی ۱۰ گیگابایت و OOM kill.

## انواع Algorithmها <Badge type="danger" text="حیاتی" /> {#paradigms}

بیشتر مسئله‌ها با یکی از این چند Pattern حل می‌شوند. مهارت اصلی **تشخیص Pattern از روی صورت مسئله** است.

| Pattern | ایدهٔ اصلی | Complexity معمول | تشبیه | مسئله‌های کلاسیک | نشانهٔ تشخیص |
| --- | --- | --- | --- | --- | --- |
| Brute force | همهٔ حالت‌ها را امتحان کن | `O(n²)` تا `O(n!)` | امتحان همهٔ کلیدهای دسته‌کلید | Linear Search، همهٔ جفت‌ها، همهٔ جایگشت‌ها | `n` خیلی کوچک است؛ یا نقطهٔ شروع برای بهینه‌سازی |
| <span class="vip-locked" title="VIP members only">Divide & conquer <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | نصف کن، هر نیمه را حل کن، ترکیب کن | `O(n log n)` یا `O(log n)` | مرتب‌کردن برگه‌ها با ادغام دسته‌ها | merge sort، quicksort، binary search | مسئله به زیرمسئله‌های **مستقل** هم‌شکل می‌شکند |
| <span class="vip-locked" title="VIP members only">Greedy <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | در هر گام بهترین انتخاب محلی، بدون برگشت | `O(n log n)` (اغلب sort + یک pass) | پس‌دادن باقی پول با بزرگ‌ترین سکهٔ ممکن | interval scheduling، Huffman، Dijkstra، MST | انتخاب محلی بهینه به جواب کلی بهینه می‌رسد (باید ثابتش کنی) |
| <span class="vip-locked" title="VIP members only">Dynamic programming <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | جواب زیرمسئله‌های **هم‌پوشان** را ذخیره کن | `O(n)` تا `O(n²)` یا `O(n·W)` | یادداشت‌کردن جواب‌های قبلی به‌جای حل دوباره | knapsack، LCS، edit distance، coin change | «تعداد راه‌ها»، «کمترین/بیشترین» + زیرمسئلهٔ تکراری |
| Backtracking | جواب را قدم‌به‌قدم بساز؛ شاخهٔ بی‌نتیجه را هرس کن | نمایی در Worst Case، در عمل خیلی کمتر | حل سودوکو با مداد و پاک‌کن | N-Queens، سودوکو، تولید جایگشت و ترکیب | «همهٔ جواب‌های معتبر» با قیدهایی که زود نقض می‌شوند |
| Two pointers / sliding window | دو Index که فقط جلو می‌روند | `O(n)` | دو انگشت روی یک خط‌کش | جفت با مجموع مشخص در Array مرتب، بلندترین Substring بدون تکرار | Array یا String + «Subarray پیوسته» یا دادهٔ مرتب |
| Binary search روی جواب | جواب یکنواست؛ روی مقدار جواب نصف کن | `O(n log(بازه))` | پیداکردن کمترین ظرفیت کامیون با آزمون و خطای نصف‌شونده | کمترین ظرفیت برای ارسال در `D` روز، بیشینه‌کردن کمینهٔ فاصله | «کمترین `x` که شرط برقرار شود» و چک‌کردن یک `x` ارزان است |
| <span class="vip-locked" title="VIP members only">Graph Traversal <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | BFS/DFS روی Vertexها و Edgeها | `O(V + E)` | گشتن یک هزارتو: سطح‌به‌سطح یا تا ته یک مسیر | کوتاه‌ترین مسیر بی‌وزن، مؤلفه‌های همبند، topological sort | رابطه، Dependency، شبکه، grid، «از A به B می‌رسیم؟» |
| Randomized / probabilistic | تصادف برای فرار از Worst Case یا جواب تقریبی | متوسط خوب؛ یا فضای خیلی کم | نظرسنجی از نمونه به‌جای سرشماری | quicksort با pivot تصادفی، Bloom filter، HyperLogLog، reservoir sampling | داده خیلی بزرگ است و جواب تقریبی کافی است؛ یا ورودی بدخیم محتمل است |

پیش‌نیازها و ادامهٔ مسیر: <span class="vip-locked" title="VIP members only">Recursion <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>، <span class="vip-locked" title="VIP members only">Arrays <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>، <span class="vip-locked" title="VIP members only">Hash table <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>، <span class="vip-locked" title="VIP members only">Tree <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>، <span class="vip-locked" title="VIP members only">Sorting و Search <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>، <span class="vip-locked" title="VIP members only">Algorithmهای رایج <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>.

مسیر معمول بهینه‌سازی در مصاحبه: اول brute force را بگو و Complexityاش را حساب کن؛ بعد بپرس «کدام کار تکراری است؟» (→ DP یا hash)، «داده مرتب است یا می‌شود مرتبش کرد؟» (→ two pointers یا binary search)، «می‌شود نصفش کرد؟» (→ divide & conquer).

## از قیدهای مسئله به Complexity لازم <Badge type="warning" text="مهم" /> {#constraints}

با بودجهٔ حدود ۱۰⁸ عمل ساده در یک ثانیه (محافظه‌کارانه؛ برای PHP و Python بودجه را ۱۰⁷ بگیر)، اندازهٔ ورودی خودش می‌گوید چه Algorithmی لازم است:

| اندازهٔ ورودی | Complexity قابل‌قبول | Algorithm معمول |
| --- | --- | --- |
| `n ≤ 10` | `O(n!)` | همهٔ جایگشت‌ها |
| `n ≤ 20` | `O(2ⁿ)` یا `O(n·2ⁿ)` | همهٔ زیرمجموعه‌ها، bitmask DP |
| `n ≤ 500` | `O(n³)` | Floyd–Warshall، DP سه‌بعدی |
| `n ≤ 5 000` | `O(n²)` | DP دوبعدی، همهٔ جفت‌ها |
| `n ≤ 10⁶` | `O(n log n)` یا `O(n)` | sort، hash، two pointers، heap |
| `n ≤ 10⁸` | `O(n)` با ثابت کوچک | یک pass، بدون allocation |
| `n ≤ 10¹⁸` | `O(log n)` یا `O(1)` | binary search، فرمول ریاضی، توان‌رسانی سریع |

همین جدول در کار واقعی هم کاربرد دارد: «جدول ۵۰ میلیون ردیف دارد و این job هر شب اجرا می‌شود» یعنی `O(n log n)` قابل‌قبول و `O(n²)` غیرممکن است. «این تابع در هر request صدا زده می‌شود و لیست ۲۰۰ عنصر دارد» یعنی حتی `O(n²)` با ۴×۱۰⁴ عمل مشکلی ندارد.

## Complexity در سیستم‌های واقعی <Badge type="danger" text="حیاتی" /> {#production}

### Go

| عمل | Complexity | نکته |
| --- | --- | --- |
| `m[k]`، `m[k] = v`، `delete(m, k)` | `O(1)` متوسط | ترتیب map Traversal تصادفی است |
| `s[i]`، `len(s)`، `cap(s)` | `O(1)` | |
| `append(s, x)` | `O(1)` Amortized | با `make([]T, 0, n)` از resize جلوگیری کن |
| `slices.Contains`، `slices.Index` | `O(n)` | داخل حلقه یعنی `O(n²)`؛ از `map[T]struct{}` استفاده کن |
| `slices.Insert` / حذف از وسط | `O(n)` | Shift عناصر |
| `slices.Sort`، `sort.Slice` | `O(n log n)` | |
| `slices.BinarySearch`، `sort.Search` | `O(log n)` | داده باید مرتب باشد |
| `s += x` در حلقه | `O(n²)` مجموعاً | string تغییرناپذیر است؛ `strings.Builder` بده |
| `copy(dst, src)`، `[]byte(str)` | `O(n)` | تبدیل string به `[]byte` کپی می‌کند |
| `heap.Push` / `heap.Pop` | `O(log n)` | `container/heap` |

### PHP

| عمل | Complexity | نکته |
| --- | --- | --- |
| `$a[$k]`، `isset($a[$k])`، `array_key_exists` | `O(1)` متوسط | PHP Array یک hash table مرتب است |
| `$a[] = $x`، `array_push`، `array_pop` | `O(1)` Amortized | |
| `count($a)` | `O(1)` | اندازه ذخیره شده است |
| `in_array`، `array_search` | `O(n)` | داخل حلقه یعنی `O(n·m)`؛ `array_flip` + `isset` |
| `array_shift`، `array_unshift` | `O(n)` | کلیدهای عددی دوباره شماره‌گذاری می‌شوند؛ برای Queue از `SplQueue` یا head Index استفاده کن |
| `array_unique` | بین `O(n)` و `O(n log n)` بسته به flag و نسخه | `array_flip` یا استفاده از کلید، `O(n)` تضمینی است |
| `sort`، `usort`، `ksort` | `O(n log n)` | |
| `array_merge` در حلقه | `O(n²)` مجموعاً | یک‌بار `array_merge(...$chunks)` |
| `array_slice`، `array_reverse`، `array_map`، `array_filter` | `O(n)` | هرکدام یک Array جدید می‌سازند |
| `str_contains`، `strpos` | `O(n·m)` Worst Case | در عمل نزدیک به خطی |

### SQL

| عمل | Complexity | نکته |
| --- | --- | --- |
| lookup با B-tree Index | `O(log n)` | عملاً ۳ تا ۴ خواندن page |
| Seq scan (بدون Index مناسب) | `O(n)` | |
| range scan با Index | `O(log n + k)` | `k` تعداد ردیف‌های برگشتی |
| `ORDER BY` بدون Index | `O(n log n)` | با Index مناسب و `LIMIT k`: `O(log n + k)` |
| `OFFSET k` | `O(k)` | صفحهٔ ۱۰٬۰۰۰ام یعنی خواندن و دورریختن همهٔ ردیف‌های قبل؛ keyset pagination بده |
| Nested loop join بدون Index | `O(n·m)` | با Index روی جدول داخلی: `O(n log m)` |
| Hash join | `O(n + m)` | حافظه `O(min(n, m))`؛ فقط برای تساوی |
| Merge join | `O(n + m)` روی ورودی مرتب | وگرنه `O(n log n + m log m)` برای sort |
| N+1 query | `O(n)` **round-trip** | هر round-trip حدود ۰٫۵ تا ۲ ms؛ با `IN (...)` یا join به یک round-trip برسان |

### Redis

| دستور | Complexity | نکته |
| --- | --- | --- |
| `GET`، `SET`، `HGET`، `HSET`، `SADD`، `SISMEMBER`، `EXPIRE` | `O(1)` | |
| `LPUSH`، `RPUSH`، `LPOP`، `RPOP` | `O(1)` | |
| `LRANGE start stop` | `O(S + N)` | `S` فاصلهٔ شروع از نزدیک‌ترین سر لیست، `N` تعداد عناصر برگشتی |
| `LINDEX` | `O(n)` | لیست Array نیست |
| `ZADD`، `ZREM`، `ZRANK`، `ZSCORE` | `O(log n)` (`ZSCORE`: `O(1)`) | skip list + hash |
| `ZRANGE` | `O(log n + m)` | `m` تعداد برگشتی |
| `SMEMBERS`، `HGETALL` | `O(n)` | روی مجموعهٔ میلیونی، Single-threaded Redis را بلاک می‌کند؛ `SSCAN`/`HSCAN` |
| `KEYS pattern` | `O(n)` روی **کل keyspace** | هرگز در production؛ `SCAN` با cursor |
| `DEL` روی کلید بزرگ | `O(n)` | `UNLINK` حافظه را در پس‌زمینه آزاد می‌کند |
| `SINTER` | `O(n·m)` Worst Case | `n` اندازهٔ کوچک‌ترین set، `m` تعداد setها |

## جایی که Big-O به تو دروغ می‌گوید <Badge type="warning" text="مهم" /> {#lies}

Big-O رفتار را برای `n` بزرگ و در مدل RAM توصیف می‌کند. سخت‌افزار واقعی مدل RAM نیست.

| دروغ | واقعیت | مثال |
| --- | --- | --- |
| «همهٔ دسترسی‌های حافظه یک هزینه دارند» | cache miss حدود ۱۰۰ برابر cache hit است (حدود ۱۰۰ ns در برابر ۱ ns) | slice Traversal پیوسته چند برابر سریع‌تر از linked list با همان `O(n)` است |
| «ثابت‌ها مهم نیستند» | ضریب ۵۰ یعنی ۵۰ Server به‌جای یکی | hash map با `O(1)` برای ۸ عنصر از Linear Search در Array کندتر است |
| «`n log n` همیشه از `n²` بهتر است» | برای `n` کوچک برعکس است | کتابخانه‌های sort برای Subarrayهای کوچک (ده تا چند ده عنصر) به insertion sort سوییچ می‌کنند |
| «عمل پایه ارزان است» | I/O چند مرتبهٔ بزرگی گران‌تر است | یک round-trip شبکه (حدود ۱ ms) برابر یک میلیون عمل CPU است |
| «Average Case کافی است» | مهاجم Worst Case را انتخاب می‌کند | HashDoS، ReDoS، ورودی مرتب برای quicksort ساده |

ترتیب بزرگی برای مقایسه:

```text
CPU instruction / L1 cache hit      ~1 ns
main memory reference (cache miss)  ~100 ns
SSD random read                     ~100 µs      = 100 000 ns
network round-trip, same datacenter ~0.5 ms      = 500 000 ns
network round-trip, cross-region    ~50–150 ms
```

نتیجه برای backend: **اول round-tripها را بشمار، بعد عمل‌های CPU را.** حلقه‌ای با ۱۰۰ Query (`O(n)` با ثابت ۱ ms) از یک In-place sort روی ۱۰۰ هزار عنصر (`O(n log n)` با ثابت ۱ ns، حدود ۲ ms) خیلی کندتر است.

### ReDoS: زمان نمایی ناخواسته

موتورهای regex مبتنی بر backtracking (PCRE در PHP، و موتورهای پیش‌فرض JavaScript، Python و Java) روی Patternهایی با تکرار تو در تو، در ورودی‌هایی که *تقریباً* match می‌شوند، همهٔ روش‌های تقسیم String را امتحان می‌کنند: `O(2ⁿ)`.

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

در PHP ممکن است PCRE با رسیدن به سقف backtrack (`pcre.backtrack_limit`) یا سقف stack در JIT کار را رها کند و `preg_match` مقدار `false` برگرداند؛ اگر `false` را با «match نشد» یکی بگیری، validation دور زده می‌شود. قطعی سراسری Cloudflare در ژوئیهٔ ۲۰۱۹ از همین جنس بود: یک regex در قوانین WAF با backtracking شدید، CPU همهٔ edgeها را اشباع کرد.

## برگهٔ تقلب {#cheat-sheet}

| کلاس | نام | تشبیه | نمونهٔ backend | `n` ده برابر شود |
| --- | --- | --- | --- | --- |
| `O(1)` | ثابت | کمد شماره‌دار | lookup در map، `GET` در Redis | بدون تغییر |
| `O(log n)` | لگاریتمی | دیکشنری کاغذی | B-tree Index، `ZADD` | حدود ۳ گام بیشتر |
| `O(√n)` | ریشهٔ دوم | مقسوم‌علیه‌ها تا نیمهٔ راه | آزمون اول‌بودن | ۳٫۲ برابر |
| `O(n)` | خطی | لیست حضور و غیاب | seq scan، `in_array` | ۱۰ برابر |
| `O(n log n)` | خطی‌لگاریتمی | ادغام دسته‌های برگه | `ORDER BY`، sort | کمی بیش از ۱۰ برابر |
| `O(n²)` | درجهٔ دو | دست‌دادن همه با همه | nested loop، `in_array` در حلقه | ۱۰۰ برابر |
| `O(n³)` | مکعبی | هر جفت شهر از هر شهر میانی | Floyd–Warshall | ۱۰۰۰ برابر |
| `O(2ⁿ)` | نمایی | ترکیب‌های تاپینگ پیتزا | همهٔ ترکیب‌های flag، ReDoS | به توان ۱۰ |
| `O(n!)` | فاکتوریل | همهٔ ترتیب‌های تحویل پیک | TSP با brute force | غیرقابل‌تصور |

```text
O(1) < O(log n) < O(√n) < O(n) < O(n log n) < O(n²) < O(n³) < O(2ⁿ) < O(n!)
|------------- scales --------------------|-- small n only --|-- n ≤ 20 / n ≤ 10 --|
```

## قاعدهٔ تصمیم <Badge type="danger" text="حیاتی" /> {#decision}

1. **`n` را مشخص کن.** امروز چقدر است و سقف واقع‌بینانهٔ دو سال بعد چقدر؟ بدون این عدد، بحث Complexity بی‌معناست.
2. **اول I/O را بشمار.** تعداد Query و round-trip تابع `n` است؟ اگر بله، همان‌جا را درست کن (batch، join، pipeline).
3. **حلقه‌های تو در تو و فراخوانی‌های پنهان را پیدا کن.** `in_array`، `array_search`، `slices.Contains`، `array_merge` و الحاق String داخل حلقه.
4. **با جدول «چقدر طول می‌کشد» چک کن.** `n²` برای `n ≤ 5000` بی‌خطر است؛ برای `n = 10⁶` نه.
5. **Data Structure را عوض کن، نه حلقه را.** تبدیل لیست به hash set یا اضافه‌کردن Index معمولاً یک کلاس کامل پایین می‌آورد؛ micro-optimization فقط ثابت را کم می‌کند.
6. **Worst Case را برای ورودی کاربر در نظر بگیر.** هر چیزی که از بیرون می‌آید (regex، کلید hash، اندازهٔ payload) باید سقف داشته باشد.
7. **در آخر اندازه بگیر.** با دادهٔ هم‌اندازهٔ production؛ profiler و `EXPLAIN ANALYZE` ثابت‌ها را نشان می‌دهند.

## تمرین {#exercises}

Time Complexity (و در صورت امکان فضایی) هر قطعه را تعیین کن.

**۱.**

```go
for i := 0; i < n; i++ {
    for j := 0; j < 100; j++ {
        count++
    }
}
```

::: details پاسخ
`O(n)`. حلقهٔ داخلی همیشه ۱۰۰ بار اجرا می‌شود و به `n` وابسته نیست؛ `100n` همان `O(n)` است. حلقهٔ تو در تو به‌خودی‌خود به معنی `n²` نیست.
:::

**۲.**

```go
for i := n; i > 0; i /= 2 {
    for j := 0; j < i; j++ {
        count++
    }
}
```

::: details پاسخ
`O(n)`، نه `O(n log n)`. حلقهٔ داخلی `n + n/2 + n/4 + … + 1` بار اجرا می‌شود که یک سری هندسی با مجموع کمتر از `2n` است.
:::

**۳.**

```php
$result = [];
foreach ($chunks as $chunk) {
    $result = array_merge($result, $chunk);
}
```

::: details پاسخ
`O(n·k)` برای `k` تکه با مجموع `n` عنصر؛ اگر تکه‌ها کوچک باشند عملاً `O(n²)`. هر `array_merge` کل `$result` فعلی را کپی می‌کند: `s + 2s + 3s + … + ks`. راه درست `array_merge(...$chunks)` است که یک‌بار و در `O(n)` انجام می‌شود.
:::

**۴.**

```go
func f(n int) int {
    if n <= 1 {
        return 1
    }
    return f(n/2) + f(n/2)
}
```

::: details پاسخ
زمان `O(n)` و فضا `O(log n)`. رابطه `T(n) = 2T(n/2) + 1` است (حالت ۱ Master Theorem: Leafها غالب‌اند). دام: چون `n/2` دیده می‌شود خیلی‌ها می‌گویند `O(log n)`؛ ولی **دو** فراخوانی داریم. اگر نتیجهٔ `f(n/2)` یک‌بار محاسبه و دو بار استفاده شود، `O(log n)` می‌شود.
:::

**۵.**

```go
sort.Ints(a)
for _, x := range b {
    i := sort.SearchInts(a, x)
    if i < len(a) && a[i] == x {
        hits++
    }
}
```

::: details پاسخ
`O(n log n + m log n)` یعنی `O((n + m) log n)` با `n = len(a)` و `m = len(b)`. جایگزین با hash set: زمان `O(n + m)` و فضا `O(n)`.
:::

**۶.**

```go
for i := 0; i < len(s); i++ {
    for j := i; j < len(s); j++ {
        seen[s[i:j+1]] = true
    }
}
```

::: details پاسخ
زمان `O(n³)`: حدود `n²/2` Substring داریم و hash‌کردن هر کلید به طول آن (تا `n`) هزینه دارد. دام: دو حلقه دیده می‌شود ولی عمل داخل حلقه `O(1)` نیست. در Go Substringها حافظهٔ String اصلی را به اشتراک می‌گذارند، پس map حدود `O(n²)` مدخل نگه می‌دارد؛ در زبان‌هایی که Substring کپی می‌شود فضا هم `O(n³)` است.
:::

**۷.**

```php
function power(int $x, int $n): int {
    if ($n === 0) {
        return 1;
    }
    $half = power($x, intdiv($n, 2));
    return $n % 2 === 0 ? $half * $half : $half * $half * $x;
}
```

::: details پاسخ
زمان `O(log n)` و فضا `O(log n)` (Stack Depth). رابطه `T(n) = T(n/2) + 1` است، چون نتیجهٔ نیمه یک‌بار محاسبه و دو بار استفاده می‌شود؛ آن را با تمرین ۴ مقایسه کن.
:::

## پرسش و پاسخ {#qa}

<QaControls />

### س۱ — Time Complexity چیست و چرا به‌جای ثانیه، «تعداد عمل» را می‌شماریم؟ <Badge type="danger" text="حیاتی" /> {#q-1}

::: details پاسخ {open}
**پاسخ:** Time Complexity تابعی است که می‌گوید تعداد عمل‌های پایهٔ یک Algorithm با بزرگ‌شدن ورودی `n` چطور رشد می‌کند. ثانیه به ماشین، زبان، بار سیستم و دادهٔ تست وابسته است؛ شکل رشد به هیچ‌کدام وابسته نیست. Big-O این تابع را تا حد یک ضریب ثابت خلاصه می‌کند تا بتوانی بپرسی: «اگر داده ۱۰۰ برابر شود چه می‌شود؟»

**مثال واقعی:** endpoint گزارشی که با `in_array` داخل `foreach` نوشته شده، با ۱٬۰۰۰ سفارش زیر ۱ ms و با یک میلیون سفارش و ۵۰ هزار کاربر مسدود ده‌ها ثانیه طول می‌کشد. هیچ benchmarkی روی دادهٔ روز اول این را نشان نمی‌داد؛ تحلیل `O(n·m)` نشان می‌داد.

**یوزکیس:** code review، برآورد ظرفیت، انتخاب Data Structure و تصمیم دربارهٔ Index.

<strong class="qa-trap">دام مصاحبه:</strong> گفتن «این O(n) است پس سریع است». Big-O دربارهٔ *رشد* است، نه سرعت مطلق؛ `n` DB Query هم `O(n)` است.
:::

### س۲ — `O(log n)` از کجا می‌آید و چرا پایهٔ لگاریتم را نمی‌نویسیم؟ <Badge type="danger" text="حیاتی" /> {#q-2}

::: details پاسخ {open}
**پاسخ:** هر وقت در هر گام کسر ثابتی از مسئله حذف شود، تعداد گام‌ها لگاریتم `n` است: `n → n/2 → n/4 → … → 1` یعنی `log₂ n` گام. پایه مهم نیست چون تغییر پایه فقط یک ضریب ثابت است: `log₂ n = log₁₀ n × 3.32`، و Big-O ضریب ثابت را دور می‌ریزد.

**مثال واقعی:** B-tree Index با fan-out حدود ۵۰۰ روی ۱۰۰ میلیون ردیف: `log₅₀₀(10⁸) ≈ 3`. یعنی با ۳ تا ۴ خواندن page به ردیف می‌رسی، در برابر ۲۷ مقایسه در binary search دودویی. هر دو `O(log n)` هستند، ولی وقتی هر گام یک I/O دیسک است همان «ضریب ثابت» تعیین‌کننده می‌شود.

**یوزکیس:** binary search، Balanced Tree، heap، تعداد دفعات retry با exponential backoff تا رسیدن به سقف.

<strong class="qa-trap">دام مصاحبه:</strong> `log n` فقط با «نصف‌کردن» نیست؛ حلقه‌ای که `i *= 2` یا `i *= 3` دارد هم لگاریتمی است. و برعکس، `i += 2` خطی است.
:::

### س۳ — آیا «Big-O یعنی Worst Case» درست است؟ فرق O، Θ و Ω با Best/Average/Worst Case چیست؟ <Badge type="danger" text="حیاتی" /> {#q-3}

::: details پاسخ {open}
**پاسخ:** نه؛ این دو محور مستقل‌اند. Best/Average/Worst Case مشخص می‌کند **کدام ورودی** را تحلیل می‌کنی و برای هرکدام یک تابع می‌دهد. `O`، `Ω` و `Θ` نوع **کران** روی آن تابع‌اند: بالا، پایین و تنگ. می‌شود گفت «Best Case insertion sort برابر `Θ(n)` است» یا «Worst Case quicksort برابر `Ω(n²)` است».

**مثال واقعی:** quicksort با pivot اول: Average Case `Θ(n log n)`، Worst Case `Θ(n²)` روی ورودی از قبل مرتب. اگر فقط بگویی «quicksort برابر `O(n log n)` است» بدون قید «متوسط»، جمله غلط است.

| جمله | درست؟ |
| --- | --- |
| Worst Case Linear Search `O(n)` است | بله |
| Best Case Linear Search `Ω(1)` است | بله |
| Linear Search `Θ(n)` است | نه؛ فقط بدترین و متوسطش |
| merge sort برابر `Θ(n log n)` است | بله؛ در هر سه حالت |

<strong class="qa-trap">دام مصاحبه:</strong> در عرف صنعت «O» را به‌جای «Θ Worst Case» به کار می‌برند. اشکالی ندارد، ولی اگر مصاحبه‌گر تفاوت را پرسید باید بدانی این یک قرارداد است، نه تعریف.
:::

### س۴ — چرا Comparison Sort نمی‌تواند از `O(n log n)` بهتر باشد؟ پس counting sort چطور `O(n)` است؟ <Badge type="warning" text="مهم" /> {#q-4}

::: details پاسخ {open}
**پاسخ:** `n` عنصر `n!` ترتیب ممکن دارند و هر مقایسه فقط یک بیت اطلاعات می‌دهد (بله/نه). برای تشخیص یکی از `n!` حالت دست‌کم `log₂(n!)` مقایسه لازم است و `log₂(n!) ≈ n log₂ n`. این یک کران پایین `Ω(n log n)` برای **هر** Algorithm مقایسه‌ای در Worst Case است.

counting sort و radix sort مقایسه نمی‌کنند؛ از مقدار کلید به‌عنوان Index استفاده می‌کنند. counting sort برابر `O(n + k)` است که `k` بازهٔ مقادیر است؛ فقط وقتی `k` کوچک باشد به‌صرفه است.

**مثال واقعی:** مرتب‌کردن ۱۰ میلیون رکورد بر اساس «سن» (۰ تا ۱۲۰) با counting sort یک pass است. مرتب‌کردن بر اساس UUID یا String دلخواه راهی جز `n log n` ندارد.

<strong class="qa-trap">دام مصاحبه:</strong> «`O(n log n)` بهترین sort ممکن است» بدون قید «مقایسه‌ای» غلط است.
:::

### س۵ — amortized با average case چه فرقی دارد؟ چرا `append` را `O(1)` می‌گوییم با اینکه گاهی کل Array کپی می‌شود؟ <Badge type="danger" text="حیاتی" /> {#q-5}

::: details پاسخ {open}
**پاسخ:** amortized میانگین هزینه روی **دنباله‌ای از عمل‌ها** در Worst Case است و هیچ فرض احتمالاتی ندارد. average case میانگین روی **توزیع ورودی‌ها** است و به فرض تصادفی‌بودن وابسته است. در `append` با دو برابرشدن ظرفیت، `n` عمل مجموعاً کمتر از `2n` کپی دارند (`1 + 2 + 4 + … + n`)، پس سهم هر عمل `O(1)` است؛ تضمینی، نه احتمالی.

**مثال واقعی:** ساخت slice یک‌میلیون‌تایی با `append` در Go فقط چند ده بار realloc می‌کند. ولی همان یک `append` که resize می‌کند چند میلی‌ثانیه طول می‌کشد و در p99 دیده می‌شود.

**یوزکیس:** وقتی اندازه را می‌دانی از `make([]T, 0, n)` استفاده کن؛ هم realloc حذف می‌شود هم فشار روی GC کم می‌شود.

<strong class="qa-trap">دام مصاحبه:</strong> اگر ظرفیت به‌جای دو برابر، هر بار به اندازهٔ ثابتی زیاد شود، کل هزینه `O(n²)` می‌شود. شرط amortized `O(1)` رشد **هندسی** است.
:::

### س۶ — lookup در hash map واقعاً `O(1)` است؟ <Badge type="danger" text="حیاتی" /> {#q-6}

::: details پاسخ {open}
**پاسخ:** در Average Case بله، به شرط Hash Function خوب و load factor کنترل‌شده. در Worst Case، وقتی همهٔ کلیدها در یک bucket بیفتند، `O(n)` است (یا `O(log n)` در پیاده‌سازی‌هایی که bucket شلوغ را به Tree تبدیل می‌کنند، مثل `HashMap` در Java). دو هزینهٔ پنهان هم هست: محاسبهٔ hash برای کلید String `O(k)` است (طول کلید)، و resize گاه‌به‌گاه `O(n)`.

**مثال واقعی:** حملهٔ HashDoS (سال ۲۰۱۱): مهاجم با ارسال هزاران پارامتر POST که همه به یک bucket hash می‌شدند، parse کردن یک request را از `O(n)` به `O(n²)` می‌رساند و با یک request چند صد کیلوبایتی یک هستهٔ CPU را دقیقه‌ها مشغول می‌کرد. راه‌حل‌ها: hash با seed تصادفی (map در Go همین کار را می‌کند) و سقف تعداد پارامتر (`max_input_vars` در PHP).

**یوزکیس:** برای دادهٔ قابل‌اعتماد، hash map بهترین انتخاب پیش‌فرض برای lookup با تساوی است. برای range query یا ترتیب، Tree یا Index مرتب لازم است.

<strong class="qa-trap">دام مصاحبه:</strong> گفتن `O(1)` بدون قید «متوسط» یا «Amortized». جواب کامل: «`O(1)` متوسط، `O(n)` Worst Case، و `O(k)` برای hash‌کردن کلید».
:::

### س۷ — `T(n) = 2T(n/2) + n` را حل کن. Master Theorem چه می‌گوید؟ <Badge type="warning" text="مهم" /> {#q-7}

::: details پاسخ {open}
**پاسخ:** جواب `Θ(n log n)` است. با Recursion Tree: در هر سطح مجموع کار `n` است (۲ زیرمسئلهٔ `n/2`، ۴ زیرمسئلهٔ `n/4`، …) و `log₂ n` سطح داریم. با Master Theorem: `a = 2`، `b = 2`، پس `n^(log_b a) = n`؛ `f(n) = n` هم‌مرتبهٔ آن است (حالت ۲)، پس یک `log n` ضرب می‌شود.

Master Theorem در یک جمله: کار Leafها (`n^(log_b a)`) را با کار Root (`f(n)`) مقایسه کن؛ هرکدام غالب بود جواب همان است و اگر مساوی بودند، ضرب در `log n`.

| رابطه | غالب | جواب |
| --- | --- | --- |
| `T(n) = 8T(n/2) + n²` | Leafها (`n³`) | `Θ(n³)` |
| `T(n) = 2T(n/2) + n` | مساوی | `Θ(n log n)` |
| `T(n) = 2T(n/2) + n²` | Root | `Θ(n²)` |

**مثال واقعی:** merge sort و external merge sort در Database (sort روی دیسک وقتی داده در `work_mem` جا نمی‌شود).

<strong class="qa-trap">دام مصاحبه:</strong> Master Theorem برای `T(n) = T(n-1) + n` یا `T(n) = 2T(n-1) + 1` کاربرد ندارد (تقسیم نیست، کم‌کردن است). آن‌جا مجموع را مستقیم حساب کن: اولی `O(n²)` و دومی `O(2ⁿ)`.
:::

### س۸ — Complexity فیبوناچی Recursive خام چیست و چطور درستش می‌کنی؟ <Badge type="warning" text="مهم" /> {#q-8}

::: details پاسخ {open}
**پاسخ:** زمان نمایی: رابطه `T(n) = T(n-1) + T(n-2) + 1` است که جواب دقیقش `Θ(φⁿ)` با `φ ≈ 1.618` است؛ `O(2ⁿ)` کران بالای درست ولی غیرتنگ است. فضا `O(n)` است (Stack Depth)، نه نمایی. علت: زیرمسئله‌های هم‌پوشان؛ `fib(n-2)` دو بار، `fib(n-3)` سه بار و … محاسبه می‌شوند.

```go
func fibIter(n int) int {
    a, b := 0, 1
    for i := 0; i < n; i++ {
        a, b = b, a+b
    }
    return a
}
```

| نسخه | زمان | فضا |
| --- | --- | --- |
| Recursive خام | `Θ(φⁿ)` | `O(n)` |
| memoization | `O(n)` | `O(n)` |
| حلقه با دو متغیر | `O(n)` | `O(1)` |

**مثال واقعی:** `fib(50)` با نسخهٔ خام حدود ۴×۱۰¹⁰ فراخوانی دارد (ده‌ها ثانیه تا چند دقیقه)؛ با حلقه ۵۰ گام. همین Pattern در محاسبهٔ Recursive قیمت، مجوز یا Tree دسته‌بندی بدون cache دیده می‌شود.

<strong class="qa-trap">دام مصاحبه:</strong> گفتن «فضا هم `O(2ⁿ)` است». در هر لحظه فقط یک مسیر از Root تا Leaf روی stack است.
:::

### س۹ — دو حلقهٔ تو در تو همیشه `O(n²)` است؟ <Badge type="warning" text="مهم" /> {#q-9}

::: details پاسخ {open}
**پاسخ:** نه. باید مجموع تکرارهای حلقهٔ داخلی را روی کل اجرا حساب کنی. سه حالت رایج که `n²` نیستند: حلقهٔ داخلی با تعداد ثابت (`O(n)`)، حلقهٔ داخلی لگاریتمی (`O(n log n)`)، و حلقهٔ داخلی‌ای که متغیرش reset نمی‌شود (two pointers و sliding window: `O(n)`).

**مثال واقعی:** rate limiter با sliding window روی لیست timestampهای مرتب: برای هر request جدید، Pointer چپ فقط جلو می‌رود تا Eventهای منقضی را رد کند. هر timestamp یک‌بار وارد و یک‌بار خارج می‌شود: `O(1)` Amortized برای هر request.

**یوزکیس:** استدلال استاندارد: «هر عنصر حداکثر یک‌بار وارد و یک‌بار خارج می‌شود، پس مجموع کار `2n` است». برای stack یکنوا و BFS هم همین را می‌گویی (هر Vertex یک‌بار وارد Queue می‌شود).

<strong class="qa-trap">دام مصاحبه:</strong> برعکسش هم هست: **یک** حلقه می‌تواند `O(n²)` باشد اگر بدنه‌اش `O(n)` باشد (`in_array`، `array_shift`، `s += x`، `slices.Contains`).
:::

### س۱۰ — Space Complexity تابع Recursive را چطور حساب می‌کنی؟ <Badge type="warning" text="مهم" /> {#q-10}

::: details پاسخ {open}
**پاسخ:** فضای stack برابر **بیشترین Depth** فراخوانی‌های هم‌زمان باز است ضرب در اندازهٔ هر frame، نه تعداد کل فراخوانی‌ها. به آن، حافظه‌ای را که هر سطح تخصیص می‌دهد اضافه کن (مثلاً Array موقت merge sort).

| Algorithm | Stack Depth | فضای کمکی کل |
| --- | --- | --- |
| merge sort | `O(log n)` | `O(n)` (Buffer ادغام) |
| quicksort in-place | `O(log n)` متوسط، `O(n)` بدترین | همان |
| Recursive DFS روی Tree | Tree Height: `O(log n)` متوازن، `O(n)` کج | همان |

**مثال واقعی:** Recursive DFS روی Tree دسته‌بندی که در اثر باگ به یک زنجیرهٔ ۱۰۰ هزار سطحی تبدیل شده: در PHP با خطای memory یا segfault تمام می‌شود و در Go تا رسیدن به سقف stack (به‌طور پیش‌فرض ۱ گیگابایت در سیستم‌های ۶۴ بیتی) حافظه می‌خورد. راه‌حل: نسخهٔ حلقه‌ای با stack صریح، یا سقف Depth.

<strong class="qa-trap">دام مصاحبه:</strong> گفتن «quicksort In-place است پس فضا `O(1)`». Recursion stack حساب می‌شود؛ برای تضمین `O(log n)` باید اول روی نیمهٔ کوچک‌تر recurse کنی و نیمهٔ بزرگ‌تر را با حلقه ادامه بدهی.
:::

### س۱۱ — ممکن است Algorithm `O(n²)` از `O(n log n)` سریع‌تر باشد؟ <Badge type="warning" text="مهم" /> {#q-11}

::: details پاسخ {open}
**پاسخ:** بله، برای `n` کوچک. Big-O ثابت‌ها را پنهان می‌کند: اگر یکی `2n²` و دیگری `50·n·log₂ n` عمل داشته باشد، تا حدود `n ≈ 190` اولی سریع‌تر است. علاوه بر آن، Algorithmهای ساده معمولاً cache-friendly هستند و branch prediction بهتری دارند.

**مثال واقعی:** پیاده‌سازی‌های sort در کتابخانه‌های استاندارد (pdqsort در Go، sort هیبریدی PHP، Timsort در Python و Java) برای Subarrayهای کوچک به insertion sort سوییچ می‌کنند. یا: برای ۵ تا ۱۰ عنصر، Linear Search در یک slice از lookup در map سریع‌تر است چون hash حساب نمی‌شود و همه‌چیز در یک خط cache است.

**یوزکیس:** وقتی `n` سقف کوچک و *تضمین‌شده* دارد (تعداد نقش‌های یک کاربر، روزهای هفته)، ساده‌ترین کد را بنویس.

<strong class="qa-trap">دام مصاحبه:</strong> «`n` کوچک است» باید تضمین‌شده باشد، نه امیدواری. «هر کاربر حداکثر ۱۰ آدرس دارد» تا روزی درست است که یک مشتری سازمانی با ۴۰ هزار آدرس بیاید.
:::

### س۱۲ — مشکل N+1 query را با زبان Complexity توضیح بده. <Badge type="danger" text="حیاتی" /> {#q-12}

::: details پاسخ {open}
**پاسخ:** برای نمایش `n` ردیف، یک Query برای لیست و `n` Query برای دادهٔ وابستهٔ هر ردیف می‌زنی: `O(n)` **round-trip**. از نظر تعداد عمل CPU ممکن است با یک join فرقی نکند، ولی واحد هزینه عوض شده: هر round-trip حدود ۰٫۵ تا ۲ ms است، یعنی صدها هزار برابر یک مقایسه در حافظه.

```php
// N+1: 1 query for orders + n queries for users
$orders = Order::all();
foreach ($orders as $order) {
    echo $order->user->name;
}

// 2 queries total, regardless of n
$orders = Order::with('user')->get();
```

**مثال واقعی:** صفحه‌ای با ۵۰۰ سفارش: ۵۰۱ Query × ۱ ms ≈ ۵۰۰ ms فقط زمان شبکه. با eager loading: ۲ Query ≈ ۳ ms.

**یوزکیس:** در هر تحلیل backend اول بپرس «تعداد round-trip تابع `n` است؟». همین Pattern برای فراخوانی HTTP به سرویس دیگر و دستورهای Redis داخل حلقه هم هست (راه‌حل: endpoint دسته‌ای، pipeline، `MGET`).

<strong class="qa-trap">دام مصاحبه:</strong> راه‌حل «همه را با یک `IN (...)` بگیر» هم سقف دارد: لیست ۱۰۰ هزارتایی در `IN` خودش مشکل‌ساز است. باید chunk کنی یا join بزنی.
:::

### س۱۳ — مسئله می‌گوید `n ≤ 10⁵`. از همین یک عدد چه نتیجه‌ای می‌گیری؟ <Badge type="warning" text="مهم" /> {#q-13}

::: details پاسخ {open}
**پاسخ:** با بودجهٔ حدود ۱۰⁸ عمل در ثانیه، `n²` یعنی ۱۰¹⁰ عمل: رد. پس جواب مورد انتظار `O(n log n)` یا `O(n)` است، یعنی sort، hash map، two pointers، heap، binary search یا DP تک‌بعدی. قید ورودی عملاً راهنمای Algorithm است.

| قید | Complexity هدف |
| --- | --- |
| `n ≤ 20` | `O(2ⁿ)`: bitmask یا backtracking |
| `n ≤ 5 000` | `O(n²)`: DP دوبعدی |
| `n ≤ 10⁵` تا `10⁶` | `O(n log n)` یا `O(n)` |
| `n ≤ 10¹⁸` | `O(log n)` یا فرمول |

**مثال واقعی:** همین استدلال در طراحی: «هر tenant تا ۱۰⁵ محصول دارد و محاسبهٔ پیشنهادها در request انجام می‌شود» یعنی مقایسهٔ جفتی محصولات ممکن نیست و باید precompute یا Index داشته باشی.

<strong class="qa-trap">دام مصاحبه:</strong> فراموش‌کردن بودجهٔ زبان. در PHP و Python مفسر ۱۰ تا ۵۰ برابر کندتر از Go است؛ `O(n²)` با `n = 5000` (۲٫۵×۱۰⁷ عمل) در Go حدود ۲۵ ms و در PHP می‌تواند نزدیک یک ثانیه باشد.
:::

### س۱۴ — چند نمونه `O(n²)` پنهان در کد روزمرهٔ Go و PHP نام ببر. <Badge type="warning" text="مهم" /> {#q-14}

::: details پاسخ {open}
**پاسخ:** هر جا عملی `O(n)` داخل حلقهٔ `O(n)` باشد:

| کد | چرا `O(n²)` | جایگزین |
| --- | --- | --- |
| `in_array` / `array_search` در `foreach` | اسکن خطی در هر تکرار | `array_flip` + `isset` |
| `array_merge` در حلقه | کپی کل Array در هر تکرار | `array_merge(...$parts)` |
| `array_shift` در `while` | شماره‌گذاری مجدد در هر بار | `SplQueue` یا head Index |
| `s += x` در حلقهٔ Go | string جدید در هر تکرار | `strings.Builder` |
| `slices.Contains` در حلقه | اسکن خطی | `map[T]struct{}` |
| حذف از وسط slice در حلقه | Shift در هر حذف | فیلتر In-place با یک Index نوشتن |
| `Collection::contains` یا `where` روی Collection در حلقه (Laravel) | اسکن خطی | `keyBy` یک‌بار، بعد `get` |

**مثال واقعی:** import فایل CSV با ۲۰۰ هزار ردیف که برای حذف تکراری‌ها `in_array($row['email'], $seen)` می‌زند: ۲×۱۰¹⁰ مقایسهٔ String در Worst Case، یعنی چند ده دقیقه. با `isset($seen[$email])`: زیر یک ثانیه.

<strong class="qa-trap">دام مصاحبه:</strong> `array_unique` و `array_diff` هم رایگان نیستند؛ قبل از استفاده داخل حلقه، هزینهٔ هر تابع کتابخانه را بدان.
:::

### س۱۵ — ReDoS چیست و چه ربطی به Complexity دارد؟ <Badge type="info" text="تکمیلی" /> {#q-15}

::: details پاسخ {open}
**پاسخ:** موتورهای regex مبتنی بر backtracking برای Patternهایی با تکرار تو در تو یا alternation هم‌پوشان (`(a+)+`، `(a|a)*`، `(.*a){10}`) روی ورودی‌ای که در آخرین لحظه match نمی‌شود، تعداد نمایی (یا چندجمله‌ای با درجهٔ بالا) مسیر را امتحان می‌کنند. مهاجم با یک String چند ده کاراکتری یک هستهٔ CPU را قفل می‌کند.

**مثال واقعی:** قطعی Cloudflare در ژوئیهٔ ۲۰۱۹ (یک regex در قوانین WAF) و قطعی Stack Overflow در ژوئیهٔ ۲۰۱۶ (regex حذف فاصله‌های انتهایی روی پستی با حدود ۲۰ هزار فاصلهٔ پشت‌سرهم؛ رفتار `O(n²)`).

**یوزکیس / دفاع:** موتور با تضمین زمان خطی (پکیج `regexp` در Go، RE2)، سقف طول ورودی *قبل از* regex، پرهیز از quantifier تو در تو، و در PHP بررسی `preg_last_error()`.

<strong class="qa-trap">دام مصاحبه:</strong> در PHP مقدار برگشتی `false` از `preg_match` یعنی «خطا»، نه «match نشد» (که `0` است). کدی که این دو را یکی می‌گیرد می‌تواند validation را دور بزند.
:::

### س۱۶ — وقتی مسئله‌ای NP-hard است، در عمل چه می‌کنی؟ <Badge type="info" text="تکمیلی" /> {#q-16}

::: details پاسخ {open}
**پاسخ:** NP-hard یعنی Algorithm چندجمله‌ای دقیقی برایش نمی‌شناسیم؛ به این معنی نیست که مسئله حل‌نشدنی است. گزینه‌های عملی:

| راهکار | کی |
| --- | --- |
| brute force یا bitmask DP | `n` واقعاً کوچک است (تا حدود ۲۰) |
| heuristic یا greedy | جواب «به‌اندازهٔ کافی خوب» کافی است |
| Algorithm تقریبی با ضمانت | کران کیفیت لازم است |
| محدودکردن مسئله | حالت خاص واقعی تو چندجمله‌ای است (مثلاً ظرفیت کوچک در knapsack: `O(n·W)`) |
| solver آماده (ILP، SAT، OR-Tools) | مسئلهٔ بهینه‌سازی با قیدهای زیاد |

**مثال واقعی:** مسیریابی پیک‌ها (VRP، تعمیم TSP): هیچ شرکتی همهٔ `n!` مسیر را امتحان نمی‌کند؛ با heuristicهایی مثل nearest neighbor + بهبود محلی (2-opt) در چند ثانیه به جوابی نزدیک به بهینه می‌رسند. bin packing برای چیدن containerها روی nodeها هم با first-fit decreasing حل می‌شود.

<strong class="qa-trap">دام مصاحبه:</strong> گفتن «NP یعنی non-polynomial». NP یعنی nondeterministic polynomial: جوابِ داده‌شده در زمان چندجمله‌ای **قابل‌بررسی** است.
:::

### س۱۷ — Master Theorem کجا جواب نمی‌دهد؟ <Badge type="info" text="تکمیلی" /> {#q-17}

::: details پاسخ {open}
**پاسخ:** سه دسته:

1. **رابطه به شکل `a·T(n/b) + f(n)` نیست:** `T(n) = T(n-1) + n` یا `T(n) = T(n/3) + T(2n/3) + n` (تقسیم نامساوی). برای دومی Recursion Tree می‌گوید هر سطح حداکثر `n` کار دارد و Depth `log₁.₅ n` است: `O(n log n)`.
2. **`f(n)` فقط به اندازهٔ یک ضریب لگاریتمی با `n^(log_b a)` فرق دارد:** `T(n) = 2T(n/2) + n log n`. نه حالت ۲ است نه حالت ۳ (اختلاف چندجمله‌ای نیست). جواب با نسخهٔ تعمیم‌یافته `Θ(n log² n)` است.
3. **`a` ثابت نیست یا کمتر از ۱ است:** مثل `T(n) = n·T(n/2) + 1`.

**مثال واقعی:** quicksort با تقسیم همیشه ۱۰ به ۹۰: `T(n) = T(n/10) + T(9n/10) + n`. Master Theorem کار نمی‌کند ولی Recursion Tree نشان می‌دهد هنوز `O(n log n)` است، فقط با ثابت بزرگ‌تر. برای همین quicksort با pivot «نه‌چندان خوب» هم در عمل سریع است.

<strong class="qa-trap">دام مصاحبه:</strong> اعمال حالت ۳ بدون اینکه `f(n)` به‌اندازهٔ یک توان مثبت `n^ε` بزرگ‌تر باشد.
:::

### س۱۸ — B-tree و Balanced Binary Tree هر دو `O(log n)` هستند. چرا Database از B-tree استفاده می‌کند؟ <Badge type="info" text="تکمیلی" /> {#q-18}

::: details پاسخ {open}
**پاسخ:** چون واحد هزینه در Database «خواندن یک page از دیسک» است، نه «یک مقایسه». Binary Tree روی ۱۰۰ میلیون کلید حدود ۲۷ سطح Depth دارد و هر سطح می‌تواند یک page جدا (یک I/O تصادفی) باشد. B-tree در هر node صدها کلید نگه می‌دارد، پس Depthاش ۳ تا ۴ است. هر دو `O(log n)` هستند، ولی پایهٔ لگاریتم (۲ در برابر چند صد) همان ثابتی است که Big-O پنهان می‌کند.

```text
binary tree, 10^8 keys:  depth ≈ log2(10^8)   ≈ 27  -> up to 27 page reads
B-tree, fan-out 500:     depth ≈ log500(10^8) ≈ 3   -> 3–4 page reads
```

**مثال واقعی:** همین منطق در حافظه هم هست: ساختارهای cache-friendly (B-tree در حافظه، Array مرتب) در عمل از Treeهای Pointer-based (red-black) سریع‌ترند، چون cache miss کمتری دارند.

**یوزکیس:** هر وقت دو گزینهٔ هم‌مرتبه داری، بپرس «عمل پایهٔ گران من چیست؟» و همان را بشمار.

<strong class="qa-trap">دام مصاحبه:</strong> «چرا hash index نه، که `O(1)` است؟» چون hash فقط تساوی را پشتیبانی می‌کند؛ range query، `ORDER BY` و prefix match ترتیب لازم دارند.
:::

## مطالب مرتبط {#related}

- [نماد Big O](/fa/fundamentals/big-o) — تعریف‌های رسمی و خانوادهٔ نمادها
- <span class="vip-locked" title="VIP members only">Recursion <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> · <span class="vip-locked" title="VIP members only">Divide & conquer <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> · <span class="vip-locked" title="VIP members only">Greedy <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> · <span class="vip-locked" title="VIP members only">Dynamic programming <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>
- <span class="vip-locked" title="VIP members only">Arrays <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> · <span class="vip-locked" title="VIP members only">Hash table <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> · <span class="vip-locked" title="VIP members only">Tree <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> · <span class="vip-locked" title="VIP members only">Graph <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>
- <span class="vip-locked" title="VIP members only">Sorting و Search <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> · <span class="vip-locked" title="VIP members only">Algorithmهای رایج <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>
