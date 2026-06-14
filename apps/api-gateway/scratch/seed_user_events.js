import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env.development') });

let privateKey = process.env.FIREBASE_PRIVATE_KEY;
if (privateKey?.startsWith('"') && privateKey?.endsWith('"')) {
    privateKey = privateKey.substring(1, privateKey.length - 1);
}
privateKey = privateKey?.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n').trim();
if (privateKey && !privateKey.endsWith('\n')) {
    privateKey += '\n';
}

initializeApp({
    credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
    }),
});

const db = getFirestore();
const userId = 'EenJl51N0rSf5y5oetrOd0GHPIl1';

async function seed() {
  console.log('Seeding events for user:', userId);

  // 1. Create an Upcoming Event
  const upcomingEventId = 'test-upcoming-' + Date.now();
  const upcomingDate = new Date();
  upcomingDate.setDate(upcomingDate.getDate() + 7);
  
  const upcomingEvent = {
    id: upcomingEventId,
    title: 'Future Vibes: The C1rcle Unleashed',
    description: 'A futuristic gathering for the elite.',
    startDate: upcomingDate.toISOString().split('T')[0],
    startTime: '21:00',
    location: 'Sky Deck, Mumbai',
    venue: 'Sky Deck',
    image: '/events/placeholder.svg',
    status: 'active',
    isRSVP: true,
    priceRange: { min: 0, max: 0, currency: 'INR' },
    createdAt: FieldValue.serverTimestamp()
  };

  await db.collection('events').doc(upcomingEventId).set(upcomingEvent);
  
  // Create RSVP for upcoming
  await db.collection('rsvp_orders').add({
    userId,
    eventId: upcomingEventId,
    eventTitle: upcomingEvent.title,
    eventDate: upcomingEvent.startDate,
    eventImage: upcomingEvent.image,
    status: 'confirmed',
    createdAt: FieldValue.serverTimestamp()
  });

  // 2. Create a Past Event
  const pastEventId = 'test-past-' + Date.now();
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 10);

  const pastEvent = {
    id: pastEventId,
    title: 'Retro Night: The Beginning',
    description: 'Where it all started.',
    startDate: pastDate.toISOString().split('T')[0],
    startTime: '20:00',
    location: 'Antigravity Club, Pune',
    venue: 'Antigravity Club',
    image: '/events/placeholder.svg',
    status: 'completed',
    isRSVP: true,
    priceRange: { min: 0, max: 0, currency: 'INR' },
    createdAt: FieldValue.serverTimestamp()
  };

  await db.collection('events').doc(pastEventId).set(pastEvent);

  // Create RSVP for past
  await db.collection('rsvp_orders').add({
    userId,
    eventId: pastEventId,
    eventTitle: pastEvent.title,
    eventDate: pastEvent.startDate,
    eventImage: pastEvent.image,
    status: 'attended',
    createdAt: FieldValue.serverTimestamp()
  });

  console.log('Successfully seeded 1 upcoming and 1 past event for the user!');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
