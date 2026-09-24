# API Gateway

## چیست؟

**API Gateway** نقطهٔ ورود واحد برای کلاینت‌هاست: درخواست‌ها را می‌گیرد، احراز هویت می‌کند، و به سرویس‌های پشت‌صحنه **مسیر می‌دهد (route)**.

```
Mobile / Web / Partner
         │
         ▼
   [ API Gateway ]
      │    │    │
      ▼    ▼    ▼
   Users Orders Payments
```

بدون Gateway، هر کلاینت باید آدرس، auth و نسخهٔ همهٔ سرویس‌ها را بداند.

---

## مسئولیت‌های رایج

| مسئولیت | توضیح |
|---------|--------|
| Routing | `/orders/*` → Order Service |
| AuthN/AuthZ | JWT، API Key، mTLS |
| Rate limiting | جلوگیری از abuse |
| SSL termination | TLS در لبه |
| Aggregation | ترکیب چند پاسخ (BFF-like) |
| Observability | request id، متریک، لاگ |
| Versioning | `/v1` vs `/v2` |

---

## مثال مفهومی (Nginx / Kong-like)

```nginx
location /api/users/ {
  proxy_pass http://users-service:8080/;
}

location /api/orders/ {
  proxy_pass http://orders-service:8080/;
  limit_req zone=api burst=20;
}
```

در Laravel اکوسیستم، گاهی «Gateway» یک اپ جدا با Sanctum/Passport است که به میکروسرویس‌ها پروکسی می‌کند.

---

## الگوهای مرتبط

- **BFF (Backend for Frontend):** Gateway مخصوص هر کلاینت (web/mobile)  
- **Edge Gateway:** عمومی برای همه  
- **Service Mesh:** ارتباط سرویس-به-سرویس داخل کلاستر (مکمل Gateway، جایگزین کامل نیست)

---

## Trade-off

| مزیت | هزینه |
|------|-------|
| کلاینت ساده‌تر | نقطهٔ شکست مرکزی → باید HA باشد |
| سیاست یکپارچه | latency اضافه |
| تغییر سرویس‌ها بدون تغییر کلاینت | تبدیل شدن به God Gateway خطرناک است |

---

## ضدالگو

- قرار دادن تمام business logic داخل Gateway  
- یک Gateway غول‌آسا بدون horizontal scale  
- پنهان کردن خطاهای سرویس بدون correlation id

---

## قانون تصمیم

1. چند سرویس + چند کلاینت → Gateway تقریباً ضروری است.  
2. مونولیت ساده → شاید فقط reverse proxy کافی باشد.  
3. Gateway را نازک نگه دار: route، security، limit — نه دامنهٔ کسب‌وکار.
