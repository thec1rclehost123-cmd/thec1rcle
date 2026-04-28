const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Load environment variables manually if needed, or assume they are in the environment
// Since I'm running this in the workspace where api-gateway has a .env, 
// I'll just use the admin sdk directly with the credentials from the env if available.

const serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, '../thec1rcle-india-firebase-adminsdk.json'), 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

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
    createdAt: admin.firestore.FieldValue.serverTimestamp()
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
    createdAt: admin.firestore.FieldValue.serverTimestamp()
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
    createdAt: admin.firestore.FieldValue.serverTimestamp()
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
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log('Successfully seeded 1 upcoming and 1 past event for the user!');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
