require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const { events } = require('../data/events');

// Initialize Firebase Admin with env variables
const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
    console.error('Missing Firebase credentials in environment variables.');
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function seedEvents() {
    console.log(`Seeding ${events.length} events...`);
    const batch = db.batch();

    events.forEach(event => {
        const docRef = db.collection('events').doc(event.id);
        batch.set(docRef, {
            ...event,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    });

    await batch.commit();
    console.log('Events seeded successfully!');
}

seedEvents().catch(console.error).finally(() => process.exit());
