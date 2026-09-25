# API Gateway

## چیست؟

**API Gateway** یک نقطهٔ ورود واحد برای کلاینت‌هاست: request را می‌گیرد، auth را هندل می‌کند، و به سرویس‌های بک‌اند **route** می‌کند.

```
Mobile / Web / Partner
         │
         ▼
   [ API Gateway ]
      │    │    │
      ▼    ▼    ▼
   Users Orders Payments
```

بدون Gateway، هر کلاینت باید آدرس، auth و نسخهٔ هر سرویس را بداند.

---

## مسئولیت‌های رایج

| مسئولیت | یادداشت |
|---------|---------|
| Routing | `/orders/*` → Order Service |
| AuthN/AuthZ | JWT، API Key، mTLS |
| Rate limiting | محافظت در برابر abuse |
| SSL termination | TLS در لبه |
| Aggregation | ترکیب پاسخ‌ها (شبیه BFF) |
| Observability | Request id، metrics، logs |
| Versioning | `/v1` در برابر `/v2` |

---

## مثال مفهومی (شبیه Nginx / Kong)

```nginx
location /api/users/ {
  proxy_pass http://users-service:8080/;
}

location /api/orders/ {
  proxy_pass http://orders-service:8080/;
  limit_req zone=api burst=20;
}
```

در دنیای Laravel، گاهی «Gateway» یک اپ جدا با Sanctum/Passport است که به میکروسرویس‌ها proxy می‌کند.

---

## الگوهای مرتبط

- **BFF (Backend for Frontend):** Gateway اختصاصی برای هر کلاینت (web/mobile)  
- **Edge Gateway:** ورود مشترک برای همه  
- **Service Mesh:** ترافیک سرویس‌به‌سرویس داخل کلاستر (مکمل Gateway؛ جایگزین کاملش نیست)

---

## بده‌بستان‌ها

| مزیت | هزینه |
|------|-------|
| کلاینت ساده‌تر | نقطهٔ شکست مرکزی → نیاز به HA |
| سیاست یکپارچه | latency اضافه |
| عوض کردن بک‌اند بدون کلاینت | خطر تبدیل شدن به God Gateway |

---

## Antipatternها

- گذاشتن همهٔ منطق بیزنس داخل Gateway  
- یک Gateway غول‌پیکر بدون scale افقی  
- پنهان کردن خطای سرویس بدون correlation id

---

## قاعدهٔ تصمیم

1. چند سرویس + چند کلاینت → تقریباً Gateway لازم است.  
2. Monolith ساده → reverse proxy شاید کافی باشد.  
3. Gateway را نازک نگه دار: route، امنیت، limit — نه منطق دامنه.
