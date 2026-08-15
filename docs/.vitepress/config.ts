import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'en-US',
  title: 'Asterix Jobs Handbook',
  description: 'Documentation for Asterix Jobs — every feature end to end, plus how the platform fits together, how it deploys, and what will bite you.',
  base: '/docs/',
  outDir: '../public/docs',
  cleanUrls: true,
  appearance: true,
  lastUpdated: true,

  head: [
    ['link', { rel: 'icon', href: '/assets/logo-light.png' }],
  ],

  themeConfig: {
    logo: { light: '/assets/logo-light.png', dark: '/assets/logo-dark.png' },
    outline: [2, 3],
    search: { provider: 'local' },

    nav: [
      { text: 'Start here', link: '/' },
      { text: 'Features', link: '/features/' },
      { text: 'Platform', link: '/platform/overview' },
      { text: 'Reference', link: '/reference/frontend' },
    ],

    sidebar: [
      {
        text: 'Start here',
        items: [
          { text: 'Read this first', link: '/' },
          { text: 'Who owns what', link: '/ownership' },
        ],
      },
      {
        text: 'Features',
        collapsed: false,
        items: [
          { text: 'What is Asterix Jobs', link: '/features/' },
          { text: 'For candidates', link: '/features/candidates' },
          { text: 'Campus Connect', link: '/features/campus-connect' },
          { text: 'For recruiters', link: '/features/recruiters' },
          { text: 'Admin tools', link: '/features/admin' },
          { text: 'Plans & pricing', link: '/features/plans-pricing' },
          { text: 'Site-wide features', link: '/features/platform-wide' },
        ],
      },
      {
        text: 'Platform',
        collapsed: false,
        items: [
          { text: 'How it all fits together', link: '/platform/overview' },
          { text: 'Infrastructure & environments', link: '/platform/infrastructure' },
          { text: 'Deploy matrix', link: '/platform/deploy-matrix' },
          { text: 'Data model (Firestore)', link: '/platform/data-model' },
          { text: 'Auth & access control', link: '/platform/auth' },
          { text: 'Security model', link: '/platform/security' },
          { text: 'Gotchas that cost days', link: '/platform/gotchas' },
        ],
      },
      {
        text: 'Reference',
        collapsed: false,
        items: [
          { text: 'Frontend app', link: '/reference/frontend' },
          { text: 'AI engine (FastAPI)', link: '/reference/ai-engine' },
          { text: 'Job aggregation pipeline', link: '/reference/job-aggregation' },
          { text: 'Payments (Cashfree)', link: '/reference/payments' },
          { text: 'Scripts & maintenance tools', link: '/reference/scripts' },
        ],
      },
    ],

    docFooter: { prev: false, next: false },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/jatiiiiiiiin/asterix-job' },
    ],

    footer: {
      message: 'Internal engineering documentation — not indexed, not customer-facing.',
      copyright: 'Asterix Jobs',
    },
  },
})
