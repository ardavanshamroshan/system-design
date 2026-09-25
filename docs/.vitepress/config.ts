import { defineConfig, type DefaultTheme } from 'vitepress'

const base = '/system-design/'

const enSidebar: DefaultTheme.Sidebar = [
  {
    text: 'Fundamentals & Algorithms',
    items: [
      { text: 'Big O Notation', link: '/fundamentals/big-o' },
      { text: 'Quick Sort & Binary Search', link: '/fundamentals/sorting-search' },
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
      { text: 'Dead-Letter Queue (DLQ)', link: '/messaging/dlq' },
      { text: 'Kafka / RabbitMQ / Redis Streams', link: '/messaging/brokers' },
      { text: 'Message Acknowledgment', link: '/messaging/acknowledgment' },
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
          message: 'System Design & Software Architecture',
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
        sidebar: [
          {
            text: 'مبانی و الگوریتم‌ها',
            items: [
              { text: 'نماد Big O', link: '/fa/fundamentals/big-o' },
            ],
          },
        ],
        footer: {
          message: 'طراحی سیستم و معماری نرم‌افزار',
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
