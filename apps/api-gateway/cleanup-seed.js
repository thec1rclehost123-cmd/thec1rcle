import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey,
  }),
});
const db = getFirestore();

async function cleanup() {
  console.log('Cleaning up seeded mock data...');

  await db.collection('venues').doc('venue_1').delete();
  await db.collection('venues').doc('venue_2').delete();
  await db.collection('users').doc('venue_1').delete();
  await db.collection('users').doc('venue_2').delete();

  await db.collection('hosts').doc('host_1').delete();
  await db.collection('hosts').doc('host_2').delete();
  await db.collection('users').doc('host_1').delete();
  await db.collection('users').doc('host_2').delete();

  console.log('Cleanup complete!');
}

cleanup().catch(console.error);
