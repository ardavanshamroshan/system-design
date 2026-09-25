# Optimistic در برابر Pessimistic Locking

> ماژول B — داده، همزمانی، پایداری · بخش ۳

## چیست و چرا

وقتی دو تراکنش همزمان یک ردیف را عوض می‌کنند، بدون قفل یکی دیگری را **overwrite** می‌کند (**lost update**):

```
A reads qty=5
B reads qty=5
A writes qty=4
B writes qty=4  ← یک decrement گم شد
```

دو رویکرد کلاسیک: **Pessimistic** و **Optimistic**.

---

## Pessimistic locking

قبل از ویرایش قفل می‌گیری (`SELECT … FOR UPDATE`) — دیگران صبر می‌کنند.

```sql
SELECT * FROM orders WHERE id = 1 FOR UPDATE;
-- دیگران روی این ردیف منتظر می‌مانند
UPDATE orders SET status = 'paid' WHERE id = 1;
COMMIT;
```

«اول قفل کن، بعد کار کن.»

| مزیت | هزینه |
|------|-------|
| تعارض کمتر در زمان commit | انتظار / رقابت قفل |
| مناسب مسیرهای پرحرف تعارض | ریسک deadlock اگر ترتیب قفل بد باشد |

---

## Optimistic locking

قفل نمی‌گیری؛ با `version` / `updated_at` بررسی می‌کنی که کسی وسط کار عوض نکرده باشد.

```
WriterA                Database                WriterB
   |                      |                       |
   |-- read version=1 --->|                       |
   |                      |<--- read version=1 ---|
   |                      |                       |
   |-- update if v=1 ---->|                       |
   |   set version=2      |                       |
   |<----- OK ------------|                       |
   |                      |<--- update if v=1 ----|
   |                      |---- 0 rows / conflict>|
```

```sql
UPDATE orders
SET status = 'paid', version = version + 1
WHERE id = 1 AND version = 1;
-- اگر 0 ردیف → کسی زودتر نوشته؛ conflict / retry
```

| مزیت | هزینه |
|------|-------|
| بدون قفل بلندمدت | زیر تعارض بالا، retry زیاد |
| برای مسیرهای کم‌تعارض مقیاس بهتر | UX باید تعارض را هندل کند |

---

## بده‌بستان

| رویکرد | مناسب برای |
|--------|------------|
| **Optimistic** | contention پایین — مثلاً پروفایل کاربر |
| **Pessimistic** | conflict زیاد — موجودی انبار / رزرو صندلی |

---

## کد Laravel

### Pessimistic

```php
DB::transaction(function () use ($orderId) {
    $order = Order::whereKey($orderId)->lockForUpdate()->firstOrFail();
    $order->status = 'paid';
    $order->save();
});
```

### Optimistic — ستون `version` روی جدول

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

---

## آپدیت اتمیک بدون «قفل ذهنی»

گاهی هیچ‌کدام را نام نمی‌بری، ولی شرط اتمیک کافی است:

```sql
UPDATE wallets
SET balance = balance - 100
WHERE id = 9 AND balance >= 100;
```

این الگو ساده و قدرتمند است — مخصوصاً برای موجودی/موجودی‌مانند.

---

## قاعدهٔ تصمیم

1. **conflict نادر** → optimistic  
2. **صحت مالی / موجودی حیاتی و race زیاد** → pessimistic (+ تراکنش کوتاه)  
3. همیشه برای deadlock و retry بودجه بگذار.  
4. قفل را کوتاه نگه دار؛ HTTP خارجی داخل تراکنش نزن.
