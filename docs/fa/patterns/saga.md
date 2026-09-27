# الگوی Saga

> ماژول C / D — پیام‌رسانی و معماری · بخش ۱۳

## فهرست ذهنی

1. [چیست و چرا](#چیست-و-چرا)  
2. [مدل ذهنی](#مدل-ذهنی)  
3. [Orchestration در برابر choreography](#orchestration-در-برابر-choreography)  
4. [Compensation (undo)](#compensation-undo)  
5. [State machine + کد Laravel](#state-machine--کد-laravel)  
6. [Outbox، ایدمپوتنسی، و timeout](#outbox-ایدمپوتنسی-و-timeout)  
7. [چالش‌های واقعی](#چالشهای-واقعی)  
8. [کی استفاده / کی نه](#کی-استفاده--کی-نه)  
9. [نکته‌های مصاحبه](#نکتههای-مصاحبه)  
10. [قانون تصمیم](#قانون-تصمیم)  
11. [ضدالگوها](#ضدالگوها)  
12. [تمرین ذهنی](#تمرین-ذهنی)

---

## چیست و چرا

**Saga** یک **تراکنش کسب‌وکار چندگامی** را بین سرویس‌ها (یا bounded contextها) **بدون** تراکنش ACID توزیع‌شده / 2PC هماهنگ می‌کند.

هر گام:

1. کار محلی را در **یک** تراکنش دیتابیس انجام می‌دهد  
2. رویداد / فرمان گام بعد را publish می‌کند  
3. اگر بعداً شکست بخورد، برای undo گام‌های قبلی **compensation** اجرا می‌کند

```
رزرو موجودی → شارژ کارت → ایجاد ارسال
      │              │               │
   tx محلی        tx محلی         tx محلی
      X شکست ─────────────────────────► آزادسازی موجودی + refund
```

**چرا؟** 2PC بین سرویس‌ها قفل می‌کند، timeout می‌خورد، مقیاس نمی‌گیرد. Saga **اتمیسیته** را با **consistency تدریجی + undo صریح** عوض می‌کند.

مرتبط: [Outbox](/fa/patterns/outbox) · [Ack](/fa/messaging/acknowledgment) · [CQRS](/fa/patterns/cqrs) · [Replication](/fa/architecture/replication) · [Resilience](/fa/architecture/resilience)

---

## مدل ذهنی

مثل **رزرو سفر** فکر کن، نه دفترکل بانکی ACID:

| ACID کلاسیک (یک DB) | Saga (چند سرویس) |
|---------------------|------------------|
| همه commit یا همه rollback | گام جلو + compensation |
| قفل روی همهٔ شرکت‌کننده‌ها | فقط قفل محلی کوتاه |
| Consistency قوی همین الان | حالت میانی قابل‌دیدن |

کاربر ممکن است کوتاه ببیند: `موجودی رزرو شد`، پرداخت pending — بعد یا `تأیید` یا `لغو + refund`.

::: tip
Saga یک **فرآیند** است، نه یک کتابخانه. State machine، timeout و compensation مال توست.
:::

---

## Orchestration در برابر choreography

### Orchestration — یک رهبر

**Orchestrator** (سرویس workflow / saga manager) به هر شرکت‌کننده می‌گوید گام بعد چیست.

```
┌─────────────┐
│  Checkout   │──cmd──► Inventory.reserve
│ Orchestrator│──cmd──► Payments.charge
│             │──cmd──► Shipping.create
└─────────────┘
        ▲ رویداد / پاسخ
```

| مزیت | ضرر |
|------|------|
| جریان در یک جا روشن است | Orchestrator ممکن است god service شود |
| وضعیت / timeout ساده‌تر دیده می‌شود | hop و مالکیت اضافه |
| Debug آسان‌تر | نباید قفل DB را روی تماس remote نگه دارد |

### Choreography — فقط رویداد

هر سرویس به رویداد واکنش می‌دهد؛ مغز مرکزی نیست.

```
OrderCreated → Inventory رزرو → StockReserved → Payment شارژ → …
شکست: PaymentFailed → Inventory آزاد → …
```

| مزیت | ضرر |
|------|------|
| جفت‌شدگی سست | جریان بین سرویس‌ها پخش است |
| بدون SPOF orchestrator | دیدن / عوض کردن ترتیب سخت |
| طبیعی با event bus | راحت به ping-pong رویداد می‌رسی |

**پیش‌فرض برای مونولیت Laravel / چند سرویس کم:** orchestration (job + جدول saga).  
**تیم‌های مستقل + طراحی رویداد بالغ:** choreography (یا ترکیبی).

---

## Compensation (undo)

Compensation = **undo کسب‌وکار**، نه `ROLLBACK` یک commit دور.

| گام جلو | Compensation |
|---------|--------------|
| رزرو موجودی | آزادسازی رزرو |
| Capture پرداخت | Refund (یا void کردن auth) |
| ساخت برچسب ارسال | لغو برچسب |
| ایمیل «تأیید» | ایمیل «لغو» (unsend نداریم) |

بعضی گام‌ها **قابل compensation نیستند** (SMS خوانده شده). طراحی: گام‌های برگشت‌ناپذیر را **آخر** بگذار، یا irreversible + جریان عذر را بپذیر.

```php
interface SagaStep
{
    public function name(): string;
    public function execute(SagaContext $ctx): void;
    public function compensate(SagaContext $ctx): void;
}
```

---

## State machine + کد Laravel

### Schema

```php
Schema::create('checkout_sagas', function (Blueprint $t) {
    $t->uuid('id')->primary();
    $t->foreignId('order_id')->constrained();
    $t->string('state'); // started|stock_reserved|paid|shipped|completed|compensating|failed
    $t->json('context');
    $t->unsignedTinyInteger('version')->default(0); // concurrency خوش‌بینانه
    $t->timestamps();
});
```

### طرح Orchestrator

```php
final class CheckoutSagaOrchestrator
{
    public function __construct(
        private InventoryClient $inventory,
        private PaymentsClient $payments,
        private ShippingClient $shipping,
    ) {}

    public function start(Order $order): void
    {
        $saga = CheckoutSaga::create([
            'id' => (string) Str::uuid(),
            'order_id' => $order->id,
            'state' => 'started',
            'context' => ['order_id' => $order->id, 'total_cents' => $order->total_cents],
        ]);

        DB::transaction(function () use ($saga) {
            OutboxMessage::create([
                'type' => 'saga.checkout.advance',
                'payload' => ['saga_id' => $saga->id],
                'idempotency_key' => "saga.advance:{$saga->id}:started",
            ]);
        });
    }

    public function advance(string $sagaId): void
    {
        $saga = CheckoutSaga::query()->whereKey($sagaId)->lockForUpdate()->firstOrFail();

        match ($saga->state) {
            'started' => $this->reserveStock($saga),
            'stock_reserved' => $this->charge($saga),
            'paid' => $this->ship($saga),
            'shipped' => $this->complete($saga),
            'compensating' => $this->compensateNext($saga),
            default => null,
        };
    }

    private function reserveStock(CheckoutSaga $saga): void
    {
        try {
            $reservationId = $this->inventory->reserve(
                orderId: $saga->order_id,
                idempotencyKey: "inv.reserve:{$saga->id}",
            );
            $saga->forceFill([
                'state' => 'stock_reserved',
                'context->reservation_id' => $reservationId,
                'version' => $saga->version + 1,
            ])->save();
            $this->enqueueAdvance($saga);
        } catch (Throwable $e) {
            $this->fail($saga, $e);
        }
    }

    private function charge(CheckoutSaga $saga): void
    {
        try {
            $paymentId = $this->payments->charge(
                amountCents: $saga->context['total_cents'],
                idempotencyKey: "pay.charge:{$saga->id}",
            );
            $saga->forceFill([
                'state' => 'paid',
                'context->payment_id' => $paymentId,
                'version' => $saga->version + 1,
            ])->save();
            $this->enqueueAdvance($saga);
        } catch (Throwable $e) {
            $saga->state = 'compensating';
            $saga->context['compensate_from'] = 'stock_reserved';
            $saga->save();
            $this->enqueueAdvance($saga);
        }
    }

    private function compensateNext(CheckoutSaga $saga): void
    {
        // Undo به ترتیب معکوس موفقیت
        if ($paymentId = $saga->context['payment_id'] ?? null) {
            $this->payments->refund($paymentId, idempotencyKey: "pay.refund:{$saga->id}");
            unset($saga->context['payment_id']);
        }
        if ($reservationId = $saga->context['reservation_id'] ?? null) {
            $this->inventory->release($reservationId, idempotencyKey: "inv.release:{$saga->id}");
            unset($saga->context['reservation_id']);
        }
        $saga->state = 'failed';
        $saga->save();
    }
}
```

```python
# طرح choreography — هر handler ایدمپوتنت
def on_stock_reserved(event: dict) -> None:
    if already_processed(event["idempotency_key"]):
        return
    try:
        payment_id = payments.charge(event["order_id"], event["total_cents"])
        emit("PaymentCaptured", {**event, "payment_id": payment_id})
    except PaymentError:
        emit("PaymentFailed", event)  # inventory گوش می‌دهد → release
```

---

## Outbox، ایدمپوتنسی، و timeout

| نگرانی | عمل |
|--------|-----|
| اتمی بودن گام + رویداد | [Outbox](/fa/patterns/outbox) در هر سرویس |
| تحویل at-least-once | کلید ایدمپوتنسی به‌ازای گام ([Ack](/fa/messaging/acknowledgment)) |
| Saga گیرکرده | Timeout + آلارم → compensate یا ops دستی |
| Worker هم‌زمان | `version` خوش‌بینانه / `lockForUpdate` روی ردیف saga |
| دید ناقص | حالت UI: `processing` / `failed` / `confirmed` |

```
مثال مهلت:
  رزرو ≤ ۳۰ثانیه hold
  auth پرداخت ≤ ۲دقیقه
  کل saga چک‌اوت ≤ ۱۵دقیقه بعد auto-compensate
```

بدون timeout، موجودی رزروشده و auth باز تا ابد نشت می‌کند.

---

## چالش‌های واقعی

### چالش الف — شارژ دوبل روی retry

HTTP پرداخت timeout. کلاینت retry. Orchestrator دوباره `charge`. کارت دو بار شارژ.

| علت | اصلاح |
|-----|--------|
| بدون کلید ایدمپوتنسی به PSP | همان کلید برای saga id + گام |
| timeout را شکست فرض کردن بعد retry ناامن | قبل از شارژ دوباره وضعیت پرداخت را بپرس |

### چالش ب — Compensation شکست می‌خورد

API refund بعد از شارژ موفق و نیاز به آزادسازی موجودی پایین است. Saga در `compensating` گیر می‌کند.

| علت | اصلاح |
|-----|--------|
| فرض undo همیشه کار می‌کند | صف compensate + DLQ + pager |
| بدون dead-letter برای saga | [DLQ](/fa/messaging/dlq) + replay ادمین |

### چالش ج — کاربر «paid» می‌بیند بعد «cancelled»

پرداخت موفق؛ shipping برای همیشه شکست؛ compensate refund می‌کند. کاربر گیج.

| علت | اصلاح |
|-----|--------|
| UX برگشت‌ناپذیر خیلی زود | ایمیل تأیید فقط روی `completed` |
| کپی وضعیت ضعیف | «refund شروع شد» نه «سفارش دود شد» |

### چالش د — Ping-pong در choreography

`PaymentFailed` → `StockReleased` → `OrderCancelled` → `Notify` → با باگ دوباره `OrderCreated` → حلقه.

| علت | اصلاح |
|-----|--------|
| بدون correlation / قواعد علّی | saga id + ایدمپوتنسی؛ از رویداد compensate دوباره وارد جلو نشو |
| بدون مالک جریان | وقتی جریان پیچیده است orchestrator را ترجیح بده |

---

## کی استفاده / کی نه

**استفاده وقتی**

- چند سرویس / DB باید روی یک نتیجهٔ کسب‌وکار توافق کنند  
- 2PC قابل‌قبول نیست  
- Compensation قابل تعریف است  

**رد وقتی**

- یک تراکنش DB همین الان کل جریان را می‌پوشاند  
- گام قابل compensate نیست و نمی‌تواند آخر باشد  
- تیم ابزار حالت گیرکرده را نمی‌تواند بچرخاند  

---

## نکته‌های مصاحبه

1. Saga ≠ event sourcing (می‌توانند جفت شوند؛ یکی نیستند).  
2. **Compensation** را صریح نام ببر؛ یک گام irreversible مثال بزن.  
3. Orchestration در برابر choreography — یکی را انتخاب و دفاع کن.  
4. به **outbox + ایدمپوتنسی + timeout** وصل کن.  
5. حالت میانی قابل‌دیدن را بگو (eventual consistency).  

---

## قانون تصمیم

1. یک DB؟ تراکنش محلی — بدون saga.  
2. چند سرویس؟ Saga (یا «best effort» ضعیف‌تر را بپذیر).  
3. یک جا برای وضعیت / SLA؟ **Orchestration**.  
4. هر گام جلو: execute **ایدمپوتنت** + undo **compensating** (یا «آخرین گام irreversible»).  
5. وضعیت saga را persist کن؛ با outbox جلو برو؛ روی گیرکردن آلارم بزن.  
6. گام پول: کلید ایدمپوتنسی اجباری.  

---

## ضدالگوها

- 2PC توزیع‌شده به‌عنوان پیش‌فرض «فقط اتمیکش کن»  
- وضعیت saga فقط در حافظه / پیام صف  
- Retry روی `charge` بدون ایدمپوتنسی  
- Compensation با فرض شبکهٔ کامل ([Fallacyها](/fa/architecture/fallacies-pacelc))  
- تأیید موفقیت به کاربر قبل از اتمام saga  
- Orchestrator خدایی که همهٔ invariant دامنه را هم مالک است  

---

## تمرین ذهنی

چک‌اوت: رزرو → پرداخت → ارسال.

1. پرداخت موفق؛ ارسال برای همیشه شکست — compensationها را به ترتیب بگو.  
2. چرا outbox روی هر سرویس، نه فقط orchestrator؟  
3. Timeout روی پرداخت: فوراً موجودی را compensate می‌کنی یا اول PSP را چک؟  
4. بعدی: وقتی Inventory کند است، timeout/retry/circuit چطور با saga قاطی می‌شود؟ → [Resilience](/fa/architecture/resilience)
