# API Gateway

> ماژول D — معماری سیستم · بخش ۱۱

## فهرست ذهنی

1. [چیست و چرا](#چیست-و-چرا)  
2. [مدل ذهنی](#مدل-ذهنی)  
3. [جریان request](#جریان-request)  
4. [مسئولیت‌ها](#مسئولیتها)  
5. [BFF در برابر Edge Gateway](#bff-در-برابر-edge-gateway)  
6. [اکوسیستم Laravel](#اکوسیستم-laravel)  
7. [مقیاس‌پذیری](#مقیاسپذیری)  
8. [Gateway در برابر همسایه‌ها](#gateway-در-برابر-همسایهها)  
9. [نکته‌های مصاحبه](#نکتههای-مصاحبه)  
10. [قانون تصمیم](#قانون-تصمیم)  
11. [ضدالگوها](#ضدالگوها)

---

## چیست و چرا

**API Gateway** نقطهٔ ورود واحد بین کلاینت‌ها و مجموعهٔ سرویس‌های بک‌اند است. توپولوژی داخلی را **کپسوله** می‌کند و API مناسب کلاینت می‌دهد؛ هم‌زمان concerns مشترک را هندل می‌کند: routing، احراز هویت، rate limit، TLS termination، گاهی aggregation.

```
Clients (Web / Mobile / Partner)
              │
              ▼
        [ API Gateway ]
         │     │     │
         ▼     ▼     ▼
   AuthSvc  OrderSvc  CatalogSvc
```

**چرا؟** میکروسرویس‌ها APIهای ریز می‌دهند. بدون Gateway هر کلاینت باید URL، auth، نسخه و retry هر سرویس را بداند. Gateway همه را در یک لبه جمع می‌کند.

::: tip
در مصاحبه کار **اصلی** = **request routing**. Middleware (auth، limit، TLS) واقعی است — ولی بیست feature لیست نکن و routing را فراموش کنی.
:::

مرتبط: [قضیهٔ CAP](/fa/architecture/cap-theorem) · [الگوهای Cache](/fa/patterns/cache-patterns) · [Outbox](/fa/patterns/outbox)

---

## مدل ذهنی

میز پذیرش هتل: مهمان دنبال اتاق نظافت / تعمیرات نمی‌دود. همین برای کلاینت در برابر میکروسرویس‌ها.

| بدون Gateway | با Gateway |
|--------------|------------|
| Client → چند سرویس | Client → یک لبه |
| Auth / TLS / limit تکراری | سیاست متمرکز |
| جابه‌جایی بک‌اند کلاینت را می‌شکند | کلاینت پایدار می‌ماند |

دو صفحه (مدل ذهنی ops):

| صفحه | کار |
|------|-----|
| **Control plane** | Routeها، policy، cert، config |
| **Data plane** | Routing زنده + اعمال همان policyها |

---

## جریان request

مسیر معمول:

1. **Validate** — URL، headerهای لازم، شکل body (fail fast)  
2. **Middleware** — authN/Z، rate limit، IP allow/deny، CORS، logging  
3. **Route** — path / method / header → سرویس بک‌اند  
4. **Backend** — منطق دامنه داخل سرویس  
5. **Transform** — اختیاری (HTTP↔gRPC، XML→JSON)  
6. **Cache** — اختیاری برای پاسخ‌های عمومی، پایدار، غیر وابسته به کاربر  
7. **Return** — یک پاسخ به کلاینت (گاهی aggregate)

```
Client → Gateway [validate → auth → limit → route]
              → OrderSvc / CatalogSvc / …
              ← response (± transform / cache)
```

---

## مسئولیت‌ها

### ضروری (لبه)

| مسئولیت | یادداشت |
|---------|---------|
| **Routing** | `/orders/*` → Order Service |
| **AuthN / AuthZ** | JWT، API key، OAuth، mTLS |
| **Rate limit / throttle** | سوءاستفاده + noisy neighbor |
| **TLS termination** | Decrypt در لبه؛ بک‌اند سبک‌تر |
| **Observability** | Request id، metrics، access log |
| **Versioning** | `/v1` در برابر `/v2` |

### اغلب مفید

| مسئولیت | یادداشت |
|---------|---------|
| Aggregation / composition | یک call کلاینت → چند بک‌اند (شبیه BFF) |
| Caching | GET / کاتالوگ عمومی؛ TTL کوتاه |
| Load balancing | Gateway→instanceهای سرویس (client→gateway معمولاً LB جدا) |
| Retry / circuit break | با POST غیر idempotent محتاط باش |
| ترجمۀ پروتکل | بیرون REST، داخل gRPC |

### الگوهای طراحی در لبه

| الگو | یک‌خطی |
|------|--------|
| **Gatekeeper** | فقط ترافیک احراز/مجاز به بک‌اند برسد |
| **Gateway offloading** | TLS، auth، log، throttle را از سرویس‌ها بردار |
| **Throttling** | سقف per client / key / IP |
| **Circuit breaker** | وابستگی بیمار را نکوب |
| **Valet key** | توکن کوتاه‌عمر محدود به یک resource |
| **Health monitor** | از بک‌اند ناسالم دور شو |

---

## BFF در برابر Edge Gateway

**Backend for Frontend (BFF)** (Sam Newman): بک‌اند شکل‌گرفته برای **یک** نوع کلاینت (web / iOS / Android). Aggregate و reshape می‌کند تا UI پنج میکروسرویس را به هم ندوزد.

| | Edge API Gateway | BFF |
|--|------------------|-----|
| مخاطب | همه / چند کلاینت | یک سطح کلاینت |
| تمرکز | سیاست مشترک + routing | شکل مخصوص کلاینت |
| ریسک | God Gateway | نگهداری چند BFF |

GraphQL اغلب به‌عنوان لایهٔ **BFF** خوب کار می‌کند (کلاینت دقیقاً فیلدهای لازم را می‌خواهد).

::: tip
یک اپ Laravel می‌تواند **BFF سبک** باشد. در مقیاس بزرگ، Gateway جدا (Kong / AWS API Gateway / Traefik) جلو؛ BFF فقط جایی که شکل کلاینت سخت فرق دارد.
:::

---

## اکوسیستم Laravel

چیدمان رایج: **Nginx / Traefik / Kong / AWS API Gateway** در لبه؛ اپ‌های Laravel به‌عنوان سرویس (یا یک Laravel به‌عنوان BFF سبک).

لبهٔ سبک در یک Laravel (routing + middleware ≈ وظایف Gateway):

```php
// routes/api.php — لبهٔ نازک: throttle + auth، بعد کنترلرهای دامنه
Route::middleware(['throttle:api', 'auth:sanctum'])->group(function () {
    Route::get('/orders', [OrderController::class, 'index']);
    Route::post('/orders', [OrderController::class, 'store']);
});
```

```php
// AppServiceProvider / RouteServiceProvider
RateLimiter::for('api', function (Request $request) {
    return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
});
```

Routing شبیه Nginx (Gateway / reverse proxy واقعی):

```nginx
location /api/users/ {
  proxy_pass http://users-service:8080/;
}

location /api/orders/ {
  proxy_pass http://orders-service:8080/;
  limit_req zone=api burst=20;
}
```

**قانون:** cross-cutting (auth، TLS، limit) در Gateway؛ **منطق بیزنس داخل سرویس‌ها**.

---

## مقیاس‌پذیری

Gateway معمولاً **stateless** است → scale افقی پشت load balancer.

| بُعد | رویکرد |
|------|--------|
| **بار** | N رپلیکا Gateway + LB (ALB / Nginx) |
| **جهانی** | Gateway منطقه‌ای + GeoDNS؛ sync کردن route/policy |
| **LB کلاینت→Gateway** | LB جدا جلوی ناوگان Gateway |
| **LB Gateway→سرویس** | خود Gateway (یا mesh) بین instanceها |

::: warning
Gateway می‌تواند **گلوگاه** و **نقطهٔ شکست واحد** شود. از روز اول HA (چند AZ / چند instance) طراحی کن.
:::

گزینه‌های رایج: **AWS API Gateway**، **Azure APIM**، **Kong**، **Tyk**، **Apigee**، استک‌های ingress (Nginx / Traefik) با پلاگین.

---

## Gateway در برابر همسایه‌ها

| جزء | ترافیک | نقش |
|-----|--------|-----|
| **API Gateway** | North–south (کلاینت → سیستم) | ورود + سیاست + route |
| **Service mesh** | East–west (سرویس ↔ سرویس) | mTLS، retry، observability داخل کلاستر |
| **Ingress controller** | ورود به کلاستر K8s | Reverse proxy بومی کلاستر؛ باریک‌تر از API management کامل |

مکمل‌اند؛ mesh جایگزین Gateway عمومی نیست.

---

## نکته‌های مصاحبه

- میکروسرویس + چند کلاینت → **Gateway پیشنهاد کن**؛ بگو «routing + middleware پایه» و برو جلو.  
- Monolith ساده / یک کلاینت → Gateway ممکن است overkill باشد؛ reverse proxy کافی.  
- ده دقیقه لیست پلاگین نسوزان — مسیرهای محصول مهم‌ترند.  
- اگر از ریسک پرسیدند: SPOF + HA را بگو.  
- وقتی شکل کلاینت‌ها جدا می‌شود → **BFF**، نه یک God Gateway.

---

## قانون تصمیم

1. **چند سرویس + چند کلاینت** → تقریباً Gateway لازم است.  
2. **Monolith / یک سطح API** → reverse proxy شاید کافی باشد.  
3. Gateway را **نازک** نگه دار: route، امنیت، limit — نه قوانین دامنه.  
4. Aggregation مخصوص کلاینت → **BFF**، نه یک God Gateway.  
5. ترافیک داخلی سرویس‌ها → mesh / LB؛ همهٔ east–west را از Gateway عمومی رد نکن.

---

## ضدالگوها

- ریختن همهٔ منطق بیزنس داخل Gateway (**God Gateway**)  
- یک instance بدون رپلیکا (SPOF)  
- مخفی کردن خطای بک‌اند بدون **correlation / request id**  
- Retry تهاجمی روی write غیر idempotent بدون idempotency key  
- Cache کردن پاسخ شخصی و دادن به کاربر دیگر  
- گرفتن Gateway به‌جای service mesh (یا برعکس)
