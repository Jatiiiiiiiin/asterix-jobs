import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('./ai-engine/service-account.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function purgeExternalJobs() {
    console.log('--- Purging ALL External Jobs ---');

    try {
        const jobsRef = db.collection('jobs');
        const snapshot = await jobsRef.get();

        if (snapshot.empty) {
            console.log('No jobs found.');
            return;
        }

        let deletedCount = 0;
        let batch = db.batch();

        snapshot.forEach(doc => {
            const data = doc.data();
            // Delete if it has an external URL (meaning it's from JSearch or an external scraper)
            if (data.externalUrl) {
                console.log(`Deleting external job: ${doc.id} - ${data.title}`);
                batch.delete(doc.ref);
                deletedCount++;
            }
        });

        if (deletedCount > 0) {
            await batch.commit();
            console.log(`Successfully purged ${deletedCount} external jobs.`);
        } else {
            console.log('No external jobs found to delete!');
        }
    } catch (error) {
        console.error('Error cleaning up jobs:', error);
    }
}

purgeExternalJobs();
