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

async function check() {
  const venues = await db.collection('venues').limit(10).get();
  console.log('Venues count:', venues.size);
  const hosts = await db.collection('hosts').limit(10).get();
  console.log('Hosts count:', hosts.size);
  const promoters = await db.collection('users').where('role', '==', 'promoter').limit(10).get();
  console.log('Promoters count:', promoters.size);
}
check().catch(console.error);
