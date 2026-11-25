# References

> References · Question bank part 20 · [All questions](/interview/)

- [Go 1.27 Release Notes](https://go.dev/doc/go1.27) and [Go 1.26 Release Notes](https://go.dev/doc/go1.26)
- [PHP 8.6 Release Announcement](https://www.php.net/releases/8.6/en.php) and [What's New in PHP 8.6](https://laravel-news.com/php-8-6)
- [PostgreSQL 19 Press Kit](https://www.postgresql.org/about/press/presskit19/) and [PostgreSQL 18 Press Kit](https://www.postgresql.org/about/press/presskit18)
- [OWASP Top 10:2025](https://owasp.org/Top10/2025/0x00_2025-Introduction/) and [OWASP Top 10 for LLMs 2025](https://www.hackerone.com/ai/owasp-top-10-llms-2025)
- [Apache Kafka 4.2.0](https://kafka.apache.org/blog/2026/02/17/apache-kafka-4.2.0-release-announcement) and [RabbitMQ 4.2 on Amazon MQ](https://aws.amazon.com/about-aws/whats-new/2025/11/amazon-mq-rabbitmq-42)
- [Back-End Developer Interview Questions](https://github.com/arialdomartini/Back-End-Developer-Interview-Questions)
- [Service engineering handbook — Ardavan ShamRoshan](https://ardavanshamroshan.github.io/system-design/handbook/) (the topics are covered in my own words)
- [System Design Interviews at Google, Amazon, and Meta](https://www.designgurus.io/blog/system-design-interviews-at-google-meta-amazon)

## Further reading

Durable resources that do not go stale when versions change. The badge on each item means: <Badge type="danger" text="Must-know" /> if you only have time for one resource on that topic, read this one; <Badge type="warning" text="Important" /> for senior level; <Badge type="info" text="Good to know" /> for extra depth.

### Distributed systems and data

- **Designing Data-Intensive Applications — Martin Kleppmann** <Badge type="danger" text="Must-know" /> — the best single book on replication, partitioning, transactions, consensus and stream processing; it teaches trade-offs rather than tools, and almost every system design question traces back to one of its chapters.
- **Database Internals — Alex Petrov** <Badge type="warning" text="Important" /> — the inside of a storage engine (B-Tree, LSM, WAL), with the second half on distributed systems; for when you want to know "why" this index is slow, not just "how" to create it.
- **[Jepsen analyses](https://jepsen.io/analyses) — Kyle Kingsbury** <Badge type="info" text="Good to know" /> — real tests of the consistency claims of databases and brokers under partition; the best antidote to blind trust in a product's marketing page.
- **[PostgreSQL official documentation](https://www.postgresql.org/docs/)** <Badge type="danger" text="Must-know" /> — the chapters on MVCC, Explicit Locking, Indexes and Using EXPLAIN are more accurate than any second-hand article and are updated with every release.

### System design and interviews

- **System Design Interview (volumes 1 and 2) — Alex Xu** <Badge type="warning" text="Important" /> — the classic interview scenarios in a fixed format with diagrams; good for practising the structure of an answer, and it should be read alongside Kleppmann for depth.
- **Building Microservices — Sam Newman** <Badge type="warning" text="Important" /> — service boundaries, communication, deployment and migrating off a monolith, with honest emphasis on when microservices are the wrong choice.
- **[The Twelve-Factor App](https://12factor.net/)** <Badge type="warning" text="Important" /> — twelve short principles for a deployable service (config in the environment, stateless processes, logs as a stream); an hour of reading that gives a team a shared vocabulary.

### Reliability and operations

- **[Site Reliability Engineering](https://sre.google/books/) — Google** <Badge type="danger" text="Must-know" /> — the reference for SLIs and SLOs, error budgets, alerting on symptoms and blameless postmortems; free online, and you do not have to read all of it.
- **Release It! — Michael Nygard** <Badge type="danger" text="Must-know" /> — stability patterns (timeout, circuit breaker, bulkhead) and the anti-patterns that take production down, all told through real incidents; the most practical book for anyone who is on call.

### Languages: Go and PHP

- **[The Go Programming Language](https://www.gopl.io/) — Alan Donovan and Brian Kernighan** <Badge type="warning" text="Important" /> — a precise language reference with good exercises; do read the chapters on goroutines, channels and concurrency with shared memory.
- **[Effective Go](https://go.dev/doc/effective_go) and [The Go Blog](https://go.dev/blog/)** <Badge type="danger" text="Must-know" /> — idiomatic style and habits from the Go team itself; the blog posts on context, pipelines, errors and the GC are the first-hand source of interview questions.
- **[PHP: The Right Way](https://phptherightway.com/)** <Badge type="warning" text="Important" /> — a compact, current guide to good modern PHP practice (Composer, the PSR standards, security, testing); for clearing out old habits.

### Software architecture and design

- **Domain-Driven Design — Eric Evans** <Badge type="warning" text="Important" /> — ubiquitous language, bounded contexts and aggregates; a heavy read, but this is where sound service boundaries and data models come from.
- **Patterns of Enterprise Application Architecture — Martin Fowler** <Badge type="info" text="Good to know" /> — the origin of the patterns you see in frameworks every day (Active Record, Data Mapper, Unit of Work, Repository); it helps you see exactly which trade-off Eloquent or a Go ORM has chosen.

### Networking and security

- **[High Performance Browser Networking](https://hpbn.co/) — Ilya Grigorik** <Badge type="warning" text="Important" /> — TCP, TLS, HTTP/2, WebSocket and SSE from the angle of latency and performance; free online, and the TCP and TLS chapters are required reading for any backend engineer.
- **[OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)** <Badge type="danger" text="Must-know" /> — short, practical sheets for every security topic (authentication, sessions, password storage, SQL injection, JWT); open the relevant sheet before implementing any sensitive feature.
