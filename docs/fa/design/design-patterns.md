# Design Patterns

> Software Design و Patternها · درس‌نامه + پرسش و پاسخ · بخش ۸ بانک سؤال · ۱۵ سؤال · [فهرست همهٔ سؤال‌ها](/fa/interview/)

<QaControls />

## درس‌نامه {#lessons}

Design Pattern یک «راه‌حل نام‌دار برای مسئله‌ای تکراری» است. ارزش اصلی‌اش واژگان مشترک است: وقتی می‌گویی «این یک decorator روی repository است»، هم‌تیمی‌ات بدون خواندن کد ساختار را می‌فهمد. ترتیب درست همیشه این است: اول مسئله (این `switch` دارد بزرگ می‌شود؛ این Object ده پارامتر اختیاری دارد)، بعد Pattern. کسی که از Pattern شروع می‌کند کدی می‌نویسد که سه Layer Abstraction دارد و یک پیاده‌سازی.

بیشتر این Patternها را هر روز در Framework و کتابخانه‌ی استاندارد استفاده می‌کنی؛ ستون «همین حالا کجا می‌بینی‌اش» برای همین است.

### Creational Patterns <Badge type="danger" text="حیاتی" />

مسئله‌ی مشترک: جداکردن «چه چیزی ساخته می‌شود و چطور» از کدی که آن را مصرف می‌کند.

| Pattern | هدف | تشبیه روزمره | همین حالا کجا می‌بینی‌اش | کی نه |
| --- | --- | --- | --- | --- |
| Singleton | فقط یک Instance | یک مدیر ساختمان برای کل مجتمع | `sync.Once`؛ `$app->singleton()`؛ connection pool | وقتی فقط برای «دسترسی راحت از همه‌جا» می‌خواهی‌اش؛ آن state سراسری است |
| Factory Method | انتخاب نوع مشخص پشت یک تابع | پیشخوانی که سفارش می‌دهی و نمی‌دانی کدام آشپز می‌پزد | `sql.Open("pgx", …)`؛ `Storage::disk('s3')` | وقتی فقط یک نوع داری؛ `new` کافی است |
| Abstract Factory | ساخت یک *خانواده* Object هماهنگ | ست مبلمان از یک برند | `database/sql/driver` (Driver → Conn → Stmt)؛ Manager‌های Laravel | وقتی Objectها به هم وابسته نیستند |
| Builder | ساخت گام‌به‌گام Object پیچیده | سفارش ساندویچ با انتخاب هر لایه | Query Builder؛ `strings.Builder`؛ Functional Options | Object با دو سه Field اجباری |
| Prototype | ساخت با کپی از Instance آماده | فتوکپی فرم پرشده | `clone` در PHP؛ کپی struct در Go | وقتی کپی عمیق پرهزینه یا مبهم است |
| Object Pool | بازاستفاده از Object گران | دوچرخه‌ی اشتراکی | `sync.Pool`؛ pool اتصال Database | Object ارزان؛ pool خودش پیچیدگی و bug می‌آورد |

### Structural Patterns <Badge type="danger" text="حیاتی" />

مسئله‌ی مشترک: چطور Objectها را کنار هم بچینیم بدون اینکه به هم جوش بخورند. تقریباً همه‌شان «یک Object که Object دیگری را می‌پیچد» هستند؛ تفاوت در *نیت* است.

| Pattern | هدف | تشبیه روزمره | همین حالا کجا می‌بینی‌اش | کی نه |
| --- | --- | --- | --- | --- |
| Adapter | تبدیل یک Interface به Interface مورد انتظار | مبدل پریز | Flysystem؛ پیچیدن SDK Gateway پشت `PaymentGateway`؛ `http.HandlerFunc` | وقتی می‌توانی خود Interface را عوض کنی |
| Decorator | افزودن رفتار با همان Interface | پوشیدن کاپشن روی لباس | `bufio.NewReader`، `gzip.NewReader`؛ middleware؛ `CachedUserRepository` | وقتی ترتیب پیچیدن مبهم یا شکننده می‌شود |
| Proxy | Access Control به Object اصلی | منشی که تماس‌ها را Filter می‌کند | lazy object در PHP؛ stub در gRPC؛ reverse proxy | وقتی فقط یک Layer بی‌فایده اضافه می‌کند |
| Facade | یک در ساده روی زیرسیستم پیچیده | پیشخوان هتل | یک `CheckoutService` روی ده Class؛ Facade در Laravel (در واقع static proxy) | وقتی به God Object تبدیل می‌شود |
| Composite | رفتار یکسان با برگ و شاخه | پوشه و فایل | منوی تودرتو؛ قواعد validation ترکیبی؛ `io.MultiWriter` | ساختار غیردرختی |
| Bridge | دو بُعد تغییر مستقل | کنترل از راه دور و تلویزیون | `database/sql` و Driverها؛ `log/slog` و `slog.Handler` | وقتی فقط یک بُعد تغییر داری |

```go
f, err := os.Open("events.json.gz")
if err != nil {
	return err
}
defer f.Close()

zr, err := gzip.NewReader(bufio.NewReader(f)) // file -> buffered -> gunzip
if err != nil {
	return err
}
defer zr.Close()

dec := json.NewDecoder(io.LimitReader(zr, 10<<20)) // -> capped at 10 MiB -> JSON
```

هر Layer یک `io.Reader` می‌گیرد و یک `io.Reader` برمی‌گرداند؛ همین decorator است، بدون یک خط Inheritance.

### Behavioral Patterns <Badge type="danger" text="حیاتی" />

مسئله‌ی مشترک: چه کسی تصمیم می‌گیرد و مسئولیت چطور بین Objectها تقسیم می‌شود.

| Pattern | هدف | تشبیه روزمره | همین حالا کجا می‌بینی‌اش | کی نه |
| --- | --- | --- | --- | --- |
| Strategy | Algorithm قابل تعویض | انتخاب مسیر در نقشه: سریع‌ترین یا کوتاه‌ترین | `sort.Slice` با تابع `less`؛ Driverهای cache و queue | دو حالت ثابت؛ یک `if` خواناتر است |
| Observer | خبر دادن به علاقه‌مندان | زنگ اخبار برای مشترکان | Events و Listeners در Laravel؛ Eloquent model events | وقتی جریان کار اصلی پشت listenerها پنهان می‌شود |
| Command | درخواست به‌صورت Object قابل ذخیره | برگه‌ی سفارش رستوران | Job در Queue؛ Artisan command؛ command bus | فراخوانی ساده‌ی همزمان |
| Chain of Responsibility | عبور درخواست از زنجیره‌ی handler | مراحل تأیید یک نامه‌ی اداری | middleware در `net/http` و Laravel؛ Pipeline | وقتی ترتیب حلقه‌ها Dependency پنهان می‌سازد |
| State | رفتار وابسته به وضعیت | چراغ راهنما | ماشین حالت سفارش؛ circuit breaker | دو سه وضعیت با گذار ساده |
| Template Method | اسکلت ثابت، گام‌های متغیر | فرم با جاهای خالی | `FormRequest` (`rules`، `authorize`)؛ `sort.Interface` | وقتی سلسله‌مراتب Inheritance عمیق می‌شود |
| Iterator | Traversal بدون افشای ساختار | کنترل «بعدی» در پخش‌کننده | `rows.Next()`؛ generator در PHP؛ `LazyCollection` | مجموعه‌ی کوچک در حافظه |
| Mediator | هماهنگ‌کننده‌ی مرکزی به‌جای ارتباط همه با همه | برج مراقبت فرودگاه | orchestrator در Saga؛ command bus | وقتی خودش God Object می‌شود |
| Null Object | پیاده‌سازی بی‌اثر به‌جای `nil` | صندلی خالی رزروشده | `io.Discard`؛ `NullLogger` در PSR-3 | وقتی نبودن باید خطا باشد |
| Specification | قاعده‌ی کسب‌وکار قابل ترکیب | Filterهای جست‌وجوی آگهی | Eloquent scope؛ Criteria در Doctrine | یک شرط ساده |

```php
// Manager = Factory + Strategy: the driver is picked by name from config
Storage::disk('s3')->put('invoices/42.pdf', $pdf);
Cache::store('redis')->remember("user:{$id}", 600, fn () => User::findOrFail($id));

// Pipeline = Chain of Responsibility: each pipe passes the payload on or stops
$order = app(Pipeline::class)
    ->send($order)
    ->through([ValidateStock::class, ApplyDiscount::class, CalculateTax::class])
    ->thenReturn();
```

### همان Pattern، دو زبان <Badge type="warning" text="مهم" />

کتاب GoF برای زبان‌های Class-based با Inheritance نوشته شده. در Go نیمی از Patternها به یک تابع یا یک Interface Single-Method تبدیل می‌شوند؛ در PHP مدرن هم closure و enum خیلی‌ها را کوتاه کرده‌اند.

| Pattern | Go idiomatic | PHP / Laravel idiomatic |
| --- | --- | --- |
| Strategy | مقدار تابعی (`func(a, b T) bool`) یا Interface کوچک | Class پشت Interface؛ closure؛ Manager با driver |
| Singleton | `sync.Once` یا بهتر: یک Instance که در `main` ساخته و Inject می‌شود | `singleton` یا `scoped` در Container |
| Builder | Functional Options | Builder روان (fluent)؛ named arguments |
| Decorator | wrapper با همان Interface؛ middleware | Class wrapper؛ `extend()` در Container |
| Observer | channel یا لیست callback | Event و Listener؛ model observer |
| Template Method | تابعی که تابع یا Interface می‌گیرد | Class abstract با hook |
| Iterator | `for range` روی channel یا تابع iterator | generator با `yield` |
| Factory | تابع `NewX(...)` | static factory؛ Container |
| State | نوع `enum`‌مانند با `iota` به‌علاوه‌ی جدول گذار | backed enum با Method |
| Inheritance | ندارد؛ embedding و Composition | دارد؛ ولی `final` و Composition پیش‌فرض بهتری است |

### Data Access Patterns <Badge type="warning" text="مهم" />

این‌ها GoF نیستند (بیشترشان از کتاب PoEAA فاولر می‌آیند) ولی در مصاحبه‌ی بک‌اند بیشتر از GoF پرسیده می‌شوند.

| Pattern | یک‌خطی | بیشتر بخوان |
| --- | --- | --- |
| Repository | مجموعه‌ی در حافظه‌مانند برای هر aggregate | سؤال ۸.۴ |
| Query Object / Directory | خواندن‌های نام‌دار و بدون اثر جانبی | <span class="vip-locked" title="VIP members only">Directory / Query Class <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> |
| CQRS Light | مسیر نوشتن غنی، مسیر خواندن تخت | <span class="vip-locked" title="VIP members only">CQRS Light <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> |
| Unit of Work | ردگیری تغییرها و یک commit | سؤال ۸.۶ |
| Active Record / Data Mapper | Object خودش را ذخیره می‌کند در برابر mapper جدا | سؤال ۸.۱۲ |
| Cache-Aside، Read/Write-Through | جای cache نسبت به منبع اصلی | <span class="vip-locked" title="VIP members only">Patternهای Cache <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> |
| DTO / Value Object / Entity | حمل داده، مقدار بی‌هویت، Object باهویت | سؤال ۸.۱۳ |

### Concurrency Patterns در Go

| Pattern | مسئله | ابزار |
| --- | --- | --- |
| Worker Pool | سقف برای کار همزمان | N goroutine روی یک channel؛ `errgroup` با `SetLimit` |
| Fan-out / Fan-in | پخش کار و جمع‌کردن نتیجه | چند goroutine و یک channel نتیجه |
| Pipeline | مراحل پشت‌سرهم با backpressure | channelهای زنجیره‌ای و `context` برای لغو |
| Semaphore | محدودکردن دسترسی به منبع | Buffered channel یا `semaphore.Weighted` |
| Singleflight | یکی‌کردن درخواست‌های همزمان یکسان | `singleflight.Group`؛ جلوگیری از cache stampede |

### Anti-patternها <Badge type="warning" text="مهم" />

| Anti-pattern | نشانه | درمان |
| --- | --- | --- |
| God Object | Classای که همه‌چیز را می‌داند؛ `Helper`، `Manager`، `Utils` | شکستن بر اساس دلیل تغییر (SRP) |
| Service Locator | `app()` یا Facade در عمق Domain؛ Dependency از Signature معلوم نیست | constructor injection |
| Anemic Domain Model | مدل فقط getter و setter؛ قواعد در serviceها پخش شده | بردن invariant به داخل مدل |
| Singleton به‌عنوان global | Testها به ترتیب اجرا حساس‌اند | Injection؛ lifetime را Container یا `main` مدیریت کند |
| Golden Hammer | هر مسئله با همان Pattern محبوب | از مسئله شروع کن |
| Lasagna code | ده Layer نازک که فقط پاس می‌دهند | حذف Layerای که تصمیمی نمی‌گیرد |
| Distributed Monolith | سرویس‌های جدا که باید با هم deploy شوند | مرزبندی دوباره یا ادغام |

### جمع‌بندی سریع

| اگر این مسئله را داری … | سراغ این برو |
| --- | --- |
| `switch` روی نوع که مدام بزرگ می‌شود | Strategy (یا State اگر خودِ Object حالت عوض می‌کند) |
| Constructor با پارامترهای اختیاری زیاد | Builder / Functional Options |
| کتابخانه‌ی بیرونی با Interface نامناسب | Adapter |
| cache، log، retry یا metric بدون دست‌زدن به کد اصلی | Decorator / middleware |
| چند واکنش مستقل به یک اتفاق | Observer؛ بین سرویس‌ها Pub/Sub |
| کاری که باید بعداً، در Queue یا با retry اجرا شود | Command (Job) |
| مراحل پشت‌سرهم که هر کدام می‌تواند متوقف کند | Chain of Responsibility |
| `if x != nil` در همه‌جا | Null Object |
| همان `where`ها در چند جا | Query Object / Specification |
| domain نباید SQL بداند | Repository |

## پرسش و پاسخ {#qa}

### ۸.۱ — Creational Patterns <Badge type="danger" text="حیاتی" /> {#q-8-1}

::: details پاسخ {open}
- **Singleton:** یک Instance در کل برنامه. در Go با `sync.Once`؛ در PHP با binding نوع `singleton`. دام: در worker ماندگار بین requestها می‌ماند.
- **Factory Method و Abstract Factory:** ساخت Object پشت Interface؛ مثل `NewNotifier("sms")`.
- **Builder:** ساخت گام‌به‌گام؛ Query Builder در Laravel؛ در Go معادلش Functional Options است.
- **Prototype:** ساخت با کپی؛ `clone` در PHP و «Clone With» در 8.5.
- **Object Pool:** استفاده‌ی مجدد؛ `sync.Pool`.

```go
var (
    once sync.Once
    cfg  *Config
)

func GetConfig() *Config {
    once.Do(func() { cfg = load() }) // thread-safe lazy init
    return cfg
}
```
:::

### ۸.۲ — Structural Patterns <Badge type="danger" text="حیاتی" /> {#q-8-2}

::: details پاسخ {open}
- **Adapter:** تبدیل Interface ناسازگار؛ پیچیدن SDK بانک پشت `PaymentGateway`؛ Flysystem در PHP.
- **Decorator:** افزودن رفتار؛ middleware در Go؛ `CachedUserRepository`.
- **Facade:** Interface ساده روی زیرسیستم پیچیده. دام: Facade در Laravel در واقع static proxy به Container است.
- **Proxy:** جانشین با Access Control یا lazy loading؛ lazy object در PHP 8.4، stub در gRPC.
- **Composite:** رفتار یکسان برای برگ و شاخه؛ منوی تو در تو.
- **Bridge:** جداسازی Abstraction از پیاده‌سازی؛ `database/sql` و Driverها.
:::

### ۸.۳ — Behavioral Patterns <Badge type="danger" text="حیاتی" /> {#q-8-3}

::: details پاسخ {open}
- **Strategy:** Algorithm قابل تعویض؛ محاسبه‌ی هزینه‌ی ارسال.
- **Observer:** Events در Laravel، EventDispatcher در Symfony.
- **Command:** درخواست به‌صورت Object؛ Job در Queue، command bus.
- **Chain of Responsibility:** خط لوله‌ی middleware.
- **State:** ماشین حالت سفارش؛ خود circuit breaker.
- **Template Method:** اسکلت ثابت، گام‌های قابل تعویض.
- **Iterator:** generator در PHP، range-over-func در Go.
- **Mediator:** orchestrator در Saga.
- **Null Object و Specification:** `NopLogger` و قوانین قابل ترکیب.
:::

### ۸.۴ — Repository Pattern؟ <Badge type="danger" text="حیاتی" /> {#q-8-4}

::: details پاسخ {open}
**پاسخ:** Abstractionای مجموعه‌مانند روی persistence برای هر aggregate؛ domain از SQL و ORM بی‌خبر می‌ماند و Test با fake ساده می‌شود.

```go
type OrderRepository interface {
    ByID(ctx context.Context, id OrderID) (*Order, error)
    Save(ctx context.Context, o *Order) error
}
```

<strong class="qa-trap">دام مصاحبه:</strong> repository عمومی روی هر جدول، یا نشت Query Builder به بیرون.
:::

### ۸.۵ — Query Object Pattern (Directory / Finder)؟ <Badge type="warning" text="مهم" /> {#q-8-5}

::: details پاسخ {open}
**پاسخ:** Classای فقط‌خواندنی که معیارهای یک خواندن را در یک جا نگه می‌دارد، تا همان `where`ها در Controller، CLI و job کپی نشوند. دو شکل دارد: Methodهای نام‌دار برای lookupهای پایدار Domain، و filter builder برای لیست‌هایی با Filterهای اختیاری زیاد.

```php
final class InvoiceFinder
{
    public function overdueFor(int $customerId, int $limit = 20): Collection
    {
        return Invoice::query()
            ->where('customer_id', $customerId)
            ->where('status', 'unpaid')
            ->where('due_date', '<', now())
            ->orderBy('due_date')
            ->limit($limit)
            ->get(['id', 'number', 'total', 'due_date']);
    }
}
```

**یوزکیس:** وقتی یک Query در بیش از یک جا تکرار می‌شود یا بیش از دو سه شرط دارد. سمت Query در CQRS Light همین است؛ نوشتن‌ها در Action یا Command Handler می‌مانند.

<strong class="qa-trap">دام مصاحبه:</strong> اثر جانبی (ایمیل، پرداخت، Queue) داخل Class query، یا یک «God Directory» با پنجاه Filter بی‌ربط.
:::

### ۸.۶ — Patternهای داده و Concurrency <Badge type="warning" text="مهم" /> {#q-8-6}

::: details پاسخ {open}
- **Unit of Work:** جمع‌آوری تغییرات و commit یکجا؛ `flush` در Doctrine.
- **Active Record و Data Mapper:** Eloquent در برابر Doctrine؛ در Go ابزار GORM در برابر sqlc.
- **DTO و Value Object:** Objectهای Immutable مثل `Money`.
- **Concurrency در Go:** Worker Pool، Fan-out/Fan-in، Pipeline، Semaphore و Singleflight.
:::

### ۸.۷ — مقایسه‌های پرتکرار <Badge type="warning" text="مهم" /> {#q-8-7}

::: details پاسخ {open}
- **Adapter، Decorator، Proxy:** اولی Interface را عوض می‌کند؛ دومی رفتار اضافه می‌کند؛ سومی دسترسی را کنترل می‌کند.
- **Strategy و State:** در اولی Client انتخاب می‌کند؛ در دومی Object با تغییر وضعیت.
- **Factory و Builder:** «کدام نوع» در برابر «چطور گام‌به‌گام».
- **Anti-patternها:** God Object، Anemic Domain Model، Service Locator، Distributed Monolith.
:::

### ۸.۸ — مشکل Singleton چیست و جایگزینش چه؟ <Badge type="warning" text="مهم" /> {#q-8-8}

::: details پاسخ {open}
**پاسخ:** Singleton کلاسیک دو چیز را قاطی می‌کند: «فقط یک Instance داشته باش» (گاهی لازم است) و «از همه‌جا در دسترس باش» (state سراسری). مشکل‌ها از دومی می‌آیند:

- Dependency پنهان: از Signature تابع معلوم نیست به چه چیزی وابسته است؛
- Test: state بین Testها می‌ماند و جایگزینی با fake سخت است؛
- Concurrency: state Mutable مشترک بین goroutineها؛
- runtime ماندگار در PHP (Octane، Swoole): Instance بین requestها زنده می‌ماند و داده‌ی کاربر قبلی نشت می‌کند.

**جایگزین:** «یک Instance» را نگه دار و «دسترسی سراسری» را حذف کن. Instance را یک بار در composition root (`main` در Go، Service Provider در Laravel) بساز و Inject کن.

```go
// instead of a package-level GetDB(): built once in main, passed explicitly
func main() {
	pool, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	users := NewUserRepository(pool) // still a single pool, but visible in the signature
	_ = users
}
```

**مثال واقعی:** در Laravel یک `singleton` که کاربر جاری را cache می‌کرد زیر Octane باعث شد request بعدی اطلاعات کاربر قبلی را ببیند؛ با `scoped` درست شد. **یوزکیس:** برای مقداردهی تنبل thread-safe در Go از `sync.Once` یا `sync.OnceValue` استفاده کن.

<strong class="qa-trap">دام مصاحبه:</strong> «Singleton همیشه بد است». connection pool، logger و config واقعاً باید تک‌نمونه باشند؛ ایراد به دسترسی سراسری و state Mutable است، نه به تعداد Instance.
:::

### ۸.۹ — Functional Options Pattern در Go؟ <Badge type="warning" text="مهم" /> {#q-8-9}

::: details پاسخ {open}
**پاسخ:** Go Argument پیش‌فرض، named argument و overload ندارد. Functional Options راه idiomatic برای Constructorای با تنظیمات اختیاری است: هر گزینه تابعی است که Object را تغییر می‌دهد و Constructor بعد از گذاشتن پیش‌فرض‌های امن، آن‌ها را به ترتیب اعمال می‌کند.

```go
type Server struct {
	addr    string
	timeout time.Duration
	logger  *slog.Logger
}

type Option func(*Server)

func WithTimeout(d time.Duration) Option { return func(s *Server) { s.timeout = d } }
func WithLogger(l *slog.Logger) Option   { return func(s *Server) { s.logger = l } }

func NewServer(addr string, opts ...Option) *Server {
	s := &Server{addr: addr, timeout: 30 * time.Second, logger: slog.Default()} // safe defaults
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// srv := NewServer(":8080", WithTimeout(5*time.Second))
```

| روش | خوب | بد |
| --- | --- | --- |
| struct پیکربندی (`Config{...}`) | ساده، قابل serialize، خوانا | مقدار صفر با «تنظیم‌نشده» قاطی می‌شود (`Timeout: 0` یعنی چه؟) |
| Functional Options | پیش‌فرض امن، افزودن گزینه بدون شکستن API، validation در هر گزینه | کد بیشتر؛ کشف گزینه‌ها سخت‌تر |
| Builder با زنجیره | آشنا برای کسانی که از Java یا PHP می‌آیند | در Go رایج نیست؛ مدیریت خطا وسط زنجیره زشت است |

**مثال واقعی:** `grpc.NewServer(grpc.MaxRecvMsgSize(...))` و `grpc.WithTransportCredentials(...)` همین Pattern هستند. **یوزکیس:** برای API عمومی کتابخانه با گزینه‌های زیاد و رو به رشد؛ برای کد داخلی با سه تنظیم، struct ساده کافی است.

<strong class="qa-trap">دام مصاحبه:</strong> Field اجباری را option نکن؛ اجباری‌ها پارامتر مستقیم Constructorاند. اگر گزینه می‌تواند نامعتبر باشد، نوع را `func(*Server) error` بگذار و خطا را از Constructor برگردان.
:::

### ۸.۱۰ — Middleware چه Patternای است و در Go و Laravel چطور کار می‌کند؟ <Badge type="danger" text="حیاتی" /> {#q-8-10}

::: details پاسخ {open}
**پاسخ:** ترکیب دو Pattern: از نظر ساختار **Decorator** است (هر middleware یک handler را می‌پیچد و همان Interface را برمی‌گرداند) و از نظر رفتار **Chain of Responsibility** (هر حلقه می‌تواند درخواست را رد کند، تغییر دهد یا به بعدی بدهد). کد قبل از صدا زدن `next` در مسیر رفت و کد بعد از آن در مسیر برگشت اجرا می‌شود؛ مثل لایه‌های پیاز.

```go
type Middleware func(http.Handler) http.Handler

func Chain(h http.Handler, mws ...Middleware) http.Handler {
	for i := len(mws) - 1; i >= 0; i-- {
		h = mws<span class="vip-locked" title="VIP members only">i <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> // wrap from the inside out so mws[0] runs first
	}
	return h
}

func Logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		slog.Info("request", "method", r.Method, "path", r.URL.Path, "took", time.Since(start))
	})
}

func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return // short-circuit: the chain stops here
		}
		next.ServeHTTP(w, r)
	})
}

// handler := Chain(mux, Logging, RequireAuth)
```

```php
final class RequireJsonBody
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->isJson()) {
            return response()->json(['error' => 'json_required'], 415); // stop the chain
        }

        $response = $next($request);            // code above this line runs on the way in
        $response->headers->set('X-Api', 'v1'); // code below it runs on the way out

        return $response;
    }
}
```

**مثال واقعی:** ترتیب معمول از بیرون به داخل: recover از panic → request id و tracing → logging و metric → rate limit → Authentication → authorization → handler. اگر logging داخل‌تر از auth باشد، درخواست‌های ۴۰۱ هیچ‌وقت Log نمی‌شوند.

**یوزکیس:** دغدغه‌های مشترک (cross-cutting) که به منطق کسب‌وکار ربطی ندارند. همین Pattern روی Client HTTP (`http.RoundTripper`)، gRPC interceptor و Consumer Queue هم به کار می‌رود.

<strong class="qa-trap">دام مصاحبه:</strong> گذاشتن منطق کسب‌وکار در middleware (مثلاً محاسبه‌ی تخفیف)؛ پنهان می‌شود و از CLI یا job Queue اجرا نمی‌شود. دام دوم در Go: خواندن `r.Body` در middleware بدون بازگرداندن آن، که handler بعدی بدنه‌ی خالی می‌بیند.
:::

### ۸.۱۱ — Observer، Pub/Sub و Mediator چه فرقی دارند؟ <Badge type="info" text="تکمیلی" /> {#q-8-11}

::: details پاسخ {open}
**پاسخ:** هر سه فرستنده را از گیرنده جدا می‌کنند، ولی به اندازه‌های متفاوت.

| | Observer | Pub/Sub | Mediator |
| --- | --- | --- | --- |
| چه کسی چه کسی را می‌شناسد | subject فهرست observerها را دارد | هیچ‌کدام؛ هر دو فقط broker و topic را می‌شناسند | همه فقط mediator را می‌شناسند |
| جهت | یک‌طرفه: اطلاع‌رسانی | یک‌طرفه: انتشار | دوطرفه: هماهنگی و تصمیم |
| مرز | داخل یک process | معمولاً بین processها | داخل یک process یا یک سرویس orchestrator |
| منطق کجاست | در observerها | در subscriberها | در خود mediator |
| مثال | Eloquent model events | Kafka، RabbitMQ، Redis Pub/Sub | orchestrator در Saga؛ command bus |

**مثال واقعی:** `OrderPaid` در Laravel با listenerهای sync داخل همان request یعنی Observer؛ همان Event که از outbox به RabbitMQ می‌رود و سرویس انبار آن را می‌گیرد یعنی Pub/Sub؛ Classای که می‌گوید «اول پرداخت، بعد رزرو انبار، اگر نشد refund» یعنی Mediator.

**یوزکیس:** وقتی واکنش‌ها مستقل‌اند Observer یا Pub/Sub؛ وقتی ترتیب و تصمیم بین چند Participant مهم است Mediator، چون جریان در یک جا خوانا می‌ماند.

<strong class="qa-trap">دام مصاحبه:</strong> listener همزمان (sync) که exception می‌دهد، عملیات اصلی را هم شکست می‌دهد و اگر داخل Transaction باشد آن را rollback می‌کند. «جدا شده» به معنی «Isolated در خرابی» نیست، مگر اینکه listener در Queue اجرا شود و بعد از commit dispatch شود.
:::

### ۸.۱۲ — Active Record یا Data Mapper؟ (Eloquent در برابر Doctrine) <Badge type="warning" text="مهم" /> {#q-8-12}

::: details پاسخ {open}
**پاسخ:** در Active Record هر Object یک ردیف جدول است و خودش ذخیره‌شدن را بلد است. در Data Mapper Domain Object چیزی از Database نمی‌داند و یک mapper جدا آن را می‌خواند و می‌نویسد؛ معمولاً همراه با Unit of Work و Identity Map.

```php
// Active Record (Eloquent): the object knows how to save itself
$order = Order::findOrFail($id);
$order->status = 'paid';
$order->save();

// Data Mapper (Doctrine): a plain object; the EntityManager tracks and flushes it
$order = $em->find(Order::class, $id);
$order->markPaid();
$em->flush();
```

| | Active Record | Data Mapper |
| --- | --- | --- |
| سرعت شروع | خیلی بالا | پایین‌تر؛ mapping و مفاهیم بیشتر |
| شکل مدل | همان شکل جدول | مستقل از جدول؛ مدل غنی راحت‌تر |
| Unit Test Domain | سخت بدون Database | ساده؛ Object معمولی است |
| نوشتن | صریح؛ هر `save()` یک Query | `flush()` همه‌ی تغییرهای ردگیری‌شده را یکجا می‌نویسد |
| ریسک | نشت persistence به همه‌جا؛ مدل چاق | پیچیدگی؛ رفتار غیرمنتظره‌ی flush و lazy loading |
| در Go | GORM (نزدیک به این سبک) | sqlc یا `pgx` خام به‌علاوه‌ی repository دستی |

**مثال واقعی:** Admin Panel و CRUD با Eloquent در چند روز بالا می‌آید. هسته‌ی صورت‌حساب با قواعد پیچیده بهتر است مدل Domain مستقل داشته باشد؛ حتی در Laravel می‌شود Eloquent را فقط داخل repository نگه داشت و به بیرون Domain Object یا DTO داد.

<strong class="qa-trap">دام مصاحبه:</strong> «Active Record Anti-pattern است». برای Domain ساده بهترین انتخاب است. مشکل وقتی است که منطق پیچیده را در مدلی بگذاری که هر property آن public و قابل `save()` از هر جای کد است.
:::

### ۸.۱۳ — DTO، Value Object و Entity چه فرقی دارند؟ <Badge type="warning" text="مهم" /> {#q-8-13}

::: details پاسخ {open}
**پاسخ:**

| | Entity | Value Object | DTO |
| --- | --- | --- | --- |
| هویت | دارد (`id`)؛ با تغییر Fieldها همان می‌ماند | ندارد؛ فقط مقدارش مهم است | ندارد |
| برابری | با `id` | با همه‌ی Fieldها | مهم نیست |
| Mutability | چرخه‌ی عمر دارد و تغییر می‌کند | Immutable | ترجیحاً Immutable |
| رفتار و قاعده | دارد (invariant) | دارد (Validation، محاسبه) | ندارد؛ فقط حمل داده |
| کجا زندگی می‌کند | Domain Layer | Domain Layer | مرزها: HTTP، Queue، بین Layerها |
| مثال | `Order`، `User` | `Money`، `Email`، `DateRange` | `CreateOrderRequest`، `OrderResponse` |

```go
// value object: validated once, compared by value, never mutated
type Email struct{ value string }

func NewEmail(s string) (Email, error) {
	s = strings.ToLower(strings.TrimSpace(s))
	if !strings.Contains(s, "@") {
		return Email{}, errors.New("invalid email")
	}
	return Email{value: s}, nil
}

func (e Email) String() string { return e.value }
```

**مثال واقعی:** `amount int` و `currency string` به‌صورت دو Field جدا در همه‌جا پخش‌اند و جایی ریال با تومان جمع می‌شود. با `Money` به‌عنوان Value Object، جمع دو ارز مختلف اصلاً ممکن نیست.

**یوزکیس:** «primitive obsession» را با Value Object درمان کن: هر جا یک `string` یا `int` قاعده دارد (ایمیل، کد ملی، مبلغ، بازه‌ی تاریخ). DTO را در مرز نگه دار تا تغییر Domain Model قرارداد API را نشکند.

<strong class="qa-trap">دام مصاحبه:</strong> برگرداندن مستقیم Entity یا مدل Eloquent از API؛ هر ستون جدید ناخواسته افشا می‌شود و schema Database به قرارداد عمومی تبدیل می‌شود.
:::

### ۸.۱۴ — Template Method یا Strategy؟ <Badge type="info" text="تکمیلی" /> {#q-8-14}

::: details پاسخ {open}
**پاسخ:** هر دو «بخش ثابت» Algorithm را از «بخش متغیر» جدا می‌کنند. Template Method با Inheritance: Class والد اسکلت را دارد و فرزند گام‌ها را پر می‌کند (انتخاب در زمان compile، یک بُعد تغییر). Strategy با Composition: بخش متغیر یک Object یا تابع جداست که Inject می‌شود (انتخاب در runtime، قابل ترکیب و Test مستقل).

| | Template Method | Strategy |
| --- | --- | --- |
| سازوکار | Inheritance و hook | Composition و Injection |
| کنترل جریان | والد فرزند را صدا می‌زند | context Strategy را صدا می‌زند |
| تعویض در runtime | نه | بله |
| چند بُعد تغییر | انفجار Subclass | چند Strategy مستقل |
| مثال PHP | `FormRequest`، `Migration` (`up` و `down`)، Job با `handle` | driver در Manager |
| مثال Go | `sort.Sort` با `sort.Interface` | `sort.Slice` با تابع `less` |

**مثال واقعی:** importer فایل با اسکلت «باز کن → parse کن → validate کن → ذخیره کن». با Template Method برای CSV و Excel دو Subclass داری؛ وقتی «مقصد ذخیره» هم متغیر شد (DB یا S3) تعداد Subclassها ضرب می‌شود. با دو Strategy (`Parser` و `Sink`) هر ترکیبی بدون Class جدید ساخته می‌شود.

**یوزکیس:** در Go چون Inheritance نیست، Template Method همیشه به شکل «تابعی که Interface یا تابع می‌گیرد» درمی‌آید، یعنی عملاً همان Strategy. در Frameworkهای PHP، Template Method برای نقطه‌های توسعه‌ای که Framework صدا می‌زند طبیعی است.

<strong class="qa-trap">دام مصاحبه:</strong> Class پایه‌ی abstract با ده hook اختیاری که هیچ فرزندی همه را لازم ندارد؛ همان fragile base class است.
:::

### ۸.۱۵ — Factory Method، Abstract Factory و Builder را با مثال از هم جدا کن. <Badge type="info" text="تکمیلی" /> {#q-8-15}

::: details پاسخ {open}
**پاسخ:** سؤال متفاوتی را جواب می‌دهند:

| Pattern | سؤالی که جواب می‌دهد | خروجی | مثال |
| --- | --- | --- | --- |
| Simple Factory / Factory Method | *کدام* نوع ساخته شود؟ | یک Object از یک Interface | `NewNotifier("sms")`؛ `Cache::store('redis')` |
| Abstract Factory | کدام *خانواده* از Objectهای سازگار؟ | چند Object مرتبط که با هم کار می‌کنند | Driver Database: connection، grammar و processor هماهنگ |
| Builder | *چطور* و با چه گام‌هایی سر هم شود؟ | یک Object پیچیده | Query Builder؛ Functional Options |

```go
// factory: picks the concrete type; callers only see the interface
func NewNotifier(kind string, cfg Config) (Notifier, error) {
	switch kind {
	case "sms":
		return &SMSNotifier{apiKey: cfg.SMSKey}, nil
	case "email":
		return &EmailNotifier{smtp: cfg.SMTPAddr}, nil
	default:
		return nil, fmt.Errorf("unknown notifier %q", kind)
	}
}
```

**مثال واقعی:** در Laravel وقتی `DB::connection('pgsql')` می‌گیری، connection، query grammar و schema grammar همه برای PostgreSQL ساخته می‌شوند؛ نمی‌شود grammar مربوط به MySQL را با connection مربوط به PostgreSQL قاطی کرد. این تضمینِ «خانواده‌ی سازگار» همان Abstract Factory است.

**یوزکیس:** در عمل نود درصد موارد یک factory ساده (یک تابع با `switch` یا یک map از Constructorها) کافی است. Abstract Factory فقط وقتی که واقعاً چند Object باید از یک خانواده باشند.

<strong class="qa-trap">دام مصاحبه:</strong> این `switch` نقض Open/Closed نیست؛ یک نقطه‌ی مرکزی برای انتخاب نوع دقیقاً همان جایی است که `switch` باید باشد. مشکل وقتی است که همان `switch` در ده جای دیگر هم تکرار شود.
:::

## مطالب مرتبط {#related}

- <span class="vip-locked" title="VIP members only">Directory / Query Class <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>
- <span class="vip-locked" title="VIP members only">CQRS Light <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>
- [اصول طراحی](/fa/design/principles)
