import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

initializeApp({ projectId: 'demo-c1rcle' });
const db = getFirestore();

async function seed() {
  const venues = [
    {
      id: 'venue_1',
      displayName: 'Club Alpha',
      role: 'venue',
      city: 'London',
      kycStatus: 'verified',
    },
    {
      id: 'venue_2',
      displayName: 'The Neon Lounge',
      role: 'venue',
      city: 'New York',
      kycStatus: 'verified',
    },
  ];

  const hosts = [
    {
      id: 'host_1',
      displayName: 'Party Wizards',
      role: 'host',
      city: 'London',
      kycStatus: 'verified',
    },
    {
      id: 'host_2',
      displayName: 'Elite Events',
      role: 'host',
      city: 'Los Angeles',
      kycStatus: 'verified',
    },
  ];

  console.log('Seeding venues and hosts into users collection...');

  for (const v of venues) {
    await db.collection('users').doc(v.id).set(v);
    await db
      .collection('venues')
      .doc(v.id)
      .set({ ...v, ownerId: v.id, visibility: 'public' });
  }

  for (const h of hosts) {
    await db.collection('users').doc(h.id).set(h);
    await db
      .collection('hosts')
      .doc(h.id)
      .set({ ...h, ownerId: h.id, visibility: 'public' });
  }

  console.log('Done!');
}

seed().catch(console.error);
