# مدل‌های Architecture

> Software Design و Patternها · درس‌نامه + پرسش و پاسخ · بخش ۹ بانک سؤال · ۱۶ سؤال · [فهرست همهٔ سؤال‌ها](/fa/interview/)

<QaControls />

## درس‌نامه {#lessons}

Architecture یعنی مجموعه‌ی تصمیم‌هایی که بعداً عوض‌کردنشان گران است: مرز Moduleها، جهت Dependencyها، مالک هر داده و نحوه‌ی حرف‌زدن بخش‌ها با هم. هیچ سبکی «بهترین» نیست؛ هر کدام یک هزینه را با هزینه‌ی دیگری عوض می‌کند. در مصاحبه هم جواب درست همیشه با «بستگی دارد به …» شروع می‌شود و با یک انتخاب مشخص تمام می‌شود.

### Layered: نقطه‌ی شروع <Badge type="warning" text="مهم" />

سه Layer: نمایش (controller) → منطق (service) → داده (ORM و Database). هر Layer فقط Layer زیرش را صدا می‌زند. ساده، آشنا و برای بیشتر CRUDها کافی است؛ پروژه‌ی پیش‌فرض Laravel همین است.

ضعفش جهت Dependency است: منطق کسب‌وکار به Data Layer وابسته است. نتیجه در عمل: مدل Eloquent یا struct Database تا controller بالا می‌آید، قاعده‌ی کسب‌وکار بدون Database Test نمی‌شود و «service» کم‌کم به یک Script بلند Transactional تبدیل می‌شود.

### Dependency Rule: Hexagonal، Onion، Clean <Badge type="danger" text="حیاتی" />

هر سه یک ایده‌اند با نام‌گذاری متفاوت: **Dependency کد فقط رو به داخل است.** Domain در مرکز می‌نشیند و هیچ‌چیز از بیرون import نمی‌کند؛ هر چیزی که I/O دارد (HTTP، Database، Queue، SDK) در بیرونی‌ترین حلقه است و Interfaceای را پیاده می‌کند که داخل تعریف شده.

```text
            Layered                                Hexagonal / Onion / Clean

   ┌────────────────────┐              driving adapters            driven adapters
   │ Presentation (HTTP)│              (HTTP, CLI, consumer)       (Postgres, Redis, SMS)
   └─────────┬──────────┘                     │                          ▲
             ▼                                ▼                          │ implements
   ┌────────────────────┐              ┌──────────────── application ───────────────┐
   │ Business logic     │              │  use cases                                 │
   └─────────┬──────────┘              │     ┌──────────── domain ────────────┐     │
             ▼                         │     │ entities, value objects, rules │     │
   ┌────────────────────┐              │     │ ports (interfaces)             │     │
   │ Data access (ORM)  │              │     └────────────────────────────────┘     │
   └─────────┬──────────┘              └────────────────────────────────────────────┘
             ▼
         database                      source-code dependencies point inward only:
                                       adapters -> application -> domain
   business depends on the DB          the domain imports nothing from the outside
```

| | Hexagonal (Cockburn) | Onion (Palermo) | Clean (Martin) |
| --- | --- | --- | --- |
| استعاره | شش‌ضلعی با port و adapter | حلقه‌های پیاز | دایره‌های متحدالمرکز |
| واژگان | driving / driven adapter، port | domain model، domain service، application service | entity، use case، interface adapter، framework |
| تأکید | تقارن ورودی و خروجی؛ Testability | Domain Model در مرکز | Dependency Rule و مرز use case |
| در عمل | یکسان: Domain خالص، use case، adapter بیرونی | یکسان | یکسان |

دو نوع port را از هم جدا کن: **driving** (ورودی؛ کسی که برنامه را صدا می‌زند: handler، CLI، consumer Queue) و **driven** (خروجی؛ چیزی که برنامه صدایش می‌زند: repository، gateway، publisher). تشبیه: کنسول بازی و دسته‌ها. کنسول (Domain) فقط شکل درگاه را تعریف می‌کند؛ هر دسته‌ای که با آن درگاه بخواند کار می‌کند و کنسول نمی‌داند ساخت کدام شرکت است.

هزینه‌اش واقعی است: فایل و mapping بیشتر (Domain Model ↔ مدل Database ↔ DTO). برای CRUD ساده این هزینه هیچ‌وقت برنمی‌گردد.

### چیدمان پوشه در Go و Laravel <Badge type="warning" text="مهم" />

```text
cmd/api/main.go                 # composition root: builds adapters, injects them
internal/
  order/                        # one module = one bounded context
    domain/
      order.go                  # aggregate + invariants, no imports from adapters
      money.go                  # value object
      events.go                 # OrderPlaced, OrderPaid
      repository.go             # port: type Repository interface { ... }
    app/
      place_order.go            # use case (command handler)
      order_queries.go          # read side
    adapters/
      httpapi/handler.go        # driving adapter
      postgres/repository.go    # driven adapter, implements domain.Repository
      amqp/publisher.go
  billing/
    ...
```

```text
app/
  Http/Controllers/Order/PlaceOrderController.php   # driving adapter (thin)
  Console/Commands/                                 # driving adapter
src/                                                # or app/Modules/, autoloaded via PSR-4
  Order/
    Domain/
      Order.php                 # aggregate (plain PHP, no Eloquent)
      Money.php                 # value object
      OrderRepository.php       # port (interface)
      Events/OrderPlaced.php
    Application/
      PlaceOrder.php            # use case / action
      OrderFinder.php           # query object
    Infrastructure/
      EloquentOrderRepository.php   # driven adapter
      OrderModel.php                # the Eloquent model stays here
      OrderServiceProvider.php      # binds port -> adapter
```

پوشه‌بندی اول بر اساس *قابلیت کسب‌وکار* (`order`، `billing`) و بعد بر اساس Layer؛ نه برعکس. پوشه‌ی سطح‌بالای `controllers/`، `services/`، `repositories/` یعنی برای هر feature باید پنج جای مختلف را باز کنی و هیچ مرزی بین Moduleها دیده نمی‌شود.

### DDD راهبردی: مرزها و زبان <Badge type="danger" text="حیاتی" />

DDD راهبردی درباره‌ی کد نیست؛ درباره‌ی این است که سیستم را کجا ببُری.

- **Ubiquitous Language:** همان کلمه‌ای که کارشناس کسب‌وکار می‌گوید در کد، جدول و API هم باشد. اگر کسب‌وکار می‌گوید «مرسوله» و کد می‌گوید `Package`، هر گفت‌وگو یک ترجمه‌ی ذهنی دارد و bug از همین ترجمه می‌آید.
- **Bounded Context:** مرزی که داخل آن هر کلمه دقیقاً یک معنی دارد. «مشتری» در فروش یعنی سرنخ و قرارداد؛ در پشتیبانی یعنی تیکت و SLA؛ در مالی یعنی صورت‌حساب و بدهی. تلاش برای یک مدل `Customer` واحد با هشتاد ستون، همان God Object در سطح سازمان است.
- **Subdomain:** core (جایی که مزیت رقابتی است؛ بهترین آدم‌ها و مدل غنی)، supporting (لازم ولی نه متمایزکننده؛ ساده بساز)، generic (بخر یا از کتابخانه استفاده کن: Authentication، پرداخت).
- **Context Map:** رابطه‌ی بین contextها و اینکه چه کسی از چه کسی تبعیت می‌کند.

| Pattern رابطه | یعنی | مثال |
| --- | --- | --- |
| Customer / Supplier | بالادست نیاز پایین‌دست را در برنامه‌اش می‌گذارد | تیم سفارش برای تیم گزارش Field اضافه می‌کند |
| Conformist | پایین‌دست مدل بالادست را بی‌چون‌وچرا می‌پذیرد | استفاده‌ی مستقیم از مدل API یک SaaS بیرونی |
| Anti-Corruption Layer | Layer ترجمه تا مدل بیرونی به داخل نشت نکند | adapter روی سیستم قدیمی یا Gateway بانک |
| Open Host / Published Language | یک API یا schema Event عمومی و مستند برای همه | Eventهای `order.*.v1` با schema ثبت‌شده |
| Shared Kernel | بخش کوچک مشترک با مالکیت مشترک | نوع `Money` بین دو context؛ خطرناک اگر بزرگ شود |
| Separate Ways | اصلاً یکپارچه نشو | دو سیستم که ارزش اتصال ندارند |

مرز خوب معمولاً جایی است که زبان عوض می‌شود، تیم عوض می‌شود یا آهنگ تغییر فرق می‌کند. Bounded context الزاماً Microservice نیست؛ می‌تواند یک Module در Monolith باشد.

### DDD تاکتیکی: قطعه‌های ساختمانی <Badge type="danger" text="حیاتی" />

| قطعه | تعریف | قاعده‌ی عملی |
| --- | --- | --- |
| Entity | هویت دارد و در طول زمان تغییر می‌کند | برابری با `id` |
| Value Object | بدون هویت، Immutable | برابری با مقدار؛ `Money`، `Email` |
| Aggregate | خوشه‌ای از entity و value object با یک Root؛ مرز Consistency | یک Transaction = یک aggregate؛ از بیرون فقط به Root دسترسی هست |
| Repository | بارگذاری و ذخیره‌ی *کل* aggregate | یک repository به ازای aggregate، نه به ازای جدول |
| Domain Event | واقعیتی که در Domain رخ داده، با نام گذشته | `OrderPlaced`؛ بعد از commit منتشر شود |
| Domain Service | قاعده‌ای که به یک entity تعلق ندارد | سیاست قیمت‌گذاری بین چند aggregate؛ بدون state و بدون I/O |
| Application Service | use case؛ هماهنگی، Transaction، Authorization | منطق کسب‌وکار ندارد؛ فقط ارکستر است |
| Factory | ساخت aggregate معتبر | وقتی ساختن خودش قاعده دارد |

```go
type Order struct {
	id     OrderID
	status Status
	lines  []Line
	events []Event
}

// every change goes through the root, so each invariant has exactly one home
func (o *Order) AddLine(sku SKU, qty int, price Money) error {
	if o.status != StatusDraft {
		return ErrOrderLocked
	}
	if qty <= 0 {
		return ErrInvalidQuantity
	}
	o.lines = append(o.lines, Line{sku: sku, qty: qty, price: price})
	return nil
}

func (o *Order) Place() error {
	if len(o.lines) == 0 {
		return ErrEmptyOrder
	}
	o.status = StatusPlaced
	o.events = append(o.events, OrderPlaced{ID: o.id})
	return nil
}
```

Patternهای تاکتیکی را فقط در core subdomain خرج کن. نوشتن aggregate و domain event برای صفحه‌ی «مدیریت دسته‌بندی‌ها» اتلاف است.

### CQRS و Event Sourcing در یک نگاه <Badge type="warning" text="مهم" />

```text
 command ──► write model (aggregate) ──► events ──► projector ──► read model(s) ──► query
                  │                         │
                  │ state-stored:           │ event-sourced:
                  │ UPDATE the row          │ append to the event store,
                  │                         │ state = fold(events), snapshot every N events
```

| سطح | چه چیزی جدا می‌شود | هزینه |
| --- | --- | --- |
| CQS | Method یا تغییر می‌دهد یا جواب می‌دهد | هیچ |
| CQRS Light | Classهای command و query جدا، یک Database | کم؛ <span class="vip-locked" title="VIP members only">CQRS Light <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> |
| CQRS کامل | read model جدا (Elasticsearch، جدول denormalized) | eventual consistency، projector، بازسازی |
| Event Sourcing | Source of Truth دنباله‌ی Eventهاست، نه state | Versioning Event، snapshot، ذهنیت متفاوت تیم |

CQRS و Event Sourcing مستقل‌اند: CQRS بدون Event Sourcing رایج و کم‌خطر است. Event Sourcing را فقط وقتی انتخاب کن که *تاریخچه خودش نیاز کسب‌وکار است* (دفتر کل، audit قانونی، «وضعیت در تاریخ X چه بود؟»)، نه برای اینکه Architecture جذاب‌تر شود.

### از Monolith تا Serverless: جدول trade-off <Badge type="danger" text="حیاتی" />

| | Monolith | Modular Monolith | Microservices | Serverless (FaaS) |
| --- | --- | --- | --- | --- |
| واحد Deployment | یکی | یکی | به ازای هر سرویس | به ازای هر تابع |
| مرزها | قراردادی (اگر باشد) | Module با API عمومی؛ با ابزار اجباری می‌شود | شبکه | شبکه و Event |
| داده | یک DB، join آزاد | یک DB، schema یا جدول‌های هر Module جدا | DB به ازای سرویس | سرویس‌های مدیریت‌شده |
| Consistency | Transaction ACID | Transaction ACID (با احتیاط بین Moduleها) | Saga، outbox، eventual | eventual |
| هزینه‌ی عملیات | کم | کم | بالا: CI/CD، tracing، mesh، on-call | کم برای زیرساخت؛ بالا برای Observability و Test |
| مقیاس | کل برنامه با هم | کل برنامه با هم | هر سرویس جدا | خودکار، تا صفر |
| Debug | stack trace | stack trace | Distributed Trace | Distributed Trace و Log پراکنده |
| اندازه‌ی تیم مناسب | ۱ تا ۱۰ نفر | ۵ تا ۵۰ نفر | چندین تیم مستقل | هر اندازه، برای بار نامنظم |
| ریسک اصلی | big ball of mud | فرسایش مرزها | distributed monolith | Lockشدن به vendor؛ cold start؛ هزینه در بار ثابت |

مسیر معقول: با modular monolith شروع کن، مرزها را در یک process کشف و تثبیت کن و فقط Moduleای را بیرون بکش که دلیل مشخص دارد (مقیاس متفاوت، تیم مستقل، چرخه‌ی Release متفاوت، Isolation خرابی). جداکردن مرز اشتباه در Monolith یک refactor است؛ در Microservice یک پروژه‌ی Migration داده.

### Twelve-Factor <Badge type="warning" text="مهم" />

دوازده قاعده برای سرویسی که بشود آن را بدون دردسر در container اجرا، مقیاس و جایگزین کرد.

| # | عامل | در عمل |
| --- | --- | --- |
| ۱ | Codebase | یک repo به ازای هر سرویس، چند deploy از همان کد |
| ۲ | Dependencies | صریح و Lockشده: `go.mod`، `composer.lock` |
| ۳ | Config | در env، نه در کد یا image؛ همان image برای staging و production |
| ۴ | Backing services | DB، Redis و Queue منابع متصل‌اند؛ با تغییر URL عوض می‌شوند |
| ۵ | Build, release, run | سه مرحله‌ی جدا؛ release Immutable و قابل rollback |
| ۶ | Processes | بدون state؛ session و فایل در Redis و object storage |
| ۷ | Port binding | سرویس خودش HTTP گوش می‌دهد |
| ۸ | Concurrency | مقیاس با افزودن process، با نوع‌های مختلف (web، worker) |
| ۹ | Disposability | شروع سریع، خاموشی آرام با `SIGTERM` |
| ۱۰ | Dev/prod parity | همان نوع DB و broker در توسعه؛ نه SQLite به‌جای PostgreSQL |
| ۱۱ | Logs | جریان Event به stdout؛ جمع‌آوری کار Platform است |
| ۱۲ | Admin processes | migration و Script یک‌باره با همان کد و همان config |

سه‌تایی که بیشتر از همه نقض می‌شوند: ۳ (config در image)، ۶ (فایل Uploadشده روی دیسک محلی pod) و ۹ (worker که وسط job با `SIGKILL` می‌میرد چون graceful shutdown ندارد).

### جمع‌بندی سریع

| مفهوم | یک‌خطی | کی |
| --- | --- | --- |
| Layered | Dependency رو به پایین، تا Database | CRUD، Domain ساده |
| Hexagonal / Clean | Dependency رو به داخل، Domain بی‌خبر از I/O | Domain پیچیده، عمر طولانی، زیرساخت متغیر |
| Bounded Context | مرزی که داخلش هر کلمه یک معنی دارد | همیشه؛ پایه‌ی هر مرزبندی |
| Aggregate | مرز Consistency و Transaction | وقتی invariant چند Object را در بر می‌گیرد |
| CQRS Light | Classهای خواندن و نوشتن جدا | خواندن‌ها شکل متفاوتی از نوشتن‌ها دارند |
| Event Sourcing | Eventها Source of Truthاند | تاریخچه نیاز کسب‌وکار است |
| Modular Monolith | یک deploy، مرزهای اجباری | پیش‌فرض معقول برای بیشتر تیم‌ها |
| Microservices | استقلال Deployment در برابر پیچیدگی Distributed | چند تیم، مرزهای تثبیت‌شده |
| Twelve-Factor | سرویس قابل جایگزینی و بدون state | هر چیزی که در container اجرا می‌شود |

## پرسش و پاسخ {#qa}

### ۹.۱ — Layered در برابر Hexagonal، Onion و Clean؟ <Badge type="danger" text="حیاتی" /> {#q-9-1}

::: details پاسخ {open}
**پاسخ:** Layered سه Layer دارد و Dependency رو به پایین است؛ پس business به Database وابسته می‌شود. در Hexagonal (Ports &amp; Adapters) domain در مرکز است و port تعریف می‌کند؛ adapterها بیرون‌اند و Dependency رو به داخل است. Onion و Clean همین ایده با حلقه‌های متحدالمرکز است.

```text
internal/order/
  domain/      # entities, value objects, ports (interfaces)
  app/         # use cases
  adapters/
    http/      # driving adapter
    postgres/  # driven adapter
```

**مثال واقعی:** تعویض Payment Gateway بدون دست‌زدن به use caseها. **یوزکیس:** Layered برای CRUD؛ Hexagonal برای domain پیچیده.
:::

### ۹.۲ — مفاهیم DDD؟ <Badge type="danger" text="حیاتی" /> {#q-9-2}

::: details پاسخ {open}
**پاسخ:** راهبردی: Ubiquitous Language، Bounded Context، Anti-Corruption Layer. تاکتیکی: Entity، Value Object، Aggregate، Domain Event.

**مثال واقعی:** «Product» در کاتالوگ با «Product» در انبار یکی نیست.
:::

### ۹.۳ — CQRS و رابطه‌اش با Event Sourcing؟ <Badge type="danger" text="حیاتی" /> {#q-9-3}

::: details پاسخ {open}
**پاسخ:** جداسازی مدل نوشتن از مدل خواندن. «CQRS Light» یعنی همان Database و فقط Classهای جدا برای command و query. شکل کامل read model جدا دارد که با Event به‌روز می‌شود. Event Sourcing تقریباً همیشه CQRS می‌خواهد، ولی CQRS بدون آن رایج است.

**مثال واقعی:** ثبت سفارش در Postgres و جست‌وجو از Elasticsearch. <strong class="qa-trap">دام مصاحبه:</strong> کاربر تغییر خودش را فوراً نمی‌بیند.
:::

### ۹.۴ — Event Sourcing؟ <Badge type="warning" text="مهم" /> {#q-9-4}

::: details پاسخ {open}
**پاسخ:** به‌جای state فعلی، دنباله‌ی Eventهای Immutable ذخیره می‌شود و state با replay به دست می‌آید.

**مثال واقعی:** دفتر کل کیف پول. **یوزکیس:** حوزه‌های مالی و compliance.
:::

### ۹.۵ — Monolith، Modular Monolith، SOA، Microservice و Serverless؟ <Badge type="warning" text="مهم" /> {#q-9-5}

::: details پاسخ {open}
- **Monolith:** یک واحد Deployment و یک DB؛ ساده.
- **Modular Monolith:** یک Deployment با Moduleهای مرزدار؛ مثل Shopify.
- **SOA:** سرویس‌های درشت‌دانه‌ی سازمانی با ESB مرکزی.
- **Microservice:** سرویس‌های کوچک با Database اختصاصی و Deployment مستقل.
- **Serverless:** توابع Event-driven با مقیاس تا صفر.

**تفاوت SOA و Microservice:** اولی هوشمندی را در ESB می‌گذارد؛ دومی استقلال تیم و Deployment می‌خواهد.
:::

### ۹.۶ — کی Microservice و کی Monolith؟ <Badge type="danger" text="حیاتی" /> {#q-9-6}

::: details پاسخ {open}
**پاسخ:** Microservice وقتی چند تیم مستقل سرعت هم را می‌گیرند و مرزهای domain روشن است. Monolith وقتی تیم کوچک است و domain ناشناخته.

**مثال واقعی:** تیم Prime Video در ۲۰۲۳ یک سرویس Monitoring را از serverless Distributed به Monolith برگرداند. <strong class="qa-trap">دام مصاحبه:</strong> یک سرویس و یک Database می‌تواند همه‌ی مرزها را پیاده کند؛ برای هر مفهوم یک Microservice لازم نیست.
:::

### ۹.۷ — Twelve-Factor و stateless؟ <Badge type="warning" text="مهم" /> {#q-9-7}

::: details پاسخ {open}
**پاسخ:** پیکربندی در env، process بدون state، Log به stdout.

**مثال واقعی:** session در Redis به‌جای حافظه‌ی process.
:::

### ۹.۸ — مرز Aggregate را چطور تعیین می‌کنی؟ <Badge type="danger" text="حیاتی" /> {#q-9-8}

::: details پاسخ {open}
**پاسخ:** Aggregate مرز Consistency فوری است: هر چیزی که باید *در همان Transaction* با هم درست باشد داخل یک aggregate است و بقیه بیرون. چهار قاعده‌ی عملی:

- invariant واقعی را پیدا کن («مجموع اقلام نباید از سقف اعتبار بیشتر شود»)؛ فقط چیزهایی که این قاعده لازم دارد داخل مرز باشند؛
- کوچک نگهش دار؛ aggregate بزرگ یعنی Lock بزرگ، بارگذاری سنگین و تعارض Concurrency؛
- به aggregateهای دیگر فقط با شناسه ارجاع بده (`customerID`)، نه با Pointer به Object؛
- تغییر چند aggregate را با domain event و eventual consistency هماهنگ کن، نه در یک Transaction.

| سؤال | اگر بله |
| --- | --- |
| این دو باید در همان لحظه با هم Consistent باشند؟ | یک aggregate |
| کسب‌وکار چند ثانیه تأخیر را می‌پذیرد؟ | دو aggregate و یک Event |
| دو کاربر همزمان بخش‌های مختلفش را عوض می‌کنند؟ | احتمالاً زیادی بزرگ است |
| مجموعه‌ی داخلی بدون سقف رشد می‌کند؟ | آن مجموعه را بیرون ببر |

**مثال واقعی:** `Order` و `OrderLine` یک aggregate هستند (مجموع سفارش به اقلام وابسته است). `Product` بیرون است؛ قیمت در لحظه‌ی خرید در `OrderLine` کپی می‌شود. اگر `Customer` همه‌ی سفارش‌هایش را در خود نگه دارد، ثبت هر سفارش کل مشتری را Lock می‌کند و مشتری پرکار به Bottleneck تبدیل می‌شود.

**یوزکیس:** Concurrency را با optimistic locking روی ریشه کنترل کن (ستون `version`)؛ تعارض زیاد روی یک aggregate نشانه‌ی مرز اشتباه است.

<strong class="qa-trap">دام مصاحبه:</strong> کشیدن مرز از روی رابطه‌های Database («این‌ها foreign key دارند پس یک aggregate‌اند»). مرز را invariant تعیین می‌کند، نه نمودار ER.
:::

### ۹.۹ — Anemic Domain Model در برابر Rich؛ همیشه rich بهتر است؟ <Badge type="warning" text="مهم" /> {#q-9-9}

::: details پاسخ {open}
**پاسخ:** در مدل anemic Objectها فقط داده‌اند (getter و setter) و همه‌ی قاعده‌ها در Classهای service نوشته می‌شود (Transaction Script). در مدل rich، قاعده کنار داده است و Object اجازه نمی‌دهد به وضعیت نامعتبر برود.

| | Anemic / Transaction Script | Rich Domain Model |
| --- | --- | --- |
| قاعده کجاست | در serviceها؛ معمولاً تکراری | در entity و value object |
| حالت نامعتبر | هر جای کد می‌تواند بسازدش | ساختنش ممکن نیست |
| هزینه‌ی شروع | کم | بیشتر؛ mapping و طراحی |
| Test | با Database یا mock زیاد | Unit Test خالص و سریع |
| مناسب | CRUD، گزارش، Admin Panel، supporting subdomain | core subdomain با قاعده‌ی زیاد |

```php
// anemic: any caller can produce an inconsistent order
$order->status = 'cancelled';
$order->save();

// rich: the rule and the state change are one operation
final class Order
{
    public function cancel(string $reason): void
    {
        if ($this->status === OrderStatus::Shipped) {
            throw new CannotCancelShippedOrder($this->id);
        }
        $this->status = OrderStatus::Cancelled;
        $this->recordThat(new OrderCancelled($this->id, $reason));
    }
}
```

**مثال واقعی:** قاعده‌ی «سفارش ارسال‌شده لغو نمی‌شود» در controller وب رعایت شده بود ولی در job لغو خودکار و در پنل پشتیبانی نه؛ چون سه جای مختلف مستقیم `status` را عوض می‌کردند.

<strong class="qa-trap">دام مصاحبه:</strong> «anemic Anti-pattern است، همیشه rich». برای فرمی که فقط ذخیره و نمایش می‌شود، مدل rich فقط تشریفات است. Anti-pattern وقتی است که Domain پیچیده داری ولی مدلت anemic است.
:::

### ۹.۱۰ — Validation در کدام Layer انجام می‌شود؟ <Badge type="warning" text="مهم" /> {#q-9-10}

::: details پاسخ {open}
**پاسخ:** «validation» چهار چیز متفاوت است و هر کدام جای خودش را دارد:

| نوع | سؤال | کجا | نتیجه‌ی شکست |
| --- | --- | --- | --- |
| شکل ورودی | JSON درست است؟ Field اجباری هست؟ نوع و طول؟ | لبه: `FormRequest`، DTO در handler | `400` یا `422` |
| Authorization | این کاربر اجازه‌ی این کار روی این منبع را دارد؟ | application service یا policy | `403` |
| قاعده‌ی Domain | این تغییر وضعیت مجاز است؟ مبلغ منفی نیست؟ | value object و aggregate | خطای Domain → `409` یا `422` |
| قاعده‌ی بین aggregate یا سراسری | ایمیل یکتاست؟ موجودی کافی است؟ | application service به‌علاوه‌ی constraint Database | `409` |

اصل راهنما: لبه برای تجربه‌ی کاربر (پیام خطای خوب و زود)، Domain برای درستی (قاعده حتی وقتی از CLI، job یا consumer صدا زده می‌شود برقرار بماند) و Database آخرین خط دفاع در برابر race.

**مثال واقعی:** یکتایی ایمیل فقط با «اول `SELECT` بعد `INSERT`» چک می‌شد؛ دو درخواست همزمان هر دو رد شدند و دو کاربر با یک ایمیل ساخته شد. درست: `UNIQUE` constraint و ترجمه‌ی خطای نقض آن به خطای Domain.

**یوزکیس:** value object را برای حذف validation تکراری به کار ببر: وقتی نوع پارامتر `Email` است، دیگر لازم نیست هیچ Layerای دوباره قالب ایمیل را چک کند.

<strong class="qa-trap">دام مصاحبه:</strong> «همه‌ی validation در FormRequest». آن‌وقت همان use case از مسیر Queue یا CLI بدون هیچ قاعده‌ای اجرا می‌شود.
:::

### ۹.۱۱ — مرز Moduleها را در Modular Monolith چطور تعریف و اجباری می‌کنی؟ <Badge type="warning" text="مهم" /> {#q-9-11}

::: details پاسخ {open}
**پاسخ:** مرزی که فقط «قرار تیمی» باشد در شش ماه فرسوده می‌شود. هر Module سه چیز لازم دارد: یک API عمومی کوچک (Interface، DTO و Eventها)، داخلی‌های غیرقابل‌دسترس، و مالکیت انحصاری روی جدول‌هایش.

**گام‌ها:**

- **کد:** در Go همه‌چیز زیر `internal/order/` و فقط یک Package عمومی نازک؛ در PHP Dependency Rule با Deptrac یا Architecture Test.
- **داده:** هر Module schema یا پیشوند جدول خودش را دارد؛ هیچ `JOIN` بین Moduleها و هیچ foreign key بین‌شان. داده‌ی Module دیگر را از API آن یا از یک read model محلی بگیر.
- **ارتباط:** فراخوانی sync فقط از طریق API عمومی؛ اثرهای جانبی با Event (درون‌process، ترجیحاً با outbox) تا Moduleها بعداً قابل جداشدن باشند.
- **CI:** Architecture Test که با نقض مرز build را قرمز می‌کند.

```php
// tests/Architecture/BoundariesTest.php (Pest)
arch('order domain is framework-free')
    ->expect('Src\Order\Domain')
    ->not->toUse(['Illuminate', 'Src\Order\Infrastructure']);

arch('billing does not reach into order internals')
    ->expect('Src\Billing')
    ->not->toUse('Src\Order\Domain');
```

**مثال واقعی:** Module گزارش مستقیم جدول `orders` را `JOIN` می‌کرد؛ وقتی تیم سفارش ستونی را تغییر نام داد، گزارش‌ها در production شکستند. بعد از آن، گزارش از یک جدول projection که با Eventهای سفارش پر می‌شود می‌خواند.

<strong class="qa-trap">دام مصاحبه:</strong> مرز در کد ولی Database مشترک و آزاد. اگر هر Module به هر جدولی دسترسی دارد، مرز واقعی وجود ندارد و جداکردن بعدی به Microservice عملاً غیرممکن است.
:::

### ۹.۱۲ — ADR چیست و چرا مهم است؟ <Badge type="info" text="تکمیلی" /> {#q-9-12}

::: details پاسخ {open}
**پاسخ:** Architecture Decision Record یک سند کوتاه (یک صفحه) است که یک تصمیم Architecture را همراه با زمینه و پیامدهایش ثبت می‌کند. کد می‌گوید «چه»؛ ADR می‌گوید «چرا این و نه آن». در repo کنار کد نگه داشته می‌شود، شماره دارد و Immutable است: تصمیم جدید ADR قبلی را «superseded» می‌کند، ویرایشش نمی‌کند.

```text
# ADR-0012: Use the outbox pattern for publishing order events

Status: Accepted (2026-02-10)   Supersedes: ADR-0007

Context
  Orders are written to PostgreSQL and events go to RabbitMQ. We lost events
  twice last quarter when the broker was unreachable after commit.

Decision
  Write events to an outbox table in the same transaction; a polling relay publishes them.

Alternatives considered
  - Publish after commit with retries: still loses events on process crash.
  - CDC with Debezium: no Kafka Connect expertise in the team today.

Consequences
  + No lost events; consumers must be idempotent (at-least-once).
  - Up to ~500 ms extra latency; outbox table needs cleanup and monitoring.
```

**مثال واقعی:** عضو جدید تیم می‌پرسد «چرا Kafka نداریم؟» و به‌جای یک جلسه‌ی یک‌ساعته، ADR-0005 را می‌خواند که محدودیت‌های آن زمان را توضیح داده؛ اگر آن محدودیت‌ها عوض شده باشند، دلیل روشنی برای بازنگری هست.

**یوزکیس:** برای تصمیم‌هایی که برگرداندنشان گران است: انتخاب Database و broker، مرز سرویس، قرارداد API، سبک Authentication. برای انتخاب نام متغیر نه.

<strong class="qa-trap">دام مصاحبه:</strong> ADR بدون بخش «گزینه‌های ردشده» و «پیامدهای منفی» فقط اطلاعیه است. ارزشش در ثبت trade-off است.
:::

### ۹.۱۳ — Vertical Slice Architecture چیست و چه فرقی با Layering دارد؟ <Badge type="info" text="تکمیلی" /> {#q-9-13}

::: details پاسخ {open}
**پاسخ:** به‌جای برش افقی (controller، service، repository)، کد بر اساس *use case* بریده می‌شود: هر feature یک پوشه دارد که همه‌چیزش (request، handler، validation، Query، پاسخ) داخل آن است. coupling بین sliceها کم و Cohesion داخل هر slice بالاست.

```text
internal/order/
  placeorder/        # POST /orders: request, handler, validation, SQL, tests
  cancelorder/
  listorders/        # may use raw SQL and a flat DTO; no need to share a model
  shared/            # only what at least three slices really share
```

| | Layered | Vertical Slice |
| --- | --- | --- |
| افزودن feature | دست‌زدن به چهار پنج پوشه | یک پوشه‌ی جدید |
| اشتراک کد | بالا (گاهی بیش از حد) | کم؛ تکرار آگاهانه |
| یکنواختی | همه‌ی featureها یک شکل | هر slice به اندازه‌ی پیچیدگی خودش |
| ریسک | serviceهای چاق و مشترک | تکرار قاعده‌ی Domain در چند slice |

**مثال واقعی:** `listorders` یک Query SQL مستقیم و یک DTO تخت است؛ `placeorder` از aggregate و repository استفاده می‌کند. هیچ‌کدام مجبور نیست تشریفات دیگری را تحمل کند. این با CQRS Light و با action class در Laravel خوب جفت می‌شود.

**یوزکیس:** با Hexagonal تضاد ندارد: می‌شود هسته‌ی Domain مشترک داشت و use caseها را به شکل slice چید.

<strong class="qa-trap">دام مصاحبه:</strong> اگر قاعده‌ی Domain (invariant) در چند slice کپی شود، دوباره به مدل anemic رسیده‌ای. قاعده‌ی مشترک باید در Domain Model بماند؛ فقط *جریان* هر use case جداست.
:::

### ۹.۱۴ — قانون Conway و fitness function در Architecture؟ <Badge type="info" text="تکمیلی" /> {#q-9-14}

::: details پاسخ {open}
**پاسخ:** **قانون Conway:** ساختار سیستم ساختار ارتباطی سازمانی را که آن را می‌سازد تکرار می‌کند. سه تیم که یک compiler می‌سازند یک compiler سه‌مرحله‌ای تحویل می‌دهند. نتیجه‌ی عملی (Inverse Conway Maneuver): اگر Architecture خاصی می‌خواهی، اول تیم‌ها را به همان شکل بچین؛ هر تیم مالک کامل یک bounded context باشد.

**Fitness function:** یک آزمون خودکار که یک ویژگی Architecture را مدام می‌سنجد، تا Architecture به‌جای سند، چیزی اجرایی و قابل شکست در CI باشد.

| ویژگی | fitness function نمونه |
| --- | --- |
| جهت Dependency | Architecture Test: Domain نباید adapter را import کند |
| مرز Module | Deptrac یا linter Dependency در CI |
| کارایی | Load Test: p99 زیر ۳۰۰ میلی‌ثانیه در هر release |
| Compatibility قرارداد | contract test؛ بررسی Compatibility schema Event |
| امنیت | Scan Dependency و secret در pipeline |
| Resilience | آزمون خرابی دوره‌ای: با قطع Redis سرویس باید پاسخ بدهد |

**مثال واقعی:** دو تیم روی یک سرویس مشترک کار می‌کردند و هر release به هماهنگی هر دو نیاز داشت. جداکردن سرویس کمکی نکرد تا وقتی مالکیت هم جدا شد؛ قبل از آن فقط یک distributed monolith ساخته بودند.

<strong class="qa-trap">دام مصاحبه:</strong> Microservice با یک تیم پنج‌نفره. طبق Conway آن تیم در نهایت یک سیستم درهم‌تنیده می‌سازد، فقط با هزینه‌ی شبکه.
:::

### ۹.۱۵ — Serverless کجا خوب است و cold start چیست؟ <Badge type="info" text="تکمیلی" /> {#q-9-15}

::: details پاسخ {open}
**پاسخ:** در FaaS کد به‌صورت تابع در پاسخ به Event اجرا می‌شود، Platform مقیاس را از صفر تا سقف Concurrency مدیریت می‌کند و فقط برای زمان اجرا پول می‌دهی. **Cold start** Latency اولین فراخوانی است وقتی Instance گرمی وجود ندارد: ساختن محیط اجرا، بارگذاری کد و مقداردهی اولیه. بسته به runtime و حجم بسته از ده‌ها میلی‌ثانیه تا چند ثانیه طول می‌کشد.

| خوب برای | بد برای |
| --- | --- |
| بار نامنظم و جهشی؛ کار دوره‌ای | بار ثابت و بالا (Server همیشه‌روشن ارزان‌تر است) |
| پردازش Event: Upload فایل، webhook، Message Queue | Latency کم و قابل‌پیش‌بینی (p99 سخت‌گیرانه) |
| چسب بین سرویس‌های مدیریت‌شده | اتصال ماندگار: WebSocket، کار طولانی |
| تیم کوچک بدون ظرفیت عملیات | کاری که state محلی یا pool اتصال بزرگ می‌خواهد |

**مثال واقعی:** تابعی که با هر Upload تصویر thumbnail می‌سازد؛ روزی صد بار یا صد هزار بار، بدون مدیریت Server. در مقابل، API با Traffic ثابت که هر Instance تابع یک اتصال به PostgreSQL باز می‌کند، با جهش بار سقف اتصال Database را پر می‌کند؛ بدون proxy اتصال (مثل PgBouncer یا RDS Proxy) از کار می‌افتد.

**یوزکیس:** کاهش cold start: باینری کوچک (Go اینجا مزیت دارد)، مقداردهی اولیه بیرون از handler، Dependency کمتر، و در صورت نیاز Instance از پیش گرم‌شده (که بخشی از مزیت هزینه را از بین می‌برد).

<strong class="qa-trap">دام مصاحبه:</strong> «serverless یعنی بدون عملیات». عملیات جابه‌جا می‌شود: محدودیت Concurrency، timeout، retry خودکار Platform (که idempotency را اجباری می‌کند)، Observability پراکنده و Test محلی سخت.
:::

### ۹.۱۶ — Architecture Multi-Tenant: مدل‌های Isolation داده؟ <Badge type="warning" text="مهم" /> {#q-9-16}

::: details پاسخ {open}
**پاسخ:** سه مدل اصلی، روی طیفی از «ارزان و مشترک» تا «گران و Isolated»:

| | جدول مشترک (ستون `tenant_id`) | Schema به ازای tenant | Database به ازای tenant |
| --- | --- | --- | --- |
| هزینه به ازای tenant | خیلی کم | متوسط | بالا |
| Isolation داده | منطقی؛ یک `WHERE` جاافتاده یعنی نشت | بهتر | کامل |
| همسایه‌ی پرسروصدا | مشکل جدی | مشکل | حل‌شده |
| migration | یک بار | N بار | N بار، با ابزار |
| backup و restore تک‌tenant | سخت | ممکن | ساده |
| سقف تعداد tenant | میلیون‌ها | هزاران (catalog سنگین می‌شود) | صدها تا هزاران |
| مناسب | SaaS با مشتری‌های کوچک و زیاد | تعداد متوسط، نیاز به سفارشی‌سازی | مشتری enterprise، الزام قانونی |

در مدل مشترک، Filter tenant نباید به حافظه‌ی برنامه‌نویس وابسته باشد. دو Layer بگذار: scope سراسری در ORM یا repository، و Row-Level Security در PostgreSQL به‌عنوان تور ایمنی.

```sql
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON invoices
  USING (tenant_id = current_setting('app.tenant_id')::bigint);

-- per request, inside the transaction:
SET LOCAL app.tenant_id = '42';
```

**مثال واقعی:** مدل ترکیبی (bridge): بیشتر مشتری‌ها در جدول‌های مشترک، و چند مشتری بزرگ روی Database اختصاصی؛ یک Layer Routing از روی tenant اتصال درست را انتخاب می‌کند. همان ایده برای Queue و cache هم لازم است: کلید cache با پیشوند tenant و rate limit به ازای tenant، تا یک مشتری بقیه را گرسنه نگذارد.

<strong class="qa-trap">دام مصاحبه:</strong> RLS برای مالک جدول و superuser به‌صورت پیش‌فرض اعمال نمی‌شود؛ برنامه باید با نقشی غیر از مالک وصل شود (یا `FORCE ROW LEVEL SECURITY`). دام دوم: `tenant_id` را از بدنه‌ی درخواست بخوانی؛ باید از هویت احرازشده (token) بیاید.
:::

## مطالب مرتبط {#related}

- <span class="vip-locked" title="VIP members only">CQRS Light <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>
- <span class="vip-locked" title="VIP members only">Microservice و Resilience <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>
- [اصول طراحی](/fa/design/principles)
