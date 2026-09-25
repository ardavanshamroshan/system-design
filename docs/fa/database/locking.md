# Optimistic در برابر Pessimistic Locking

## مسئله

دو request همزمان همان ردیف را آپدیت می‌کنند (مثلاً موجودی). بدون کنترل:

```
A reads qty=5
B reads qty=5
A writes qty=4
B writes qty=4  ← یک decrement گم شد
```

دو رویکرد کلاسیک: **Optimistic** و **Pessimistic**.

---

## Pessimistic locking

«اول قفل کن، بعد کار کن.»

```sql
SELECT * FROM products WHERE id = 1 FOR UPDATE;
-- others wait on this row
UPDATE products SET qty = qty - 1 WHERE id = 1;
COMMIT;
```

```php
DB::transaction(function () {
    $product = Product::whereKey(1)->lockForUpdate()->first();
    $product->qty -= 1;
    $product->save();
});
```

| مزیت | هزینه |
|------|-------|
| تعارض کمتر در زمان commit | انتظار / رقابت قفل |
| مناسب مسیرهای پرحرف تعارض | ریسک deadlock اگر ترتیب قفل بد باشد |

---

## Optimistic locking

«بدون قفل بخوان؛ موقع نوشتن چک کن version عوض نشده باشد.»

معمولاً ستون `version` یا `updated_at`:

```sql
UPDATE products
SET qty = 4, version = version + 1
WHERE id = 1 AND version = 3;
-- if 0 rows → someone wrote first; retry
```

```php
$product = Product::find(1);
$affected = Product::where('id', $product->id)
    ->where('version', $product->version)
    ->update([
        'qty' => $product->qty - 1,
        'version' => $product->version + 1,
    ]);

if ($affected === 0) {
    throw new ConflictException('Retry');
}
```

| مزیت | هزینه |
|------|-------|
| بدون قفل بلندمدت | زیر تعارض بالا، retry زیاد |
| برای مسیرهای read-heavy بهتر مقیاس می‌شود | UX باید تعارض را هندل کند |

---

## کی کدام را؟

| سناریو | انتخاب رایج |
|--------|-------------|
| موجودی محدود، صندلی کنسرت | Pessimistic یا `UPDATE ... WHERE qty > 0` اتمیک |
| ویرایش پروفایل کم‌تعارض | Optimistic |
| تراکنش مالی حساس با ردیف‌های مرتبط | Pessimistic با ترتیب قفل ثابت |
| سند مشترک با تداخل نادر | Optimistic + merge |

---

## آپدیت اتمیک بدون «قفل ذهنی»

گاهی هیچ‌کدام را نام نمی‌بری، ولی شرط اتمیک کافی است:

```sql
UPDATE wallets
SET balance = balance - 100
WHERE id = 9 AND balance >= 100;
```

این الگو ساده و قدرتمند است.

---

## قاعدهٔ تصمیم

1. نرخ تعارض را تخمین بزن. بالا → pessimistic / اتمیک. پایین → optimistic.  
2. همیشه برای deadlock و retry بودجه بگذار.  
3. قفل را کوتاه نگه دار؛ HTTP خارجی داخل تراکنش نزن.
