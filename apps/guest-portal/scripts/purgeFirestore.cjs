/**
 * One-time cleanup script: wipes seed/fake data collections from Firestore.
 * PRESERVES: users, platform_settings, platform_stats
 *
 * Usage:
 *   cd apps/guest-portal && node scripts/purgeFirestore.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.development') });
const admin = require('firebase-admin');

// Robust PEM reconstruction (mirrors packages/core/admin.js)
const parsePrivateKey = (raw) => {
  if (!raw) return null;
  let key = raw.replace(/\\n/g, '\n');
  if (key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1);
  let body = key
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '');
  body = body.replace(/[^a-zA-Z0-9+/=]/g, '');
  const formatted = body.match(/.{1,64}/g)?.join('\n');
  if (!formatted) return null;
  return `-----BEGIN PRIVATE KEY-----\n${formatted}\n-----END PRIVATE KEY-----\n`;
};

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
};

if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
  console.error('Missing Firebase credentials. Check .env.development for FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const COLLECTIONS_TO_WIPE = ['events', 'orders', 'homepage_selects', 'homepage_interviews'];
const BATCH_SIZE = 400;

async function deleteCollection(collectionName) {
  const collRef = db.collection(collectionName);
  let deleted = 0;

  while (true) {
    const snapshot = await collRef.limit(BATCH_SIZE).get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snapshot.size;
    console.log(`  [${collectionName}] deleted ${deleted} documents so far...`);
  }

  console.log(`  [${collectionName}] DONE — ${deleted} total documents removed.`);
  return deleted;
}

async function main() {
  console.log('=== Firestore Purge Script ===');
  console.log(`Project: ${serviceAccount.projectId}`);
  console.log(`Collections to wipe: ${COLLECTIONS_TO_WIPE.join(', ')}`);
  console.log('Preserving: users, platform_settings, platform_stats');
  console.log('');

  for (const col of COLLECTIONS_TO_WIPE) {
    await deleteCollection(col);
  }

  console.log('\nPurge complete.');
}

main().catch((err) => {
  console.error('Purge failed:', err);
  process.exit(1);
}).finally(() => process.exit(0));
