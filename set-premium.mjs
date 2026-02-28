// set-premium.mjs  –  run with: node set-premium.mjs
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('./service-account.json');

initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();
const uid = 'rR2ysHC9jZONNatpVdxoO2WfWJN2';

await db.doc(`users/${uid}`).update({ plan: 'premium_student' });
console.log(`✅  User ${uid} upgraded to premium_student`);
