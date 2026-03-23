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
            isAdminPosted: true
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
        // Standard endpoint: e.g., 'jsearch.p.rapidapi.com/search'
        const url = 'https://jsearch.p.rapidapi.com/search?query=Software%20Engineer&num_pages=1';
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
        // JSearch mapped to Asterix LiveJob schema
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
            jobSummary: extJob.job_description || '',
            externalUrl: extJob.job_apply_link || '',
            isAdminPosted: true
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
        let merged = 0;

        for (const extJob of externalJobs) {
            const liveJob = provider.mapToLiveJob(extJob);
            // Generate deterministic ID so we don't duplicate on multiple runs
            const idKey = extJob.id || extJob.job_id || Math.random().toString(36).substring(7);
            const docId = `aggregated_${providerArg}_${idKey}`;
            const docRef = jobsRef.doc(docId);

            batch.set(docRef, liveJob, { merge: true });
            merged++;
        }

        if (merged > 0) {
            await batch.commit();
            console.log(`Successfully merged/upserted ${merged} jobs to Firestore.`);
        } else {
            console.log('No records required updating.');
        }

    } catch (error) {
        console.error('Fatal Import Error:', error);
    }
}

importJobs();
