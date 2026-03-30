// cleanup-jobs.mjs
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('./ai-engine/service-account.json');

initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();

async function cleanupExpiredJobs() {
    console.log('--- Starting Job Cleanup ---');
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

    console.log(`Current Date: ${todayStr}`);

    try {
        const jobsRef = db.collection('jobs');
        // We look for active jobs where applicationDeadline is less than today
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
            const deadline = data.applicationDeadline;

            if (deadline && deadline < todayStr) {
                console.log(`Closing expired job: ${doc.id} (${data.title}) - Deadline: ${deadline}`);
                batch.update(doc.ref, { status: 'closed' });
                deletedCount++;
            }
        });

        if (deletedCount > 0) {
            await batch.commit();
            console.log(`Successfully deleted ${deletedCount} expired jobs.`);
        } else {
            console.log('No expired jobs to delete.');
        }
    } catch (error) {
        console.error('Error cleaning up jobs:', error);
    }
}

cleanupExpiredJobs();
