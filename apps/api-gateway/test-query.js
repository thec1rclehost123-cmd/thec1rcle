import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

initializeApp({ projectId: 'demo-c1rcle' });
const db = getFirestore();

async function check() {
    console.log("Checking promoter_stats...");
    const snap = await db.collection('promoter_stats').get();
    snap.docs.forEach(d => console.log(d.id, d.data()));
}
check();
