# اصول طراحی

> Software Design و Patternها · درس‌نامه + پرسش و پاسخ · بخش ۷ بانک سؤال · ۱۵ سؤال · [فهرست همهٔ سؤال‌ها](/fa/interview/)

<QaControls />

## درس‌نامه {#lessons}

اصول طراحی برای یک هدف‌اند: **ارزان نگه‌داشتن تغییر**. کدی که امروز کار می‌کند ولی هر تغییر کوچک در آن سه فایل بی‌ربط را می‌شکند، بد طراحی شده؛ حتی اگر همه‌ی Patternها را رعایت کرده باشد. هر اصل را با «بویی» که برطرف می‌کند یاد بگیر، نه با تعریفش.

### SOLID، یکی‌یکی <Badge type="danger" text="حیاتی" />

| اصل | یک‌خطی | بویی که برطرف می‌کند |
| --- | --- | --- |
| **S** — Single Responsibility | هر واحد یک دلیل (یک ذی‌نفع) برای تغییر | Class هزارخطی؛ merge conflict دائمی روی یک فایل |
| **O** — Open/Closed | رفتار جدید با کد جدید، نه ویرایش کد قدیمی | `switch` روی نوع که در ده جا تکرار شده |
| **L** — Liskov Substitution | Subtype هر جا والد بود بدون غافل‌گیری کار کند | `if ($x instanceof Special)`؛ Methodای که `not supported` می‌اندازد |
| **I** — Interface Segregation | Consumer به Methodای که صدا نمی‌زند وابسته نباشد | mock با بیست Method خالی |
| **D** — Dependency Inversion | سیاست به جزئیات وابسته نباشد؛ هر دو به Abstraction | use case که بدون Database واقعی Test نمی‌شود |

**S — Single Responsibility.** «یک کار» یعنی «یک دلیل برای تغییر». قیمت‌گذاری را تیم مالی عوض می‌کند، متن ایمیل را تیم بازاریابی؛ اگر هر دو در یک متدند، تغییر یکی دیگری را به خطر می‌اندازد.

```php
// before: pricing, persistence and email change for three different reasons
final class OrderService
{
    public function place(Cart $cart): Order
    {
        $total = 0;
        foreach ($cart->items as $item) {
            $total += $item->price * $item->qty;
        }
        $order = Order::create(['total' => $total]);
        Mail::to($cart->email)->send(new OrderPlaced($order));

        return $order;
    }
}

// after: each collaborator has one reason to change; the use case only coordinates
final class PlaceOrder
{
    public function __construct(
        private PriceCalculator $prices,
        private OrderRepository $orders,
        private OrderNotifier $notifier,
    ) {}

    public function handle(Cart $cart): Order
    {
        $order = $this->orders->save(Order::fromCart($cart, $this->prices->total($cart)));
        $this->notifier->placed($order);

        return $order;
    }
}
```

**O — Open/Closed.** نقطه‌ای را که می‌دانی تغییر می‌کند (Gateway، حامل، قالب خروجی) پشت یک Interface بگذار تا افزودن مورد جدید به معنی ویرایش کد Testشده‌ی قبلی نباشد.

```go
// before: every new carrier edits this function (and every other switch like it)
func ShippingCost(carrier string, kg float64) (float64, error) {
	switch carrier {
	case "post":
		return 50_000 + 8_000*kg, nil
	case "tipax":
		return 90_000 + 5_000*kg, nil
	default:
		return 0, fmt.Errorf("unknown carrier %q", carrier)
	}
}

// after: a new carrier is a new type registered in one place
type Carrier interface {
	Cost(kg float64) float64
}

type Post struct{}

func (Post) Cost(kg float64) float64 { return 50_000 + 8_000*kg }

type Tipax struct{}

func (Tipax) Cost(kg float64) float64 { return 90_000 + 5_000*kg }

var carriers = map[string]Carrier{"post": Post{}, "tipax": Tipax{}}
```

یک `switch` تنها اشکالی ندارد؛ OCP وقتی ارزش دارد که همان `switch` در چند جا تکرار شود یا موردها مرتب اضافه شوند.

**L — Liskov Substitution.** قرارداد فقط Method Signature نیست؛ Precondition، Postcondition و خطاهایی که ممکن است برگردد هم جزو آن است. Subtype نباید بیشتر بخواهد یا کمتر قول بدهد.

```php
// violation: callers of Repository::save() now need to know about the subtype
interface Repository
{
    public function find(int $id): ?Order;
    public function save(Order $order): void;
}

final class ReplicaRepository implements Repository
{
    public function find(int $id): ?Order { /* read from the replica */ return null; }

    public function save(Order $order): void
    {
        throw new LogicException('read-only'); // breaks the contract of the parent type
    }
}

// fix: do not promise what you cannot do
interface OrderReader { public function find(int $id): ?Order; }
interface OrderWriter { public function save(Order $order): void; }
```

**I — Interface Segregation.** Interface را به اندازه‌ی نیاز Consumer ببُر. در Go این اصل تقریباً رایگان است چون Interface به‌صورت ضمنی پیاده می‌شود.

```go
// before: the report only reads, yet its tests must fake every method
type UserStore interface {
	ByID(ctx context.Context, id int64) (User, error)
	ByEmail(ctx context.Context, email string) (User, error)
	Create(ctx context.Context, u User) error
	Update(ctx context.Context, u User) error
	Delete(ctx context.Context, id int64) error
}

// after: declared in the consumer package, sized to what it actually calls
type userFinder interface {
	ByID(ctx context.Context, id int64) (User, error)
}

func BuildReport(ctx context.Context, users userFinder, id int64) (Report, error) {
	u, err := users.ByID(ctx, id)
	if err != nil {
		return Report{}, fmt.Errorf("load user %d: %w", id, err)
	}
	return Report{Name: u.Name}, nil
}
```

**D — Dependency Inversion.** «وارونگی» یعنی Interface متعلق به Layer سیاست (use case) است و جزئیات (SDK، Database، HTTP client) آن را پیاده می‌کنند؛ جهت Dependency کد برعکس جهت فراخوانی در runtime می‌شود.

```php
// before: the use case is welded to one vendor's client
final class SendOtp
{
    public function handle(string $phone, string $code): void
    {
        (new KavenegarClient(config('sms.key')))->send($phone, "Code: {$code}");
    }
}

// after: the policy owns the interface; the detail implements it
interface SmsSender
{
    public function send(string $phone, string $text): void;
}

final class SendOtpViaSender
{
    public function __construct(private SmsSender $sms) {}

    public function handle(string $phone, string $code): void
    {
        $this->sms->send($phone, "Code: {$code}");
    }
}

// AppServiceProvider::register()
$this->app->bind(SmsSender::class, KavenegarSmsSender::class);
```

### DRY، KISS، YAGNI و «Abstraction اشتباه» <Badge type="danger" text="حیاتی" />

- **DRY** درباره‌ی تکرار *دانش* است نه تکرار *متن*. نرخ مالیات که در سه جا hard-code شده نقض DRY است. دو تابع که امروز اتفاقاً شبیه هم‌اند ولی به دو دلیل متفاوت تغییر می‌کنند، نقض DRY نیستند.
- **KISS**: ساده‌ترین چیزی که مسئله‌ی فعلی را حل می‌کند. سادگی یعنی کمترین تعداد مفهومی که خواننده باید در ذهن نگه دارد، نه کمترین تعداد خط.
- **YAGNI**: برای نیازی که هنوز نیامده کد ننویس. هزینه‌ی واقعی‌اش فقط نوشتن نیست؛ نگه‌داری، Test و محدودشدن طراحی آینده است.

هشدار کلاسیک (Sandi Metz): «تکرار خیلی ارزان‌تر از Abstraction اشتباه است». چرخه‌اش این است: دو تکه کد شبیه را یکی می‌کنی؛ نیاز سوم کمی فرق دارد و یک پارامتر `bool` اضافه می‌شود؛ بعد یکی دیگر؛ چند ماه بعد تابعی داری با شش flag که هیچ‌کس جرئت دست‌زدن به آن را ندارد. درمان: Abstraction را برگردان (inline کن)، تکرار را بپذیر و صبر کن تا شکل واقعی مشترک دیده شود. قاعده‌ی سه: بار اول بنویس، بار دوم با اکراه تکرار کن، بار سوم استخراج کن.

### Cohesion و Coupling <Badge type="warning" text="مهم" />

Cohesion یعنی چیزهایی که با هم تغییر می‌کنند کنار هم باشند؛ coupling یعنی یک Module چقدر درباره‌ی Module دیگر می‌داند. هدف: Cohesion بالا در داخل، coupling کم و آشکار در بیرون.

| نوع coupling (از بدترین) | یعنی | مثال | بهتر است |
| --- | --- | --- | --- |
| محتوا | دست‌بردن در داخل Module دیگر | خواندن مستقیم جدول سرویس دیگر | API یا Event |
| سراسری | اشتراک state سراسری | متغیر package-level، `config()` در عمق Domain | Injection مقدار |
| کنترلی | فرستادن flag برای تعیین رفتار دیگری | `save($order, true, false)` | دو Method یا Strategy |
| ساختاری (stamp) | فرستادن کل Object وقتی یک Field لازم است | دادن کل `User` برای ارسال ایمیل | فقط `email` یا یک DTO کوچک |
| داده‌ای | فقط داده‌ی لازم | `charge(amount, token)` | همین خوب است |
| زمانی | هر دو باید همزمان بالا باشند | فراخوانی sync زنجیره‌ای | Queue یا Event |

دو Metric ساده برای دیدنش در کد واقعی: **fan-in** (چند جا به این Module وابسته‌اند؛ بالا یعنی تغییرش گران است پس باید پایدار باشد) و **fan-out** (این Module به چند جا وابسته است؛ بالا یعنی شکننده است). آزمون عملی Cohesion: آیا می‌توانی کار Module را در یک جمله بدون «و» بگویی؟

### Dependency Injection: Go در برابر PHP <Badge type="danger" text="حیاتی" />

ایده یکی است: Object Dependencyاش را نمی‌سازد، تحویل می‌گیرد. اجرا در دو زبان فرق دارد.

| | Go | PHP / Laravel |
| --- | --- | --- |
| روش غالب | constructor injection دستی در `main` (composition root) | Container با autowiring از روی type-hint |
| Interface کجا تعریف می‌شود | سمت Consumer، کوچک | معمولاً کنار Domain؛ binding در Service Provider |
| خطا کی دیده می‌شود | زمان compile | زمان resolve (runtime) |
| ابزار | هیچ؛ برای Graph بزرگ `wire` یا `fx` | `bind`، `singleton`، `scoped`، contextual binding |
| دام | package-level variable و `init()` | Facade و `app()` وسط Domain (Service Locator) |

```go
func main() {
	db, err := sql.Open("pgx", os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	orders := postgres.NewOrderRepository(db) // concrete types are built here...
	gateway := zarinpal.NewClient(os.Getenv("ZARINPAL_MERCHANT"))
	checkout := app.NewCheckout(orders, gateway) // ...and handed in as interfaces

	log.Fatal(http.ListenAndServe(":8080", httpapi.NewRouter(checkout)))
}
```

```php
// Laravel resolves the whole graph from constructor type-hints
final class CheckoutController
{
    public function __construct(private Checkout $checkout) {}
}

// AppServiceProvider::register(): only interfaces need an explicit binding
$this->app->bind(PaymentGateway::class, ZarinpalGateway::class);
$this->app->scoped(CartContext::class); // one instance per request, safe under Octane
```

نکته برای runtime ماندگار (Octane، Swoole، RoadRunner): `singleton` بین requestها زنده می‌ماند. هر چیزی که state مربوط به request دارد باید `scoped` باشد، وگرنه داده‌ی یک کاربر به request بعدی نشت می‌کند.

### Composition به‌جای Inheritance <Badge type="warning" text="مهم" />

Inheritance قوی‌ترین نوع coupling است: Subclass به جزئیات پیاده‌سازی والد وابسته می‌شود و تغییر والد همه‌ی فرزندان را می‌شکند (fragile base class). با Composition، رفتار از قطعه‌های کوچک پشت Interface سرهم می‌شود و هر قطعه جدا Test و تعویض می‌شود.

```go
// behaviour is assembled, not inherited: a retrying sender wraps any sender
type Sender interface {
	Send(ctx context.Context, to, text string) error
}

type RetryingSender struct {
	next     Sender
	attempts int
}

func (s RetryingSender) Send(ctx context.Context, to, text string) error {
	var err error
	for i := 0; i < s.attempts; i++ {
		if err = s.next.Send(ctx, to, text); err == nil {
			return nil
		}
	}
	return err
}
```

Go اصلاً Inheritance ندارد؛ embedding فقط Methodها را promote می‌کند و رابطه‌ی «is-a» نمی‌سازد (Method embed‌شده نمی‌تواند Method override‌شده‌ی بیرونی را صدا بزند). در PHP Inheritance را برای رابطه‌ی واقعی «نوعی از» نگه دار و برای اشتراک کد از Composition یا در نهایت trait استفاده کن؛ Classها را پیش‌فرض `final` بگذار.

### Law of Demeter و Tell, Don't Ask

`$order->customer->address->city->name` یعنی این کد ساختار داخلی چهار Object را می‌داند و با تغییر هر کدام می‌شکند. به‌جای «پرسیدن و تصمیم‌گرفتن»، به Object «بگو» چه می‌خواهی: `$order->shippingCity()`. استثنا: DTO و ساختارهای داده‌ی ساده که رفتار ندارند؛ زنجیره‌ی fluent مثل Query Builder هم نقض نیست چون همیشه با همان Object حرف می‌زنی.

### جمع‌بندی سریع

| اصل | سؤالی که از خودت بپرس | نشانه‌ی افراط |
| --- | --- | --- |
| SRP | این Class به چند دلیل مختلف تغییر می‌کند؟ | صد Class سه‌خطی که باید همه را باز کنی تا یک جریان را بفهمی |
| OCP | مورد بعدی را بدون ویرایش کد قدیمی می‌شود اضافه کرد؟ | Interface با یک پیاده‌سازی «برای آینده» |
| LSP | جایگزینی Subtype کسی را غافل‌گیر می‌کند؟ | — |
| ISP | Consumer همه‌ی Methodهای این Interface را صدا می‌زند؟ | Interface Single-Method برای همه‌چیز |
| DIP | use case بدون Database و شبکه Test می‌شود؟ | Abstraction روی چیزهایی که هرگز عوض نمی‌شوند |
| DRY | این *دانش* در چند جا نوشته شده؟ | تابع مشترک با شش flag |
| YAGNI | همین امروز چه کسی این را لازم دارد؟ | نادیده‌گرفتن تصمیم‌های برگشت‌ناپذیر (schema، API عمومی) |
| Coupling | تغییر این Module چند Module دیگر را باز می‌کند؟ | — |
| DI | Dependencyها از Signature constructor معلوم‌اند؟ | Container جادویی که هیچ‌کس Graphش را نمی‌فهمد |
| Composition | این واقعاً رابطه‌ی «نوعی از» است؟ | — |

## پرسش و پاسخ {#qa}

### ۷.۱ — اصول SOLID؟ <Badge type="danger" text="حیاتی" /> {#q-7-1}

::: details پاسخ {open}
- **S — Single Responsibility:** هر Module یک دلیل برای تغییر. مثال: `OrderService` که هم قیمت حساب می‌کند هم ایمیل می‌زند؛ جدا کن.
- **O — Open/Closed:** Gateway جدید با پیاده‌سازی `PaymentGateway`، نه `switch` جدید.
- **L — Liskov:** Subtype بدون شکستن رفتار جایگزین والد شود. نقض: `ReadOnlyRepository` که `Save()` آن exception می‌دهد.
- **I — Interface Segregation:** Interface کوچک؛ مثل `io.Reader` و `io.Writer`.
- **D — Dependency Inversion:** use case به `UserRepository` وابسته است، نه به `*sql.DB` یا Eloquent.

```go
type PaymentGateway interface {
    Charge(ctx context.Context, amount Money, token string) (TxID, error)
}

type Checkout struct{ gw PaymentGateway } // depends on the abstraction

func NewCheckout(gw PaymentGateway) *Checkout { return &Checkout{gw: gw} }
```

<strong class="qa-trap">دام مصاحبه:</strong> افراط در SOLID یعنی Abstraction زودهنگام؛ در Go Interface را سمت Consumer تعریف کن.
:::

### ۷.۲ — DRY، KISS، YAGNI، Law of Demeter و Composition over Inheritance؟ <Badge type="warning" text="مهم" /> {#q-7-2}

::: details پاسخ {open}
**پاسخ:** تکرار دانش را حذف کن؛ ساده‌ترین راه‌حل؛ چیزی که لازم نیست نساز؛ فقط با همسایه‌ی مستقیم حرف بزن؛ رفتار را با Composition بساز.

**مثال واقعی:** در Go Inheritance نیست و embedding داریم؛ در PHP trait و Dependency Injection.
:::

### ۷.۳ — Cohesion و Coupling؟ <Badge type="warning" text="مهم" /> {#q-7-3}

::: details پاسخ {open}
**پاسخ:** Cohesion بالا یعنی اجزای یک Module یک هدف دارند؛ coupling کم یعنی تغییر یکی دیگری را نمی‌شکند.
:::

### ۷.۴ — Dependency Injection و IoC؟ <Badge type="danger" text="حیاتی" /> {#q-7-4}

::: details پاسخ {open}
**پاسخ:** Object Dependencyهایش را از بیرون می‌گیرد. در Go معمولاً دستی در `main`؛ در PHP Container Laravel و Symfony.

**مثال واقعی:** تعویض `SmtpMailer` با `FakeMailer` در Test. <strong class="qa-trap">دام مصاحبه:</strong> Service Locator Anti-pattern است.
:::

### ۷.۵ — چرا state سراسری بد است؟ <Badge type="warning" text="مهم" /> {#q-7-5}

::: details پاسخ {open}
**پاسخ:** Dependency پنهان و Test سخت. در Go منبع data race است؛ در PHP با runtime ماندگار بین requestها نشت می‌کند.
:::

### ۷.۶ — «Accept interfaces, return structs» در Go یعنی چه؟ <Badge type="danger" text="حیاتی" /> {#q-7-6}

::: details پاسخ {open}
**پاسخ:** تابع در ورودی کوچک‌ترین Interfaceای را بپذیرد که لازم دارد، و در خروجی نوع مشخص (concrete) برگرداند. Interface را Consumer تعریف می‌کند، نه Packageای که پیاده‌سازی را دارد؛ چون در Go پیاده‌سازی ضمنی است، لازم نیست Producer از قبل بداند چه کسی چه چیزی می‌خواهد.

```go
// package postgres: returns the concrete type, exports no interface
func NewOrderRepository(db *sql.DB) *OrderRepository { return &OrderRepository{db: db} }

// package app: declares only what it needs
type orderSaver interface {
	Save(ctx context.Context, o Order) error
}

func NewCheckout(orders orderSaver) *Checkout { return &Checkout{orders: orders} }
```

چرا خروجی concrete: فراخواننده به همه‌ی Methodها دسترسی دارد، افزودن Method جدید کسی را نمی‌شکند (افزودن Method به Interface breaking change است) و خواننده با یک کلیک به پیاده‌سازی می‌رسد.

**مثال واقعی:** `io.Copy(dst io.Writer, src io.Reader)` با فایل، Socket، buffer و gzip کار می‌کند چون فقط یک Method می‌خواهد. **یوزکیس:** استثناها: `error` همیشه Interface برمی‌گردد؛ factoryای که بین چند پیاده‌سازی انتخاب می‌کند ناچار Interface برمی‌گرداند.

<strong class="qa-trap">دام مصاحبه:</strong> عادت Java: یک `interfaces.go` با Interface بزرگ کنار پیاده‌سازی، قبل از اینکه Consumer دومی وجود داشته باشد. دام دوم: برگرداندن Pointer `nil` از نوع concrete در قالب Interface؛ نتیجه `!= nil` است.
:::

### ۷.۷ — نقض Liskov در کد واقعی چه شکلی است؟ <Badge type="warning" text="مهم" /> {#q-7-7}

::: details پاسخ {open}
**پاسخ:** هر جا فراخواننده مجبور شود نوع واقعی را بداند، LSP شکسته است. شکل‌های رایج:

| نقض | مثال |
| --- | --- |
| Methodای که پشتیبانی نمی‌شود | `save()` در repository فقط‌خواندنی exception می‌دهد |
| Precondition سخت‌تر | والد هر مبلغی را می‌پذیرد، فرزند فقط بالای ۱۰۰۰ |
| Postcondition ضعیف‌تر | والد قول «مرتب‌شده» می‌دهد، فرزند نامرتب برمی‌گرداند |
| خطای جدید | cache decorator که خطای Redis را به فراخواننده‌ای می‌دهد که فقط خطای DB را می‌شناسد |
| تغییر رفتار جانبی | پیاده‌سازی async از Interfaceای که فراخواننده فرض می‌کند sync و کامل‌شده است |
| مربع و مستطیل | `Square::setWidth()` ارتفاع را هم عوض می‌کند و Testهای `Rectangle` می‌شکنند |

آزمون عملی: مجموعه Test قرارداد (contract test) که برای Interface نوشته شده باید روی *همه‌ی* پیاده‌سازی‌ها سبز باشد؛ از جمله fake Test.

**مثال واقعی:** `FakePaymentGateway` در Test همیشه موفق است و هیچ‌وقت timeout نمی‌دهد؛ کد در Test سبز و در production روی اولین timeout خراب می‌شود. fake هم باید قرارداد خطا را رعایت کند.

<strong class="qa-trap">دام مصاحبه:</strong> «Go Inheritance ندارد پس LSP مطرح نیست». هر پیاده‌سازی یک Interface Subtype آن است؛ `io.Reader`ای که `0, nil` برمی‌گرداند و هیچ‌وقت `io.EOF` نمی‌دهد قرارداد مستند را شکسته و فراخواننده را در حلقه نگه می‌دارد.
:::

### ۷.۸ — DRY کی ضرر می‌زند؟ <Badge type="danger" text="حیاتی" /> {#q-7-8}

::: details پاسخ {open}
**پاسخ:** وقتی شباهت ظاهری را با دانش مشترک اشتباه بگیری. سه جای رایج:

- **Abstraction اشتباه:** دو تکه کد شبیه یکی می‌شوند و بعد با flag و `if` از هم جدا نگه داشته می‌شوند. نشانه: پارامتر `bool`، نام‌های کلی مثل `process` یا `handle`، و فراخواننده‌هایی که هر کدام فقط نصف تابع را لازم دارند.
- **اشتراک بین مرزها:** یک Package `common` یا `shared` که DTO و مدل را بین چند سرویس یا bounded context مشترک می‌کند. نتیجه: هیچ سرویسی جدا deploy نمی‌شود (distributed monolith). بین سرویس‌ها قرارداد مشترک است، نه کد.
- **DRY در Test:** helperهای تودرتو که برای فهمیدن یک Test باید پنج فایل را باز کنی. Test باید داستانش را خودش بگوید؛ آنجا خوانایی از DRY مهم‌تر است (DAMP).

**مثال واقعی:** validation فرم ثبت‌نام کاربر و فرم ویرایش پروفایل توسط admin در ابتدا یکسان‌اند و یکی می‌شوند؛ شش ماه بعد قواعد admin فرق می‌کند و Class مشترک پر از `if ($isAdmin)` است. دو Class جدا با ده خط تکراری ارزان‌تر بود.

**یوزکیس:** قبل از استخراج بپرس: «اگر یکی تغییر کند، دیگری هم *باید* تغییر کند؟» اگر نه، تکرار نیست؛ تصادف است.

<strong class="qa-trap">دام مصاحبه:</strong> تعریف DRY به «کد تکراری ننویس». تعریف اصلی این است: هر تکه *دانش* یک نمایش واحد و معتبر در سیستم داشته باشد.
:::

### ۷.۹ — چرا می‌گویند سختی Test نشانه‌ی طراحی بد است؟ <Badge type="warning" text="مهم" /> {#q-7-9}

::: details پاسخ {open}
**پاسخ:** Test اولین Consumer کد است. اگر برای ساختن یک Object در Test به Database، ساعت سیستم، متغیر محیطی و پنج mock نیاز داری، همان coupling در production هم هست و فقط دیده نمی‌شود.

| درد در Test | مشکل طراحی | درمان |
| --- | --- | --- |
| setup طولانی با mockهای زیاد | Dependency زیاد، SRP | شکستن Class؛ جداکردن منطق خالص از I/O |
| نیاز به `sleep` یا تاریخ واقعی | زمان به‌عنوان Dependency پنهان | Injection clock |
| Testها به ترتیب اجرا حساس‌اند | state سراسری | Injection state؛ حذف singleton |
| mock کردن Method static یا Facade | Service Locator | constructor injection |
| Test با هر refactor می‌شکند | Test به پیاده‌سازی چسبیده، نه رفتار | Test از مرز عمومی |

```go
type Clock func() time.Time

type TokenIssuer struct{ now Clock }

func (t TokenIssuer) ExpiresAt() time.Time { return t.now().Add(15 * time.Minute) }

// production: TokenIssuer{now: time.Now}
// test:       TokenIssuer{now: func() time.Time { return time.Unix(1_700_000_000, 0) }}
```

**مثال واقعی:** Pattern «functional core, imperative shell»: محاسبه‌ی تخفیف یک تابع خالص است که صدها حالتش در میلی‌ثانیه Test می‌شود؛ Layer نازک بیرونی فقط داده را می‌خواند و می‌نویسد و با چند Test integration پوشش داده می‌شود.

<strong class="qa-trap">دام مصاحبه:</strong> راه‌حل را «mock بیشتر» دانستن. mock زیاد خودش نشانه‌ی همان مشکل است و Testای می‌سازد که پیاده‌سازی را قفل می‌کند.
:::

### ۷.۱۰ — Immutability چه کمکی می‌کند و در Go و PHP چطور به دستش می‌آوری؟ <Badge type="info" text="تکمیلی" /> {#q-7-10}

::: details پاسخ {open}
**پاسخ:** Object Immutable بعد از ساخت همیشه معتبر است: validation یک بار در constructor انجام می‌شود، اشتراکش بین goroutineها یا requestها بی‌خطر است و «چه کسی این را عوض کرد؟» دیگر سؤال نیست. هزینه‌اش تخصیص حافظه‌ی بیشتر است که جز در مسیرهای داغ اهمیتی ندارد.

```php
final readonly class Money
{
    public function __construct(public int $amount, public string $currency)
    {
        if ($amount < 0) {
            throw new InvalidArgumentException('amount must not be negative');
        }
    }

    public function add(Money $other): self
    {
        if ($other->currency !== $this->currency) {
            throw new InvalidArgumentException('currency mismatch');
        }

        return new self($this->amount + $other->amount, $this->currency);
    }
}
```

در Go کلمه‌ی کلیدی برای آن نیست؛ با قرارداد به دست می‌آید: Fieldهای unexported، Constructorای که validate می‌کند، Methodهای value receiver که مقدار جدید برمی‌گردانند، و کپی دفاعی از slice و map در ورودی و خروجی.

**مثال واقعی:** `Carbon` در Laravel Mutable است و `$date->addDay()` تاریخ اصلی را هم عوض می‌کند؛ منبع کلاسیک bug در گزارش‌ها. `CarbonImmutable` یا `DateTimeImmutable` آن را حذف می‌کند.

<strong class="qa-trap">دام مصاحبه:</strong> `readonly` در PHP سطحی است: اگر property یک Object Mutable یا Arrayای از Objectها باشد، محتوای آن هنوز قابل تغییر است. در Go هم کپی struct، slice و map داخلش را کپی نمی‌کند.
:::

### ۷.۱۱ — Encapsulation و «Tell, Don't Ask»؟ <Badge type="info" text="تکمیلی" /> {#q-7-11}

::: details پاسخ {open}
**پاسخ:** Encapsulation یعنی قاعده کنار داده‌ای باشد که از آن محافظت می‌کند، تا حالت نامعتبر اصلاً قابل ساختن نباشد. getter و setter برای هر Field Encapsulation نیست؛ همان Field public است با تشریفات بیشتر.

```go
// ask: the rule is repeated (and eventually forgotten) in every caller
if acct.Balance >= amount && !acct.Frozen {
	acct.Balance -= amount
}

// tell: the rule lives next to the data it protects
func (a *Account) Withdraw(amount int64) error {
	if a.frozen {
		return ErrFrozen
	}
	if a.balance < amount {
		return ErrInsufficientFunds
	}
	a.balance -= amount
	return nil
}
```

**مثال واقعی:** `$order->status = 'shipped'` در ده جای کد در برابر `$order->ship()` که بررسی می‌کند سفارش پرداخت شده، وضعیت را عوض می‌کند و Event `OrderShipped` را ثبت می‌کند. اولی همان Anemic Domain Model است.

**یوزکیس:** برای مدل‌هایی که invariant دارند. برای DTO، read model و CRUD ساده، ساختار داده‌ی باز کاملاً درست است.

<strong class="qa-trap">دام مصاحبه:</strong> افراط: شیئی که برای «گفتن» مجبور شود ایمیل بفرستد یا در Database بنویسد. رفتار Domain داخل Object؛ I/O بیرون از آن.
:::

### ۷.۱۲ — با بدهی فنی چه می‌کنی و refactor بزرگ را چطور پیش می‌بری؟ <Badge type="danger" text="حیاتی" /> {#q-7-12}

::: details پاسخ {open}
**پاسخ:** بدهی فنی مثل وام است: گاهی آگاهانه می‌گیری تا زودتر برسی، ولی بهره‌اش (کندی هر تغییر بعدی) را می‌پردازی. همه‌اش را لازم نیست صاف کنی؛ فقط آن بخشی که بهره‌ی بالا دارد.

**گام‌ها:**

- **اولویت با داده:** جایی که هم پیچیده است هم زیاد تغییر می‌کند (hotspot). کد زشتی که سه سال است کسی به آن دست نزده بهره‌ای ندارد.
- **اول تور ایمنی:** قبل از تغییر کد قدیمی، characterization test بنویس که رفتار فعلی (حتی bugها) را ثبت کند.
- **گام‌های کوچک و قابل merge:** refactor را از تغییر رفتار جدا کن؛ هر PR یا ساختار را عوض می‌کند یا رفتار را، نه هر دو.
- **بدون branch طولانی:** با branch by abstraction (Interface جلوی پیاده‌سازی قدیم، پیاده‌سازی جدید پشت feature flag) روی trunk بمان.
- **مقایسه در production:** مسیر جدید را در سایه اجرا کن و خروجی را با قدیمی مقایسه کن، بعد Traffic را تدریجی جابه‌جا کن.
- **با کسب‌وکار به زبان خودش حرف بزن:** نه «کد کثیف است»، بلکه «هر تغییر در صورت‌حساب الان دو هفته طول می‌کشد و با این کار دو روز می‌شود».

**مثال واقعی:** Module محاسبه‌ی کارمزد با ۳۰۰۰ خط و بدون Test؛ به‌جای بازنویسی، ۲۰۰ ورودی واقعی production به‌عنوان golden test ذخیره شد، محاسبه تکه‌تکه به توابع خالص منتقل شد و هر تکه با همان golden testها تأیید شد.

<strong class="qa-trap">دام مصاحبه:</strong> «از صفر بازنویسی می‌کنیم». بازنویسی کامل دانش پنهان در کد قدیمی (edge caseهای چندساله) را دور می‌ریزد و تا روز آخر هیچ ارزشی تحویل نمی‌دهد؛ تقریباً همیشه Migration تدریجی (Strangler Fig) بهتر است.
:::

### ۷.۱۳ — در code review به چه چیزهایی و با چه ترتیبی نگاه می‌کنی؟ <Badge type="warning" text="مهم" /> {#q-7-13}

::: details پاسخ {open}
**پاسخ:** از گران‌ترین اشتباه به ارزان‌ترین؛ چیزی که بعد از merge برگرداندنش سخت است اول.

| اولویت | چه چیزی | نمونه‌ی سؤال |
| --- | --- | --- |
| ۱ | درستی و داده | آیا race، Transaction ناقص یا از دست رفتن داده ممکن است؟ retry آن را دو بار اجرا می‌کند؟ |
| ۲ | امنیت | ورودی Validation شده؟ authorization روی همین منبع چک می‌شود؟ secret در Log نیست؟ |
| ۳ | چیزهای برگشت‌ناپذیر | migration قابل rollback است؟ API و schema Event backward-compatible است؟ |
| ۴ | طراحی | مسئولیت در جای درست است؟ Dependency جدید در جهت درست است؟ |
| ۵ | رفتار در خرابی | timeout، خطای Dependency، ورودی خالی یا خیلی بزرگ؛ Query N+1 |
| ۶ | Test و Observability | Test رفتار را می‌سنجد یا پیاده‌سازی را؟ Log و Metric برای Debug در production کافی است؟ |
| ۷ | خوانایی | نام‌ها، اندازه‌ی تابع، کامنت «چرا» |
| ۸ | سبک | به formatter و linter بسپار، نه به انسان |

**مثال واقعی:** PR با migration که ستون `NOT NULL` با مقدار پیش‌فرض به جدول ۲۰۰ میلیون ردیفی اضافه می‌کند و همزمان کد جدید را deploy می‌کند؛ نکته‌ی review نام متغیر نیست، ترتیب deploy و Table Lock است.

**یوزکیس:** PR کوچک (زیر چندصد خط) بهترین ابزار کیفیت review است؛ برای PR بزرگ اول توضیح طراحی را بخوان، بعد کد.

<strong class="qa-trap">دام مصاحبه:</strong> فقط از سبک و نام‌گذاری حرف‌زدن. مصاحبه‌گر می‌خواهد ببیند ریسک را می‌بینی: Concurrency، Backward Compatibility و رفتار هنگام خرابی.
:::

### ۷.۱۴ — مدیریت خطا به‌عنوان بخشی از طراحی API؟ <Badge type="warning" text="مهم" /> {#q-7-14}

::: details پاسخ {open}
**پاسخ:** خطاهایی که یک تابع برمی‌گرداند جزو قرارداد آن‌اند. سه تصمیم طراحی: فراخواننده کدام خطاها را باید از هم تشخیص دهد (نبودن، تعارض، گذرا، دائمی)، خطای Layer پایین کجا به خطای Domain ترجمه می‌شود، و چه کسی Log می‌کند (فقط یک جا، در مرز).

```go
var ErrNotFound = errors.New("order: not found")

func (r *Repo) ByID(ctx context.Context, id int64) (Order, error) {
	var o Order
	err := r.db.QueryRowContext(ctx,
		`SELECT id, status FROM orders WHERE id = $1`, id).Scan(&o.ID, &o.Status)
	if errors.Is(err, sql.ErrNoRows) {
		return Order{}, ErrNotFound // translate the storage detail into a domain error
	}
	if err != nil {
		return Order{}, fmt.Errorf("order by id %d: %w", id, err)
	}
	return o, nil
}
```

| | Go | PHP |
| --- | --- | --- |
| سازوکار | مقدار برگشتی `error`؛ `errors.Is` و `errors.As` | exception؛ سلسله‌مراتب Class |
| افزودن زمینه | `fmt.Errorf("...: %w", err)` | exception جدید با `previous` |
| خطای Domain | sentinel یا نوع خطا | Class exception اختصاصی Domain |
| ترجمه به HTTP | یک نقطه در handler یا middleware | exception handler مرکزی |

**مثال واقعی:** use case خطای `ErrInsufficientStock` برمی‌گرداند؛ HTTP Layer آن را به `409` با کد خطای پایدار `insufficient_stock` ترجمه می‌کند. Client روی کد شرط می‌گذارد نه روی متن پیام.

<strong class="qa-trap">دام مصاحبه:</strong> نشت خطای زیرساخت (`sql.ErrNoRows`، `QueryException`) تا HTTP Layer؛ هم coupling می‌سازد هم جزئیات داخلی را به کاربر نشان می‌دهد. دام دوم: «Log کن و دوباره برگردان» در هر Layer، که یک خطا را پنج بار در Log می‌نویسد.
:::

### ۷.۱۵ — «بهینه‌سازی زودهنگام» یعنی چه و مرزش کجاست؟ <Badge type="info" text="تکمیلی" /> {#q-7-15}

::: details پاسخ {open}
**پاسخ:** یعنی پیچیده‌کردن کد برای سرعتی که هنوز اندازه نگرفته‌ای و معلوم نیست لازم باشد. ترتیب درست: درست کار کند → خوانا باشد → اندازه بگیر → فقط Bottleneck را بهینه کن. بیشتر زمان اجرا در بخش کوچکی از کد می‌گذرد و حدس انسان درباره‌ی اینکه کدام بخش، معمولاً غلط است.

چیزهایی که «زودهنگام» نیستند و باید از اول درست باشند، چون بعداً عوض‌کردنشان گران است:

- Algorithmic Complexity روی داده‌ی بزرگ (حلقه‌ی تودرتو روی یک میلیون ردیف)؛
- Query N+1 و نبود Index؛
- طراحی schema و کلید partition؛
- فراخوانی شبکه داخل حلقه؛
- نداشتن timeout و سقف (pagination، اندازه‌ی batch).

**مثال واقعی:** تیمی یک هفته serialization را با `sync.Pool` و کد دستی بهینه کرد؛ profile نشان داد ۹۰٪ زمان request در یک Query بدون Index می‌گذرد. **یوزکیس:** ابزار اندازه‌گیری: `pprof` و benchmark در Go؛ در PHP یک profiler (مثل Xdebug یا Blackfire) و `EXPLAIN ANALYZE` برای Query.

<strong class="qa-trap">دام مصاحبه:</strong> استفاده از این جمله به‌عنوان بهانه برای بی‌توجهی به کارایی. ادامه‌ی نقل‌قول Knuth این است که آن چند درصد حیاتی را نباید نادیده گرفت.
:::

## مطالب مرتبط {#related}

- [Design Patterns](/fa/design/design-patterns)
- [مدل‌های Architecture](/fa/design/architecture-styles)
