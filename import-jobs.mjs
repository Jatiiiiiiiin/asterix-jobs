// import-jobs.mjs
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
let serviceAccount;
try {
    serviceAccount = require('./ai-engine/service-account.json');
} catch (e) {
    console.error('❌ Error: Missing credentials file `./ai-engine/service-account.json`.');
    console.log('To run this background script, generate a Service Account Key from Firebase Console.');
    process.exit(1);
}

// 1. Initialize Firebase Admin
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

/**
 * @typedef {import('./Jobservice').LiveJob} LiveJob
 */

function slugify(text) {
    if (!text) return 'generic';
    return text.toString().toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // remove invalid chars
        .replace(/\s+/g, '_')         // collapse whitespace and replace with _
        .replace(/-+/g, '_')          // replace - with _
        .replace(/^_+|_+$/g, '');     // trim _
}

/* ── Providers Strategy ──────────────────────────────────────────────────── */

const MockProvider = {
    name: 'Mock',
    async fetchJobs() {
        console.log('Using Mock Provider. Generating 2 testing jobs...');
        return [
            {
                id: 'mock_1',
                title: 'Senior Frontend Developer (React)',
                company: 'Vercel Inc.',
                location: 'Remote, US',
                salaryMin: 120000,
                salaryMax: 150000,
                currency: 'USD',
                summary: 'We are looking for a Next.js wizard to scale our dashboard architecture.',
                url: 'https://vercel.com/careers'
            },
            {
                id: 'mock_2',
                title: 'Data Engineer (Python / FastAPI)',
                company: 'OpenAI',
                location: 'San Francisco, CA',
                salaryMin: 140000,
                salaryMax: 180000,
                currency: 'USD',
                summary: 'Design and pipeline high-volume vector data streams securely.',
                url: 'https://openai.com/careers'
            }
        ];
    },
    mapToLiveJob(extJob) {
        const sourceName = 'Internal'; 
        return {
            title: extJob.title,
            status: 'active',
            postedDate: new Date().toISOString(),
            company: { name: extJob.company },
            location: {
                city: extJob.location,
                type: extJob.location.toLowerCase().includes('remote') ? 'Remote' : 'On-site',
                remoteAllowed: extJob.location.toLowerCase().includes('remote')
            },
            salaryRange: { min: extJob.salaryMin, max: extJob.salaryMax, currency: extJob.currency },
            jobSummary: extJob.summary,
            externalUrl: extJob.url,
            isAdminPosted: true,
            sources: {
                [sourceName]: {
                    url: extJob.url,
                    postedDate: new Date().toISOString()
                }
            }
        };
    }
};

const RapidAPIProvider = {
    name: 'RapidAPI (Jearch / LinkedIn)',
    async fetchJobs() {
        const apiKey = process.env.RAPIDAPI_KEY;
        if (!apiKey) {
            console.error('❌ Missing RAPIDAPI_KEY inside `.env.local` file.');
            console.log('Falling back to empty fetch for RapidAPI.');
            return [];
        }

        console.log('Fetching from RapidAPI JSearch setup...');
        const queries = [
            'Software Engineer Fresher in India',
            'Junior Frontend Developer in India',
            'Entry Level React Developer in India',
            'Junior Full Stack Developer in India',
            'Junior Backend Engineer in India',
            'Entry Level Data Engineer in India'
        ];
        const randomQuery = queries[Math.floor(Math.random() * queries.length)];
        const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(randomQuery)}&num_pages=1&date_posted=today`;
        const options = {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': apiKey,
                'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
            }
        };

        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`);
            const result = await response.json();
            return result.data || []; // JSearch wraps in .data
        } catch (error) {
            console.error('RapidAPI Fetch Error:', error);
            return [];
        }
    },
    mapToLiveJob(extJob) {
        const sourceName = extJob.job_publisher || 'External';
        
        const descOptions = [
            extJob.job_description,
            extJob.job_summary,
            Object.values(extJob.job_highlights || {}).flat().join('\n')
        ].filter(Boolean);
        const bestDescription = descOptions.sort((a, b) => b.length - a.length)[0] || '';

        // --- NATIVE JD PARSER IMPL ---
        // Since we are running in GitHub Actions without the Python Backend, extract techStack using regex/keyword matching
        const techKeywords = [
            "python", "javascript", "typescript", "java", "c++", "c#", "react", "angular", "vue",
            "node", "express", "django", "flask", "spring", "sql", "mongodb", "postgresql", "mysql",
            "aws", "azure", "gcp", "docker", "kubernetes", "git", "ci/cd", "graphql", "rest api", "redis",
            "kafka", "elastic", "linux", "html", "css", "tailwind", "next.js"
        ];
        const descLower = bestDescription.toLowerCase();
        
        // Use Set to avoid duplicates safely
        const techStackSet = new Set();
        techKeywords.forEach(kw => {
            // Check for exact word boundaries to avoid false positives (e.g. matching 'java' in 'javascript')
            const regex = new RegExp(`\\b${kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
            if (regex.test(descLower)) {
                techStackSet.add(kw.charAt(0).toUpperCase() + kw.slice(1));
            }
        });

        // Ensure these match the Job Schema array format strictly
        const resList = extJob.job_highlights?.Responsibilities || [];
        const reqSkillsList = extJob.job_required_skills || extJob.job_highlights?.Qualifications || [];
        const benefitsList = extJob.job_benefits_strings || extJob.job_highlights?.Benefits || [];

        return {
            title: extJob.job_title || 'Untitled',
            status: 'active',
            postedDate: extJob.job_posted_at_datetime_utc || new Date().toISOString(),
            company: { name: extJob.employer_name || 'Unknown' },
            location: {
                city: extJob.job_city || extJob.job_country || 'Remote',
                type: extJob.job_is_remote ? 'Remote' : 'On-site',
                remoteAllowed: !!extJob.job_is_remote
            },
            salaryRange: {
                min: extJob.job_min_salary || null,
                max: extJob.job_max_salary || null,
                currency: extJob.job_salary_currency || 'USD'
            },
            jobSummary: bestDescription,
            requiredSkills: reqSkillsList,
            responsibilities: resList,
            benefits: benefitsList,
            techStack: Array.from(techStackSet),
            employmentType: extJob.job_employment_type || null,
            experienceRequired: extJob.job_required_experience?.required_experience_in_months ? `${Math.round(extJob.job_required_experience.required_experience_in_months / 12)}+ years` : null,
            externalUrl: extJob.job_apply_link || '',
            isAdminPosted: true,
            sources: {
                [sourceName]: {
                    url: extJob.job_apply_link,
                    postedDate: extJob.job_posted_at_datetime_utc || new Date().toISOString()
                }
            }
        };
    }
};

const PROVIDERS = {
    mock: MockProvider,
    rapidapi: RapidAPIProvider
};

/* ── Main Operations ────────────────────────────────────────────────────── */

async function importJobs() {
    // Parse arguments or use .env
    const args = process.argv.slice(2);
    let providerArg = process.env.JOB_PROVIDER || 'mock';

    const providerIdx = args.findIndex(a => a.startsWith('--provider='));
    if (providerIdx !== -1) {
        providerArg = args[providerIdx].split('=')[1];
    } else if (args.includes('--provider')) {
        const idx = args.indexOf('--provider');
        providerArg = args[idx + 1] || 'mock';
    } else if (args[0] && !args[0].startsWith('--')) {
        providerArg = args[0]; // Position fallback
    }

    const provider = PROVIDERS[providerArg?.toLowerCase()];

    if (!provider) {
        console.error(`❌ Unknown provider: "${providerArg}". Valid are: ${Object.keys(PROVIDERS).join(', ')}`);
        return;
    }

    console.log(`--- Starting Job Import [Provider: ${provider.name}] ---`);

    try {
        const externalJobs = await provider.fetchJobs();
        if (externalJobs.length === 0) {
            console.log('No jobs found or fetched. Exiting.');
            return;
        }

        const jobsRef = db.collection('jobs');
        const batch = db.batch();
        const groupedJobs = {};
        let merged = 0;

        for (const extJob of externalJobs) {
            const liveJob = provider.mapToLiveJob(extJob);
            
            const compName = typeof liveJob.company === 'string' ? liveJob.company : liveJob.company?.name;
            const key = `${slugify(compName)}_${slugify(liveJob.title)}`;
            const docId = `aggregated_${key}`;

            if (!groupedJobs[docId]) {
                groupedJobs[docId] = {
                    ...liveJob,
                    sources: { ...liveJob.sources }
                };
            } else {
                // Merge sources
                groupedJobs[docId].sources = {
                    ...groupedJobs[docId].sources,
                    ...liveJob.sources
                };
                
                // Update externalUrl to point to a primary one if needed, or keep original
                // We keep the old descriptions/titles for now, or could pick best.
            }
        }

        for (const [docId, job] of Object.entries(groupedJobs)) {
            const docRef = jobsRef.doc(docId);
            batch.set(docRef, job, { merge: true });
            merged++;
        }

        if (merged > 0) {
            await batch.commit();
            console.log(`Successfully merged/upserted ${merged} unique jobs to Firestore.`);
        } else {
            console.log('No records required updating.');
        }

    } catch (error) {
        console.error('Fatal Import Error:', error);
    }
}

importJobs();
