# System Design

مستندات **طراحی سیستم و معماری نرم‌افزار** با ظاهر مستندات Laravel — منتشر روی GitHub Pages.

**سایت:** https://ardavanshamroshan.github.io/system-design/

## موضوعات

| گروه | صفحات |
|------|--------|
| مقدمات و الگوریتم | Big O، Quick Sort / Binary Search |
| الگوهای نرم‌افزاری | CQRS، Directory Query، Cache Patterns، Outbox |
| معماری سیستم | API Gateway، CAP Theorem |
| پیام‌رسانی | DLQ، Brokers، Acknowledgment |
| پایگاه داده | Connection Pool، Locking |
| DevOps | Docker Compose Profiles |

## توسعه محلی

```bash
npm install
npm run dev
```

ساخت استاتیک:

```bash
npm run build
```

## استقرار

Push به `main` با GitHub Actions روی GitHub Pages منتشر می‌شود (`base: /system-design/`).
