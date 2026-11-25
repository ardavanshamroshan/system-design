---
description: راهنمای دانش و عملیات برای مرز سرویس‌ها، هویت، Messaging، اجرای برنامه و Observability.
---
# راهنمای مهندسی سرویس‌ها

این مجموعه، مفاهیم معماری را به مراحل پیاده‌سازی، آزمایش خرابی و نگهداری تبدیل می‌کند. مثال مشترک، سرویس اعلان است: Eventی از Espo یا برنامه‌ای دیگر دریافت می‌کند، دو روز منتظر می‌ماند، شرایط فعلی مشتری را بررسی می‌کند و در صورت مجاز بودن، پیامک می‌فرستد. همین اصول در پرداخت، سفارش، Webhook و گزارش‌های پس‌زمینه کاربرد دارند.

> مسیر مطالعه: شناخت مرز مسئولیت ← تعریف قرارداد ← پیاده‌سازی ← آزمایش خرابی ← ثبت تصمیم عملیاتی.

## ارزیابی مفاهیم اولیه

طرح اولیه مناسب است؛ برای دقیق شدن تضمین‌ها، این تفاوت‌ها باید روشن باشند:

| مفهوم | نتیجه و نکتهٔ تکمیلی |
| --- | --- |
| API Gateway | آدرس پایدار، Routing و سیاست‌های مشترک؛ Authorization به منابع همچنان در سرویس بررسی می‌شود. |
| Traefik | مرز Reverse Proxy را اجرا می‌کند؛ محل تصمیم‌گیری کمپین یا جایگزین Identity Provider نیست. |
| mTLS | دارندهٔ Certificate را در یک اتصال مشخص Authenticate می‌کند؛ اعتماد به CA به معنی مجوز همهٔ عملیات نیست. |
| JWT و JWKS | Token حامل Claimهاست و JWKS کلیدها را منتشر می‌کند؛ صدور Token و سیاست Authorization موضوعاتی جدا هستند. |
| REST و AMQP | در این طرح، HTTP برای Command و Query و AMQP برای انتشار Event است؛ این تقسیم‌بندی محدودیت ذاتی Protocolها نیست. |
| Docker و Octane | بسته‌بندی برنامه با چرخهٔ عمر Process تفاوت دارد؛ Process گرم، سهمیهٔ ارائه‌دهندهٔ پیامک را افزایش نمی‌دهد. |
| RabbitMQ و Redis | Event بین سرویس‌ها و کار اجرایی داخل سرویس دو مسئولیت متفاوت دارند؛ این فصل، شمارهٔ ۷ حذف‌شده از متن اولیه را تکمیل می‌کند. |
| داده‌های Monitoring | برای تشخیص علت رفتار سیستم هستند؛ مرجع وضعیت ارسال، Durable Record کسب‌وکار است. |

HTTP می‌تواند با پاسخ `202` کار Async را بپذیرد و AMQP نیز قابلیت اجرای Pattern درخواست/پاسخ را دارد. منابع: [معنای HTTP 202](https://www.rfc-editor.org/rfc/rfc9110.html#name-202-accepted) و [RPC در RabbitMQ](https://www.rabbitmq.com/tutorials/tutorial-six-python).

## نقشهٔ معماری

مرورگر به Backend پنل مدیریت متصل می‌شود. سایت‌های فراخوان و Backend مدیریت از مرز API داخلی عبور می‌کنند. callback ارائه‌دهنده مسیر عمومی جداگانه‌ای دارد و Signature آن در برنامه بررسی می‌شود. Database اعلان، مالک Workflow، رضایت مشتری، تلاش‌های ارسال و inbox/outbox است.

## فصل‌ها و نمونه‌ها

راهنماها در منوی کناری بر اساس موضوع دسته‌بندی شده‌اند: API Gateway در **System Architecture**؛ JWT/JWKS و mTLS در **Software Design و Patternها، بخش Authentication**؛ REST/AMQP و کارهای Durable در **Messaging**؛ و Traefik، Docker/Octane و Observability در **DevOps**. این صفحه، مسیر مطالعهٔ پیوسته را حفظ می‌کند.

| فصل | دانش و روش اجرا | نمونهٔ اصلی |
| --- | --- | --- |
| <span class="vip-locked" title="VIP members only">۱. API Gateway <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | قرارداد مسیر، بودجهٔ زمان و ترکیب پاسخ‌ها | Python و HTTPX |
| <span class="vip-locked" title="VIP members only">۲. Traefik روی Docker <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Service Discovery، router، middleware و Release تغییر | Compose و YAML |
| <span class="vip-locked" title="VIP members only">۳. mTLS بین سایت‌ها <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | اعتماد، نگاشت هویت، تمدید و عیب‌یابی | OpenSSL، Python و PHP |
| <span class="vip-locked" title="VIP members only">۴. JWT و JWKS <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Issuer، اعتبارسنجی و Authorization منابع | FastAPI، PyJWT و Laravel |
| <span class="vip-locked" title="VIP members only">۵. REST و AMQP <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Command تکرارپذیر، Event و Transaction | HTTP، JSON و Pika |
| <span class="vip-locked" title="VIP members only">۶. Docker و Processهای برنامه <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Image، نقش Process و وضعیت مشترک | FastAPI و Octane |
| <span class="vip-locked" title="VIP members only">۷. Durable Workflow و Work Queue <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Scheduling، توقف، Redis و Reconciliation وضعیت | SQL و آزمایش اجرایی Python |
| <span class="vip-locked" title="VIP members only">۸. Observability <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Log JSON، Sentry، ClickStack و Incident عملیاتی | Python، Monolog و OpenTelemetry |

نمونه‌های «طرح اتصال» به آداپتورهای اختصاصی برنامه نیاز دارند. آزمایش Transaction Python بدون بستهٔ جانبی اجرا می‌شود؛ فایل‌های پیکربندی، یک سامانهٔ آمادهٔ تولید نیستند. نمونه‌های وابسته به نسخه برای Traefik v3، Laravel 13، Python 3.10 به بالا، PyJWT 2 و AMQP 0-9-1 نوشته شده‌اند. پیش از Deployment، نسخهٔ اصلاحی پشتیبانی‌شده را انتخاب و قفل کنید.

## ترتیب اجرا

۱. مالکیت tenant، رضایت مشتری، قرارداد callback و معنای «دو روز» را مشخص کنید؛ ۴۸ ساعت با دو روز تقویمی یکسان نیست.

۲. Identity Provider، audience، مجوزها و مسئول Certificateها را تعیین کنید.

۳. قرارداد API و Event، دامنهٔ کلید idempotency و مدت نگهداری را بنویسید.

۴. مرزهای Transaction و سناریوهای خرابی را پیش از اتصال به ارائه‌دهندهٔ واقعی آزمایش کنید.

۵. نقش‌های HTTP، مصرف Event، Scheduling، relay و اجرای کار را جدا کنید.

۶. Routing، mTLS، Token و callback را با موارد مجاز و غیرمجاز بررسی کنید.

۷. شاخص‌های خدمت، Alertها، بازیابی و Rollback نسخه را مستند کنید.

برای نسخهٔ اولیه، یک سرویس و یک Database می‌توانند این مرزها را اجرا کنند. هر فصل به معنی نیاز به یک Microservice جداگانه نیست.

## الگوی مدیریت دانش

برای هر قابلیت، مسئله، تصمیم، گزینه‌های ردشده، مالک، شرط بازبینی، تضمین‌ها و شواهد آزمایش را کنار کد نگه دارید. در مستندات فقط به محل نگهداری secret اشاره کنید؛ مقدار واقعی آن را ننویسید.

```yaml
id: ADR-007
capability: notification-delivery
status: proposed # proposed | accepted | superseded
owner: notifications-team
review_trigger: provider-contract-or-identity-change
context: delivery may succeed even when the HTTP response is lost
decision: persist attempts and reconcile unknown outcomes
alternatives:
  - retry every timeout # rejected: possible duplicate SMS
invariants:
  - one stable provider idempotency key per logical send
verification:
  - lost-response exercise produces an unknown attempt
runbook: handbook/durable-jobs
rollback: pause dispatch; retain pending database records
evidence: link-to-test-run-and-staging-exercise
```

راهنمای عملیات باید محرک اجرا، مسئول، پیش‌نیاز، دستورها، نتیجهٔ مورد انتظار، شرط توقف و روش بازیابی داشته باشد. وضعیت «پیشنهادی» را زمانی به «پذیرفته‌شده» تغییر دهید که شواهد آزمایش و Deployment موجود باشد.

## تمرین و پذیرش

از ریشهٔ Repository اجرا کنید:

```bash
python3 -m unittest discover -s examples/notification-core -v
npm run build
```

آزمایش‌ها، درخواست تکراری، تعارض payload، Isolation tenant، rollback، لغو، مرز زمانی، راه‌اندازی مجدد، رقابت هم‌زمان، قطعی broker و خرابی پس از انتشار را پوشش می‌دهند. build مستندات جای آزمایش واقعی TLS، هویت، Queue و ارائه‌دهندهٔ پیامک را نمی‌گیرد.

دانش مرتبط: <span class="vip-locked" title="VIP members only">API Gateway <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>، <span class="vip-locked" title="VIP members only">Outbox <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>، <span class="vip-locked" title="VIP members only">Message Acknowledgment <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>، <span class="vip-locked" title="VIP members only">DLQ <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>، <span class="vip-locked" title="VIP members only">Saga <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> و <span class="vip-locked" title="VIP members only">Profile Compose <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>.
