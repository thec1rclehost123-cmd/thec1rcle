require('dotenv').config({ path: 'apps/partner-dashboard/.env' });
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        })
    });
}

const db = getFirestore();

async function checkVenue() {
    console.log("Checking venues...");
    const snapshot = await db.collection('venues').get();
    snapshot.forEach(doc => {
        console.log(`Document ID: ${doc.id}`);
        console.log(`Name: ${doc.data().name}`);
        console.log(`Cover: ${doc.data().coverURL || doc.data().image}`);
        console.log("---");
    });
}

checkVenue();
