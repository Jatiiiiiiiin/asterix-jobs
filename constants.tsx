import { Job, Candidate } from './types';

export const MOCK_JOBS: Job[] = [
  {
    id: 'primus-perfect-match',
    title: 'Junior Software Engineer – AI & Web Systems',
    department: 'Engineering',
    company: {
      name: 'Primus Software Solutions Pvt. Ltd.',
      industry: 'AI & SaaS',
      website: 'https://primussoftware.in',
      headquarters: 'Ghaziabad, India',
      size: '100-250 employees',
      founded: 2016
    },
    location: {
      type: 'Hybrid',
      city: 'Ghaziabad',
      remoteAllowed: true
    },
    employmentType: 'Full-time',
    salaryRange: {
      min: 1400000,
      max: 2000000,
      currency: 'INR'
    },
    experienceRequired: '0-2 Years',
    educationRequired: 'B.Tech / MCA (CS/IT)',
    openings: 2,
    jobSummary:
      'We are seeking a highly motivated Junior Software Engineer to contribute to AI-driven web applications and real-time systems. The role involves frontend development, backend integrations, and building scalable cloud-native applications.',
    responsibilities: [
      'Develop scalable frontend applications using React.js',
      'Implement real-time features using Firebase Firestore and Auth',
      'Integrate RESTful APIs and AI-based backend services',
      'Build modular and reusable UI components',
      'Optimize application performance and improve Lighthouse scores',
      'Participate in code reviews and agile sprint cycles',
      'Write unit and integration tests'
    ],
    requiredSkills: [
      'React.js',
      'Firebase (Firestore & Auth)',
      'JavaScript / TypeScript',
      'Python',
      'Git & GitHub',
      'Data Structures & Algorithms'
    ],
    preferredSkills: [
      'Razorpay Integration',
      'Tailwind CSS',
      'REST API Design',
      'Basic DevOps knowledge',
      'CI/CD familiarity'
    ],
    techStack: [
      'React',
      'Firebase',
      'Node.js',
      'Python',
      'GitHub Actions'
    ],
    benefits: [
      'Equity Options',
      'Flexible Remote Policy',
      'Learning & Certification Stipend',
      'Performance Bonus',
      'Paid Annual Leaves (20 days)'
    ],
    hiringProcess: [
      'Resume Screening',
      'Technical Assignment',
      'DSA Round',
      'Technical Interview',
      'HR Discussion'
    ],
    postedDate: '2026-02-01',
    applicationDeadline: '2026-03-15',
    matchScore: 0
  },
  {
    id: 'kognetics-prompt-eng-002',
    title: 'Prompt Engineer – Generative AI Products',
    department: 'AI Research',
    company: {
      name: 'Kognetics AI Labs Pvt. Ltd.',
      industry: 'Generative AI',
      website: 'https://kognetics.ai',
      headquarters: 'Bengaluru, India',
      size: '50-100 employees',
      founded: 2022
    },
    location: {
      type: 'Remote',
      city: 'Bengaluru',
      remoteAllowed: true
    },
    employmentType: 'Full-time',
    salaryRange: {
      min: 1200000,
      max: 1800000,
      currency: 'INR'
    },
    experienceRequired: '1-3 Years',
    educationRequired: 'B.Tech / B.Sc. (CS / AI / Linguistics)',
    openings: 3,
    jobSummary:
      'Join our AI Research team to design, test, and iterate on prompts for large language models powering our SaaS suite. You will work closely with product and engineering teams to improve LLM output quality across diverse enterprise use cases.',
    responsibilities: [
      'Design and optimize prompts for GPT-4, Claude, and Gemini models',
      'Build and maintain prompt libraries and internal testing frameworks',
      'Collaborate with ML engineers on fine-tuning and retrieval strategies',
      'Evaluate model outputs using automated and human feedback pipelines',
      'Iterate on chain-of-thought and few-shot prompting approaches',
      'Document prompt patterns, anti-patterns, and best practices',
      'A/B test prompt variations for production features'
    ],
    requiredSkills: [
      'Prompt Engineering',
      'LLM APIs (OpenAI / Anthropic / Google)',
      'Python',
      'JSON / YAML',
      'Technical Writing',
      'Data Structures & Algorithms'
    ],
    preferredSkills: [
      'LangChain',
      'RAG Pipelines',
      'Semantic Search',
      'Hugging Face Transformers',
      'Vector Databases (Pinecone / Weaviate)'
    ],
    techStack: [
      'OpenAI API',
      'Anthropic Claude',
      'LangChain',
      'Pinecone',
      'Python'
    ],
    benefits: [
      '100% Remote',
      'Health Insurance',
      'Conference & Learning Budget',
      'Flexible Hours',
      'ESOPs'
    ],
    hiringProcess: [
      'Resume Screening',
      'Prompt Challenge Assignment',
      'Technical Interview',
      'Culture Fit Round',
      'HR Discussion'
    ],
    postedDate: '2026-02-05',
    applicationDeadline: '2026-03-20',
    matchScore: 0
  },
  {
    id: 'synaptiq-ml-engineer-003',
    title: 'ML Engineer – LLM Fine-Tuning & Deployment',
    department: 'Machine Learning',
    company: {
      name: 'Synaptiq Technologies Pvt. Ltd.',
      industry: 'MLOps / AI Infrastructure',
      website: 'https://synaptiq.tech',
      headquarters: 'Hyderabad, India',
      size: '250-500 employees',
      founded: 2019
    },
    location: {
      type: 'Hybrid',
      city: 'Hyderabad',
      remoteAllowed: false
    },
    employmentType: 'Full-time',
    salaryRange: {
      min: 2000000,
      max: 3500000,
      currency: 'INR'
    },
    experienceRequired: '2-4 Years',
    educationRequired: 'B.Tech / M.Tech (CS / AI / ML)',
    openings: 1,
    jobSummary:
      'We are looking for an ML Engineer with hands-on experience in fine-tuning and deploying large language models at scale. You will own the model lifecycle from experimentation to production, including quantization, RLHF pipelines, and serving infrastructure.',
    responsibilities: [
      'Fine-tune open-source LLMs (LLaMA, Mistral, Falcon) using LoRA and QLoRA',
      'Set up RLHF and DPO pipelines with human feedback integration',
      'Deploy models using vLLM, TensorRT-LLM, or Text Generation Inference',
      'Monitor model drift, latency, and performance in production',
      'Optimize inference throughput via quantization and batching',
      'Collaborate with data teams on dataset curation and annotation',
      'Write reproducible training scripts and experiment reports'
    ],
    requiredSkills: [
      'PyTorch',
      'Hugging Face Transformers',
      'LoRA / QLoRA',
      'CUDA / GPU Programming',
      'Python',
      'Docker'
    ],
    preferredSkills: [
      'vLLM',
      'TensorRT-LLM',
      'RLHF / DPO',
      'Kubernetes',
      'Weights & Biases / MLflow'
    ],
    techStack: [
      'PyTorch',
      'Hugging Face',
      'vLLM',
      'Docker',
      'Kubernetes',
      'AWS SageMaker'
    ],
    benefits: [
      'Relocation Assistance',
      'GPU Cloud Credits',
      'Research Publication Support',
      'Performance Bonus',
      'Health & Dental Insurance'
    ],
    hiringProcess: [
      'Resume Screening',
      'ML Take-home Project',
      'System Design Round',
      'Technical Deep-dive',
      'HR Discussion'
    ],
    postedDate: '2026-01-28',
    applicationDeadline: '2026-03-10',
    matchScore: 0
  },
  {
    id: 'mindfulai-fullstack-genai-004',
    title: 'Full-Stack Developer – AI-Powered Applications',
    department: 'Engineering',
    company: {
      name: 'Mindful AI Solutions Pvt. Ltd.',
      industry: 'HealthTech / Generative AI',
      website: 'https://mindfulai.in',
      headquarters: 'Pune, India',
      size: '25-50 employees',
      founded: 2023
    },
    location: {
      type: 'Remote',
      city: 'Pune',
      remoteAllowed: true
    },
    employmentType: 'Full-time',
    salaryRange: {
      min: 1600000,
      max: 2400000,
      currency: 'INR'
    },
    experienceRequired: '1-3 Years',
    educationRequired: 'B.Tech / MCA (CS/IT)',
    openings: 2,
    jobSummary:
      'Build next-generation mental health applications powered by conversational AI and generative interfaces. You will develop full-stack features from GPT-integrated chat interfaces to analytics dashboards, shipping fast in a high-ownership startup environment.',
    responsibilities: [
      'Build React/Next.js frontends with streaming LLM API integrations',
      'Develop FastAPI or Node.js backends serving AI-generated content',
      'Implement RAG pipelines for context-aware therapeutic conversations',
      'Design and maintain PostgreSQL and vector database schemas',
      'Ship features end-to-end including tests and CI/CD pipelines',
      'Ensure HIPAA-compliant data handling and encryption practices',
      'Participate in daily standups and weekly product reviews'
    ],
    requiredSkills: [
      'React.js / Next.js',
      'Node.js / FastAPI',
      'PostgreSQL',
      'OpenAI / Anthropic APIs',
      'TypeScript',
      'Git & GitHub'
    ],
    preferredSkills: [
      'LangChain',
      'pgvector / Supabase',
      'Vercel',
      'WebSockets / Server-Sent Events',
      'CI/CD familiarity'
    ],
    techStack: [
      'Next.js',
      'FastAPI',
      'Supabase',
      'pgvector',
      'OpenAI API',
      'Vercel'
    ],
    benefits: [
      'Fully Remote',
      'Mental Wellness Days (12/yr)',
      'Learning & Certification Stipend',
      'Stock Options',
      'Flexible Hours'
    ],
    hiringProcess: [
      'Resume Screening',
      'Pair Programming Session',
      'System Design Round',
      'Founder Interview',
      'HR Discussion'
    ],
    postedDate: '2026-02-08',
    applicationDeadline: '2026-03-25',
    matchScore: 0
  },
  {
    id: 'nexascale-backend-ai-005',
    title: 'Backend Engineer – AI Inference & APIs',
    department: 'Platform Engineering',
    company: {
      name: 'NexaScale Systems Pvt. Ltd.',
      industry: 'AI Infrastructure / SaaS',
      website: 'https://nexascale.io',
      headquarters: 'Delhi NCR, India',
      size: '50-100 employees',
      founded: 2020
    },
    location: {
      type: 'Hybrid',
      city: 'Delhi NCR',
      remoteAllowed: true
    },
    employmentType: 'Full-time',
    salaryRange: {
      min: 1800000,
      max: 2800000,
      currency: 'INR'
    },
    experienceRequired: '2-4 Years',
    educationRequired: 'B.Tech (CS/IT)',
    openings: 2,
    jobSummary:
      'Design and operate the backend infrastructure that serves millions of AI inference requests daily. You will build high-performance API gateways, intelligent model routing, rate limiting, and observability tooling for our multi-tenant GenAI platform.',
    responsibilities: [
      'Build and maintain high-throughput inference APIs in Python or Go',
      'Implement intelligent model routing and provider failover logic',
      'Design rate limiting, caching, and cost-tracking systems',
      'Integrate with multiple LLM providers including OpenAI, Anthropic, and Gemini',
      'Build usage analytics and billing metering pipelines',
      'Set up Prometheus and Grafana dashboards for API observability',
      'Ensure 99.99% uptime SLAs with on-call rotation'
    ],
    requiredSkills: [
      'Python / Go',
      'FastAPI / Gin',
      'Redis',
      'PostgreSQL',
      'Docker / Kubernetes',
      'REST API Design'
    ],
    preferredSkills: [
      'LLM Provider APIs',
      'Apache Kafka',
      'Prometheus / Grafana',
      'AWS / GCP',
      'gRPC'
    ],
    techStack: [
      'Python',
      'Go',
      'Redis',
      'Kafka',
      'Kubernetes',
      'Prometheus',
      'AWS'
    ],
    benefits: [
      'Stock Options',
      'On-call Bonus',
      'Cloud Certification Sponsorship',
      'Flexible Remote Policy',
      'Annual Company Retreat'
    ],
    hiringProcess: [
      'Resume Screening',
      'Backend Coding Round',
      'System Design Interview',
      'Technical Panel',
      'HR Discussion'
    ],
    postedDate: '2026-01-25',
    applicationDeadline: '2026-03-12',
    matchScore: 0
  },
  {
    id: 'insightgen-data-scientist-006',
    title: 'Data Scientist – NLP & Generative Models',
    department: 'Data Science',
    company: {
      name: 'InsightGen Analytics Pvt. Ltd.',
      industry: 'Data & Analytics / AI',
      website: 'https://insightgen.in',
      headquarters: 'Mumbai, India',
      size: '100-250 employees',
      founded: 2018
    },
    location: {
      type: 'Hybrid',
      city: 'Mumbai',
      remoteAllowed: true
    },
    employmentType: 'Full-time',
    salaryRange: {
      min: 1800000,
      max: 3000000,
      currency: 'INR'
    },
    experienceRequired: '2-5 Years',
    educationRequired: 'M.Tech / M.Sc. (AI / ML / Statistics)',
    openings: 2,
    jobSummary:
      'Apply NLP and generative AI techniques to extract actionable insights from unstructured business data at scale. You will develop text classification, summarization, and information extraction models, and integrate them directly into our BI and analytics products.',
    responsibilities: [
      'Build NLP pipelines for text classification and named entity extraction',
      'Develop and evaluate generative summarization and Q&A models',
      'Design RAG systems for document search and knowledge retrieval products',
      'Conduct statistical analysis and ablation studies on model outputs',
      'Present model findings and performance metrics to business stakeholders',
      'Maintain model versioning, experiment tracking, and reproducibility',
      'Write data preprocessing pipelines for structured and unstructured sources'
    ],
    requiredSkills: [
      'Python',
      'NLP (spaCy / NLTK)',
      'Hugging Face Transformers',
      'Scikit-learn',
      'SQL',
      'Data Structures & Algorithms'
    ],
    preferredSkills: [
      'LLM Fine-tuning',
      'Vector Databases (Qdrant / Chroma)',
      'Apache Spark / Databricks',
      'MLflow',
      'LangChain'
    ],
    techStack: [
      'Python',
      'Hugging Face',
      'LangChain',
      'Qdrant',
      'Databricks',
      'MLflow'
    ],
    benefits: [
      'Research Publication Bonus',
      'Conference Sponsorship',
      'Flexible Work from Home',
      'Health Insurance (Family)',
      'Performance Bonus'
    ],
    hiringProcess: [
      'Resume Screening',
      'Take-home NLP Assignment',
      'Technical Interview',
      'Leadership Round',
      'HR Discussion'
    ],
    postedDate: '2026-02-10',
    applicationDeadline: '2026-04-01',
    matchScore: 0
  },
  {
    id: 'vectara-genai-product-mgr-007',
    title: 'Product Manager – Generative AI Features',
    department: 'Product',
    company: {
      name: 'Vectara India Pvt. Ltd.',
      industry: 'Enterprise AI / NLP',
      website: 'https://vectara.com',
      headquarters: 'Noida, India',
      size: '100-250 employees',
      founded: 2021
    },
    location: {
      type: 'Hybrid',
      city: 'Noida',
      remoteAllowed: true
    },
    employmentType: 'Full-time',
    salaryRange: {
      min: 2500000,
      max: 4000000,
      currency: 'INR'
    },
    experienceRequired: '3-6 Years',
    educationRequired: 'B.Tech + MBA (preferred)',
    openings: 1,
    jobSummary:
      'Drive the product roadmap for our flagship Generative AI features including RAG-powered search, AI summarization, and conversational assistants. You will work at the intersection of customer needs, AI capabilities, and engineering delivery to ship meaningful GenAI products.',
    responsibilities: [
      'Own and prioritize the product roadmap for GenAI features',
      'Conduct user research and translate pain points into problem statements',
      'Write detailed PRDs for AI-driven workflows and agent features',
      'Coordinate with ML, engineering, and design teams across sprint cycles',
      'Define success metrics, run experiments, and analyze outcomes',
      'Represent product strategy in executive and customer-facing meetings',
      'Monitor competitor GenAI product developments and market trends'
    ],
    requiredSkills: [
      'Product Management',
      'AI / ML Fundamentals',
      'Data Analysis',
      'Agile / Scrum',
      'Stakeholder Communication',
      'SQL'
    ],
    preferredSkills: [
      'RAG Architecture',
      'LLM Evaluation Metrics',
      'Figma',
      'A/B Testing',
      'Python (basic scripting)'
    ],
    techStack: [
      'Jira',
      'Figma',
      'Mixpanel',
      'SQL',
      'OpenAI API'
    ],
    benefits: [
      'ESOPs',
      'Executive Coaching',
      'International Conference Travel',
      'Flexible PTO',
      'Premium Health Insurance'
    ],
    hiringProcess: [
      'Resume Screening',
      'Product Case Study',
      'Panel Interview',
      'Executive Presentation',
      'HR Discussion'
    ],
    postedDate: '2026-02-03',
    applicationDeadline: '2026-03-18',
    matchScore: 0
  },
  {
  id: 'genai-rag-002',
  title: 'Generative AI Engineer – RAG Systems',
  department: 'AI Research & Engineering',
  company: {
    name: 'NeuroStack Technologies',
    industry: 'Artificial Intelligence',
    website: 'https://neurostack.ai',
    headquarters: 'Bengaluru, India',
    size: '200-500 employees',
    founded: 2019
  },
  location: {
    type: 'Remote',
    city: 'Bengaluru',
    remoteAllowed: true
  },
  employmentType: 'Full-time',
  salaryRange: {
    min: 1800000,
    max: 2800000,
    currency: 'INR'
  },
  experienceRequired: '1-3 Years',
  educationRequired: 'B.Tech / M.Tech (CS/AI)',
  openings: 3,

  jobSummary:
    'Build scalable Retrieval-Augmented Generation pipelines using vector databases and LLM orchestration frameworks.',

  responsibilities: [
    'Design and optimize RAG pipelines',
    'Implement embeddings using open-source transformer models',
    'Integrate vector databases (Pinecone / Weaviate)',
    'Fine-tune LLM prompts for enterprise use cases',
    'Collaborate with frontend teams for AI integration'
  ],

  requiredSkills: [
    'Python',
    'LangChain',
    'RAG Architecture',
    'Vector Databases',
    'REST APIs'
  ],

  preferredSkills: [
    'FastAPI',
    'Docker',
    'AWS / GCP',
    'HuggingFace Transformers'
  ],

  techStack: [
    'Python',
    'LangChain',
    'Pinecone',
    'FastAPI',
    'Docker'
  ],

  benefits: [
    'AI Research Budget',
    'Flexible Hours',
    'Remote Setup Allowance',
    'Stock Options'
  ],

  hiringProcess: [
    'Resume Screening',
    'Technical Discussion',
    'System Design Round',
    'Leadership Interview'
  ],

  postedDate: '2026-02-03',
  applicationDeadline: '2026-03-25',
  matchScore: 0
},
{
  id: 'fse-saas-003',
  title: 'Full Stack Engineer – SaaS Platform',
  department: 'Product Engineering',
  company: {
    name: 'CloudNova Systems',
    industry: 'SaaS',
    website: 'https://cloudnova.io',
    headquarters: 'Hyderabad, India',
    size: '500-1000 employees',
    founded: 2015
  },
  location: {
    type: 'Hybrid',
    city: 'Hyderabad',
    remoteAllowed: true
  },
  employmentType: 'Full-time',
  salaryRange: {
    min: 1600000,
    max: 2400000,
    currency: 'INR'
  },
  experienceRequired: '1-4 Years',
  educationRequired: 'B.Tech / MCA',
  openings: 4,

  jobSummary:
    'Develop and maintain scalable SaaS applications with modern frontend and backend frameworks.',

  responsibilities: [
    'Build responsive UI using React / Next.js',
    'Develop backend services with Node.js',
    'Design scalable database schemas',
    'Implement authentication & RBAC systems',
    'Optimize application performance'
  ],

  requiredSkills: [
    'React',
    'Node.js',
    'MongoDB',
    'REST APIs',
    'Git'
  ],

  preferredSkills: [
    'TypeScript',
    'AWS',
    'CI/CD',
    'Docker'
  ],

  techStack: [
    'React',
    'Next.js',
    'Node.js',
    'MongoDB',
    'AWS'
  ],

  benefits: [
    'Performance Bonus',
    'Medical Insurance',
    'Annual Tech Conference Budget'
  ],

  hiringProcess: [
    'Coding Round',
    'System Design',
    'Managerial Interview'
  ],

  postedDate: '2026-02-05',
  applicationDeadline: '2026-03-28',
  matchScore: 0
},
{
  id: 'frontend-perf-004',
  title: 'Frontend Performance Engineer',
  department: 'UI Engineering',
  company: {
    name: 'PixelCraft Labs',
    industry: 'Design Tools',
    website: 'https://pixelcraft.design',
    headquarters: 'Remote',
    size: '50-150 employees',
    founded: 2020
  },
  location: {
    type: 'Remote',
    city: 'Remote',
    remoteAllowed: true
  },
  employmentType: 'Full-time',
  salaryRange: {
    min: 2200000,
    max: 3200000,
    currency: 'INR'
  },
  experienceRequired: '3-6 Years',
  educationRequired: 'B.Tech / Equivalent Experience',
  openings: 1,

  jobSummary:
    'Improve frontend performance and optimize large-scale web applications.',

  responsibilities: [
    'Reduce bundle size and improve Lighthouse score',
    'Implement code splitting and lazy loading',
    'Optimize DOM rendering cycles',
    'Conduct performance audits'
  ],

  requiredSkills: [
    'React',
    'Next.js',
    'Performance Optimization',
    'Webpack',
    'TypeScript'
  ],

  preferredSkills: [
    'Web Vitals',
    'Server Side Rendering',
    'GraphQL'
  ],

  techStack: [
    'React',
    'Next.js',
    'Webpack',
    'TypeScript'
  ],

  benefits: [
    'Equity',
    'Remote First Culture',
    'Premium Hardware'
  ],

  hiringProcess: [
    'Performance Assignment',
    'Technical Interview',
    'Founders Round'
  ],

  postedDate: '2026-02-06',
  applicationDeadline: '2026-03-30',
  matchScore: 0
},
{
  id: 'devops-cloud-005',
  title: 'DevOps Engineer – Cloud Infrastructure',
  department: 'Infrastructure',
  company: {
    name: 'SkyBridge Cloud',
    industry: 'Cloud Services',
    website: 'https://skybridgecloud.com',
    headquarters: 'Pune, India',
    size: '1000-5000 employees',
    founded: 2012
  },
  location: {
    type: 'Onsite',
    city: 'Pune',
    remoteAllowed: false
  },
  employmentType: 'Full-time',
  salaryRange: {
    min: 2500000,
    max: 4000000,
    currency: 'INR'
  },
  experienceRequired: '4-8 Years',
  educationRequired: 'B.Tech / M.Tech',
  openings: 2,

  jobSummary:
    'Design and manage scalable cloud infrastructure for enterprise clients.',

  responsibilities: [
    'Manage AWS infrastructure',
    'Implement CI/CD pipelines',
    'Automate deployments using Terraform',
    'Monitor system reliability and uptime'
  ],

  requiredSkills: [
    'AWS',
    'Terraform',
    'Kubernetes',
    'Docker'
  ],

  preferredSkills: [
    'Go',
    'Monitoring Tools (Prometheus, Grafana)'
  ],

  techStack: [
    'AWS',
    'Terraform',
    'Kubernetes',
    'Docker'
  ],

  benefits: [
    'RSU Package',
    'Health Insurance',
    'Annual Bonus'
  ],

  hiringProcess: [
    'Technical Assessment',
    'Cloud Architecture Interview',
    'HR Round'
  ],

  postedDate: '2026-02-07',
  applicationDeadline: '2026-04-01',
  matchScore: 0
},

];


export const MOCK_CANDIDATES: Candidate[] = [
  {
    id: 'c1',
    name: 'Jatin Thakur',
    title: 'AI/ML Software Developer',
    experience: 'Fresher / Intern',
    matchScore: 98,
    skills: ['Python', 'LangChain', 'RAG', 'React', 'TensorFlow'],
    status: 'New Lead',
    avatarUrl: 'https://picsum.photos/seed/jatin/100/100'
  },
  {
    id: 'c2',
    name: 'Sarah Chen',
    title: 'Fullstack Engineer',
    experience: '5 years',
    matchScore: 94,
    skills: ['React', 'Node.js', 'Go', 'AWS'],
    status: 'Interviewing',
    avatarUrl: 'https://picsum.photos/seed/sarah/100/100'
  }
];
