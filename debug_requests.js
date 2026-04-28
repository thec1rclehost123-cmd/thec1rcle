
const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'apps/admin-console/.env.local') });

const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const uid = '6NTPQUfjc6TJ4tCgwugY9DCBitm1';

async function check() {
    const s = await db.collection('onboarding_requests').where('uid', '==', uid).get();
    console.log('Requests for UID:', uid);
    s.forEach(doc => console.log(doc.id, doc.data().status));
    process.exit();
}

check();
