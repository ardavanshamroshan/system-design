# ACID و Transaction

> Database · درس‌نامه + پرسش و پاسخ · بخش ۲ بانک سؤال · ۱۸ سؤال · [فهرست همهٔ سؤال‌ها](/fa/interview/)

<QaControls />

## درس‌نامه {#lessons}

### چهار حرف و سازوکار هرکدام

- **Atomicity (همه یا هیچ):** اگر وسط کار خطا شد، هیچ اثری نمی‌ماند. در Postgres نسخه‌های ساخته‌ی Transaction لغوشده «نامرئی» علامت می‌خورند و VACUUM جمعشان می‌کند؛ در InnoDB با undo log به عقب برمی‌گردد.
- **Consistency:** Database از یک حالت معتبر به حالت معتبر دیگر می‌رود. ابزار Database Constraintهاست (PK، FK، UNIQUE، CHECK، NOT NULL)، ولی درستی قواعد business مسئولیت برنامه است.
- **Isolation:** Transactionهای همزمان اثر ناخواسته روی هم ندارند. پیاده‌سازی با Lock (2PL) یا snapshot (MVCC). چون Isolation کامل گران است، سطح‌بندی دارد.
- **Durability:** بعد از پاسخ commit داده با crash از بین نمی‌رود. سازوکار: WAL و fsync هنگام commit. برای تحمل خرابی دیسک، replication و backup لازم است.

در مقابل، مدل BASE (Basically Available، Soft state، Eventual consistency) Availability را به Consistency فوری ترجیح می‌دهد. ACID فقط داخل یک Database معنا دارد؛ بین چند سرویس باید با Saga، Outbox و idempotency کار کرد.

| Anomaly | Read Committed | Repeatable Read در Postgres | Serializable |
| --- | --- | --- | --- |
| Dirty read | ندارد | ندارد | ندارد |
| Non-repeatable read | دارد | ندارد | ندارد |
| Phantom read | دارد | ندارد | ندارد |
| Lost update | دارد | با خطا لغو می‌شود | ندارد |
| Write skew | دارد | دارد | ندارد |

### Isolation Levelها در عمل: PostgreSQL در برابر MySQL <Badge type="danger" text="حیاتی" />

نام سطح‌ها در استاندارد SQL یکی است ولی رفتارشان در هر Database فرق دارد. دو چیز را باید حفظ باشی: پیش‌فرض Postgres سطح Read Committed است و پیش‌فرض InnoDB سطح Repeatable Read؛ و «Repeatable Read» در این دو یک چیز نیست.

| سطح | PostgreSQL | MySQL InnoDB |
| --- | --- | --- |
| Read Uncommitted | همان Read Committed؛ dirty read وجود ندارد | dirty read واقعی |
| Read Committed | **پیش‌فرض.** هر دستور snapshot تازه می‌گیرد | هر دستور snapshot تازه می‌گیرد؛ gap lock تقریباً کنار می‌رود |
| Repeatable Read | snapshot isolation؛ نوشتن روی ردیفی که بعد از snapshot تغییر کرده با `40001` لغو می‌شود | **پیش‌فرض.** snapshot برای خواندن ساده؛ next-key lock برای Locking Read و نوشتن؛ خطای serialization ندارد |
| Serializable | SSI: Optimistic، کسی را Block نمی‌کند، هنگام تعارض `40001` | 2PL: هر `SELECT` ساده عملاً `FOR SHARE` می‌شود؛ انتظار و deadlock بیشتر |

ماتریس Anomalyها وقتی هر دو Database را کنار هم بگذاری:

| Anomaly | Read Committed (هر دو) | Repeatable Read در Postgres | Repeatable Read در InnoDB | Serializable (هر دو) |
| --- | --- | --- | --- | --- |
| Dirty read | ندارد | ندارد | ندارد | ندارد |
| Non-repeatable read | دارد | ندارد | ندارد | ندارد |
| Phantom read | دارد | ندارد | در خواندن ساده ندارد؛ با Locking Read یا نوشتن خود Transaction ممکن است | ندارد |
| Lost update | دارد | با `40001` لغو می‌شود | دارد (بی‌صدا) | ندارد |
| Write skew | دارد | دارد | دارد | ندارد |

نتیجه‌ی عملی: کدی که در InnoDB با «بخوان، در برنامه حساب کن، بنویس» ظاهراً کار می‌کند، با Migration به Postgres (یا برعکس) رفتارش عوض می‌شود. به Isolation Level تکیه نکن؛ هرجا درستی مهم است صریح باش: به‌روزرسانی Atomic، `FOR UPDATE`، ستون version یا Database Constraint.

### شهود MVCC و snapshot <Badge type="danger" text="حیاتی" />

در MVCC نوشتن، ردیف را درجا عوض نمی‌کند؛ نسخه‌ی جدید می‌سازد. در Postgres هر نسخه دو برچسب دارد: `xmin` (Transactionی که آن را ساخته) و `xmax` (Transactionی که آن را حذف یا جایگزین کرده). snapshot یعنی «فهرست Transactionهایی که در لحظه‌ی عکس‌گرفتن commit شده بودند»؛ هر نسخه‌ای که سازنده‌اش در این فهرست نباشد دیده نمی‌شود. مثل عکس گرفتن از تخته‌ی وایت‌برد: بقیه به نوشتن ادامه می‌دهند ولی تو از روی عکس خودت می‌خوانی. نتیجه: خواننده نویسنده را Block نمی‌کند و نویسنده خواننده را.

تنها تفاوت Read Committed و Repeatable Read در Postgres زمان گرفتن عکس است:

```text
time  ──────────────────────────────────────────────────────────▶
T1 (RC)   BEGIN   SELECT (snapshot #1)        SELECT (snapshot #2)  COMMIT
T1 (RR)   BEGIN   SELECT (snapshot #1)        SELECT (snapshot #1)  COMMIT
T2                          UPDATE + COMMIT
                                              RC: sees T2's change
                                              RR: still sees the old row
```

هزینه‌ی این مدل: نسخه‌های قدیمی باید تا وقتی یک snapshot قدیمی به آن‌ها نیاز دارد بمانند. به همین دلیل یک Transaction باز چندساعته جلوی VACUUM را می‌گیرد و جدول‌ها bloat می‌کنند (سؤال ۲.۹). در InnoDB نسخه‌های قدیمی در undo log هستند و Transaction طولانی history list را بزرگ می‌کند.

### WAL، fsync و group commit <Badge type="warning" text="مهم" />

قاعده‌ی write-ahead: پیش از آنکه تغییر یک page به فایل داده برسد، Record آن تغییر باید در WAL روی دیسک باشد. هنگام commit فقط WAL همان Transaction fsync می‌شود (نوشتن ترتیبی و ارزان)؛ pageهای داده بعداً توسط checkpoint و background writer نوشته می‌شوند (نوشتن تصادفی و گران). بعد از crash، Database WAL را از آخرین checkpoint دوباره اجرا می‌کند.

```text
COMMIT ─▶ WAL record in memory ─▶ fsync WAL ─▶ "OK" to client
                                      │
            later: checkpoint writes dirty data pages, old WAL is recycled
```

Bottleneck commit همان fsync است؛ روی SSD معمولی هر fsync از چند ده میکروثانیه تا چند میلی‌ثانیه طول می‌کشد. group commit چند Transaction همزمان را با یک fsync می‌نویسد؛ به همین دلیل throughput نوشتن با Concurrency بالا می‌رود ولی ۱۰٬۰۰۰ Transaction تک‌ردیفی پشت‌سرهم از یک Transaction با ۱۰٬۰۰۰ ردیف بسیار کندتر است. `synchronous_commit = off` پاسخ را قبل از fsync می‌دهد: با crash چند Transaction آخر (حداکثر حدود سه برابر `wal_writer_delay`) گم می‌شوند ولی Database خراب نمی‌شود، و می‌شود آن را فقط برای یک Transaction با `SET LOCAL` تنظیم کرد.

### مرز Transaction در کد برنامه <Badge type="danger" text="حیاتی" />

بیشتر باگ‌های Transaction از SQL نیستند؛ از این‌اند که مرز Transaction در کد جای اشتباهی است. سه قاعده: Transaction در لایه‌ی use-case باز و بسته شود (نه داخل repository)، همه‌ی Queryها روی همان Connection اجرا شوند، و هیچ I/O بیرونی داخل آن نباشد.

در Go Transaction یعنی یک Connection مشخص از pool؛ هر Query که با `db` (نه `tx`) اجرا شود روی Connection دیگری و بیرون از Transaction است:

```go
func Transfer(ctx context.Context, db *sql.DB, from, to, amount int64) error {
    tx, err := db.BeginTx(ctx, nil) // default isolation: READ COMMITTED on Postgres
    if err != nil {
        return err
    }
    defer tx.Rollback() // no-op after a successful Commit

    res, err := tx.ExecContext(ctx,
        `UPDATE accounts SET balance = balance - $1 WHERE id = $2 AND balance >= $1`, amount, from)
    if err != nil {
        return err
    }
    if n, _ := res.RowsAffected(); n == 0 {
        return ErrInsufficientFunds
    }
    if _, err = tx.ExecContext(ctx,
        `UPDATE accounts SET balance = balance + $1 WHERE id = $2`, amount, to); err != nil {
        return err
    }
    return tx.Commit()
}
```

در Laravel closure مرز را مشخص می‌کند: exception یعنی rollback و برگشتن عادی یعنی commit. کاری که باید «فقط اگر commit شد» انجام شود با `afterCommit` ثبت می‌شود:

```php
DB::transaction(function () use ($order) {
    $order->update(['status' => 'paid']);
    $order->items()->update(['locked' => true]);

    // runs only if the outermost transaction commits
    DB::afterCommit(fn () => SendReceipt::dispatch($order->id));
}, 3); // up to 3 attempts on deadlock
```

### Distributed Transaction: فقط یک اشاره <Badge type="info" text="تکمیلی" />

همه‌ی تضمین‌های بالا داخل یک Database است. به محض اینکه یک عملیات دو Database، یا Database و message broker را درگیر کند، دیگر «یک commit» وجود ندارد. دو راه هست: 2PC/XA (Atomic ولی Blocking؛ سؤال ۲.۱۶) یا کنار گذاشتن Atomicity و رسیدن به Eventual Consistency با <span class="vip-locked" title="VIP members only">Saga <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> و <span class="vip-locked" title="VIP members only">Outbox <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>. در معماری سرویس‌محور تقریباً همیشه راه دوم انتخاب می‌شود: Event در همان Transaction محلی در جدول outbox نوشته و بعداً منتشر می‌شود.

### جمع‌بندی سریع

| موضوع | چیزی که باید یادت بماند |
| --- | --- |
| پیش‌فرض‌ها | Postgres: Read Committed · InnoDB: Repeatable Read |
| Read Committed | snapshot برای هر دستور؛ دو `SELECT` پشت‌سرهم ممکن است دو دنیا ببینند |
| Repeatable Read در Postgres | یک snapshot برای کل Transaction؛ تعارض نوشتن → `40001` و retry |
| Serializable در Postgres | SSI؛ همیشه با حلقه‌ی retry |
| MVCC | خواننده و نویسنده همدیگر را Block نمی‌کنند؛ هزینه‌اش نسخه‌های مرده و VACUUM |
| Durability | fsync روی WAL هنگام commit؛ group commit هزینه را سرشکن می‌کند |
| مرز Transaction | کوتاه، روی یک Connection، بدون HTTP و ایمیل؛ اثر جانبی بعد از commit |
| lost update و write skew | به Isolation Level تکیه نکن؛ به‌روزرسانی Atomic، Lock یا Constraint |
| بین سرویس‌ها | Outbox و Saga و Consumer idempotent؛ نه 2PC |

## پرسش و پاسخ {#qa}

### ۲.۱ — ACID چیست؟ <Badge type="danger" text="حیاتی" /> {#q-2-1}

::: details پاسخ {open}
**پاسخ:** Atomicity (همه یا هیچ)، Consistency (Constraintها قبل و بعد برقرارند)، Isolation (Transactionهای همزمان انگار پشت‌سرهم اجرا شده‌اند) و Durability (بعد از commit ماندگار است).

**مثال واقعی:** انتقال وجه؛ کسر از A و واریز به B در یک Transaction. **یوزکیس:** هر عملیات مالی، موجودی و رزرو.

<strong class="qa-trap">دام مصاحبه:</strong> حرف C بیشتر مسئولیت برنامه است و Isolation در عمل سطح‌بندی دارد؛ پیش‌فرض بیشتر Databaseها Serializable نیست.
:::

### ۲.۲ — Atomicity چطور پیاده می‌شود؟ <Badge type="warning" text="مهم" /> {#q-2-2}

::: details پاسخ {open}
**پاسخ:** با Log. در مدل undo (InnoDB) مقدار قبلی نگه داشته و هنگام rollback برگردانده می‌شود. در Postgres نسخه‌ی جدید ردیف نوشته می‌شود و وضعیت Transaction (commit یا abort) تعیین می‌کند دیده شود یا نه؛ پس rollback تقریباً بی‌هزینه است.

**مثال واقعی:** خطا وسط درج ۱۰۰۰ ردیف؛ هیچ‌کدام دیده نمی‌شوند. **یوزکیس:** savepoint برای rollback جزئی داخل یک Transaction.

<strong class="qa-trap">دام مصاحبه:</strong> Atomicity درباره‌ی «لغوپذیری» است، نه Concurrency؛ آن موضوع Isolation است.
:::

### ۲.۳ — Durability دقیقاً چه تضمینی می‌دهد؟ <Badge type="warning" text="مهم" /> {#q-2-3}

::: details پاسخ {open}
**پاسخ:** Record commit قبل از پاسخ به Client روی دیسک fsync می‌شود. group commit چند Transaction را با یک fsync می‌نویسد. در Postgres پارامتر `synchronous_commit` سطح را تعیین می‌کند: `off` (سریع؛ ریسک گم‌شدن چند Transaction آخر)، `on` و `remote_apply` (تا اعمال روی standby صبر می‌کند).

**مثال واقعی:** Event Log کم‌اهمیت با `off`؛ پرداخت با standby همگام. **یوزکیس:** تعیین RPO.

<strong class="qa-trap">دام مصاحبه:</strong> دیسکی که درباره‌ی fsync دروغ می‌گوید یا `fsync=off` یعنی خطر خرابی، نه فقط گم‌شدن داده.
:::

### ۲.۴ — Consistency در ACID با Consistency در CAP چه فرقی دارد؟ <Badge type="warning" text="مهم" /> {#q-2-4}

::: details پاسخ {open}
**پاسخ:** در ACID یعنی برقرار ماندن Constraintها و invariantهای داده. در CAP یعنی همه‌ی Nodeها یک مقدار یکسان و تازه را ببینند (linearizability).

**مثال واقعی:** Constraint «موجودی منفی نشود» از نوع اول است؛ «replica هنوز مقدار قدیمی را نشان می‌دهد» از نوع دوم.
:::

### ۲.۵ — Isolation Levelها و پدیده‌های خواندن؟ <Badge type="danger" text="حیاتی" /> {#q-2-5}

::: details پاسخ {open}
**پاسخ:** Dirty read خواندن داده‌ی commit‌نشده است؛ Non-repeatable read دو مقدار متفاوت برای یک ردیف؛ Phantom ردیف‌های جدید در تکرار یک Query بازه‌ای. Read Committed جلوی اولی را می‌گیرد، Repeatable Read جلوی دومی را، و Serializable همه را.

**نکته‌ی Postgres:** سطح Read Uncommitted عملاً Read Committed است؛ Repeatable Read آن snapshot isolation است؛ Serializable با SSI پیاده شده و خطای `40001` باید retry شود.

**یوزکیس:** Read Committed برای اکثر OLTP؛ Serializable یا Lock صریح برای موجودی و رزرو.
:::

### ۲.۶ — Lost update چیست و چطور جلویش را می‌گیری؟ <Badge type="danger" text="حیاتی" /> {#q-2-6}

::: details پاسخ {open}
**پاسخ:** دو Transaction مقدار را می‌خوانند، هر دو بر اساس مقدار قدیمی می‌نویسند و یکی از تغییرها گم می‌شود. چهار راه:

1. به‌روزرسانی Atomic: `UPDATE t SET n = n - 1 WHERE id = ?`
2. Pessimistic Lock: `SELECT ... FOR UPDATE`
3. Optimistic Lock: ستون `version` در شرط WHERE
4. سطح Repeatable Read یا Serializable همراه با retry

**مثال واقعی:** دو ادمین همزمان موجودی کالا را اصلاح می‌کنند.
:::

### ۲.۷ — Write skew چیست و چرا snapshot isolation کافی نیست؟ <Badge type="warning" text="مهم" /> {#q-2-7}

::: details پاسخ {open}
**پاسخ:** دو Transaction داده‌ی مشترکی را می‌خوانند، هرکدام ردیف متفاوتی را تغییر می‌دهند و مجموعاً یک قاعده را می‌شکنند. چون ردیف‌ها فرق دارند، تعارض نوشتن دیده نمی‌شود.

**مثال واقعی:** دو پزشک آنکال همزمان چک می‌کنند «یک نفر دیگر هست» و هر دو off می‌شوند. **یوزکیس:** راه‌حل: Serializable، یا Lock روی ردیف مشترک (`FOR UPDATE`)، یا Constraint در Database (exclusion constraint برای رزرو بازه‌ای).
:::

### ۲.۸ — Savepoint و Transaction تو در تو؟ <Badge type="warning" text="مهم" /> {#q-2-8}

::: details پاسخ {open}
**پاسخ:** Databaseهای رابطه‌ای Transaction تو در توی واقعی ندارند؛ savepoint نقطه‌ای است که می‌شود فقط تا آن rollback کرد.

**مثال واقعی:** `DB::transaction()` تو در تو در Laravel با savepoint پیاده شده. **یوزکیس:** ادامه‌ی batch وقتی یک مورد خطا می‌دهد.

<strong class="qa-trap">دام مصاحبه:</strong> در Postgres بعد از خطا کل Transaction «aborted» می‌شود مگر با savepoint.
:::

### ۲.۹ — چرا Transaction طولانی خطرناک است؟ <Badge type="danger" text="حیاتی" /> {#q-2-9}

::: details پاسخ {open}
**پاسخ:** Lockها را نگه می‌دارد، جلوی VACUUM را می‌گیرد، lag می‌سازد و Connection pool را اشغال می‌کند.

**مثال واقعی:** فراخوانی HTTP Payment Gateway داخل Transaction. **یوزکیس:** کار بیرونی را قبل یا بعد از Transaction انجام بده و با Outbox هماهنگ کن.
:::

### ۲.۱۰ — Transaction با retry را چطور می‌نویسی؟ <Badge type="warning" text="مهم" /> {#q-2-10}

::: details پاسخ {open}
**پاسخ:** خطاهای serialization (`40001`) و deadlock (`40P01`) گذرا هستند و کل Transaction باید از اول اجرا شود؛ پس بدنه باید بدون اثر جانبی بیرونی باشد.

```go
func withTx(ctx context.Context, db *sql.DB, fn func(*sql.Tx) error) error {
    for attempt := 0; attempt < 3; attempt++ {
        tx, err := db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
        if err != nil {
            return err
        }
        if err = fn(tx); err == nil {
            err = tx.Commit()
        } else {
            _ = tx.Rollback()
        }
        var pgErr *pgconn.PgError
        if errors.As(err, &pgErr) && (pgErr.Code == "40001" || pgErr.Code == "40P01") {
            continue // serialization failure or deadlock: safe to retry
        }
        return err
    }
    return errors.New("transaction retries exhausted")
}
```

**یوزکیس:** در Laravel آرگومان دوم `DB::transaction($fn, 3)` همین کار را برای deadlock می‌کند.
:::

### ۲.۱۱ — ACID یا BASE؟ Transaction بین چند سرویس؟ <Badge type="warning" text="مهم" /> {#q-2-11}

::: details پاسخ {open}
**پاسخ:** داخل یک سرویس ACID؛ بین سرویس‌ها eventual consistency با Saga، Outbox و Consumer idempotent. 2PC ممکن است ولی Blocking و شکننده.

**مثال واقعی:** سفارش و پرداخت در دو سرویس جدا.
:::

### ۲.۱۲ — Read Committed و Repeatable Read در Postgres دقیقاً چه فرقی در رفتار دارند؟ <Badge type="danger" text="حیاتی" /> {#q-2-12}

::: details پاسخ {open}
**پاسخ:** دو فرق. اول، زمان snapshot: در Read Committed هر دستور snapshot تازه می‌گیرد، در Repeatable Read کل Transaction با snapshot اولین دستور کار می‌کند (نه لحظه‌ی `BEGIN`). دوم، رفتار نوشتن روی ردیفی که Transaction دیگری همزمان تغییرش داده: در Read Committed دستور منتظر می‌ماند، بعد از commit طرف مقابل شرط `WHERE` را روی نسخه‌ی جدید دوباره ارزیابی می‌کند و ادامه می‌دهد؛ در Repeatable Read با خطای `40001` (`could not serialize access due to concurrent update`) لغو می‌شود و باید کل Transaction را retry کنی.

```sql
-- session A                                   -- session B
BEGIN; -- READ COMMITTED
SELECT count(*) FROM orders WHERE user_id = 7; -- 3
                                               -- INSERT INTO orders (user_id) VALUES (7); COMMIT;
SELECT count(*) FROM orders WHERE user_id = 7; -- 4 under READ COMMITTED, 3 under REPEATABLE READ
COMMIT;
```

**مثال واقعی:** گزارشی که با چند Query جمع و جزئیات را جدا می‌خواند در Read Committed ممکن است جمعی بدهد که با جزئیات نمی‌خواند؛ با Repeatable Read همه از یک snapshot می‌خوانند. **یوزکیس:** Read Committed برای کار روزمره‌ی OLTP؛ Repeatable Read برای گزارش چند-Query، export و هر جا «یک تصویر ثابت» لازم است.

<strong class="qa-trap">دام مصاحبه:</strong> ارزیابی دوباره در Read Committed فقط `UPDATE ... WHERE balance >= 100` را ایمن می‌کند؛ Pattern «`SELECT` کن، در برنامه تصمیم بگیر، `UPDATE` کن» همچنان lost update دارد چون تصمیم روی داده‌ی کهنه گرفته شده است.
:::

### ۲.۱۳ — autocommit چیست و چه دام‌هایی در Go و PHP دارد؟ <Badge type="danger" text="حیاتی" /> {#q-2-13}

::: details پاسخ {open}
**پاسخ:** بدون `BEGIN` صریح، هر دستور Transaction مستقل خودش است و بلافاصله commit می‌شود. پس دو دستور پشت‌سرهم Atomic نیستند: اگر بین آن‌ها process بمیرد، اولی مانده و دومی اجرا نشده. دام رایج در Go این است که داخل Transaction، یک Query با `db` به‌جای `tx` اجرا شود؛ آن Query روی Connection دیگری از pool و بیرون از Transaction است.

```go
tx, _ := db.BeginTx(ctx, nil)
defer tx.Rollback()

tx.ExecContext(ctx, `UPDATE orders SET status = 'paid' WHERE id = $1`, id)
db.ExecContext(ctx, `INSERT INTO ledger (order_id) VALUES ($1)`, id) // BUG: db, not tx
```

این خط سه مشکل دارد: با rollback برنمی‌گردد، تغییر commit‌نشده‌ی `tx` را نمی‌بیند، و اگر `MaxOpenConns` کوچک باشد منتظر Connectionی می‌ماند که خود Transactionها گرفته‌اند و کل pool Lock می‌شود.

**مثال واقعی:** repositoryای که `*sql.DB` را در سازنده گرفته و نمی‌داند داخل Transaction صدا زده شده است. راه‌حل: Methodها interface مشترک `*sql.DB` و `*sql.Tx` را بگیرند (`ExecContext`، `QueryContext`، `QueryRowContext`) یا Transaction در `context` حمل شود. در Laravel همه‌ی Queryهای داخل closure روی یک connection اجرا می‌شوند، ولی مدلی که `$connection` دیگری دارد بیرون از Transaction می‌ماند. **یوزکیس:** برای یک دستور تکی autocommit بهترین انتخاب است؛ Transaction صریح رفت‌وبرگشت اضافه دارد.

<strong class="qa-trap">دام مصاحبه:</strong> در MySQL دستورهای DDL (`ALTER TABLE`، `CREATE INDEX`) Transaction باز را بی‌صدا commit می‌کنند؛ در Postgres بیشتر DDLها Transactionalاند و rollback می‌شوند. برعکسِ این هم دام است: Driverی که autocommit را خاموش می‌کند و فراموش‌کردن commit، Connection را در حالت `idle in transaction` رها می‌کند.
:::

### ۲.۱۴ — چرا نباید ایمیل، Queue job یا event را داخل Transaction فرستاد؟ <Badge type="danger" text="حیاتی" /> {#q-2-14}

::: details پاسخ {open}
**پاسخ:** اثر جانبی بیرونی با rollback برنمی‌گردد و ترتیبش با commit تضمین‌شده نیست. دو خرابی رایج: (۱) job قبل از commit به Queue می‌رود، worker فوراً آن را برمی‌دارد و ردیف را پیدا نمی‌کند (`ModelNotFoundException`) یا داده‌ی قدیمی می‌بیند؛ (۲) ایمیل یا event فرستاده می‌شود ولی Transaction بعداً rollback می‌شود و مشتری رسید سفارشی را گرفته که وجود ندارد.

```php
DB::transaction(function () use ($user) {
    $user->save();

    // BUG: SendWelcomeEmail::dispatch($user); -- a worker may pick it up before COMMIT
    SendWelcomeEmail::dispatch($user)->afterCommit(); // pushed to the queue only after COMMIT
});
```

**مثال واقعی:** این باگ فقط زیر بار دیده می‌شود: در محیط توسعه worker کندتر از commit است و همه‌چیز کار می‌کند. **یوزکیس:** در Laravel گزینه‌ی `after_commit` در تنظیمات Queue Connection، Method `afterCommit()` روی job و Interface `ShouldDispatchAfterCommit` برای event. در Go اثر جانبی را بعد از برگشتن موفق `Commit()` اجرا کن.

<strong class="qa-trap">دام مصاحبه:</strong> «بعد از commit» هم تضمین نیست: اگر process بین commit و dispatch بمیرد، Message هرگز فرستاده نمی‌شود. وقتی گم‌شدن Message پذیرفتنی نیست، Message را در همان Transaction در جدول outbox بنویس و جدا منتشر کن (<span class="vip-locked" title="VIP members only">Outbox <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>).
:::

### ۲.۱۵ — اگر Connection درست هنگام `COMMIT` قطع شود چه می‌کنی؟ retry امن چطور ساخته می‌شود؟ <Badge type="warning" text="مهم" /> {#q-2-15}

::: details پاسخ {open}
**پاسخ:** نتیجه نامعلوم است: ممکن است commit انجام شده و فقط پاسخ نرسیده باشد. خطاهای `40001` و `40P01` یعنی «قطعاً انجام نشد» و retry کورکورانه امن است؛ خطای شبکه یا timeout هنگام commit چنین نیست و retry کورکورانه یعنی کسر دوباره از حساب. راه‌حل این است که خود Transaction idempotent باشد: یک کلید یکتا برای هر درخواست، با UNIQUE Constraint، در همان Transaction ثبت شود.

```sql
BEGIN;
INSERT INTO processed_requests (idempotency_key) VALUES ('7f3c-order-991')
ON CONFLICT (idempotency_key) DO NOTHING;
-- 0 rows inserted => this request already committed earlier: ROLLBACK and return the stored result
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
COMMIT;
```

**مثال واقعی:** Client موبایل بعد از timeout دکمه‌ی پرداخت را دوباره می‌زند؛ Header `Idempotency-Key` همان درخواست را شناسایی می‌کند. failover Database وسط commit هم همین وضعیت را می‌سازد. **یوزکیس:** هر عملیات غیرقابل‌تکرار: پرداخت، کسر موجودی، صدور فاکتور.

<strong class="qa-trap">دام مصاحبه:</strong> ثبت کلید باید در همان Transaction کار اصلی باشد. اگر کلید در Redis یا Transaction جدا ثبت شود، دوباره پنجره‌ای هست که یکی انجام شده و دیگری نه.
:::

### ۲.۱۶ — 2PC و XA چطور کار می‌کنند و چرا کمتر استفاده می‌شوند؟ <Badge type="info" text="تکمیلی" /> {#q-2-16}

::: details پاسخ {open}
**پاسخ:** در فاز اول (prepare) هماهنگ‌کننده از هر شرکت‌کننده می‌خواهد Transaction را تا مرز commit ببرد و قول بدهد که می‌تواند commit کند؛ در فاز دوم اگر همه قول دادند دستور commit می‌دهد، وگرنه rollback. XA رابط استاندارد همین Protocol است. در Postgres با `PREPARE TRANSACTION` پیاده می‌شود و پیش‌فرض خاموش است (`max_prepared_transactions = 0`).

```sql
-- on each participant
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
PREPARE TRANSACTION 'transfer-991'; -- phase 1: survives restart, keeps its locks

-- coordinator, after every participant prepared successfully
COMMIT PREPARED 'transfer-991';     -- phase 2 (or ROLLBACK PREPARED 'transfer-991')

-- find orphans left by a dead coordinator
SELECT gid, prepared FROM pg_prepared_xacts;
```

**مثال واقعی:** اگر هماهنگ‌کننده بعد از prepare بمیرد، شرکت‌کننده‌ها «in-doubt» می‌مانند: Lockها را نگه می‌دارند، جلوی VACUUM را می‌گیرند و خودشان حق تصمیم ندارند. **یوزکیس:** درون Distributed Databaseها و ابزارهای sharding که هماهنگ‌کننده‌ی مقاوم دارند؛ یا بین دو Database تحت کنترل یک تیم. بین Microserviceها Saga و Outbox.

<strong class="qa-trap">دام مصاحبه:</strong> 2PC Atomicity می‌دهد نه Isolation: بین commit شرکت‌کننده‌ی اول و دوم، خواننده حالت نیمه‌کاره را می‌بیند. در دسترس بودن هم ضرب می‌شود: با خرابی هر شرکت‌کننده کل عملیات متوقف است.
:::

### ۲.۱۷ — Constraint deferred چیست و کجا لازم می‌شود؟ <Badge type="info" text="تکمیلی" /> {#q-2-17}

::: details پاسخ {open}
**پاسخ:** به‌طور پیش‌فرض Constraintها بلافاصله بعد از هر دستور بررسی می‌شوند (و UNIQUE معمولی در Postgres حتی ردیف‌به‌ردیف). Constraintی که `DEFERRABLE` تعریف شده را می‌شود تا لحظه‌ی commit عقب انداخت؛ یعنی وسط Transaction حالت موقتاً نامعتبر مجاز است، به شرط اینکه در پایان معتبر باشد. فقط UNIQUE، PRIMARY KEY، FOREIGN KEY و EXCLUDE این قابلیت را دارند؛ `NOT NULL` و `CHECK` همیشه فوری‌اند.

```sql
ALTER TABLE slides
    ADD CONSTRAINT slides_deck_pos_uniq UNIQUE (deck_id, position)
    DEFERRABLE INITIALLY IMMEDIATE;

BEGIN;
SET CONSTRAINTS slides_deck_pos_uniq DEFERRED;
UPDATE slides SET position = 2 WHERE id = 10; -- temporary duplicate is allowed
UPDATE slides SET position = 1 WHERE id = 11;
COMMIT; -- checked here
```

**مثال واقعی:** جابه‌جایی ترتیب دو آیتم با Constraint یکتایی روی `position`؛ درج دو ردیف که با FOREIGN KEY به هم اشاره می‌کنند (Circular Dependency). **یوزکیس:** بارگذاری داده‌ی حجیم با ترتیب دلخواه جدول‌ها.

<strong class="qa-trap">دام مصاحبه:</strong> خطا به لحظه‌ی `COMMIT` منتقل می‌شود؛ کدی که فقط خطای دستورها را بررسی می‌کند و خطای commit را نادیده می‌گیرد آن را از دست می‌دهد. UNIQUE Constraint از نوع deferrable را هم نمی‌شود در `ON CONFLICT` به‌کار برد، و InnoDB اصلاً Constraint deferred ندارد.
:::

### ۲.۱۸ — Transaction read-only به چه درد می‌خورد؟ گزارش طولانی را چطور امن اجرا می‌کنی؟ <Badge type="info" text="تکمیلی" /> {#q-2-18}

::: details پاسخ {open}
**پاسخ:** Transaction برای خواندن هم معنا دارد: چند `SELECT` در یک Transaction Repeatable Read همه از یک snapshot می‌خوانند و اعدادشان با هم جور درمی‌آید. `READ ONLY` جلوی نوشتن تصادفی را می‌گیرد و قصد را مستند می‌کند. `pg_dump` دقیقاً همین‌طور یک backup سازگار می‌گیرد.

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT count(*) FROM orders WHERE created_at >= '2026-01-01';
SELECT sum(total) FROM orders WHERE created_at >= '2026-01-01'; -- same snapshot as the count
COMMIT;
```

در Go همین با `sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true}` ساخته می‌شود.

**مثال واقعی:** export شبانه‌ای که چند جدول را می‌خواند و باید «تصویر یک لحظه» باشد. **یوزکیس:** گزارش سنگین را روی replica اجرا کن تا primary آزاد بماند. در سطح Serializable، حالت `READ ONLY DEFERRABLE` منتظر یک snapshot امن می‌ماند و بعد بدون سربار SSI و بدون خطر `40001` اجرا می‌شود.

<strong class="qa-trap">دام مصاحبه:</strong> read-only به معنای بی‌هزینه نیست. snapshot قدیمی روی primary جلوی پاک‌شدن نسخه‌های مرده را می‌گیرد (bloat). روی replica هم Query طولانی با اعمال WAL تعارض پیدا می‌کند و با `canceling statement due to conflict with recovery` لغو می‌شود؛ باید بین `max_standby_streaming_delay` (lag بیشتر) و `hot_standby_feedback` (bloat روی primary) انتخاب کنی.
:::

## مطالب مرتبط {#related}

- <span class="vip-locked" title="VIP members only">Optimistic و Pessimistic Lock <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>
- <span class="vip-locked" title="VIP members only">Lockها و Concurrency <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>
- <span class="vip-locked" title="VIP members only">Saga Pattern <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>
