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

async function countEvents() {
    console.log('Counting events in Firestore...');
    const snapshot = await db.collection('events').get();
    console.log(`Found ${snapshot.size} documents in 'events' collection.`);
    if (snapshot.size > 0) {
        console.log('Sample IDs:', snapshot.docs.slice(0, 3).map(d => d.id));
        console.log('Sample Data of first doc:', JSON.stringify(snapshot.docs[0].data(), null, 2));
    } else {
        console.log('Collection is empty!');
    }
}

countEvents().catch(console.error).finally(() => process.exit());
