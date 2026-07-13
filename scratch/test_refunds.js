const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../apps/admin-console/.env.local') });

const { cert, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

let privateKey = process.env.FIREBASE_PRIVATE_KEY;
if (privateKey) {
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }
  privateKey = privateKey.replace(/\\n/g, '\n');
}

try {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    })
  });
} catch(e){}

const db = getFirestore();

async function run() {
  console.log("Querying firestore...");
  try {
    const snap = await db.collection('refund_requests')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .limit(26)
      .get();
    console.log("Docs found:", snap.docs.length);
  } catch (error) {
    console.error("Firestore Query Failed:", error);
  }
}

run();
