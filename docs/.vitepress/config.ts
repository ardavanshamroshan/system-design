import { defineConfig, type DefaultTheme } from 'vitepress'

const base = '/system-design/'

const authorFooterEn =
  'Built by <a href="https://ardavanshamroshan.ir" target="_blank" rel="noopener">Ardavan ShamRoshan</a> · <a href="https://github.com/ardavanshamroshan" target="_blank" rel="noopener">GitHub</a>'

const authorFooterFa =
  'ساخته‌شده توسط <a href="https://ardavanshamroshan.ir" target="_blank" rel="noopener">Ardavan ShamRoshan</a> · <a href="https://github.com/ardavanshamroshan" target="_blank" rel="noopener">GitHub</a>'

const enSidebar: DefaultTheme.Sidebar = [
  {
    text: 'Fundamentals & Algorithms',
    items: [
      { text: 'Big O Notation', link: '/fundamentals/big-o' },
      { text: 'Quick / Merge Sort & Binary Search', link: '/fundamentals/sorting-search' },
      { text: 'More Common Algorithms', link: '/fundamentals/common-algorithms' },
    ],
  },
  {
    text: 'Software Patterns',
    items: [
      { text: 'CQRS & Light Patterns', link: '/patterns/cqrs' },
      { text: 'Directory Query Class', link: '/patterns/directory-query' },
      { text: 'Cache Aside / Read-Write Through', link: '/patterns/cache-patterns' },
      { text: 'Outbox Pattern', link: '/patterns/outbox' },
    ],
  },
  {
    text: 'System Architecture',
    items: [
      { text: 'API Gateway', link: '/architecture/api-gateway' },
      { text: 'CAP Theorem', link: '/architecture/cap-theorem' },
    ],
  },
  {
    text: 'Messaging',
    items: [
      { text: 'Kafka / RabbitMQ / Redis Streams', link: '/messaging/brokers' },
      { text: 'Message Acknowledgment', link: '/messaging/acknowledgment' },
      { text: 'Dead-Letter Queue (DLQ)', link: '/messaging/dlq' },
      { text: 'Outbox Pattern', link: '/patterns/outbox' },
    ],
  },
  {
    text: 'Database',
    items: [
      { text: 'Connection Pooling', link: '/database/connection-pool' },
      { text: 'Optimistic vs Pessimistic Locking', link: '/database/locking' },
    ],
  },
  {
    text: 'DevOps',
    items: [
      { text: 'Docker Compose Environments', link: '/devops/docker-compose-profiles' },
    ],
  },
]

const faSidebar: DefaultTheme.Sidebar = [
  {
    text: 'مبانی و الگوریتم‌ها',
    items: [
      { text: 'نماد Big O', link: '/fa/fundamentals/big-o' },
      { text: 'Quick / Merge Sort و Binary Search', link: '/fa/fundamentals/sorting-search' },
      { text: 'الگوریتم‌های پرکاربرد بیشتر', link: '/fa/fundamentals/common-algorithms' },
    ],
  },
  {
    text: 'الگوهای نرم‌افزاری',
    items: [
      { text: 'CQRS و الگوهای سبک', link: '/fa/patterns/cqrs' },
      { text: 'کلاس Directory Query', link: '/fa/patterns/directory-query' },
      { text: 'Cache Aside / Read-Write Through', link: '/fa/patterns/cache-patterns' },
      { text: 'الگوی Outbox', link: '/fa/patterns/outbox' },
    ],
  },
  {
    text: 'معماری سیستم',
    items: [
      { text: 'API Gateway', link: '/fa/architecture/api-gateway' },
      { text: 'قضیه CAP', link: '/fa/architecture/cap-theorem' },
    ],
  },
  {
    text: 'پیام‌رسانی',
    items: [
      { text: 'Kafka / RabbitMQ / Redis Streams', link: '/fa/messaging/brokers' },
      { text: 'تأیید پیام (Ack)', link: '/fa/messaging/acknowledgment' },
      { text: 'صف Dead-Letter (DLQ)', link: '/fa/messaging/dlq' },
      { text: 'الگوی Outbox', link: '/fa/patterns/outbox' },
    ],
  },
  {
    text: 'دیتابیس',
    items: [
      { text: 'Connection Pooling', link: '/fa/database/connection-pool' },
      { text: 'قفل Optimistic و Pessimistic', link: '/fa/database/locking' },
    ],
  },
  {
    text: 'DevOps',
    items: [
      { text: 'محیط‌های Docker Compose', link: '/fa/devops/docker-compose-profiles' },
    ],
  },
]

export default defineConfig({
  title: 'System Design',
  description: 'System design and software architecture documentation',
  base,
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
      light: 'material-theme-palenight',
      dark: 'material-theme-palenight',
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
        nav: [
          { text: 'Docs', link: '/fundamentals/big-o' },
          { text: 'GitHub', link: 'https://github.com/ardavanshamroshan/system-design' },
        ],
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
        nav: [
          { text: 'مستندات', link: '/fa/fundamentals/big-o' },
          { text: 'GitHub', link: 'https://github.com/ardavanshamroshan/system-design' },
        ],
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
