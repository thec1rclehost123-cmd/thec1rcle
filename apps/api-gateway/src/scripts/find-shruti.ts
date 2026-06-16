import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function normalizePrivateKey(raw?: string) {
  if (!raw) return raw;
  let privateKey = raw;
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.substring(1, privateKey.length - 1);
  }
  privateKey = privateKey.replace(/\\n/g, '\n').replace(/\\n/g, '\n').trim();
  if (!privateKey.endsWith('\n')) {
    privateKey += '\n';
  }
  return privateKey;
}

async function main() {
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  if (!privateKey) throw new Error('FIREBASE_PRIVATE_KEY is missing');

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  }

  const db = getFirestore();

  console.log('--- USERS ---');
  const usersSnap = await db.collection('users').get();
  for (const doc of usersSnap.docs) {
    const data = doc.data();
    if (
      data.displayName?.toLowerCase().includes('shruti') ||
      data.name?.toLowerCase().includes('shruti')
    ) {
      console.log(doc.id, JSON.stringify(data, null, 2));
    }
  }

  console.log('--- PARTNERS ---');
  const partnersSnap = await db.collection('partners').get();
  for (const doc of partnersSnap.docs) {
    const data = doc.data();
    if (
      data.displayName?.toLowerCase().includes('shruti') ||
      data.name?.toLowerCase().includes('shruti')
    ) {
      console.log(doc.id, JSON.stringify(data, null, 2));
    }
  }

  console.log('--- PROMOTERS (type: promoter) ---');
  const pSnap = await db.collection('partners').where('type', '==', 'promoter').get();
  for (const doc of pSnap.docs) {
    console.log(doc.id, JSON.stringify(doc.data(), null, 2));
  }
}

main().catch(console.error);
