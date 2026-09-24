import { defineConfig } from 'vitepress'

const base = '/system-design/'

export default defineConfig({
  lang: 'en-US',
  title: 'System Design',
  description: 'System design and software architecture documentation',
  base,
  cleanUrls: true,
  lastUpdated: true,

  head: [
    // Self-hosted fonts (no Google Fonts CDN) — base must be explicit in head
    ['link', { rel: 'stylesheet', href: `${base}fonts/fonts.css` }],
    ['link', { rel: 'icon', href: `${base}favicon.svg`, type: 'image/svg+xml' }],
    ['link', { rel: 'icon', href: `${base}favicon-32x32.png`, type: 'image/png', sizes: '32x32' }],
    ['link', { rel: 'icon', href: `${base}favicon.ico`, sizes: 'any' }],
    ['link', { rel: 'apple-touch-icon', href: `${base}apple-touch-icon.png` }],
    ['meta', { name: 'theme-color', content: '#f53003' }],
  ],

  markdown: {
    theme: {
      light: 'material-theme-palenight',
      dark: 'material-theme-palenight',
    },
    lineNumbers: true,
  },

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
    sidebar: [
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
    ],
    footer: {
      message: 'System Design & Software Architecture',
      copyright: 'Educational docs — free to learn and share',
    },
  },
})
