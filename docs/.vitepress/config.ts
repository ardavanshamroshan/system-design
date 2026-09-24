import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'fa-IR',
  title: 'System Design',
  description: 'مستندات طراحی سیستم و معماری نرم‌افزار',
  base: '/system-design/',
  cleanUrls: true,
  lastUpdated: true,

  head: [
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    [
      'link',
      {
        href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap',
        rel: 'stylesheet',
      },
    ],
    ['meta', { name: 'theme-color', content: '#f53003' }],
  ],

  themeConfig: {
    logo: { light: '/logo.svg', dark: '/logo.svg' },
    siteTitle: 'System Design',
    outline: {
      label: 'در این صفحه',
      level: [2, 3],
    },
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: 'جستجو', buttonAriaLabel: 'جستجو' },
          modal: {
            noResultsText: 'نتیجه‌ای پیدا نشد',
            resetButtonTitle: 'پاک کردن',
            footer: { selectText: 'انتخاب', navigateText: 'پیمایش', closeText: 'بستن' },
          },
        },
      },
    },
    nav: [
      { text: 'مستندات', link: '/fundamentals/big-o' },
      { text: 'GitHub', link: 'https://github.com/ardavanshamroshan/system-design' },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/ardavanshamroshan/system-design' },
    ],
    sidebar: [
      {
        text: 'مقدمات و الگوریتم',
        items: [
          { text: 'Big O Notation', link: '/fundamentals/big-o' },
          { text: 'Quick Sort و Binary Search', link: '/fundamentals/sorting-search' },
        ],
      },
      {
        text: 'الگوهای نرم‌افزاری',
        items: [
          { text: 'CQRS و الگوهای سبک', link: '/patterns/cqrs' },
          { text: 'Directory Query Class', link: '/patterns/directory-query' },
          { text: 'Cache Aside / Read-Write Through', link: '/patterns/cache-patterns' },
          { text: 'Outbox Pattern', link: '/patterns/outbox' },
        ],
      },
      {
        text: 'معماری سیستم',
        items: [
          { text: 'API Gateway', link: '/architecture/api-gateway' },
          { text: 'CAP Theorem', link: '/architecture/cap-theorem' },
        ],
      },
      {
        text: 'پیام‌رسانی',
        items: [
          { text: 'Dead-Letter Queue (DLQ)', link: '/messaging/dlq' },
          { text: 'Kafka / RabbitMQ / Redis Streams', link: '/messaging/brokers' },
          { text: 'Message Acknowledgment', link: '/messaging/acknowledgment' },
        ],
      },
      {
        text: 'پایگاه داده',
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
    ],
    footer: {
      message: 'System Design & Software Architecture',
      copyright: 'مستندات آموزشی — آزاد برای یادگیری و اشتراک',
    },
    docFooter: {
      prev: 'قبلی',
      next: 'بعدی',
    },
    darkModeSwitchLabel: 'تم',
    lightModeSwitchTitle: 'حالت روشن',
    darkModeSwitchTitle: 'حالت تاریک',
    sidebarMenuLabel: 'منو',
    returnToTopLabel: 'بازگشت به بالا',
  },
})
