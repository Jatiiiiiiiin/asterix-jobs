import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('./ai-engine/service-account.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function purgeJSearchJobs() {
    console.log('--- 🧹 Purging All Aggregated Jobs (JSearch) ---');

    try {
        const jobsRef = db.collection('jobs');
        const snapshot = await jobsRef.get();

        if (snapshot.empty) {
            console.log('No jobs found in the database at all.');
            return;
        }

        let deletedCount = 0;
        let batch = db.batch();
        let batchOpCount = 0;

        for (const doc of snapshot.docs) {
            // Delete all jobs imported by our aggregator
            if (doc.id.startsWith('aggregated_')) {
                console.log(`- Deleting: ${doc.id}`);
                batch.delete(doc.ref);
                deletedCount++;
                batchOpCount++;

                // Firestore batch limit is 500
                if (batchOpCount === 500) {
                    await batch.commit();
                    batch = db.batch(); // Start a new batch
                    batchOpCount = 0;
                }
            }
        }

        // Commit any remaining deletions
        if (batchOpCount > 0) {
            await batch.commit();
        }

        if (deletedCount > 0) {
            console.log(`✅ Successfully purged ${deletedCount} old aggregated jobs.`);
        } else {
            console.log('No aggregated JSearch jobs found to delete!');
        }
    } catch (error) {
        console.error('❌ Error cleaning up jobs:', error);
    }
}

purgeJSearchJobs();
