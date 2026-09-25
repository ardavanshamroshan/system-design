# Kafka، RabbitMQ یا Redis Streams؟

## سؤال درست را بپرس

«کدام بهترین است؟» سؤال اشتباه است.  
بپرس: **الگوی ترافیک، تضمین‌ها، ordering و مدل مصرف** چیست؟

---

## مقایسهٔ سریع

| معیار | Kafka | RabbitMQ | Redis Streams |
|-------|-------|----------|---------------|
| مدل | Distributed log | Message broker کلاسیک | Stream روی Redis |
| Throughput | خیلی بالا | بالا (معمولاً کمتر از Kafka) | بالا در مقیاس متوسط |
| Retention | بلند / replay | معمولاً تا زمان consume | با MAXLEN / trim |
| Routing | Topic + partition | Exchange خیلی انعطاف‌پذیر | Key / consumer group |
| پیچیدگی ops | بالاتر | متوسط | کمتر اگر از قبل Redis داری |
| نقاط قوت | Event streaming، analytics | Task queue، routing غنی | Queue سبک، realtime |

---

## Kafka — کی؟

- حجم بالای event (clickstream، audit، CDC)  
- نیاز به **replay** تاریخچه  
- چند consumer مستقل روی یک topic  
- ordering در سطح partition مهم است

```
Producer → Topic(partitions) → Consumer Groups
```

::: tip
Kafka بیشتر «دفتر رویداد» است تا work queue کلاسیک.
:::

---

## RabbitMQ — کی؟

- Job queue با routing غنی (topic/fanout/headers)  
- Priority، TTL، پیام تأخیری  
- پروتکل‌های متنوع (AMQP)  
- الگوی request/reply

```
Producer → Exchange → Queue → Consumer
```

---

## Redis Streams — کی؟

- Redis از قبل در استک هست  
- به consumer group ساده نیاز داری  
- latency کم در مقیاس متوسط  
- نمی‌خواهی کلاستر Kafka راه بیندازی

```
XADD → Stream → XREADGROUP
```

محدودیت: دوام/ops سطح Kafka را فرض نکن؛ Redis را درست HA کن.

---

## جدول تصمیم کوتاه

| نیازت | انتخاب اول |
|-------|------------|
| Event sourcing / analytics سنگین | Kafka |
| Job queue + routing غنی | RabbitMQ |
| Queue سبک کنار cache موجود | Redis Streams |
| «بعداً یک job اجرا کن» در Laravel | گاهی Redis/database queue کافی است |

---

## Antipatternها

- آوردن Kafka برای ۱٬۰۰۰ پیام در روز  
- استفاده از Redis Streams برای سیستم مالی بدون فهم durability  
- یک broker برای همه چیز بدون SLO

---

## قاعدهٔ تصمیم

1. حجم + retention + نیاز به replay را بنویس.  
2. با پیچیدگی ops تیم صادق باش.  
3. با ساده‌ترین ابزاری که SLO را می‌دهد شروع کن؛ بعداً ارتقا بده.
