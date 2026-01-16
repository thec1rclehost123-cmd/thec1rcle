require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const { createHmac } = require('node:crypto');

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

async function simulateGetUserTickets() {
    console.log(`Simulating getUserTickets for ${userId}...`);

    // 1. Fetch orders
    const ordersSnapshot = await db.collection("orders")
        .where("userId", "==", userId)
        .get();
    const orderDocs = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`Found ${orderDocs.length} orders.`);

    // 2. Fetch events
    const allEventIds = Array.from(new Set(orderDocs.map(o => o.eventId)));
    const eventsData = {};
    if (allEventIds.length > 0) {
        const snapshots = await Promise.all(allEventIds.map(id => db.collection("events").doc(id).get()));
        snapshots.forEach(s => {
            if (s.exists) eventsData[s.id] = { id: s.id, ...s.data() };
        });
    }
    console.log(`Found ${Object.keys(eventsData).length} unique events.`);

    const now = new Date();
    const upcoming = [];
    const past = [];

    orderDocs.forEach(order => {
        const event = eventsData[order.eventId];
        if (!event) {
            console.log(`- Skipping order ${order.id}: Event ${order.eventId} not found!`);
            return;
        }

        const eventStart = new Date(event.startDate || event.startAt);
        const isEventPast = eventStart < now;

        if (!["confirmed", "used", "cancelled"].includes(order.status)) {
            console.log(`- Skipping order ${order.id}: Invalid status ${order.status}`);
            return;
        }

        order.tickets.forEach((ticketGroup) => {
            for (let i = 0; i < ticketGroup.quantity; i++) {
                const ticketId = `${order.id}-${ticketGroup.ticketId}-${i}`;
                const status = order.status === "cancelled" ? "cancelled" : (isEventPast ? "used" : "active");

                if (status === "active") upcoming.push(ticketId);
                else past.push(ticketId);
            }
        });
    });

    console.log(`Upcoming Tickets (${upcoming.length}):`, upcoming);
    console.log(`Past Tickets (${past.length}):`, past);
}

simulateGetUserTickets().catch(console.error).finally(() => process.exit());
