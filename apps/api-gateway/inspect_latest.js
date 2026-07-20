import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createDecipheriv, scryptSync } from 'node:crypto';
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

const algorithm = 'aes-256-cbc';
const secret = process.env.ENCRYPTION_KEY || 'c1rcle-super-secret-key-1234567890';
const key = scryptSync(secret, 'salt', 32);

function decrypt(encryptedText) {
  if (!encryptedText) return '';
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) return encryptedText;
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return encryptedText;
  }
}

async function run() {
  console.log('=== LATEST EVENT PROMOTER SETTINGS ===');
  const settingsSnap = await db
    .collection('event_promoter_settings')
    .orderBy('updatedAt', 'desc')
    .limit(5)
    .get();
  for (const doc of settingsSnap.docs) {
    console.log(doc.id, '->', JSON.stringify(doc.data(), null, 2));
  }

  console.log('\n=== LATEST PROMOTER ASSIGNMENTS ===');
  const assignSnap = await db
    .collection('promoter_assignments')
    .orderBy('updatedAt', 'desc')
    .limit(5)
    .get();
  for (const doc of assignSnap.docs) {
    const data = doc.data();
    console.log(doc.id, '->', {
      ...data,
      eventNameDecrypted: decrypt(data.eventName),
      venueNameDecrypted: decrypt(data.venueName),
    });
  }

  console.log('\n=== LATEST NOTIFICATIONS ===');
  const notifSnap = await db
    .collection('notifications')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();
  for (const doc of notifSnap.docs) {
    const data = doc.data();
    console.log(doc.id, '->', {
      ...data,
      titleDecrypted: decrypt(data.title),
      messageDecrypted: decrypt(data.message),
    });
  }
}

run().catch(console.error);
