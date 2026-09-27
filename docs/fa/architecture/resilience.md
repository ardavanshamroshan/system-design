# الگوهای Resilience

> ماژول D — معماری سیستم · بخش ۱۴

## فهرست ذهنی

1. [چیست و چرا](#چیست-و-چرا)  
2. [مدل ذهنی — بودجه](#مدل-ذهنی--بودجه)  
3. [Timeoutها](#timeoutها)  
4. [Retry + jitter](#retry--jitter)  
5. [Circuit breaker](#circuit-breaker)  
6. [Bulkhead و backpressure](#bulkhead-و-backpressure)  
7. [Graceful degradation](#graceful-degradation)  
8. [نمونه‌های Laravel / PHP](#نمونههای-laravel--php)  
9. [چالش‌های واقعی](#چالشهای-واقعی)  
10. [نکته‌های مصاحبه](#نکتههای-مصاحبه)  
11. [قانون تصمیم](#قانون-تصمیم)  
12. [ضدالگوها](#ضدالگوها)  
13. [تمرین ذهنی](#تمرین-ذهنی)

---

## چیست و چرا

**Resilience** = وقتی dependency شکست می‌خورد، کند می‌شود یا flap می‌کند، همچنان *چیز مفیدی* سرو کن — بدون آب‌کردن پروسس خودت.

تماس توزیع‌شده شکست می‌خورد. [Fallacyها](/fa/architecture/fallacies-pacelc) تضمینش می‌کنند. الگوهای resilience شعاع انفجار را محدود می‌کنند.

| الگو | کار در یک خط |
|------|----------------|
| **Timeout** | دیگر صبر نکن |
| **Retry + jitter** | blip را تحمل کن — با احتیاط |
| **Circuit breaker** | به dependency بیمار زنگ نزن |
| **Bulkhead** | استخرها را جدا کن تا یک شکست همه را غرق نکند |
| **Backpressure** | وقتی مصرف‌کننده غرق است، تولیدکننده را کند کن |
| **Degradation** | جزئی / کش / پیش‌فرض برگردان |

مرتبط: [Fallacyها و PACELC](/fa/architecture/fallacies-pacelc) · [Saga](/fa/patterns/saga) · [DLQ](/fa/messaging/dlq) · [API Gateway](/fa/architecture/api-gateway) · [Ack](/fa/messaging/acknowledgment)

---

## مدل ذهنی — بودجه

هر درخواست یک **بودجهٔ زمانی** دارد. هر hop از آن خرج می‌کند.

```
بودجه کلاینت 300ms
  Gateway  20ms
  Order    80ms
  Inventory timeout ≤ باقیمانده (مثلاً 120ms)
  Fraud    timeout ≤ باقیمانده
```

بدون بودجه: هر لایه پیش‌فرض ۳۰ثانیه → طوفان retry → outage کامل.

```
Deadline = start + budget
remaining = deadline - now
child_timeout = min(policy_max, remaining - safety_margin)
```

---

## Timeoutها

| لایه | اشتباه رایج | بهتر |
|------|-------------|------|
| HTTP client | بدون timeout / پیش‌فرض ۳۰ثانیه | Connect + total صریح |
| Job صف | تا ابد می‌دود | `timeout` + `retryUntil` |
| DB | نادیده گرفتن `wait_timeout` | Timeout عبارت + قفل |
| گام Saga | «pending» بی‌نهایت | مهلت کسب‌وکار + compensate |

```php
Http::connectTimeout(0.05)
    ->timeout(0.2) // ثانیهٔ کل
    ->withHeaders(['Idempotency-Key' => $key])
    ->post($url, $body);
```

```python
import httpx
httpx.Client(timeout=httpx.Timeout(0.2, connect=0.05))
```

::: tip
Timeout بدون **مسیر fallback یا خطا** فقط hang را به موج ۵۰۳ تبدیل می‌کند — هنوز واکنش کاربر / saga را طراحی کن.
:::

---

## Retry + jitter

Retry فقط وقتی:

1. خطا **گذرا** است (timeout، ۵۰۳، reset اتصال)  
2. عملیات **ایدمپوتنت** است (یا کلید ایدمپوتنسی داری)  
3. هنوز **بودجه** داری  
4. تلاش‌ها **کران‌دار**اند

**Backoff نمایی + jitter** از stampedes هم‌زمان جلوگیری می‌کند:

```
sleep = min(cap, base * 2^attempt) * random(0.5, 1.0)
```

```php
function retryIdempotent(callable $fn, string $key, int $max = 3): mixed
{
    $delayMs = 50;
    for ($attempt = 0; $attempt <= $max; $attempt++) {
        try {
            return $fn($key);
        } catch (TransientHttpException $e) {
            if ($attempt === $max) {
                throw $e;
            }
            usleep(random_int((int) ($delayMs * 500), $delayMs * 1000));
            $delayMs = min(2000, $delayMs * 2);
        }
    }
}
```

**Retry نکن:** اعتبارسنجی `400`، `401/403`، بیشتر تعارض‌های کسب‌وکار `409`، `POST` غایرایدمپوتنت بدون کلید.

---

## Circuit breaker

حالت‌ها:

```
Closed ──(شکست زیاد)──► Open ──(cooldown)──► Half-open ──(probe OK)──► Closed
                              ▲                    │
                              └────(probe fail)────┘
```

| حالت | رفتار |
|------|--------|
| **Closed** | تماس‌ها جریان دارند؛ شکست شمرده می‌شود |
| **Open** | Fail fast — بدون تماس به dependency |
| **Half-open** | چند probe مجاز |

وقتی Inventory مرده، thread/workerهایت را حفظ می‌کند. با fallback جفت کن (کش، پیش‌فرض، صف برای بعد).

```php
final class CircuitBreaker
{
    public function __construct(
        private string $name,
        private int $failureThreshold = 5,
        private int $openSeconds = 30,
    ) {}

    public function call(callable $fn): mixed
    {
        $state = Cache::get("cb:{$this->name}:state", 'closed');
        if ($state === 'open') {
            $openedAt = (int) Cache::get("cb:{$this->name}:opened_at", 0);
            if (time() < $openedAt + $this->openSeconds) {
                throw new CircuitOpenException($this->name);
            }
            Cache::put("cb:{$this->name}:state", 'half_open', 60);
        }

        try {
            $result = $fn();
            Cache::put("cb:{$this->name}:failures", 0, 120);
            Cache::put("cb:{$this->name}:state", 'closed', 120);
            return $result;
        } catch (Throwable $e) {
            $failures = (int) Cache::increment("cb:{$this->name}:failures");
            if ($failures >= $this->failureThreshold || $state === 'half_open') {
                Cache::put("cb:{$this->name}:state", 'open', 120);
                Cache::put("cb:{$this->name}:opened_at", time(), 120);
            }
            throw $e;
        }
    }
}
```

نکتهٔ پروداکشن: store مشترک (Redis) تا همهٔ نودهای اپ وضعیت breaker را شریک شوند — یا breaker per-node را بپذیر.

---

## Bulkhead و backpressure

**Bulkhead:** استخر منابع را جدا کن تا یک سیل همه را نخورد.

| ایزولاسیون | مثال |
|------------|------|
| استخر thread / worker | Worker چک‌اوت ≠ export گزارش |
| استخر اتصال | [Pool](/fa/database/connection-pool) به‌ازای dependency |
| پارتیشن صف | صف اولویت / tenant |
| Container | Deploy جدا برای مسیر حیاتی |

**Backpressure:** وقتی مصرف‌کننده کند است، به تولیدکننده سیگنال بده کند شود یا طبق سیاست drop کند.

```
Producer → صف کران‌دار (N) → Consumer
              │ پر
              ▼
         رد / بلاک / sample-drop
```

در HTTP: `429` + `Retry-After`. در messaging: pause مصرف / آلارم lag / رد publish وقتی lag > SLO.

---

## Graceful degradation

| Dependency پایین | رفتار degrade |
|------------------|---------------|
| پیشنهادها | ریل را پنهان کن؛ PDP بماند |
| Fraud (اختیاری) | Fail-open با فلگ بررسی **یا** fail-closed — تصمیم محصول |
| سرویس پرومو قیمت | قیمت پایه نشان بده |
| کلاستر جستجو | کش top query / «بعداً تلاش کن» |

Degradation تصمیم **محصول** کدشده است — نه تصادف.

```php
try {
    $recs = $breaker->call(fn () => $recsClient->forUser($userId));
} catch (Throwable) {
    $recs = []; // degrade: ریل خالی، صفحه هنوز 200
}
```

---

## نمونه‌های Laravel / PHP

### انتشار Deadline

```php
final class Deadline
{
    public function __construct(private float $unixDeadline) {}

    public static function fromBudgetMs(int $ms): self
    {
        return new self(microtime(true) + $ms / 1000);
    }

    public function remainingSeconds(float $margin = 0.02): float
    {
        return max(0.01, $this->unixDeadline - microtime(true) - $margin);
    }
}

$deadline = Deadline::fromBudgetMs(300);
Http::timeout($deadline->remainingSeconds())->get($inventoryUrl);
```

### Resilience جاب صف

```php
class ChargeOrderJob implements ShouldQueue
{
    public int $tries = 5;
    public array $backoff = [1, 5, 15, 30]; // در صورت امکان jitter در middleware

    public function retryUntil(): DateTime
    {
        return now()->addMinutes(15);
    }

    public function handle(PaymentsClient $payments): void
    {
        $payments->charge(
            orderId: $this->orderId,
            idempotencyKey: "order.charge:{$this->orderId}",
        );
    }
}
```

شکست بعد از بودجه → [DLQ](/fa/messaging/dlq) / `failed_jobs` + آلارم — نه drop خاموش.

---

## چالش‌های واقعی

### چالش الف — طوفان Retry اینونتوری را می‌کشد

Inventory کند. Gateway ۳ بار retry. اپ ۳ بار retry. کاربر refresh. ۱ overload → ۲۰× بار → outage دائم.

| اصلاح | جزئیات |
|-------|--------|
| بودجه | یک deadline سرتاسری |
| Jitter | شکستن retry هم‌زمان |
| Breaker | وقتی نرخ خطا بالاست باز کن |
| Load shed | `429` در لبه |

### چالش ب — Retry روی refund غایرایدمپوتنت

ابزار پشتیبانی روی timeout دوباره `POST /refund` می‌زند → refund دوبل.

| اصلاح | Idempotency-Key به‌ازای نیت refund؛ قبل از ساخت، وضعیت را بپرس |

### چالش ج — Flap کردن Breaker

آستانه خیلی پایین → روی blip باز → half-open → موفق → بسته → شکست → flap؛ UX بدتر از dependency کند.

| اصلاح | آستانه بالاتر، open طولانی‌تر، سلامت روی p99 نه تک‌خطا |

### چالش د — Bulkhead گم در Octane / workerها

یک کوئری سنگین گزارش استخر DB را اشباع می‌کند؛ checkout گرسنه می‌ماند.

| اصلاح | استخر / صف / `max` worker جدا؛ timeout عبارت ([pool](/fa/database/connection-pool)) |

### چالش هـ — تداخل Saga + retry

گام saga دوباره `ship` را retry می‌کند در حالی که compensation شروع شده → ارسال بعد از لغو ساخته می‌شود.

| اصلاح | State machine saga دروازه بزند؛ ship ایدمپوتنت؛ بعد از `compensating` جلو را retry نکن ([Saga](/fa/patterns/saga)) |

---

## نکته‌های مصاحبه

1. ترتیب الگوها: **timeout → retry ایدمپوتنت → breaker → bulkhead → degrade**.  
2. **Jitter** و **بودجه** بگو — نه «فقط retry».  
3. Fail-open در برابر fail-closed را با مثال محصول جدا کن.  
4. به messaging وصل کن: retry + [DLQ](/fa/messaging/dlq) + [ack](/fa/messaging/acknowledgment).  
5. Circuit breaker بدون fallback = شکست سریع‌تر، هنوز کاربر عصبانی.  

---

## قانون تصمیم

1. هر تماس remote: **timeout** ≤ بودجهٔ باقیمانده.  
2. Retry فقط **گذرا + ایدمپوتنت + کران‌دار + با jitter**.  
3. Dependency مشترک بیمار → **circuit open** + fallback صریح.  
4. مسیر حیاتی را با **bulkhead** ایزوله کن (استخر/صف).  
5. **Degradation** را قبل از حادثه به‌ازای feature تعریف کن.  
6. پیام سمی را در **DLQ** نگه دار؛ به انسان پیج بده.  
7. پول / refund: کلید ایدمپوتنسی غیرقابل‌مذاکره.  

---

## ضدالگوها

- Retry بی‌نهایت / بدون timeout  
- Retry روی `POST` بدون ایدمپوتنسی  
- Retry هم‌زمان (thundering herd)  
- Circuit breaker بدون متریک / داستان state مشترک  
- یک استخر worker غول برای همهٔ نوع جاب  
- قورت دادن خطا و برگرداندن `200` با body خالی خاموش  
- کپی timeout ۳۰ثانیه‌ای روی هر hop داخلی  

---

## تمرین ذهنی

Checkout صدا می‌زند: Pricing، Inventory، Fraud (اختیاری)، Pay.

1. بودجهٔ کل کلاینت ۴۰۰ ms — timeoutها را تقسیم کن.  
2. Fraud پایین — برای سفارش با ارزش بالا fail-open یا fail-closed؟  
3. Inventory پنجاه‌وسه می‌دهد — چند بار retry؟ با چه کلیدی؟  
4. بعد از باز شدن breaker روی Inventory — کاربر چه می‌بیند؟  
5. این چطور به مسیر compensation در [Saga](/fa/patterns/saga) وصل می‌شود؟
