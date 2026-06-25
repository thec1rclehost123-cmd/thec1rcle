import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('.env.development') });

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (privateKey?.startsWith('"') && privateKey?.endsWith('"')) {
  privateKey = privateKey.slice(1, -1);
}
privateKey = privateKey?.replace(/\\n/g, '\n');

initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
});

const db = getFirestore();

async function run() {
  const eventsSnap = await db.collection('events').get();
  console.log(`Total events: ${eventsSnap.size}`);

  for (const doc of eventsSnap.docs) {
    const data = doc.data();
    if (
      data.venueId === 'venue_hoZM0jpi' ||
      data.venueId === 'venue_NPpsWyAw' ||
      data.venueId === 'venue_jwTJjY5R'
    ) {
      console.log(
        `Event: ${doc.id} -> Title: ${data.title}, venueId: ${data.venueId}, venueName: ${data.venueName || 'none'}, lifecycle: ${data.lifecycle}, status: ${data.status}`,
      );
    }
  }
}

run().catch(console.error);
