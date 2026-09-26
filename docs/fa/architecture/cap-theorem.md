# قضیهٔ CAP

> ماژول D — معماری سیستم · بخش ۱۰

## فهرست ذهنی

1. [چیست و چرا](#چیست-و-چرا)  
2. [مدل ذهنی](#مدل-ذهنی)  
3. [CP / AP / CA](#cp--ap--ca)  
4. [تمایل تقریبی سیستم‌ها](#تمایل-تقریبی-سیستمها)  
5. [طیف Consistency](#طیف-consistency)  
6. [نکته‌های مصاحبه](#نکتههای-مصاحبه)  
7. [Tradeoff به‌ازای feature](#tradeoff-بهازای-feature)  
8. [قانون تصمیم](#قانون-تصمیم)  
9. [ضدالگوها](#ضدالگوها)

---

## چیست و چرا

**CAP** (اریک بروئر، ۲۰۰۰): در یک سیستم **توزیع‌شده** با دادهٔ مشترک، وقتی **network partition** رخ دهد، هر سه را هم‌زمان کامل نمی‌توانی تضمین کنی:

| حرف | معنی |
|-----|------|
| **C** Consistency | هر read موفق، آخرین write موفق را می‌بیند (یا خطا) |
| **A** Availability | هر درخواست به نود سالم، پاسخ غیرخطا می‌گیرد (ممکن است stale باشد) |
| **P** Partition tolerance | سیستم با وجود از دست رفتن پیام / قطع بین نودها به کار ادامه می‌دهد |

**چرا هر سه نه؟** Partition (latency، قطع کابل، ایزوله شدن AZ) اجتناب‌ناپذیر است. نودها نمی‌توانند sync شوند. باید انتخاب کنی:

- تا امن نشدن، رد / بلاک کن → **C** را نگه دار، **A** را بده (**CP**)  
- از state محلی جواب بده → **A** را نگه دار، **C** را بده (**AP**)

در عمل برای سیستم توزیع‌شدهٔ واقعی **P تقریباً اجباری است**. انتخاب مفید اغلب **CP در برابر AP** است.

::: tip
CAP **فقط در زمان partition** معنا دارد. روز عادی ممکن است C و A هر دو خوب به‌نظر برسند. تلهٔ مصاحبه: CAP را «هر روز برای همیشه دو تا از سه» گرفتن.
:::

مرتبط: [API Gateway](/fa/architecture/api-gateway) · [Outbox](/fa/patterns/outbox) · [Brokerها](/fa/messaging/brokers)

---

## مدل ذهنی

دو سرور؛ لینک قطع:

```
Client → [S1]  ⚡ cut  [S2] ← Client
           write X=1     read X → ?
```

Write روی S1 می‌نشیند. Read به S2 می‌خورد. S1 و S2 حرف نمی‌زنند.

| انتخاب | رفتار |
|--------|--------|
| نگه داشتن **C** | S2 رد / timeout → از دست رفتن **A** |
| نگه داشتن **A** | S2 مقدار قدیمی X را می‌دهد → از دست رفتن **C** |

کل قضیه در یک دیاگرام. همان ایدهٔ آپدیت پروفایل USA ↔ Europe: نام stale نشان بده (**AP**) یا خطا (**CP**).

---

## CP / AP / CA

### CP — Consistency + Partition tolerance

دادهٔ درست را ترجیح بده؛ موقع partition ممکن است کار را رد کند.

| تمایل رایج | یادداشت |
|------------|---------|
| MongoDB (majority write concern / حالت سخت) | منتظر quorum؛ minority ممکن است unavailable شود |
| HBase، ZooKeeper، etcd | هماهنگی؛ بدون quorum → بدون جواب |
| Spanner / CockroachDB | strong consistency؛ هزینهٔ latency |
| MySQL/Postgres primary + sync replica | اگر sync/quorum کامل نشود ممکن است write بایستد |

**کی:** موجودی اشتباه فاجعه است — بانکی، رزرو صندلی، reservation موجودی، پروندهٔ پزشکی.

### AP — Availability + Partition tolerance

جواب دادن را ترجیح بده؛ بعداً reconcile (eventual، versioning، CRDT، last-write-wins، …).

| تمایل رایج | یادداشت |
|------------|---------|
| Cassandra، DynamoDB (حالت eventual) | write را می‌پذیرد؛ بعد هم‌گرا می‌شود |
| CouchDB | multi-master + conflict docs |
| فید / لایک / شمارنده | چند ثانیه–دقیقه stale قابل قبول |

**کی:** downtime بیشتر از کمی stale آسیب می‌زند — newsfeed، عکس پروفایل، مرور سبد (checkout ممکن است هنوز CP باشد).

### CA — Consistency + Availability (برای توزیع‌شده نظری)

RDBMS تک‌نود (یک MySQL/Postgres بدون replication چندنودی) می‌تواند شبیه CA باشد: ACID + همیشه جواب **همان** نود. بین نودها **partition-tolerant نیست** — چندنود + split → CAP اعمال می‌شود. Redis **تک‌نود** هم همین: ادعای CAP توزیع‌شده نیست؛ نقطهٔ شکست واحد است.

::: warning
«ما CA هستیم» در مارکتینگ DB چندمنطقه‌ای معمولاً غلط است یا یعنی happy path. سیستم‌ها را **نزدیک به CP / نزدیک به AP** بخوان و quorum، replication و default کلاینت را چک کن.
:::

---

## تمایل تقریبی سیستم‌ها

| سیستم | تمایل تقریبی | یادداشت کوتاه |
|-------|--------------|---------------|
| MySQL primary + sync replica سخت | نزدیک به CP | نوشتن روی primary؛ بدون quorum ممکن است unavailable |
| DynamoDB / Cassandra سبک | AP + eventual | همیشه پاسخ؛ ممکن است stale |
| Redis single node | نه واقعاً distributed CAP | SPOF؛ فرمول CAP اعمال نمی‌شود |
| Kafka | حول log + replication | trade-off روی ISR / `acks` — برچسب خام CAP نزن |
| ZooKeeper / etcd | CP | هماهنگی کلاستر |
| Redis Cluster | وابسته به config | ساده نگیر — مستندات را بخوان |

---

## طیف Consistency

«C» در CAP ≈ **linearizability / strong consistency** در اثبات کلاسیک — یکی نیست با «C» در ACID (قیدها). طیفی که واقعاً طراحی می‌کنی:

| مدل | تضمین | کاربرد رایج |
|-----|--------|-------------|
| **Strong** | بعد از write موفق، هر read همان را می‌بیند | موجودی، رزرو |
| **Causal** | رویدادهای مرتبط ترتیب منطقی دارند (کامنت بعد از پست) | فید تعاملی |
| **Read-your-writes** | خودت همیشه آپدیت خودت را می‌بینی | UX ویرایش پروفایل |
| **Eventual** | اگر writeها بایستند، replicaها هم‌گرا می‌شوند | DNS، شمارنده، لایک |

عمیق‌تر از «۲ از ۳»: **PACELC** — اگر Partition → بین A و C؛ **Else** (عادی) → بین Latency و Consistency. CAP فقط گوشهٔ کوچک *C کامل + A کامل زیر partition* را ممنوع می‌کند.

---

## نکته‌های مصاحبه

1. NFR را با این شروع کن: **«روی partition، C را ترجیح می‌دهیم یا A؟»**  
2. CAP به‌تنهایی Cassandra برای چت را توجیه نمی‌کند — latency، مسیر write، ops را بشکاف.  
3. صادق باش: CAP فقط C+A کامل زیر partition را می‌بندد؛ partition نادر است ولی واقعی.  
4. Postgres تک‌نود را بدون گفتن «توزیع‌شده نیست» «CP» یا «CA» صدا نزن.

---

## Tradeoff به‌ازای feature

محصول واقعی داخل یک سیستم leanهای مختلف دارد:

| سطح | تمایل | چرا |
|-----|--------|-----|
| **رزرو** بلیت | CP | صندلی دوبل = فاجعه |
| صفحهٔ **توضیح** رویداد | AP | متن کمی کهنه OK |
| **پرداخت / کیف پول** | نزدیک به CP، single writer، تراکنش | پول غلط غیرقابل‌قبول |
| شمارندهٔ فید / لایک | AP + eventual | تقریبی کافی است |
| **افزودن** به سبد | اغلب AP | مرور باید بالا بماند |
| **checkout** سبد | اغلب CP | یک‌بار شارژ، موجودی درست |

جملهٔ مصاحبه: «Consistency برای مسیر write حیاتی؛ Availability برای read-mostly / soft state.»

---

## قانون تصمیم

1. بپرس: **دادهٔ غلط کوتاه فاجعه است؟** بله → CP / strong. نه → AP / eventual.  
2. در طراحی چندنودی **P را مفروض بگیر**؛ زیر partition بین C و A بحث کن.  
3. CAP را **به‌ازای feature** بزن، نه یک مهر برای کل محصول.  
4. Happy path شبیه CA ≠ CA زیر split — failure mode را طراحی کن.  
5. پرداخت / موجودی / صندلی → consistency (نزدیک به CP، single writer، تراکنش). Feed / لایک → اغلب AP + eventual کافی است.

---

## ضدالگوها

- گفتن «هر سهٔ CAP را می‌خواهیم» بدون تعریف رفتار partition  
- چسباندن برچسب **CP/AP** به DB بدون چک write concern / quorum / حالت consistency کلاینت  
- اعمال CAP به **تک‌نود** انگار تضمین توزیع‌شده است  
- یک مدل consistency برای **همه** endpointهای اپ بزرگ  
- نادیده گرفتن **latency در برابر consistency** در مسیر سالم (PACELC) بعد از فقط ذکر CAP
