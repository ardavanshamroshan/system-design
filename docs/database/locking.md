# Optimistic vs Pessimistic Locking

## مسئله

دو درخواست همزمان می‌خواهند یک ردیف را عوض کنند (مثلاً موجودی انبار). بدون کنترل:

```
A می‌خواند qty=5
B می‌خواند qty=5
A می‌نویسد qty=4
B می‌نویسد qty=4  ← یکی از کم‌شدن‌ها گم شد
```

دو راه کلاسیک: **Optimistic** و **Pessimistic**.

---

## Pessimistic Locking

«اول قفل کن، بعد کار کن.»

```sql
SELECT * FROM products WHERE id = 1 FOR UPDATE;
-- دیگران روی این ردیف صبر می‌کنند
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
| تداخل کمتر در لحظهٔ commit | انتظار / lock contention |
| مناسب conflict زیاد | خطر deadlock اگر ترتیب قفل‌ها بد باشد |

---

## Optimistic Locking

«بدون قفل بخوان؛ موقع نوشتن چک کن نسخه عوض نشده باشد.»

معمولاً ستون `version` یا `updated_at`:

```sql
UPDATE products
SET qty = 4, version = version + 1
WHERE id = 1 AND version = 3;
-- اگر 0 row → کسی زودتر نوشته؛ retry کن
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
| بدون lock طولانی | در conflict بالا، retry زیاد |
| مقیاس‌پذیرتر برای read سنگین | UX باید conflict را مدیریت کند |

---

## کی کدام؟

| سناریو | انتخاب رایج |
|--------|-------------|
| رزرو موجودی محدود، صندلی کنسرت | Pessimistic یا atomic `UPDATE ... WHERE qty > 0` |
| ویرایش پروفایل کاربر کم‌تداخل | Optimistic |
| تراکنش مالی حساس با ردیف‌های مرتبط | Pessimistic با ترتیب ثابت |
| سند协作 با ویرایش همزمان کم | Optimistic + merge |

---

## نکتهٔ atomic بدون «lock ذهنی»

گاهی هیچ‌کدام را صریح نمی‌نویسی، ولی شرط اتمی کافی است:

```sql
UPDATE wallets
SET balance = balance - 100
WHERE id = 9 AND balance >= 100;
```

این الگوی بسیار قوی و ساده است.

---

## قانون تصمیم

1. نرخ conflict را تخمین بزن. بالا → pessimistic / atomic. پایین → optimistic.  
2. همیشه برای deadlock و retry بودجه بگذار.  
3. قفل را کوتاه نگه دار؛ کار خارجی (HTTP) داخل تراکنش نکن.
