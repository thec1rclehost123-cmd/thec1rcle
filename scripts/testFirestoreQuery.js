require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

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

async function testQuery() {
    console.log('Testing query for "Pune, IN"...');
    const snapshot = await db.collection('events')
        .where('city', '==', 'Pune, IN')
        .where('heatScore', '>=', 0)
        .orderBy('heatScore', 'desc')
        .get();

    console.log(`Found ${snapshot.size} events.`);
    if (snapshot.size > 0) {
        console.log('Sample event titles:', snapshot.docs.map(d => d.data().title));
    }
}

testQuery().catch(console.error).finally(() => process.exit());
