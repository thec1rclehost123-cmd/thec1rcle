
import admin from 'firebase-admin';
import { events } from './apps/guest-portal/data/events.js';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

admin.initializeApp({
    projectId: 'thec1rcle-india'
});

const db = admin.firestore();

async function seed() {
    console.log('Seeding Firestore emulator...');
    const batch = db.batch();

    for (const event of events) {
        const ref = db.collection('events').doc(event.id);
        batch.set(ref, {
            ...event,
            lifecycle: 'scheduled', // 'scheduled' is required for visibility in mobile app
            status: 'scheduled',
            createdAt: event.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        console.log(`Added event: ${event.id}`);
    }

    await batch.commit();
    console.log('Seeding complete!');
    process.exit(0);
}

seed().catch(err => {
    console.error('Seeding failed:', err);
    process.exit(1);
});
