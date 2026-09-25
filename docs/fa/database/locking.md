# Optimistic در برابر Pessimistic Locking

> ماژول B — داده، همزمانی، پایداری · بخش ۳

## فهرست ذهنی

1. [چیست و چرا](#چیست-و-چرا)  
2. [Lost update](#lost-update)  
3. [Pessimistic در Laravel](#pessimistic-locking-در-laravel)  
4. [Optimistic در Laravel](#optimistic-locking-در-laravel)  
5. [آپدیت اتمیک](#آپدیت-اتمیک-بدون-قفل-ذهنی)  
6. [مثال واقعی](#مثال-عملی--لغو-آیتم-سفارش)  
7. [کی کدام؟](#کی-کدام)  
8. [Gotchaها و best practice](#gotchaها-و-best-practice)  
9. [قاعدهٔ تصمیم](#قاعدهٔ-تصمیم)

---

## چیست و چرا

**Locking** کنترل همزمانی است: چند process/request نتوانند همان داده را طوری بخوانند/بنویسند که صحت از بین برود.

دو استراتژی اصلی:

| | شعار | ایده |
|--|------|------|
| **Pessimistic** | «تا کارم تمام نشده کسی دست نزند» | قبل از تغییر قفل بگیر |
| **Optimistic** | «احتمالاً conflict نیست؛ موقع save چک کن» | بدون قفل پیش برو؛ موقع نوشتن اعتبارسنجی کن |

بدون یکی از این‌ها (یا الگوی اتمیک معادل): **double spend**، claim تکراری کوپن، موجودی منفی، overwrite مدل‌ها.

---

## Lost update

دو تراکنش همزمان یک ردیف را عوض می‌کنند:

```
A reads qty=5
B reads qty=5
A writes qty=4
B writes qty=4  ← یک decrement گم شد (lost update)
```

هدف locking: یا یکی صبر کند (pessimistic)، یا دومی موقع write بفهمد جهان عوض شده (optimistic).

---

## Pessimistic locking در Laravel

فرض: conflict محتمل است → ردیف را برای مدت تراکنش قفل کن. دیگران برای write (و بسته به نوع قفل، گاهی read خاص) منتظر می‌مانند.

«اول قفل کن، بعد کار کن.»

### `lockForUpdate()` — `SELECT … FOR UPDATE`

قفل انحصاری روی ردیف‌های انتخاب‌شده تا پایان تراکنش. بقیهٔ `FOR UPDATE` / update روی همان ردیف **صبر** می‌کنند (یا با `innodb_lock_wait_timeout` / معادل Postgres timeout می‌خورند).

```php
DB::transaction(function () {
    $user = DB::table('users')
        ->where('id', 1)
        ->lockForUpdate()
        ->first();

    // اینجا امن است که $user را تغییر دهی
});
```

با Eloquent:

```php
DB::transaction(function () use ($orderId) {
    $order = Order::whereKey($orderId)
        ->lockForUpdate()
        ->firstOrFail();

    $order->status = 'paid';
    $order->save();
});
```

SQL معادل:

```sql
BEGIN;
SELECT * FROM orders WHERE id = 1 FOR UPDATE;
UPDATE orders SET status = 'paid' WHERE id = 1;
COMMIT;
```

قوانین حیاتی:

1. **فقط داخل transaction** معنا دارد. بیرون تراکنش، قفل بلافاصله بی‌اثر/بی‌معنا می‌شود.  
2. ترتیب صدا زدن مهم است — قفل باید **قبل از اجرای query** اعمال شود:

```php
// درست: قفل قبل از اجرا
$model = User::lockForUpdate()->find(1);

// غلط: find اول اجرا شده؛ lockForUpdate روی نتیجهٔ model بی‌اثر است
$model = User::find(1)->lockForUpdate();
```

### `sharedLock()` — `SELECT … FOR SHARE` / `LOCK IN SHARE MODE`

قفل اشتراکی: دیگران می‌توانند **بخوانند**، ولی update/delete روی ردیف باید صبر کند. برای «خواندن سازگار بدون قصد ویرایش فوری» مفید است.

```php
DB::transaction(function () {
    $user = DB::table('users')
        ->where('id', 1)
        ->sharedLock()
        ->first();

    // خواندن پایدار؛ برای تغییر بعدی معمولاً lockForUpdate بهتر است
});
```

| متد | رفتار تقریبی | کی؟ |
|-----|----------------|-----|
| `lockForUpdate()` | انحصاری — read-then-write امن | پرداخت، claim کوپن، موجودی |
| `sharedLock()` | اشتراکی — خواندن پایدار | وقتی فقط نیاز به snapshot پایدار داری |

### Use case کلاسیک

دو کاربر همزمان یک **کد تخفیف یک‌بارمصرف** را claim می‌کنند. بدون قفل هر دو موفق می‌شوند. با pessimistic: اولی قفل می‌گیرد و مصرف می‌کند؛ دومی صبر می‌کند و بعد از commit می‌بیند کد دیگر آزاد نیست.

```php
DB::transaction(function () use ($code, $userId) {
    $coupon = Coupon::where('code', $code)
        ->whereNull('redeemed_by')
        ->lockForUpdate()
        ->firstOrFail();

    $coupon->update([
        'redeemed_by' => $userId,
        'redeemed_at' => now(),
    ]);
});
```

---

## Optimistic locking در Laravel

فرض: conflict نادر است. ردیف را قفل DB نمی‌کنی؛ موقع نوشتن چک می‌کنی version/timestamp عوض نشده باشد.

Laravel **out-of-the-box** optimistic locking ندارد — خودت با ستون `version` (ترجیح) یا `updated_at` پیاده می‌کنی. چون `updated_at` برای Eloquent timestamps هم هست، ستون اختصاصی `version` واضح‌تر و کم‌ریسک‌تر است.

### جریان conflict

```
WriterA                Database                WriterB
   |                      |                       |
   |-- read version=1 --->|                       |
   |                      |<--- read version=1 ---|
   |-- update if v=1 ---->|                       |
   |   set version=2      |                       |
   |<----- OK ------------|                       |
   |                      |<--- update if v=1 ----|
   |                      |---- 0 rows / conflict>|
```

### Migration ستون version

```php
Schema::table('orders', function (Blueprint $table) {
    $table->unsignedInteger('version')->default(1);
});
```

### با `version`

```php
DB::transaction(function () use ($orderId, $payload) {
    $order = Order::findOrFail($orderId);

    $affected = Order::whereKey($order->id)
        ->where('version', $order->version)
        ->update([
            ...$payload,
            'version' => $order->version + 1,
        ]);

    if ($affected === 0) {
        throw new \RuntimeException('Conflict: order changed by another request');
    }
});
```

### با `updated_at` (ساده‌تر، شکننده‌تر)

```php
$product = Product::findOrFail($id);
$originalUpdatedAt = $product->updated_at;

// ... منطق کسب‌وکار ...

$success = Product::whereKey($id)
    ->where('updated_at', $originalUpdatedAt)
    ->update(['stock' => $newStock]);

if (! $success) {
    // Stale — retry یا exception
    throw new \RuntimeException('Stale model');
}
```

هشدار: اگر جای دیگر همان ردیف را بدون تغییر منطقی `touch` کند، false conflict می‌گیری. برای دامنهٔ جدی → `version`.

### Retry ساده برای optimistic

```php
use Illuminate\Support\Facades\DB;

function updateOrderOptimistic(int $orderId, array $payload, int $attempts = 3): void
{
    for ($i = 0; $i < $attempts; $i++) {
        $done = DB::transaction(function () use ($orderId, $payload) {
            $order = Order::findOrFail($orderId);

            $affected = Order::whereKey($order->id)
                ->where('version', $order->version)
                ->update([
                    ...$payload,
                    'version' => $order->version + 1,
                ]);

            return $affected === 1;
        });

        if ($done) {
            return;
        }
        // conflict → دوباره بخوان و تلاش کن
    }

    throw new \RuntimeException('Optimistic lock failed after retries');
}
```

Use case رایج: ویرایش پروفایل، سند مشترک با تداخل نادر، سبد خرید کم‌تعارض — نه رزرو ۱۰۰ صندلی کنسرت در یک ثانیه.

---

## آپدیت اتمیک بدون «قفل ذهنی»

گاهی نه optimistic نام می‌بری نه pessimistic — یک `UPDATE … WHERE` شرط‌دار کافی است:

```sql
UPDATE wallets
SET balance = balance - 100
WHERE id = 9 AND balance >= 100;
-- affected = 0 → موجودی کافی نبود
```

```php
$affected = DB::table('wallets')
    ->where('id', $walletId)
    ->where('balance', '>=', 100)
    ->decrement('balance', 100);

if ($affected === 0) {
    throw new \RuntimeException('Insufficient funds');
}
```

ساده، سریع، و برای counter/موجودی خیلی قوی — اغلب بهتر از read→calculate→write بدون شرط.

---

## مثال عملی — لغو آیتم سفارش

سنario: لغو یک line-item؛ باید Order قفل شود تا قیمت/وضعیت هم‌زمان خراب نشود.

```php
final class OrderItemCancelAction
{
    public function handle(string $orderItemId, int $userId): void
    {
        $orderItem = OrderItem::query()
            ->where('is_canceled', false)
            ->findOrFail($orderItemId);

        DB::transaction(function () use ($userId, $orderItem) {
            $order = Order::query()
                ->lockForUpdate()
                ->whereKey($orderItem->order_id)
                ->where('user_id', $userId)
                ->whereIn('status', ['processing', 'suspended'])
                ->firstOrFail();

            $orderItem->update([
                'is_canceled' => true,
                'canceled_at' => now(),
            ]);

            $remaining = $order->items()->where('is_canceled', false);

            $attributes = [
                'price' => (clone $remaining)->sum(DB::raw('price * quantity')),
            ];

            if (! $remaining->exists()) {
                $attributes['status'] = 'cancelled';
            }

            $order->update($attributes);
        });
    }
}
```

نکته‌ها:

- `lockForUpdate` روی **Order** (ریشهٔ صحت)، نه فقط item  
- کل کار داخل یک `DB::transaction`  
- بدون HTTP خارجی وسط تراکنش  

---

## کی کدام؟

| سناریو | انتخاب |
|--------|--------|
| انتقال بانکی / موجودی حیاتی / claim کوپن | **Pessimistic** |
| ویرایش پروفایل، تنظیمات، تداخل نادر | **Optimistic** |
| تراکنش طولانی + کار کاربر وسط مسیر | **Optimistic** (قفل طولانی خطرناک است) |
| ترتیب قطعی update لازم است | **Pessimistic** |
| counter ساده با شرط | **آپدیت اتمیک** |
| صندلی کنسرت / overselling | Pessimistic یا atomic `WHERE qty > 0` |

خلاصهٔ بده‌بستان:

| | Pessimistic | Optimistic |
|--|-------------|------------|
| فرض | conflict زیاد | conflict کم |
| هزینه | wait / deadlock | retry / UX conflict |
| عملکرد زیر contention بالا | پایدارتر برای صحت | retry thrash |
| عملکرد زیر contention پایین | قفل اضافی | بهتر scale می‌شود |

---

## Gotchaها و best practice

### Deadlock

دو تراکنش قفل را با ترتیب متفاوت بگیرند:

```
T1: lock order → lock payment
T2: lock payment → lock order  → deadlock
```

**همیشه همان ترتیب ثابت** (مثلاً همیشه اول `orders` بعد `payments` با id صعودی).

### Timeout و قفل بلند

تراکنش طولانی دیگران را block می‌کند. قفل را **کوتاه** نگه دار؛ I/O خارجی (HTTP، ایمیل، S3) بیرون تراکنش.

### Granularity

قفل ردیف > قفل جدول. فقط همان رکوردهایی که لازم است.

### Retry

Optimistic بدون retry = خطای خام به کاربر. بودجهٔ retry + backoff کوتاه بگذار.

### Octane یادآوری

تراکنش بازمانده روی worker بین requestها نشت می‌کند — همیشه `commit`/`rollBack` یا `DB::transaction`. (مرتبط با صفحهٔ [Connection Pooling](/fa/database/connection-pool))

### Best practice فشرده

1. قفل حداقل زمان  
2. قفل در ریزترین سطح لازم (row)  
3. ترتیب قفل ثابت  
4. `lockForUpdate` / `sharedLock` **قبل از** اجرای query  
5. برای conflict نادر → optimistic + retry  
6. برای صحت مالی/موجودی → pessimistic + تراکنش کوتاه  

---

## قاعدهٔ تصمیم

1. **conflict نادر** → optimistic (+ retry).  
2. **صحت مالی / موجودی حیاتی و race زیاد** → pessimistic (+ تراکنش کوتاه).  
3. اگر می‌توانی با `UPDATE … WHERE` اتمیک حل کنی — اغلب ساده‌ترین راه است.  
4. همیشه برای deadlock و lock wait timeout بودجه بگذار.  
5. قفل را کوتاه نگه دار؛ HTTP خارجی داخل تراکنش نزن.
