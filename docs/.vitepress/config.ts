import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type DefaultTheme } from 'vitepress'

/** Public free site uses /system-design/. Full private Pages uses /system-design-full/. */
const base = process.env.DOCS_BASE || '/system-design/'

/** When building the public teaser site, mark non-free sidebar links as ★ VIP. */
const publicFreeBuild = true /* free public artifact */

const freePathSet: Set<string> = (() => {
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    // docs/.vitepress → repo root access/free-paths.json (or docs-public sibling)
    const candidates = [
      join(here, '../../access/free-paths.json'), // repoRoot/access from docs/.vitepress
      join(here, '../access/free-paths.json'), // docs-public/access from docs-public/.vitepress
      join(here, '../../../access/free-paths.json'),
    ]
    for (const p of candidates) {
      try {
        const raw = JSON.parse(readFileSync(p, 'utf8')) as { paths: string[] }
        return new Set(
          raw.paths.map((x) => {
            let s = x.trim()
            if (!s.startsWith('/')) s = `/${s}`
            return s.length > 1 && s.endsWith('/') ? s : s.replace(/\/$/, '') || '/'
          }),
        )
      } catch {
        /* try next */
      }
    }
  } catch {
    /* ignore */
  }
  return new Set<string>()
})()

function isFreeLink(link?: string): boolean {
  if (!link) return true
  let s = link.trim()
  if (!s.startsWith('/')) s = `/${s}`
  if (s.length > 1 && s.endsWith('/')) {
    return freePathSet.has(s) || freePathSet.has(s.slice(0, -1))
  }
  return freePathSet.has(s) || freePathSet.has(`${s}/`)
}

const vipBadge =
  '<span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span>'

const authorFooterEn =
  'Built by <a href="https://ardavanshamroshan.ir" target="_blank" rel="noopener">Ardavan ShamRoshan</a> · <a href="https://github.com/ardavanshamroshan" target="_blank" rel="noopener">GitHub</a>'

const authorFooterFa =
  'ساخته‌شده توسط <a href="https://ardavanshamroshan.ir" target="_blank" rel="noopener">Ardavan ShamRoshan</a> · <a href="https://github.com/ardavanshamroshan" target="_blank" rel="noopener">GitHub</a>'

/** Matches NavNewBadge.vue — 7 days after 2026-09-27 (exclusive end of 2026-10-04 UTC). */
const NEW_UNTIL_MS = Date.UTC(2026, 9, 4, 23, 59, 59)
const showNewBadge = Date.now() <= NEW_UNTIL_MS

const newMark = (label: string) => (showNewBadge ? `${label} · New` : label)
const newMarkFa = (label: string) => (showNewBadge ? `${label} · جدید` : label)

// Mark the new service guides in both locale sidebars.
const serviceNew = (label: string, badge = 'New') =>
  `${label} <span class="sidebar-new-badge">${badge}</span>`
const serviceNewFa = (label: string) => serviceNew(label, 'جدید')

/** Importance level shown as a dot beside sidebar items: 1 = must-know, 2 = important, 3 = good to know. */
type Level = 1 | 2 | 3

interface Entry {
  en: string
  fa: string
  /** Path without locale prefix, e.g. `/database/locking`. */
  link?: string
  level?: Level
  /** Marks the handbook service guides. */
  service?: boolean
  /** Uses the time-limited "New" label. */
  recent?: boolean
  open?: boolean
  items?: Entry[]
}

const levelTitle: Record<'en' | 'fa', Record<Level, string>> = {
  en: { 1: 'Must-know', 2: 'Important', 3: 'Good to know' },
  fa: { 1: 'حیاتی', 2: 'مهم', 3: 'تکمیلی' },
}

const tree: Entry[] = [
  {
    en: 'Fundamentals & Algorithms',
    fa: 'مبانی و Algorithm',
    items: [
      {
        en: 'Complexity',
        fa: 'Complexity و تحلیل',
        open: true,
        items: [
          { en: 'Algorithm Analysis & Time Complexity', fa: 'تحلیل Algorithm و Time Complexity', link: '/fundamentals/algorithm-analysis', level: 1 },
          { en: 'Big O Notation', fa: 'نماد Big O', link: '/fundamentals/big-o', level: 1 },
        ],
      },
      {
        en: 'Problem-solving techniques',
        fa: 'روش‌های حل مسئله',
        open: true,
        items: [
          { en: 'Recursion', fa: 'Recursion', link: '/fundamentals/recursion', level: 1 },
          { en: 'Divide and Conquer', fa: 'Divide and Conquer', link: '/fundamentals/divide-and-conquer', level: 2 },
          { en: 'Greedy Algorithms', fa: 'Greedy', link: '/fundamentals/greedy', level: 2 },
          { en: 'Dynamic Programming', fa: 'Dynamic Programming', link: '/fundamentals/dynamic-programming', level: 2 },
        ],
      },
      {
        en: 'Data structures',
        fa: 'Data Structureها',
        open: true,
        items: [
          { en: 'Arrays', fa: 'Array', link: '/fundamentals/arrays', level: 1 },
          { en: 'Linked List', fa: 'Linked List', link: '/fundamentals/linked-list', level: 2 },
          { en: 'Stack', fa: 'Stack', link: '/fundamentals/stack', level: 1 },
          { en: 'Queue', fa: 'Queue', link: '/fundamentals/queue', level: 1 },
          { en: 'Hash Table', fa: 'Hash Table', link: '/fundamentals/hash-table', level: 1 },
          { en: 'Tree', fa: 'Tree', link: '/fundamentals/tree', level: 1 },
          { en: 'Graph', fa: 'Graph', link: '/fundamentals/graph', level: 1 },
        ],
      },
      {
        en: 'Search & sort',
        fa: 'Search و Sort',
        open: true,
        items: [
          { en: 'Quick / Merge Sort & Binary Search', fa: 'Quick / Merge Sort و Binary Search', link: '/fundamentals/sorting-search', level: 1 },
          { en: 'More Common Algorithms', fa: 'Algorithmهای پرکاربرد بیشتر', link: '/fundamentals/common-algorithms', level: 2 },
        ],
      },
      { en: 'Lessons + Q&A: Data Structures & Algorithms', fa: 'درس‌نامه + سؤال: Data Structure و Algorithm', link: '/fundamentals/data-structures', level: 1 },
    ],
  },
  {
    en: 'Database',
    fa: 'Database',
    items: [
      {
        en: 'Transactions & concurrency',
        fa: 'Transaction و Concurrency',
        open: true,
        items: [
          { en: 'ACID & Transactions', fa: 'ACID و Transaction', link: '/database/transactions-acid', level: 1 },
          { en: 'Isolation Levels: Anomalies & Use Cases', fa: 'Isolation Levelها: Anomalyها و Use Caseها', link: '/database/isolation-levels', level: 1 },
          { en: 'Locks & Concurrency', fa: 'Lock و Concurrency', link: '/database/concurrency-locks', level: 1 },
          { en: 'Optimistic vs Pessimistic Locking', fa: 'Optimistic و Pessimistic Locking', link: '/database/locking', level: 1 },
        ],
      },
      {
        en: 'Relational',
        fa: 'Relational',
        open: true,
        items: [
          { en: 'PostgreSQL & Database Fundamentals', fa: 'PostgreSQL و مبانی Database', link: '/database/postgresql', level: 1 },
          { en: 'Partitioning & Sharding in PostgreSQL', fa: 'Partitioning و Sharding در PostgreSQL', link: '/database/postgresql-partitioning-sharding', level: 1 },
          { en: 'MySQL Storage Engines: InnoDB vs MyISAM', fa: 'Storage Engineهای MySQL: InnoDB و MyISAM', link: '/database/mysql-storage-engines', level: 2 },
          { en: 'Connection Pooling', fa: 'Connection Pooling', link: '/database/connection-pool', level: 2 },
        ],
      },
      {
        en: 'NoSQL',
        fa: 'NoSQL',
        open: true,
        items: [
          { en: 'NoSQL: Families & Data Models', fa: 'NoSQL: خانواده‌ها و Data Modelها', link: '/database/nosql', level: 1 },
          { en: 'Redis: Data Structures, Commands & Patterns', fa: 'Redis: Data Structureها، Commandها و Patternها', link: '/database/redis', level: 1 },
          { en: 'MongoDB in Depth', fa: 'MongoDB از نزدیک', link: '/database/mongodb', level: 2 },
        ],
      },
      {
        en: 'Internals & scale',
        fa: 'Storage Engine و Scaling',
        open: true,
        items: [
          { en: 'Storage Engines & Search / Sort / Join Algorithms', fa: 'Storage Engineها و Algorithmهای Search / Sort / Join', link: '/database/storage-engines-query-algorithms', level: 2 },
          { en: 'Storage & Data Scaling', fa: 'Storage و Data Scaling', link: '/database/storage-scaling', level: 1 },
        ],
      },
    ],
  },
  {
    en: 'Messaging',
    fa: 'Messaging',
    items: [
      { en: 'Lessons + Q&A: Messaging & Event-Driven', fa: 'درس‌نامه + سؤال: Messaging و Event-Driven', link: '/messaging/event-driven', level: 1 },
      { en: 'Kafka / RabbitMQ / Redis Streams', fa: 'Kafka / RabbitMQ / Redis Streams', link: '/messaging/brokers', level: 1 },
      { en: 'Redis vs RabbitMQ vs Kafka: Delivery, Ack & Verification', fa: 'تفاوت Redis، RabbitMQ و Kafka: Delivery، Ack و Verification', link: '/messaging/redis-rabbitmq-kafka', level: 1 },
      { en: 'Message Acknowledgment', fa: 'Message Acknowledgment', link: '/messaging/acknowledgment', level: 1 },
      { en: 'Dead-Letter Queue (DLQ)', fa: 'Dead-Letter Queue (DLQ)', link: '/messaging/dlq', level: 2 },
      { en: 'Outbox Pattern', fa: 'Outbox Pattern', link: '/patterns/outbox', level: 1 },
      { en: 'Saga Pattern', fa: 'Saga Pattern', link: '/patterns/saga', level: 1, recent: true },
      { en: 'REST and AMQP', fa: 'REST و AMQP', link: '/handbook/rest-amqp', level: 2, service: true },
      { en: 'Durable Workflows and Jobs', fa: 'Durable Workflow و Job', link: '/handbook/durable-jobs', level: 2, service: true },
    ],
  },
  {
    en: 'System Design',
    fa: 'System Design',
    open: true,
    items: [
      {
        en: 'Lessons + Q&A',
        fa: 'درس‌نامه + سؤال',
        open: true,
        items: [
          { en: 'Design Principles', fa: 'Design Principles', link: '/design/principles', level: 1 },
          { en: 'Architecture Styles', fa: 'Architecture Styles', link: '/design/architecture-styles', level: 1 },
        ],
      },
      {
        en: 'Applied patterns',
        fa: 'Patternهای کاربردی',
        open: true,
        items: [
          { en: 'CQRS Light', fa: 'CQRS Light', link: '/patterns/cqrs', level: 2 },
          { en: 'Directory / Query Class', fa: 'Directory / Query Class', link: '/patterns/directory-query', level: 3 },
          { en: 'Cache Aside / Read-Write Through', fa: 'Cache Aside / Read-Write Through', link: '/patterns/cache-patterns', level: 1 },
          { en: 'Outbox Pattern', fa: 'Outbox Pattern', link: '/patterns/outbox', level: 1 },
          { en: 'Saga Pattern', fa: 'Saga Pattern', link: '/patterns/saga', level: 1, recent: true },
        ],
      },
    ],
  },
  {
    en: 'Design Patterns',
    fa: 'Design Patterns',
    open: true,
    items: [
      { en: 'Overview + Q&A', fa: 'Overview + سؤال', link: '/design/design-patterns', level: 1 },
      { en: 'Catalog (Laravel + FastAPI)', fa: 'کاتالوگ (Laravel + FastAPI)', link: '/design/gof/', level: 1, recent: true },
      {
        en: 'SOLID',
        fa: 'SOLID',
        open: true,
        items: [
          { en: 'SRP', fa: 'SRP', link: '/design/gof/solid/srp', level: 2 },
          { en: 'OCP', fa: 'OCP', link: '/design/gof/solid/ocp', level: 2 },
          { en: 'LSP', fa: 'LSP', link: '/design/gof/solid/lsp', level: 2 },
          { en: 'ISP', fa: 'ISP', link: '/design/gof/solid/isp', level: 2 },
          { en: 'DIP', fa: 'DIP', link: '/design/gof/solid/dip', level: 2 },
        ],
      },
      {
        en: 'Creational',
        fa: 'Creational',
        open: false,
        items: [
          { en: 'Factory Method', fa: 'Factory Method', link: '/design/gof/creational/factory-method', level: 2 },
          { en: 'Abstract Factory', fa: 'Abstract Factory', link: '/design/gof/creational/abstract-factory', level: 2 },
          { en: 'Builder', fa: 'Builder', link: '/design/gof/creational/builder', level: 2 },
          { en: 'Prototype', fa: 'Prototype', link: '/design/gof/creational/prototype', level: 2 },
          { en: 'Singleton', fa: 'Singleton', link: '/design/gof/creational/singleton', level: 2 },
        ],
      },
      {
        en: 'Structural',
        fa: 'Structural',
        open: false,
        items: [
          { en: 'Adapter', fa: 'Adapter', link: '/design/gof/structural/adapter', level: 2 },
          { en: 'Bridge', fa: 'Bridge', link: '/design/gof/structural/bridge', level: 2 },
          { en: 'Composite', fa: 'Composite', link: '/design/gof/structural/composite', level: 2 },
          { en: 'Decorator', fa: 'Decorator', link: '/design/gof/structural/decorator', level: 2 },
          { en: 'Facade', fa: 'Facade', link: '/design/gof/structural/facade', level: 2 },
          { en: 'Flyweight', fa: 'Flyweight', link: '/design/gof/structural/flyweight', level: 2 },
          { en: 'Proxy', fa: 'Proxy', link: '/design/gof/structural/proxy', level: 2 },
        ],
      },
      {
        en: 'Behavioral',
        fa: 'Behavioral',
        open: false,
        items: [
          { en: 'Chain of Responsibility', fa: 'Chain of Responsibility', link: '/design/gof/behavioral/chain-of-responsibility', level: 2 },
          { en: 'Command', fa: 'Command', link: '/design/gof/behavioral/command', level: 2 },
          { en: 'Iterator', fa: 'Iterator', link: '/design/gof/behavioral/iterator', level: 2 },
          { en: 'Mediator', fa: 'Mediator', link: '/design/gof/behavioral/mediator', level: 2 },
          { en: 'Memento', fa: 'Memento', link: '/design/gof/behavioral/memento', level: 2 },
          { en: 'Observer', fa: 'Observer', link: '/design/gof/behavioral/observer', level: 2 },
          { en: 'State', fa: 'State', link: '/design/gof/behavioral/state', level: 2 },
          { en: 'Strategy', fa: 'Strategy', link: '/design/gof/behavioral/strategy', level: 2 },
          { en: 'Template Method', fa: 'Template Method', link: '/design/gof/behavioral/template-method', level: 2 },
          { en: 'Visitor', fa: 'Visitor', link: '/design/gof/behavioral/visitor', level: 2 },
        ],
      },
    ],
  },
  {
    en: 'System Architecture',
    fa: 'System Architecture',
    items: [
      {
        en: 'Lessons + Q&A',
        fa: 'درس‌نامه + سؤال',
        open: true,
        items: [
          { en: 'System Design & Distributed Systems', fa: 'System Design و Distributed Systems', link: '/architecture/distributed-systems', level: 1 },
          { en: 'Microservices & Resilience', fa: 'Microservice و Resilience', link: '/architecture/microservices', level: 1 },
        ],
      },
      { en: 'Fallacies & PACELC', fa: 'Fallacyها و PACELC', link: '/architecture/fallacies-pacelc', level: 2, recent: true },
      { en: 'CAP Theorem', fa: 'CAP Theorem', link: '/architecture/cap-theorem', level: 1 },
      { en: 'Replication', fa: 'Replication', link: '/architecture/replication', level: 1, recent: true },
      { en: 'Resilience Patterns', fa: 'Resilience Patterns', link: '/architecture/resilience', level: 1, recent: true },
      {
        en: 'API Gateway',
        fa: 'API Gateway',
        open: true,
        items: [
          { en: 'Foundations', fa: 'مبانی', link: '/architecture/api-gateway', level: 2 },
          { en: 'Contracts and procedures', fa: 'قراردادها و روش اجرا', link: '/handbook/api-gateway', level: 3, service: true },
        ],
      },
    ],
  },
  {
    en: 'Security',
    fa: 'Security',
    items: [
      { en: 'Lessons + Q&A: Security', fa: 'درس‌نامه + سؤال: Security', link: '/security/application-security', level: 1 },
      {
        en: 'Authentication',
        fa: 'Authentication',
        open: true,
        items: [
          { en: 'JWT and JWKS', fa: 'JWT و JWKS', link: '/handbook/jwt-jwks', level: 1, service: true },
          { en: 'Site-to-site mTLS', fa: 'mTLS بین سایت‌ها', link: '/handbook/mtls', level: 2, service: true },
        ],
      },
    ],
  },
  {
    en: 'Networking',
    fa: 'Networking',
    items: [
      { en: 'IP, Subnets, Routing, NAT & DNS', fa: 'IP، Subnet، Routing، NAT و DNS', link: '/networking/ip-nat-dns', level: 1 },
      { en: 'TCP, UDP, TLS/SSL, HTTP & HTTPS', fa: 'TCP، UDP، TLS/SSL، HTTP و HTTPS', link: '/networking/tcp-tls-http', level: 1 },
      { en: 'Telnet, SSH & Debugging Tools', fa: 'Telnet، SSH و ابزارهای Debug', link: '/networking/remote-access-tools', level: 2 },
      { en: 'Container & Kubernetes Networking', fa: 'Networking در Container و Kubernetes', link: '/networking/kubernetes-networking', level: 2 },
      { en: 'Lessons + Q&A: Networking', fa: 'درس‌نامه + سؤال: Networking', link: '/networking/fundamentals', level: 1 },
    ],
  },
  {
    en: 'Languages',
    fa: 'زبان‌ها',
    items: [
      { en: 'Go', fa: 'زبان Go', link: '/languages/go', level: 1 },
      { en: 'PHP', fa: 'زبان PHP', link: '/languages/php', level: 1 },
    ],
  },
  {
    en: 'AI & LLMs',
    fa: 'AI و LLM',
    items: [{ en: 'Lessons + Q&A: AI & LLMs', fa: 'درس‌نامه + سؤال: AI و LLM', link: '/ai/llm', level: 2 }],
  },
  {
    en: 'DevOps & Observability',
    fa: 'DevOps و Observability',
    items: [
      { en: 'Lessons + Q&A: Observability, Delivery & Testing', fa: 'درس‌نامه + سؤال: Observability، Delivery و Testing', link: '/devops/observability-delivery-testing', level: 1 },
      { en: 'Health Checks: Types & Scenarios', fa: 'Health Check: انواع و Scenarioها', link: '/devops/health-checks', level: 1 },
      { en: 'JSON Logs, Sentry & ClickStack', fa: 'JSON Log، Sentry و ClickStack', link: '/handbook/observability', level: 2, service: true },
      { en: 'Docker, Octane & Application Workers', fa: 'Docker، Octane و Application Workerها', link: '/handbook/docker-octane', level: 2, service: true },
      { en: 'Traefik on Docker', fa: 'Traefik روی Docker', link: '/handbook/traefik-docker', level: 3, service: true },
      { en: 'Compose Profiles & Profiling', fa: 'Compose Profiles و Profiling', link: '/devops/docker-compose-profiles', level: 3 },
    ],
  },
  {
    en: 'Case Studies & Scenarios',
    fa: 'Case Study و Scenario',
    items: [
      { en: 'System Design Scenarios', fa: 'System Design Scenarios', link: '/case-studies/system-design-scenarios', level: 1 },
      { en: 'Notification Service (Durable Workflow)', fa: 'Notification Service (Durable Workflow)', link: '/case-studies/notification-service', level: 2 },
    ],
  },
  {
    en: 'Interview Q&A & Resources',
    fa: 'بانک سؤال و منابع',
    items: [
      { en: 'All questions by topic', fa: 'فهرست همهٔ سؤال‌ها', link: '/interview/' },
      { en: 'Service engineering handbook', fa: 'Service Engineering Handbook', link: '/handbook/' },
      { en: 'References', fa: 'منابع', link: '/resources/references' },
    ],
  },
]

function buildSidebar(locale: 'en' | 'fa', entries: Entry[], top = true): DefaultTheme.SidebarItem[] {
  const prefix = locale === 'fa' ? '/fa' : ''
  return entries.map((e) => {
    const locked = publicFreeBuild && !!e.link && !isFreeLink(e.link)
    let text = e[locale]
    if (e.recent) text = locale === 'fa' ? newMarkFa(text) : newMark(text)
    if (e.service) text = locale === 'fa' ? serviceNewFa(text) : serviceNew(text)
    if (locked) {
      text = `<span class="vip-locked">${text} ${vipBadge}</span>`
    }
    if (e.level) {
      const title = levelTitle[locale][e.level]
      text = `<span class="sidebar-lvl sidebar-lvl--${e.level}" title="${title}" aria-label="${title}"></span>${text}`
    }
    const item: DefaultTheme.SidebarItem = { text }
    // Free build: VIP topics stay visible in the menu but have no page/link.
    if (e.link && !locked) item.link = prefix + e.link
    if (e.items) {
      item.items = buildSidebar(locale, e.items, false)
      // Honor `open` even on top-level groups (otherwise everything stays collapsed).
      item.collapsed = e.open != null ? !e.open : top
    }
    return item
  })
}

const enSidebar: DefaultTheme.Sidebar = buildSidebar('en', tree)
const faSidebar: DefaultTheme.Sidebar = buildSidebar('fa', tree)

const enNav: DefaultTheme.NavItem[] = [
  { text: 'Docs', link: '/fundamentals/algorithm-analysis' },
  { text: 'Interview Q&A', link: '/interview/' },
  { text: 'Handbook', link: '/handbook/' },
  { text: 'GitHub', link: 'https://github.com/ardavanshamroshan/system-design' },
]

const faNav: DefaultTheme.NavItem[] = [
  { text: 'مستندات', link: '/fa/fundamentals/algorithm-analysis' },
  { text: 'بانک سؤال', link: '/fa/interview/' },
  { text: 'راهنمای اجرا', link: '/fa/handbook/' },
  { text: 'GitHub', link: 'https://github.com/ardavanshamroshan/system-design' },
]

export default defineConfig({
  ignoreDeadLinks: true,
  title: 'System Design',
  description: 'System design and software architecture documentation',
  base,
  themeConfig: {
    search: { provider: 'local', options: { detailedView: true } },
  },
  cleanUrls: true,
  lastUpdated: true,

  head: [
    ['link', { rel: 'stylesheet', href: `${base}fonts/fonts.css` }],
    ['link', { rel: 'icon', href: `${base}favicon-32x32.png`, type: 'image/png', sizes: '32x32' }],
    ['link', { rel: 'icon', href: `${base}favicon-16x16.png`, type: 'image/png', sizes: '16x16' }],
    ['link', { rel: 'icon', href: `${base}favicon.ico`, sizes: 'any' }],
    ['link', { rel: 'apple-touch-icon', href: `${base}apple-touch-icon.png`, sizes: '180x180' }],
    ['meta', { name: 'theme-color', content: '#f53003' }],
  ],

  markdown: {
    theme: {
      light: 'github-light-high-contrast',
      dark: 'github-dark',
    },
    lineNumbers: true,
  },

  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      title: 'System Design',
      description: 'System design and software architecture documentation',
      themeConfig: {
        logo: { light: '/logo.svg', dark: '/logo.svg' },
        siteTitle: 'System Design',
        outline: {
          label: 'On this page',
          level: [2, 3],
        },
        search: {
          provider: 'local',
          options: {
            detailedView: true,
          },
        },
        nav: enNav,
        socialLinks: [
          { icon: 'github', link: 'https://github.com/ardavanshamroshan/system-design' },
        ],
        sidebar: enSidebar,
        footer: {
          message: authorFooterEn,
          copyright: 'Educational docs — free to learn and share',
        },
      },
    },
    fa: {
      label: 'فارسی',
      lang: 'fa-IR',
      dir: 'rtl',
      title: 'طراحی سیستم',
      description: 'مستندات طراحی سیستم و معماری نرم‌افزار',
      themeConfig: {
        logo: { light: '/logo.svg', dark: '/logo.svg' },
        siteTitle: 'طراحی سیستم',
        outline: {
          label: 'در این صفحه',
          level: [2, 3],
        },
        search: {
          provider: 'local',
          options: {
            detailedView: true,
            translations: {
              button: { buttonText: 'جستجو', buttonAriaLabel: 'جستجو' },
              modal: {
                displayDetails: 'نمایش جزئیات',
                resetButtonTitle: 'پاک کردن',
                backButtonTitle: 'بازگشت',
                noResultsText: 'نتیجه‌ای نبود',
                footer: { selectText: 'انتخاب', navigateText: 'جابه‌جایی', closeText: 'بستن' },
              },
            },
          },
        },
        nav: faNav,
        socialLinks: [
          { icon: 'github', link: 'https://github.com/ardavanshamroshan/system-design' },
        ],
        sidebar: faSidebar,
        footer: {
          message: authorFooterFa,
          copyright: 'مستندات آموزشی — آزاد برای یادگیری و اشتراک',
        },
        darkModeSwitchLabel: 'ظاهر',
        lightModeSwitchTitle: 'حالت روشن',
        darkModeSwitchTitle: 'حالت تاریک',
        sidebarMenuLabel: 'منو',
        returnToTopLabel: 'بازگشت به بالا',
        langMenuLabel: 'تغییر زبان',
        lastUpdated: {
          text: 'آخرین به‌روزرسانی',
        },
        docFooter: {
          prev: 'قبلی',
          next: 'بعدی',
        },
      },
    },
  },
})
