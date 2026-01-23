
const admin = require('firebase-admin');
const { baseEvents, metadataById } = require('./apps/guest-portal/data/events');

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

admin.initializeApp({
    projectId: 'thec1rcle-india'
});

const db = admin.firestore();

async function seed() {
    console.log('Seeding Firestore emulator...');
    const batch = db.batch();

    for (const base of baseEvents) {
        const meta = metadataById[base.id] || {};
        const event = {
            ...base,
            ...meta,
            lifecycle: 'published',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Normalize properties for the app logic
        if (!event.startDate && event.startDateTime) event.startDate = event.startDateTime;
        if (!event.endDate && event.endDateTime) event.endDate = event.endDateTime;

        const ref = db.collection('events').doc(event.id);
        batch.set(ref, event);
        console.log(`Added event: ${event.id}`);
    }

    await batch.commit();
    console.log('Seeding complete!');
}

seed().catch(err => {
    console.error('Seeding failed:', err);
    process.exit(1);
});
