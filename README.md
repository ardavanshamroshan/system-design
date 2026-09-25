# System Design

System design and software architecture documentation, styled like Laravel docs, published on GitHub Pages.

**Site:** https://ardavanshamroshan.github.io/system-design/

## Topics

| Group | Pages |
|-------|--------|
| Fundamentals & Algorithms | Big O, Sort/Search, Common Algorithms |
| Software Patterns | CQRS, Directory Query, Cache Patterns, Outbox |
| System Architecture | API Gateway, CAP Theorem |
| Messaging | DLQ, Brokers, Acknowledgment |
| Database | Connection Pool, Locking |
| DevOps | Docker Compose Profiles |

## Local development

```bash
npm install
npm run dev
```

Build static site:

```bash
npm run build
```

## Deploy

Push to `main` deploys automatically via GitHub Actions to GitHub Pages (`base: /system-design/`).
