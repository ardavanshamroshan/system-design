# منابع

> منابع · بخش ۲۰ بانک سؤال · [فهرست همهٔ سؤال‌ها](/fa/interview/)

- [Go 1.27 Release Notes](https://go.dev/doc/go1.27) و [Go 1.26 Release Notes](https://go.dev/doc/go1.26)
- [PHP 8.6 Release Announcement](https://www.php.net/releases/8.6/en.php) و [What's New in PHP 8.6](https://laravel-news.com/php-8-6)
- [PostgreSQL 19 Press Kit](https://www.postgresql.org/about/press/presskit19/) و [PostgreSQL 18 Press Kit](https://www.postgresql.org/about/press/presskit18)
- [OWASP Top 10:2025](https://owasp.org/Top10/2025/0x00_2025-Introduction/) و [OWASP Top 10 for LLMs 2025](https://www.hackerone.com/ai/owasp-top-10-llms-2025)
- [Apache Kafka 4.2.0](https://kafka.apache.org/blog/2026/02/17/apache-kafka-4.2.0-release-announcement) و [RabbitMQ 4.2 on Amazon MQ](https://aws.amazon.com/about-aws/whats-new/2025/11/amazon-mq-rabbitmq-42)
- [Back-End Developer Interview Questions](https://github.com/arialdomartini/Back-End-Developer-Interview-Questions)
- [Service engineering handbook — Ardavan ShamRoshan](https://ardavanshamroshan.github.io/system-design/handbook/) (سرفصل‌ها با بیان خودم پوشش داده شده)
- [System Design Interviews at Google, Amazon, and Meta](https://www.designgurus.io/blog/system-design-interviews-at-google-meta-amazon)

## برای مطالعهٔ بیشتر

منابع ماندگاری که با عوض‌شدن نسخه‌ها کهنه نمی‌شوند. برچسب هر مورد یعنی: <Badge type="danger" text="حیاتی" /> اگر فقط وقت یک منبع در آن موضوع را داری همین را بخوان؛ <Badge type="warning" text="مهم" /> برای سطح senior؛ <Badge type="info" text="تکمیلی" /> برای عمق بیشتر.

### Distributed Systems و داده

- **Designing Data-Intensive Applications — Martin Kleppmann** <Badge type="danger" text="حیاتی" /> — بهترین تک‌کتاب برای replication، partitioning، Transaction، Consensus و Stream Processing؛ به‌جای ابزار، بده‌بستان‌ها را یاد می‌دهد و تقریباً هر پرسش طراحی سیستم به یکی از فصل‌هایش برمی‌گردد.
- **Database Internals — Alex Petrov** <Badge type="warning" text="مهم" /> — درون موتور ذخیره‌سازی (B-Tree، LSM، WAL) و نیمه‌ی دوم درباره‌ی Distributed Systems؛ وقتی می‌خواهی بدانی «چرا» این Index کند است، نه فقط «چطور» بسازی‌اش.
- **[Jepsen analyses](https://jepsen.io/analyses) — Kyle Kingsbury** <Badge type="info" text="تکمیلی" /> — آزمون واقعی ادعاهای Consistency Databaseها و brokerها زیر partition؛ بهترین پادزهر برای اعتماد کورکورانه به صفحه‌ی بازاریابی یک محصول.
- **[مستندات رسمی PostgreSQL](https://www.postgresql.org/docs/)** <Badge type="danger" text="حیاتی" /> — فصل‌های MVCC، Explicit Locking، Indexes و Using EXPLAIN از هر مقاله‌ی دست‌دومی دقیق‌ترند و با هر نسخه به‌روز می‌شوند.

### طراحی سیستم و مصاحبه

- **System Design Interview (جلد ۱ و ۲) — Alex Xu** <Badge type="warning" text="مهم" /> — سناریوهای کلاسیک مصاحبه با قالب ثابت و نمودار؛ برای تمرین ساختار پاسخ خوب است، برای عمق باید کنار Kleppmann خوانده شود.
- **Building Microservices — Sam Newman** <Badge type="warning" text="مهم" /> — مرز سرویس، ارتباط، Deployment و Migration از monolith، با تأکید صادقانه بر این‌که کِی microservice اشتباه است.
- **[The Twelve-Factor App](https://12factor.net/)** <Badge type="warning" text="مهم" /> — دوازده اصل کوتاه برای سرویس قابل Deploy (config در محیط، Process بدون حالت، Log به‌صورت جریان)؛ یک ساعت خواندن که واژگان مشترک تیم را می‌سازد.

### قابلیت اطمینان و عملیات

- **[Site Reliability Engineering](https://sre.google/books/) — Google** <Badge type="danger" text="حیاتی" /> — مرجع SLI و SLO، error budget، Alerting روی نشانه و postmortem بدون سرزنش؛ رایگان و آنلاین، و لازم نیست همه‌اش را بخوانی.
- **Release It! — Michael Nygard** <Badge type="danger" text="حیاتی" /> — Stability Patternها (timeout، circuit breaker، bulkhead) و Anti-Patternهایی که production را می‌خوابانند، همه با روایت Incidentهای واقعی؛ کاربردی‌ترین کتاب برای کسی که on-call است.

### زبان‌ها: Go و PHP

- **[The Go Programming Language](https://www.gopl.io/) — Alan Donovan و Brian Kernighan** <Badge type="warning" text="مهم" /> — مرجع دقیق زبان با تمرین‌های خوب؛ فصل‌های goroutine، channel و Concurrency با حافظه‌ی مشترک را حتماً بخوان.
- **[Effective Go](https://go.dev/doc/effective_go) و [The Go Blog](https://go.dev/blog/)** <Badge type="danger" text="حیاتی" /> — سبک و عادت‌های idiomatic از خود تیم Go؛ مقاله‌های وبلاگ درباره‌ی context، pipelineها، خطاها و GC منبع دست‌اول پرسش‌های مصاحبه‌اند.
- **[PHP: The Right Way](https://phptherightway.com/)** <Badge type="warning" text="مهم" /> — راهنمای فشرده و به‌روز شیوه‌های درست PHP مدرن (Composer، استانداردهای PSR، امنیت، Test)؛ برای پاک‌کردن عادت‌های قدیمی.

### معماری و طراحی نرم‌افزار

- **Domain-Driven Design — Eric Evans** <Badge type="warning" text="مهم" /> — زبان مشترک، bounded context و aggregate؛ سنگین‌خوان است ولی مرزبندی درست سرویس‌ها و مدل داده از همین‌جا می‌آید.
- **Patterns of Enterprise Application Architecture — Martin Fowler** <Badge type="info" text="تکمیلی" /> — ریشه‌ی Patternهایی که هر روز در Frameworkها می‌بینی (Active Record، Data Mapper، Unit of Work، Repository)؛ کمک می‌کند بدانی Eloquent یا یک ORM در Go دقیقاً کدام بده‌بستان را انتخاب کرده.

### شبکه و امنیت

- **[High Performance Browser Networking](https://hpbn.co/) — Ilya Grigorik** <Badge type="warning" text="مهم" /> — TCP، TLS، HTTP/2، WebSocket و SSE از دید Latency و کارایی؛ رایگان و آنلاین، و فصل‌های TCP و TLS برای هر مهندس backend لازم است.
- **[OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)** <Badge type="danger" text="حیاتی" /> — برگه‌های کوتاه و عملی برای هر موضوع امنیتی (Authentication، session، ذخیره‌ی گذرواژه، SQL injection، JWT)؛ قبل از پیاده‌سازی هر قابلیت حساس برگه‌اش را باز کن.
