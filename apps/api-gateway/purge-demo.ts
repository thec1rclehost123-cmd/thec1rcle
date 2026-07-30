import { getFirestore } from 'firebase-admin/firestore';
import admin from 'firebase-admin';

// Initialize firebase admin if not already
if (!admin.apps.length) {
  admin.initializeApp();
}

async function purgeDemoEvents() {
  const db = getFirestore();
  const eventsSnap = await db.collection('events').get();

  let deletedCount = 0;
  for (const doc of eventsSnap.docs) {
    if (doc.id.startsWith('demo-event-')) {
      console.log(`Deleting ${doc.id}`);
      await doc.ref.delete();
      deletedCount++;
    }
  }

  console.log(`Deleted ${deletedCount} demo events.`);
  process.exit(0);
}

purgeDemoEvents().catch(console.error);
