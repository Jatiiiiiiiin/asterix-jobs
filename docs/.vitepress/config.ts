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
      { text: '🔬 Research', link: '/research/' },
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
      {
        text: '🔬 Research Corner',
        collapsed: false,
        items: [
          { text: 'Overview & methodology', link: '/research/' },
          { text: 'EXP 1 — Matching accuracy', link: '/research/exp1-matching-accuracy' },
          { text: 'EXP 2 — AI vs TF-IDF baseline', link: '/research/exp2-model-comparison' },
          { text: 'EXP 3 — Scalability & throughput', link: '/research/exp3-scalability' },
          { text: 'EXP 4 — Component latency', link: '/research/exp4-latency' },
          { text: 'EXP 5 — Bias & fairness audit', link: '/research/exp5-bias' },
          { text: 'EXP 6 — Score distribution', link: '/research/exp6-score-distribution' },
          { text: 'EXP 7 — User capacity (M/M/c)', link: '/research/exp7-capacity' },
          { text: 'EXP 8 — Embedding cache', link: '/research/exp8-cache' },
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
