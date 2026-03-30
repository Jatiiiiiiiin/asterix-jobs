import fs from 'fs';

// Helper to get API key
const getApiKey = () => {
    try {
        const envFile = fs.readFileSync('.env.local', 'utf-8');
        const match = envFile.match(/RAPIDAPI_KEY=(.*)/);
        return match ? match[1].trim() : null;
    } catch (e) {
        return null;
    }
};

const apiKey = getApiKey();
if (!apiKey) {
    console.error('❌ RAPIDAPI_KEY not found in .env.local');
    process.exit(1);
}

const queries = [
    'Software Engineer Fresher in India',
    'Junior Frontend Developer in India',
    'Entry Level React Developer in India'
];

async function testQuery(query, datePosted) {
    console.log(`\nTesting: "${query}" | date_posted: "${datePosted}"`);
    const encodeQ = encodeURIComponent(query);
    const url = `https://jsearch.p.rapidapi.com/search?query=${encodeQ}&num_pages=1&date_posted=${datePosted}`;
    
    const options = {
        method: 'GET',
        headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
        }
    };

    try {
        const response = await fetch(url, options);
        const result = await response.json();
        const count = result.data ? result.data.length : 0;
        console.log(`Found: ${count} jobs`);
        if (count > 0) {
            console.log(`First job: ${result.data[0].job_title} at ${result.data[0].employer_name} (Posted: ${result.data[0].job_posted_at_datetime_utc})`);
        }
    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}

async function run() {
    for (const q of queries) {
        await testQuery(q, 'today');
        await testQuery(q, '3days');
    }
}

run();
