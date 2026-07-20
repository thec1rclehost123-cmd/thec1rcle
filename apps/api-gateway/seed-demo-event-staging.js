import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

// Read service account from env var FIREBASE_ADMIN_SDK_PATH
const serviceAccount = JSON.parse(fs.readFileSync(process.env.FIREBASE_ADMIN_SDK_PATH, 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const event = {
  id: 'demo-event-02',
  title: 'Neon Sundays',
  description: 'Brothers Day Special. One last wild night before Monday hits. Featuring DJ Ishu, DJ Justinn, and DJ Sumit.',
  startDate: '2026-07-04T11:00:00.000Z',
  endDate: '2026-07-05T16:00:00.000Z',
  venue: 'D.O.T Pune',
  location: 'Baner, Pune',
  city: 'Pune',
  hostId: 'demo-host-02',
  hostName: 'D.O.T Pune',
  lifecycle: 'scheduled',
  status: 'active',
  isFeatured: true,
  category: 'brunch',
  tickets: [
    { id: 't1', name: 'Couple Pass', price: 1499, quantity: 60, remaining: 18, entryType: 'couple' },
    { id: 't2', name: 'Stag Entry', price: 999, quantity: 30, remaining: 12, entryType: 'stag' },
  ],
  stats: { views: 3100, saves: 201, shares: 67, rsvps: 220 },
  coordinates: { latitude: 18.5362, longitude: 73.9003 },
};

async function seed() {
  console.log('Seeding demo-event-02 into STAGING...');
  await db.collection('events').doc(event.id).set(event);
  
  // Create inventory docs
  for (const t of event.tickets) {
    await db.collection('events').doc(event.id).collection('inventory').doc(t.id).set({
      available: t.remaining,
      reserved: 0,
      sold: t.quantity - t.remaining,
      capacity: t.quantity
    });
  }

  console.log('Done!');
  process.exit(0);
}
seed().catch(console.error);
