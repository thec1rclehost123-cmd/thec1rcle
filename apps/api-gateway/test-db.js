import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

initializeApp({ projectId: 'demo-c1rcle' });
const db = getFirestore();

async function run() {
  const eventsSnap = await db.collection('events').get();
  eventsSnap.forEach(doc => {
    const data = doc.data();
    console.log(`Event: ${data.title}, Cover: ${data.coverImage || data.image || data.coverURL || data.bannerImage || data.photoURL || 'NONE'}`);
  });
}

run();
