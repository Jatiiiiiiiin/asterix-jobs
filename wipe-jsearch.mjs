import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('./ai-engine/service-account.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function purgeJSearchJobs() {
    console.log('--- Purging All Aggregated Jobs (JSearch) ---');

    try {
        const jobsRef = db.collection('jobs');
        const snapshot = await jobsRef.get();

        if (snapshot.empty) {
            console.log('No jobs found in the database at all.');
            return;
        }

        let deletedCount = 0;
        let batch = db.batch();

        snapshot.forEach(doc => {
            // Delete all jobs imported by our aggregator
            if (doc.id.startsWith('aggregated_')) {
                console.log(`Deleting previously fetched job: ${doc.id}`);
                batch.delete(doc.ref);
                deletedCount++;
                
                // Firestore batch limit is 500. For safety we just do it if it's less than 500, but let's implement a simple chunk approach if needed.
            }
        });

        if (deletedCount > 0) {
            if (deletedCount <= 500) {
                await batch.commit();
                console.log(`Successfully purged ${deletedCount} old aggregated jobs.`);
            } else {
                console.log(`Found ${deletedCount} jobs, which exceeds the 500 batch limit. Please implement chunking.`);
            }
        } else {
            console.log('No aggregated JSearch jobs found to delete!');
        }
    } catch (error) {
        console.error('Error cleaning up jobs:', error);
    }
}

purgeJSearchJobs();
