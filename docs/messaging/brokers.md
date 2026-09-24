# Kafka، RabbitMQ یا Redis Streams؟

## سؤال درست

«کدام بهترین است؟» اشتباه است.  
بپرس: **الگوی ترافیک، تضمین، ترتیب، و مدل مصرف** چیست؟

---

## مقایسهٔ سریع

| معیار | Kafka | RabbitMQ | Redis Streams |
|-------|-------|----------|---------------|
| مدل | Log توزیع‌شده | Message broker کلاسیک | Stream روی Redis |
| Throughput | خیلی بالا | بالا (معمولاً کمتر از Kafka) | بالا برای مقیاس متوسط |
| Retention | طولانی / replay | معمولاً تا consume | با MAXLEN / trim |
| Routing | Topic + partition | Exchange بسیار انعطاف‌پذیر | Key / consumer group |
| پیچیدگی ops | بیشتر | متوسط | کمتر اگر Redis داری |
| موارد قوی | event streaming، analytics | task queue، RPC-ish، routing پیچیده | صف سبک، realtime |

---

## Kafka — چه وقت؟

- حجم رویداد زیاد (clickstream، audit، CDC)  
- نیاز به **replay** تاریخچه  
- چند مصرف‌کننده مستقل از یک topic  
- ترتیب per-partition مهم است

```
Producer → Topic(partitions) → Consumer Groups
```

::: tip
Kafka بیشتر «دفترکل رویداد» است تا «صف کار کلاسیک».
:::

---

## RabbitMQ — چه وقت؟

- صف کار (job) با routing پیچیده (topic/fanout/headers)  
- اولویت، TTL، delayed message  
- پروتکل‌های متنوع (AMQP)  
- الگوهای request/reply

```
Producer → Exchange → Queue → Consumer
```

---

## Redis Streams — چه وقت؟

- از قبل Redis در استک هست  
- نیاز به consumer group ساده  
- latency پایین، مقیاس متوسط  
- نمی‌خواهی کلاستر Kafka راه بیندازی

```
XADD → Stream → XREADGROUP
```

محدودیت: persistence/ops را با Kafka یکی فرض نکن؛ Redis را درست HA کن.

---

## جدول تصمیم کوتاه

| نیاز تو | پیشنهاد اولیه |
|---------|----------------|
| Event sourcing / analytics سنگین | Kafka |
| Job queue + routing غنی | RabbitMQ |
| صف سبک کنار cache موجود | Redis Streams |
| فقط «بعداً یک job اجرا شود» در Laravel | گاهی Redis queue / database queue کافی است |

---

## ضدالگو

- آوردن Kafka برای روزی ۱۰۰۰ پیام  
- استفاده از Redis Streams به‌جای سیستم مالی بدون درک durability  
- یک broker برای همه چیز بدون SLO مشخص

---

## قانون تصمیم

1. حجم + retention + replay را بنویس.  
2. پیچیدگی عملیاتی تیم را صادقانه بسنج.  
3. از ساده‌ترین ابزاری شروع کن که SLO را می‌دهد؛ بعداً upgrade کن.
