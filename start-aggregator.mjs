import { exec } from 'child_process';

const INTERVAL = 15 * 60 * 1000; // 15 minutes

function runImport() {
    console.log(`[${new Date().toLocaleString()}] 🔄 Starting background job import...`);
    // Pass provider if needed, defaults to mock/RAPIDAPI based on .env
    exec('node import-jobs.mjs', (error, stdout, stderr) => {
        if (error) {
            console.error(`❌ Execution Error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`⚠️ Stderr: ${stderr}`);
        }
        if (stdout) {
            console.log(stdout);
        }
        console.log(`[${new Date().toLocaleString()}] ✅ Import complete. Waiting 15 minutes...`);
    });
}

// Run immediately on start
runImport();

// Run every 15 minutes
setInterval(runImport, INTERVAL);

console.log('--- 🚀 Job Aggregator Daemon Started ---');
console.log(`Interval: 15 minutes`);
console.log(`Press Ctrl+C to stop.`);
