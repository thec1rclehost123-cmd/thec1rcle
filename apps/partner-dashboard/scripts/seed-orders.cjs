const admin = require('firebase-admin');

function getCredentials() {
    const envKey = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (envKey) {
        try {
            return admin.credential.cert(JSON.parse(envKey));
        } catch {
            throw new Error("FIREBASE_SERVICE_ACCOUNT must be a valid JSON string");
        }
    }
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (credPath) {
        return admin.credential.applicationDefault();
    }
    // If running with FIRESTORE_EMULATOR_HOST, applicationDefault() will throw if not set,
    // so we can initialize app with projectId for emulator
    if (process.env.FIRESTORE_EMULATOR_HOST) {
        return null;
    }
    throw new Error("Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS env var");
}

if (!admin.apps.length) {
    const creds = getCredentials();
    admin.initializeApp(creds ? { credential: creds } : { projectId: 'demo-thec1rcle' });
}

const db = admin.firestore();

async function seed() {
    const promoterId = 'dummy-promoter-id'; // If the user is logged in, we can either seed a generic promoter or let them see all.
    // Wait, the API might filter by the active promoter. 
    // We should make sure we seed for the currently active promoter.
    // I will add some general dummy orders without promoter ID just for 'lookup' testing, 
    // AND some with a promoterId.

    const dummyOrders = [
        {
            id: 'ORD-1001',
            eventId: 'EVT-001',
            eventName: 'Summer Rave — Kitty Su',
            promoterId: 'dummy-promoter-id', // Assuming it'll be replaced or matched
            status: 'confirmed',
            userName: 'Alice Johnson',
            userEmail: 'alice@example.com',
            totalAmount: 1500,
            tickets: [{ quantity: 2, type: 'VIP' }],
            checkedIn: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        },
        {
            id: 'ORD-1002',
            eventId: 'EVT-001',
            eventName: 'Summer Rave — Kitty Su',
            status: 'confirmed',
            userName: 'Bob Smith',
            userEmail: 'bob@example.com',
            totalAmount: 800,
            tickets: [{ quantity: 1, type: 'GA' }],
            checkedIn: false, // For testing Add Guest
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        },
        {
            id: 'ORD-1003',
            eventId: 'EVT-002',
            eventName: 'Sunburn Warm-up — VH',
            status: 'confirmed',
            userName: 'Charlie Davis',
            userEmail: 'charlie@example.com',
            totalAmount: 3000,
            tickets: [{ quantity: 3, type: 'VVIP' }],
            checkedIn: false, // For testing Add Guest
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        }
    ];

    for (const order of dummyOrders) {
        await db.collection('orders').doc(order.id).set(order);
        console.log('Seeded order:', order.id);
    }
    console.log('Seeded orders for testing Add Guest and general viewing.');
}

seed().catch(console.error);
