require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const { events } = require('../data/events');

const userId = 'TraOjbiHwiOauY5ymPhSi3b6ODv1'; // Actual User UID for Aayush Divase

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

async function seedOrders() {
    console.log(`Seeding mock orders for user ${userId}...`);

    // Create a couple of orders
    const event1 = events[0]; // After Dark
    const event2 = events[10]; // Nirvana Night (Tribute to One Direction)

    const order1 = {
        userId,
        userEmail: 'mock@example.com',
        userName: 'Aayush Divase',
        eventId: event1.id,
        status: 'confirmed',
        totalAmount: event1.tickets[0].price,
        paymentMethod: 'card',
        tickets: [
            {
                ticketId: event1.tickets[0].id,
                name: event1.tickets[0].name,
                price: event1.tickets[0].price,
                quantity: 1
            }
        ],
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const order2 = {
        userId,
        userEmail: 'mock@example.com',
        userName: 'Aayush Divase',
        eventId: event2.id,
        status: 'confirmed',
        totalAmount: event2.tickets[0].price * 2,
        paymentMethod: 'upi',
        tickets: [
            {
                ticketId: event2.tickets[0].id,
                name: event2.tickets[0].name,
                price: event2.tickets[0].price,
                quantity: 2
            }
        ],
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const batch = db.batch();
    batch.set(db.collection('orders').doc('order-1'), order1);
    batch.set(db.collection('orders').doc('order-2'), order2);

    // Also seed a couple assignment for event2 (if it was a couple ticket)
    // Actually event2 "Nirvana Night" doesn't have couple tickets in data/events.js
    // Let's find one that does.
    // None in data/events.js have "Couple" in name but we can force it.

    const event3 = events[6]; // House of Synth
    const order3 = {
        userId,
        userEmail: 'mock@example.com',
        userName: 'Aayush Divase',
        eventId: event3.id,
        status: 'confirmed',
        totalAmount: 2500,
        paymentMethod: 'card',
        tickets: [
            {
                ticketId: 'couple-ticket-1',
                name: 'VIP Couple Entry',
                price: 2500,
                quantity: 1
            }
        ],
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    batch.set(db.collection('orders').doc('order-3'), order3);

    await batch.commit();
    console.log('Orders seeded successfully!');
}

seedOrders().catch(console.error).finally(() => process.exit());
