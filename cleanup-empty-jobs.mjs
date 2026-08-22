import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('./ai-engine/service-account.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function cleanupEmptyJobs() {
    console.log('--- Starting Empty Job Cleanup ---');

    try {
        const jobsRef = db.collection('jobs');
        // Get all active jobs
        const snapshot = await jobsRef
            .where('status', '==', 'active')
            .get();

        if (snapshot.empty) {
            console.log('No active jobs found.');
            return;
        }

        let deletedCount = 0;
        const batch = db.batch();

        snapshot.forEach(doc => {
            const data = doc.data();
            const summary = data.jobSummary || '';
            
            // Delete if the description is too short (just like our new aggregator threshold)
            // or if it's explicitly undefined/null
            if (!summary || summary.trim().length < 50) {
                console.log(`Deleting invalid empty job: ${doc.id} (${data.title})`);
                batch.delete(doc.ref);
                deletedCount++;
            }
        });

        if (deletedCount > 0) {
            // Commit in chunks if there are >500, but batch.commit() has a 500 limit.
            // Let's assume there are fewer than 500 bad jobs for now, 
            // since we only fetched 1 page per 15 minutes.
            if (deletedCount <= 500) {
                await batch.commit();
                console.log(`Successfully deleted ${deletedCount} empty/invalid jobs.`);
            } else {
                console.log(`Found ${deletedCount} jobs, which exceeds the 500 batch limit. Please run multiple times or implement chunking.`);
            }
        } else {
            console.log('No empty or invalid jobs to delete! Your database is clean.');
        }
    } catch (error) {
        console.error('Error cleaning up empty jobs:', error);
    }
}

cleanupEmptyJobs();
