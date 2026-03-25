import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('./ai-engine/service-account.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function checkJobs() {
    const snapshot = await db.collection('jobs').get();
    let count = 0;
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.isAdminPosted) {
            console.log(`ID: ${doc.id}`);
            console.log(`Title: ${data.title}`);
            console.log(`Sources:`, data.sources);
            console.log(`ExternalUrl:`, data.externalUrl);
            console.log('---');
            count++;
        }
    });
    console.log(`Total admin/external jobs: ${count}`);
}

checkJobs();
