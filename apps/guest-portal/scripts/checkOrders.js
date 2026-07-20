require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

const userId = 'TraOjbiHwiOauY5ymPhSi3b6ODv1';

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

async function checkOrders() {
    console.log(`Checking orders for user ${userId}...`);
    const ordersSnapshot = await db.collection("orders")
        .where("userId", "==", userId)
        .get();

    console.log(`Found ${ordersSnapshot.size} orders.`);
    ordersSnapshot.forEach(doc => {
        console.log(`- Order ID: ${doc.id}, Status: ${doc.data().status}, Event ID: ${doc.data().eventId}`);
    });

    if (ordersSnapshot.size > 0) {
        const eventId = ordersSnapshot.docs[0].data().eventId;
        const eventDoc = await db.collection("events").doc(eventId).get();
        if (eventDoc.exists) {
            console.log(`Event ${eventId} exists: ${eventDoc.data().title}`);
            console.log(`Start date: ${eventDoc.data().startDate || eventDoc.data().startAt}`);
        } else {
            console.log(`Event ${eventId} DOES NOT EXIST in Firestore!`);
        }
    }
}

checkOrders().catch(console.error).finally(() => process.exit());
