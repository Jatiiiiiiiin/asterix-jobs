import fs from 'fs';
const envFile = fs.readFileSync('.env.local', 'utf-8');
const match = envFile.match(/RAPIDAPI_KEY=(.*)/);
if (!match) process.exit(1);

const apiKey = match[1].trim();
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
    const result = await response.json();
    if (result.data && result.data.length > 0) {
        // Find a job with a missing or short description
        let badJob = result.data.find(j => !j.job_description || j.job_description.length < 50);
        if (!badJob) badJob = result.data[0]; // fallback
        
        console.log("Testing job:", badJob.job_title);
        console.log("Search endpoint desc length:", badJob.job_description?.length);

        // Fetch job-details
        const detailsUrl = `https://jsearch.p.rapidapi.com/job-details?job_id=${encodeURIComponent(badJob.job_id)}`;
        const detailsResponse = await fetch(detailsUrl, options);
        const detailsResult = await detailsResponse.json();
        const detailJob = detailsResult.data && detailsResult.data[0];
        
        if (detailJob) {
            console.log("Job-details desc length:", detailJob.job_description?.length);
            console.log("Job-details highlights keys:", Object.keys(detailJob.job_highlights || {}));
        } else {
            console.log("No details returned for job_id:", badJob.job_id);
        }
    }
} catch (e) {
    console.error(e);
}
