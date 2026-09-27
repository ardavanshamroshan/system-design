# Replication (تکثیر)

> ماژول D — معماری سیستم · بخش ۹٫۶ (بعد از Fallacies / مبانی CAP)

## فهرست ذهنی

1. [چیست و چرا](#چیست-و-چرا)  
2. [مدل ذهنی](#مدل-ذهنی)  
3. [Sync در برابر Async](#sync-در-برابر-async)  
4. [توپولوژی‌ها](#توپولوژیها)  
5. [Lag، دوام، و مسیریابی خواندن](#lag-دوام-و-مسیریابی-خواندن)  
6. [Failover و split-brain](#failover-و-split-brain)  
7. [Quorum و PACELC](#quorum-و-pacelc)  
8. [Laravel / Postgres در عمل](#laravel--postgres-در-عمل)  
9. [چالش‌های واقعی](#چالشهای-واقعی)  
10. [نکته‌های مصاحبه](#نکتههای-مصاحبه)  
11. [قانون تصمیم](#قانون-تصمیم)  
12. [ضدالگوها](#ضدالگوها)  
13. [تمرین ذهنی](#تمرین-ذهنی)

---

## چیست و چرا

**Replication** همان دادهٔ منطقی را روی چند نود کپی می‌کند تا:

- خواندن مقیاس بگیرد (replica)،
- مرگ یک نود قابل‌تحمل باشد (HA)،
- جغرافیا به کاربر نزدیک‌تر شود (latency).

رایگان نیست. هر replica اضافه می‌کند: ریسک lag، پیچیدگی failover، سطح conflict، هزینهٔ ops.

| هدف | Replication کمک می‌کند؟ | مالیات اصلی |
|-----|--------------------------|-------------|
| QPS خواندن بیشتر | بله (read replica) | خواندن stale |
| زنده ماندن بعد از مرگ دیسک/نود | بله | درستی failover |
| Write چندمنطقه‌ای | سخت | conflict / latency |
| Consistency قوی همه‌جا | اغلب به latency **ضرر** می‌زند | quorum همزمان |

مرتبط: [Fallacyها و PACELC](/fa/architecture/fallacies-pacelc) · [CAP](/fa/architecture/cap-theorem) · [قفل‌گذاری](/fa/database/locking) · [Outbox](/fa/patterns/outbox)

---

## مدل ذهنی

یک **حقیقت نویسنده** (یا چندتا، اگر multi-leader) به‌علاوهٔ **follower**هایی که همان جریان تغییر را اعمال می‌کنند:

```
Client write ──► Primary ──WAL/binlog──► Replica A
                     │                      │
                     └──────────────────► Replica B
Client read  ◄── primary و/یا replicaها (سیاست!)
```

هر طراحی باید جواب بدهد:

1. **چه کسی write می‌پذیرد؟** (تک‌primary در برابر multi-leader)  
2. **write کی «تمام» است؟** (fsync محلی در برابر انتظار N replica)  
3. **خواندن کجا می‌رود؟** (همیشه primary / sticky / هر replica)  
4. **اگر primary وسط کار بمیرد؟** (failover + fencing)

::: tip
Replication **تاریخچهٔ تغییر** را کپی می‌کند. به‌تنهایی مدل consistency جدید نمی‌سازد — **سیاست ACK + مسیریابی خواندن** تمایل PACELC را تعیین می‌کند.
:::

---

## Sync در برابر Async

| حالت | ACK نوشتن وقتی… | حالت شکست | تمایل |
|------|-----------------|------------|--------|
| **Async** | Primary محلی durable شد | اگر primary بسوزد، replica ممکن است N commit آخر را نبیند | L پایین، دوام ضعیف‌تر |
| **Sync** (کامل) | همهٔ replicaها ACK | هر replica پایین → write متوقف | قوی‌تر، L بالا |
| **Quorum / semi-sync** | اکثریت (یا standby مشخص) ACK | از دست رفتن اقلیت OK؛ از دست رفتن اکثریت → رد یا promote با احتیاط | نزدیک PC/EC |

```
Async:     Client ← ACK ← Primary          (replica بعداً می‌رسد)
Semi-sync: Client ← ACK ← Primary ← ACK ← Standby
Sync all:  Client ← ACK ← Primary ← ACK ← همهٔ replicaها
```

**قاعدهٔ سرانگشتی:** پول / موجودی → حداقل **semi-sync یا quorum**. Analytics / گرم‌کردن کش → async OK.

---

## توپولوژی‌ها

### تک‌رهبر (primary / secondary)

اکثر ستاپ‌های Laravel/Postgres/MySQL.

| مزیت | ضرر |
|------|------|
| داستان conflict ساده (یک نویسنده) | Primary گلوگاه write است |
| Failover شناخته‌شده | اشتباه failover → split-brain |
| مدل ذهنی آسان | Write بین‌منطقه‌ای همیشه به یک جا می‌خورد |

### Multi-leader

Write در ≥۲ منطقه پذیرفته می‌شود.

| مزیت | ضرر |
|------|------|
| Latency نوشتن محلی | حل conflict اجباری است |
| زنده ماندن write منطقه | اپ باید ردیف واگرا را هندل کند |

فقط با **قواعد merge روشن** (CRDT، LWW با version vector، یا «برنده» دامنه). هرگز multi-leader برای کیف پول بدون داستان conflict.

### بدون رهبر (سبک Dynamo)

کلاینت به N نود می‌نویسد؛ quorum R/W. ببین [CAP](/fa/architecture/cap-theorem) + NWR. قدرتمند، ops سنگین — پیش‌فرض اپ RDBMS کلاسیک نیست.

---

## Lag، دوام، و مسیریابی خواندن

**Replication lag** = فاصلهٔ زمانی بین commit روی primary و apply روی replica.

```
t=0    primary سفارش #1001 را paid می‌کند
t=1.2s replica هنوز unpaid نشان می‌دهد   ← پنجرهٔ lag
```

### Read-your-writes

بعد از write موفق، همان کاربر باید آن را ببیند. گزینه‌ها:

| استراتژی | چگونه |
|----------|--------|
| **Sticky primary** | همان session / کاربر را T ثانیه به primary بفرست |
| **توکن read-after-write** | کلاینت `last_write_lsn` / زمان می‌فرستد؛ replica فقط اگر رسیده باشد جواب می‌دهد |
| **همیشه primary برای جریان mutating** | چک‌اوت، تأیید ذخیرهٔ پروفایل |

```php
// مفهومی Laravel — sticky primary بعد از write
session(['read_from_primary_until' => now()->addSeconds(5)]);

$connection = session('read_from_primary_until')?->isFuture()
    ? 'pgsql_primary'
    : 'pgsql_replica';

$order = DB::connection($connection)
    ->table('orders')
    ->where('id', $orderId)
    ->first();
```

```python
# همان ایده — صفحهٔ «پرداخت موفق» را از replica عقب‌افتاده سرو نکن
def choose_connection(user_just_wrote: bool) -> str:
    return "primary" if user_just_wrote else "replica"
```

### دوام ≠ دیده‌شدن

Semi-sync می‌تواند write را روی standby **durable** کند در حالی که **replica دیگری** برای خواندن هنوز عقب است. جدا کن:

- **سیاست دوام** (fsync / sync_commit / `rpl_semi_sync`)  
- **سیاست مسیریابی خواندن** (کدام نود برای کدام کوئری)

---

## Failover و split-brain

**Failover:** وقتی primary قدیمی در دسترس نیست، یک replica را primary کن.

**Split-brain:** دو نود هر دو خود را primary می‌دانند → write واگرا → merge کابوس (مخصوصاً پول).

```
AZ-1 Primary ◄──X──► AZ-2 Replica (promote شد؟)
         │                    │
      هنوز می‌پذیرد         او هم می‌پذیرد
         write               write
              ╲             ╱
               DB واگرا
```

### الزامات سخت برای failover امن

1. **Fencing** — primary قدیمی بعد از promote دیگر write نپذیرد (STONITH، لغو lease، fencing دیسک).  
2. **Lease تک‌نویسنده** — با consensus (Patroni + etcd/ZooKeeper) یا failover مدیریت‌شدهٔ ابری.  
3. **Reconnect اپ** — pool اتصال primary مرده را رها کند؛ DNS نویسندهٔ جدید را پیدا کند.  
4. **Replay / catch-up** — primary جدید باید آخرین موقعیت durable شناخته‌شده را داشته باشد (یا از دست رفتن داده را **صریح** بپذیری).

```php
// سمت اپ: خطای اتصال = «شاید failover»، نه retry ابدی روی IP مرده
try {
    DB::connection('pgsql')->transaction(fn () => $this->placeOrder($cmd));
} catch (QueryException $e) {
    if ($this->isConnectionLost($e)) {
        // backoff کوتاه؛ DNS/ProxySQL/PgBouncer باید به primary جدید اشاره کند
        usleep(200_000);
        DB::purge('pgsql');
        DB::reconnect('pgsql');
        // retry فقط اگر عملیات ایدمپوتنت است
    }
    throw $e;
}
```

::: danger
Failover خودکار **بدون fencing** اغلب بدتر از downtime است. Dual primary برای پرداخت = رویداد محدودکنندهٔ شغل.
:::

---

## Quorum و PACELC

انتخاب‌های replication همان پیچ‌های PACELCاند:

| تنظیم | زیر partition | مسیر سالم |
|-------|---------------|-----------|
| Async + read replica | اغلب **A** (stale OK) | **L** (سریع) — تمایل PA/EL |
| Write با quorum همزمان | ترجیح **C** (بدون quorum رد کن) | هزینهٔ **C** بیشتر → latency بالاتر — تمایل PC/EC |
| Multi-leader + LWW | **A** با conflict | L پایین، C ضعیف |

یادآوری NWR (بدون رهبر / سبک Dynamo):

- **N** کپی، **W** ACK نوشتن، **R** نود خواندن  
- خواندن نسبتاً قوی اگر `R + W > N`

RDBMS تک‌primary کلاسیک معمولاً: **W = primary (+ اختیاری sync standby)**، خواندن اختیاری از replica با lag.

---

## Laravel / Postgres در عمل

### اتصال‌ها

```php
// config/database.php (طرح)
'pgsql' => [ /* پیش‌فرض — اغلب primary */ ],
'pgsql_replica' => [
    'driver' => 'pgsql',
    'host' => env('DB_REPLICA_HOST'),
    // کاربر فقط‌خواندنی توصیه می‌شود
],
```

```php
// آفلود صریح خواندن — برای مسیر پول حدس نزن
$products = DB::connection('pgsql_replica')
    ->table('products')
    ->where('active', true)
    ->paginate(40);

DB::connection('pgsql')->transaction(function () use ($order) {
    // write همیشه primary
    $order->markPaid();
});
```

### پیچ‌های Postgres (مفهومی)

| پیچ | اثر |
|-----|------|
| `synchronous_commit = on` | منتظر flush محلی (نه لزوماً replica) |
| `synchronous_standby_names` | منتظر standby نام‌دار — semi-sync / sync |
| Streaming replication | ارسال WAL به replica |
| Logical replication | سطح جدول / بین نسخه؛ قواعد lag و conflict فرق دارد |

خویشاوندان MySQL: binlog، `rpl_semi_sync_master_enabled`، failover با GTID.

### Laravel **برایت انجام نمی‌دهد**

- انتخاب sync در برابر async  
- Fence کردن primary زامبی  
- تضمین read-your-writes روی `pgsql_replica`  

این‌ها **infra + سیاست مسیریابی**اند. کد اپ فقط سیاست را رعایت می‌کند.

---

## چالش‌های واقعی

### چالش الف — پشتیبانی unpaid می‌بیند؛ مشتری رسید دارد

پرداخت روی primary نوشته شد. UI ادمین از replica می‌خواند (lag ۳ ثانیه). اپراتور سفارش «پرداخت‌نشده» را refund می‌کند → آشوب دوبل.

| علت | اصلاح |
|-----|--------|
| مسیریابی خواندن زمینهٔ mutating را نادیده گرفت | Sticky primary / توکن برای ابزار ops هم |
| فرض lag ≈ ۰ | Fallacy #۲ |

### چالش ب — Failover «بدون downtime» ۴۰ سفارش آخر را می‌بلعد

Replica async بعد از مرگ دیسک primary promote شد. آخرین WAL ارسال نشده → سفارش‌های «paid» روی primary مرده روی primary جدید وجود ندارند. PSP پول گرفته؛ DB می‌گوید سفارشی نیست.

| علت | اصلاح |
|-----|--------|
| دوام async + promote خودکار | Semi-sync / quorum؛ یا پذیرش از دست رفتن **و** reconcile از webhookهای PSP |
| بدون reconcile outbox/PSP | Consumer ایدمپوتنت webhook حقیقت را بازمی‌سازد |

```php
// وقتی failover دم WAL را از دست بدهد، webhook PSP منبع حقیقت پول است
public function handlePaymentSucceeded(array $payload): void
{
    Order::query()->updateOrCreate(
        ['psp_payment_id' => $payload['id']],
        ['status' => 'paid', 'paid_at' => $payload['created']],
    );
}
```

### چالش ج — Split-brain بعد از VPN شل بین AZ

هر دو طرف promote. موجودی روی دو primary جدا کم شد. اسکریپت merge «بیشینه version» را برمی‌دارد → موجودی غلط.

| علت | اصلاح |
|-----|--------|
| Failover بدون quorum/lease | Patroni/etcd یا HA مدیریت‌شده با fencing |
| LWW روی موجودی | تابع merge غلط برای stock — قواعد دامنه + audit |

### چالش د — استخر replica برای «سرعت» روی checkout

Checkout موجودی را از replica می‌خواند، رزرو را روی primary می‌نویسد. مسابقه: دو checkout روی replica عقب‌افتاده stock=1 می‌بینند → oversell.

| علت | اصلاح |
|-----|--------|
| Consistency مخلوط در یک جریان | رزرو روی primary با [قفل](/fa/database/locking) / کاهش اتمی |
| ناسازگاری PACELC | Checkout تمایل PC/EC می‌خواهد، نه PA/EL |

```php
DB::connection('pgsql')->transaction(function () use ($sku) {
    $row = DB::table('inventory')->where('sku', $sku)->lockForUpdate()->first();
    if ($row->qty < 1) {
        throw new OutOfStock();
    }
    DB::table('inventory')->where('sku', $sku)->decrement('qty');
});
```

---

## نکته‌های مصاحبه

1. **Primary + replica** بکش، بعد بپرس: sync یا async؟ خواندن کجا؟  
2. **Lag** را صریح بگو؛ استراتژی read-your-writes بده.  
3. Failover: **fencing / split-brain** را بگو — نه فقط «replica را promote کن».  
4. به PACELC وصل کن: replica async = EL؛ quorum sync = EC.  
5. نگو «replication = consistency قوی».  

---

## قانون تصمیم

1. پیش‌فرض **تک‌نویسنده**؛ multi-leader فقط با پروتکل conflict.  
2. پول / موجودی / صندلی: write (+ خواندن حیاتی بعد از write) روی **primary**؛ دوام **semi-sync/quorum** را ترجیح بده.  
3. خواندن کاتالوگ / فید: replica OK؛ حداکثر lag قابل‌قبول را مستند کن.  
4. Failover: **fencing > اسکریپت زرنگ**. برای پرداخت downtime بهتر از dual primary است.  
5. بعد از write: sticky primary یا دروازهٔ LSN — هرگز «امید به lag صفر».  
6. پول بیرونی (PSP) را با **webhook ایدمپوتنت** reconcile کن — replication دفترکل نیست.

---

## ضدالگوها

- همهٔ خواندن‌ها روی replica، از جمله تأیید بعد از checkout  
- Replication async + failover خودکار به‌عنوان «RPO = ۰»  
- IP هاردکد primary (fallacy توپولوژی)  
- Multi-leader بدون قواعد merge  
- استفاده از `max(updated_at)` برای merge موجودی بانکی  
- فرض اینکه چون RDS هست، Laravel `DB::connection('mysql')` failover را حل کرده — هنوز باید سیاست خواندن تعریف کنی  

---

## تمرین ذهنی

Postgres primary + ۲ replica async پشت Laravel داری:

1. کاربر پرداخت می‌کند؛ فوراً GET `/orders/{id}` — کدام connection؟ چرا؟  
2. Primary می‌میرد؛ lag replica ۲ ثانیه بود — چه چیزی ممکن است از دست برود؟ چطور می‌فهمی؟  
3. Sync به یک standby روشن می‌کنی — چه خریدی؟ چه دادی؟  
4. باگ ادمین «refund unpaid» — کدام سیاست شکست؟  
5. الگوی بعدی: چندگام **Order → Pay → Ship** بین سرویس‌ها — چرا فقط replication نجاتت نمی‌دهد → [Saga](/fa/patterns/saga).
