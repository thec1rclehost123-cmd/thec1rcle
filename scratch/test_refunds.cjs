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
  console.log("Querying firestore with try-catch and fallback...");
  const status = 'pending';
  const limit = 25;
  const cursor = null;
  try {
    const snap = await db.collection('refund_requests')
      .where('status', '==', status)
      .orderBy('createdAt', 'desc')
      .limit(limit + 1)
      .get();
    console.log("Docs found with standard query:", snap.docs.length);
  } catch (err) {
    if (err.message && err.message.includes('FAILED_PRECONDITION')) {
      console.warn('⚠️ Standard query failed. Running fallback...');
      const snapshot = await db.collection('refund_requests').orderBy('createdAt', 'desc').get();
      console.log("Docs found with fallback query:", snapshot.docs.length);
      
      let allRefunds = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      if (status !== 'all') {
        allRefunds = allRefunds.filter(r => r.status === status);
      }
      console.log("Filtered docs:", allRefunds.length);
    } else {
      console.error("Unknown query error:", err);
    }
  }
}

run();
