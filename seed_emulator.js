import { getAdminDb } from '@c1rcle/core/admin';
import { baseEvents, metadataById } from './apps/guest-portal/data/events.js';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const db = getAdminDb();

async function seed() {
  const batch = db.batch();
  for (const ev of baseEvents) {
    const ref = db.collection('events').doc(ev.id);
    batch.set(ref, ev);
  }
  await batch.commit();
  console.log(`Seeded ${baseEvents.length} events`);

  const metaBatch = db.batch();
  for (const [id, meta] of Object.entries(metadataById)) {
    const ref = db.collection('event_metadata').doc(id);
    metaBatch.set(ref, meta);
  }
  await metaBatch.commit();
  console.log(`Seeded ${Object.keys(metadataById).length} event_metadata docs`);
}

seed().catch(console.error);
