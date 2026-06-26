#!/usr/bin/env node
import * as admin from 'firebase-admin';
import { randomBytes } from 'crypto';

const REVIEWER_EMAIL = 'reviewer@thec1rcle.com';
const REVIEWER_DISPLAY_NAME = 'App Reviewer';
const REVIEWER_PASSWORD = process.env.REVIEWER_PASSWORD || randomBytes(16).toString('hex');

const MOCK_USER_EMAIL = 'charlotte@example.com';
const MOCK_USER_DISPLAY_NAME = 'Charlotte';

let db: admin.firestore.Firestore;
let auth: admin.auth.Auth;

function fail(msg: string): never {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function isoNow(): string {
  return new Date().toISOString();
}

function isoFuture(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function isoPast(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

async function getOrCreateAuthUser(email: string, displayName: string, password?: string) {
  try {
    const user = await auth.getUserByEmail(email);
    console.log(`  User ${email} already exists (uid=${user.uid})`);
    return user;
  } catch (err: any) {
    if (err.code !== 'auth/user-not-found') throw err;
  }
  const user = await auth.createUser({
    email,
    emailVerified: true,
    password: password || randomBytes(16).toString('hex'),
    displayName,
  });
  console.log(`  Created user ${email} (uid=${user.uid})`);
  return user;
}

async function main() {
  console.log('=== Provisioning App Reviewer ===\n');

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    fail(
      'Set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON file path, ' +
        'or FIREBASE_SERVICE_ACCOUNT_KEY to the JSON string.',
    );
  }

  const credential = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))
    : admin.credential.applicationDefault();

  admin.initializeApp({ credential });
  db = admin.firestore();
  auth = admin.auth();
  console.log('Firebase Admin initialized.\n');

  // ── 1. Create Auth Users ────────────────────────────────────────────────
  console.log('[1/6] Creating auth users...');
  const reviewer = await getOrCreateAuthUser(
    REVIEWER_EMAIL,
    REVIEWER_DISPLAY_NAME,
    REVIEWER_PASSWORD,
  );
  const mockUser = await getOrCreateAuthUser(MOCK_USER_EMAIL, MOCK_USER_DISPLAY_NAME);
  const reviewerUid = reviewer.uid;
  const mockUid = mockUser.uid;
  console.log();

  // ── 2. Create User Documents ────────────────────────────────────────────
  console.log('[2/6] Creating user documents...');
  const reviewerDoc = {
    uid: reviewerUid,
    email: REVIEWER_EMAIL,
    displayName: REVIEWER_DISPLAY_NAME,
    handle: 'appreviewer',
    photoURL: '',
    avatar: '',
    phone: null,
    city: 'Mumbai, IN',
    instagram: '',
    age: null,
    gender: null,
    bio: 'Official app reviewer account.',
    attendedEvents: [] as string[],
    isVerified: true,
    onboardingComplete: true,
    createdAt: isoNow(),
    updatedAt: isoNow(),
  };
  await db.collection('users').doc(reviewerUid).set(reviewerDoc, { merge: true });
  console.log(`  Created/updated user document for ${REVIEWER_EMAIL}`);

  const mockDoc = {
    uid: mockUid,
    email: MOCK_USER_EMAIL,
    displayName: MOCK_USER_DISPLAY_NAME,
    handle: 'charlotte',
    photoURL: '',
    avatar: '',
    phone: null,
    city: 'Mumbai, IN',
    instagram: '',
    age: 28,
    gender: 'female',
    bio: 'Love exploring new events!',
    attendedEvents: [] as string[],
    isVerified: true,
    onboardingComplete: true,
    createdAt: isoNow(),
    updatedAt: isoNow(),
  };
  await db.collection('users').doc(mockUid).set(mockDoc, { merge: true });
  console.log(`  Created/updated user document for ${MOCK_USER_EMAIL}`);
  console.log();

  // ── 3. Create Events + Event Card Index ─────────────────────────────────
  console.log('[3/6] Creating mock events...');
  const events = [
    {
      id: `event_reviewer_upcoming_${Date.now()}`,
      title: 'C1RCLE Summer Mixer 2026',
      summary: 'The biggest summer party of the year!',
      description:
        'Join us for an unforgettable evening of music, dancing, and networking at the C1RCLE Summer Mixer. Featuring top DJs, live performances, and premium cocktails.',
      category: 'Music',
      host: 'C1RCLE Events',
      hostId: mockUid,
      venue: 'The Grand Ballroom',
      venueId: 'venue_grand_ballroom',
      city: 'Mumbai, IN',
      cityKey: 'mumbai-in',
      area: 'Bandra West',
      areaKey: 'bandra-west',
      startDate: isoFuture(21),
      endDate: isoFuture(22),
      startAt: isoFuture(21),
      endAt: isoFuture(22),
      lifecycle: 'live',
      visibility: 'public',
      creatorId: mockUid,
      creatorRole: 'venue',
      workspaceId: 'default',
      createdAt: isoPast(14),
      updatedAt: isoNow(),
      stats: { rsvps: 12, views: 340, saves: 8, shares: 3 },
      tags: ['music', 'summer', 'party'],
      vibes: ['lively', 'social'],
      coordinates: { latitude: 19.076, longitude: 72.8777 },
      poster: '',
      image: '',
      heatScore: 65,
      priceMin: 500,
      priceMax: 2000,
      isFree: false,
      searchText: 'c1rcle summer mixer 2026 music party grand ballroom mumbai',
    },
    {
      id: `event_reviewer_past1_${Date.now()}`,
      title: 'C1RCLE Jazz Night',
      summary: 'An evening of smooth jazz and fine dining.',
      description:
        'Experience the finest jazz musicians from around the country in an intimate setting at The Blue Note Lounge.',
      category: 'Music',
      host: 'Blue Note Collective',
      hostId: mockUid,
      venue: 'The Blue Note Lounge',
      venueId: 'venue_blue_note',
      city: 'Mumbai, IN',
      cityKey: 'mumbai-in',
      area: 'Colaba',
      areaKey: 'colaba',
      startDate: isoPast(10),
      endDate: isoPast(10),
      startAt: isoPast(10),
      endAt: isoPast(10),
      lifecycle: 'completed',
      visibility: 'public',
      creatorId: mockUid,
      creatorRole: 'venue',
      workspaceId: 'default',
      createdAt: isoPast(30),
      updatedAt: isoPast(10),
      stats: { rsvps: 45, views: 890, saves: 22, shares: 8 },
      tags: ['jazz', 'dining', 'live-music'],
      vibes: ['chill', 'sophisticated'],
      coordinates: { latitude: 18.92, longitude: 72.8328 },
      poster: '',
      image: '',
      heatScore: 40,
      priceMin: 1500,
      priceMax: 3000,
      isFree: false,
      searchText: 'c1rcle jazz night blue note lounge mumbai',
    },
    {
      id: `event_reviewer_past2_${Date.now()}`,
      title: 'C1RCLE Tech Summit',
      summary: 'Connect with innovators and thought leaders.',
      description:
        'A day-long summit featuring keynote speeches, panel discussions, and networking sessions with top tech entrepreneurs and investors.',
      category: 'Tech',
      host: 'C1RCLE Events',
      hostId: mockUid,
      venue: 'Convention Centre',
      venueId: 'venue_convention_centre',
      city: 'Mumbai, IN',
      cityKey: 'mumbai-in',
      area: 'Powai',
      areaKey: 'powai',
      startDate: isoPast(20),
      endDate: isoPast(20),
      startAt: isoPast(20),
      endAt: isoPast(20),
      lifecycle: 'completed',
      visibility: 'public',
      creatorId: mockUid,
      creatorRole: 'venue',
      workspaceId: 'default',
      createdAt: isoPast(45),
      updatedAt: isoPast(20),
      stats: { rsvps: 120, views: 2100, saves: 56, shares: 34 },
      tags: ['tech', 'networking', 'innovation'],
      vibes: ['professional', 'educational'],
      coordinates: { latitude: 19.1197, longitude: 72.9056 },
      poster: '',
      image: '',
      heatScore: 30,
      priceMin: 0,
      priceMax: 0,
      isFree: true,
      searchText: 'c1rcle tech summit convention centre mumbai',
    },
  ];

  const batch = db.batch();
  for (const event of events) {
    const eventRef = db.collection('events').doc(event.id);
    batch.set(eventRef, event, { merge: true });

    const statusKey = event.lifecycle === 'completed' ? 'ended' : 'upcoming';
    const lifecycle = statusKey === 'ended' ? 'completed' : 'scheduled';
    const dayKey = event.startDate?.slice(0, 10) || null;

    const card = {
      eventId: event.id,
      id: event.id,
      slug: event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title: event.title,
      cityKey: event.cityKey,
      cityLabel: event.city,
      areaKey: event.areaKey || '',
      startAt: event.startAt,
      endAt: event.endAt,
      dayKey,
      lifecycle,
      visibility: 'public',
      posterUrl: event.poster || null,
      image: event.image || null,
      hostId: event.hostId || null,
      hostName: event.host,
      hostSlug: event.host?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || null,
      venueId: event.venueId || null,
      venueName: event.venue,
      venueSlug: event.venue?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || null,
      venue: event.venue,
      host: event.host,
      priceMin: event.priceMin,
      priceMax: event.priceMax,
      isFree: event.isFree,
      price: event.priceMin,
      startingPrice: event.priceMin,
      priceRange: { min: event.priceMin, max: event.priceMax, currency: 'INR' },
      tags: event.tags,
      eventType: event.category,
      curatedCategory: event.category,
      category: event.category,
      heatScore: event.heatScore,
      searchText: event.searchText || event.title.toLowerCase(),
      publishedAt: isoPast(14),
      updatedAt: isoNow(),
      status: lifecycle,
      statusKey,
      description: event.description || '',
      summary: event.summary || '',
      location: event.venue,
      city: event.city,
      date: event.startDate,
      startDate: event.startDate,
      endDate: event.endDate,
      startDateTime: event.startAt,
      guests: ['New', 'Guests'],
      trending: event.heatScore > 40,
      stats: event.stats,
      readModelVersion: 2,
      sourceUpdatedAt: event.updatedAt,
    };
    const cardRef = db.collection('event_card_index').doc(event.id);
    batch.set(cardRef, card, { merge: true });

    console.log(`  Created event: ${event.title} (${statusKey})`);
  }
  await batch.commit();
  console.log();

  // ── 4. Add Attendance (Likes) ──────────────────────────────────────────
  console.log('[4/6] Adding reviewer as attendee...');
  const likeBatch = db.batch();
  const attendedEventIds: string[] = [];
  for (const event of events) {
    const likeId = `${reviewerUid}_${event.id}`;
    const likeRef = db.collection('likes').doc(likeId);
    likeBatch.set(likeRef, {
      userId: reviewerUid,
      eventId: event.id,
      createdAt: isoNow(),
    });
    attendedEventIds.push(event.id);

    const eventRef = db.collection('events').doc(event.id);
    likeBatch.update(eventRef, { 'stats.saves': admin.firestore.FieldValue.increment(1) });

    console.log(`  Marked attendance: ${event.title}`);
  }
  await likeBatch.commit();

  const userRef = db.collection('users').doc(reviewerUid);
  await userRef.update({
    attendedEvents: admin.firestore.FieldValue.arrayUnion(...attendedEventIds),
  });
  console.log('  Updated user attendedEvents.');
  console.log();

  // ── 5. Create DM Conversations ──────────────────────────────────────────
  console.log('[5/6] Creating DM conversations...');
  const convo1Id = `convo_reviewer_${Date.now()}_1`;
  const convo1 = {
    eventId: events[0].id,
    participants: [reviewerUid, mockUid],
    status: 'accepted',
    initiatedBy: mockUid,
    acceptedAt: isoPast(5),
    createdAt: isoPast(7),
    expiresAt: isoFuture(7),
    isSaved: false,
    lastMessage: {
      content: 'Hey! So excited for the Summer Mixer! Are you going?',
      senderId: mockUid,
      createdAt: isoPast(1),
    },
    updatedAt: isoPast(1),
  };
  await db.collection('privateConversations').doc(convo1Id).set(convo1);

  const convo1Messages = [
    {
      conversationId: convo1Id,
      senderId: mockUid,
      content: 'Hey! So excited for the Summer Mixer! Are you going?',
      type: 'text',
      createdAt: isoPast(1),
      readAt: isoNow(),
      isDeleted: false,
    },
    {
      conversationId: convo1Id,
      senderId: reviewerUid,
      content: 'Definitely! I heard the lineup is amazing this year.',
      type: 'text',
      createdAt: isoPast(1),
      readAt: isoNow(),
      isDeleted: false,
    },
    {
      conversationId: convo1Id,
      senderId: mockUid,
      content: 'Yes! I have a couple of friends coming too. See you there! 🎉',
      type: 'text',
      createdAt: isoPast(1),
      readAt: isoNow(),
      isDeleted: false,
    },
  ];
  for (const msg of convo1Messages) {
    await db.collection('directMessages').add(msg);
  }
  console.log(`  Created conversation 1: Summer Mixer chat (${convo1Messages.length} messages)`);

  const convo2Id = `convo_reviewer_${Date.now()}_2`;
  const convo2 = {
    eventId: events[1].id,
    participants: [reviewerUid, mockUid],
    status: 'accepted',
    initiatedBy: reviewerUid,
    acceptedAt: isoPast(8),
    createdAt: isoPast(10),
    expiresAt: isoFuture(7),
    isSaved: false,
    lastMessage: {
      content: 'That jazz night was incredible! We should go again next month.',
      senderId: reviewerUid,
      createdAt: isoPast(9),
    },
    updatedAt: isoPast(9),
  };
  await db.collection('privateConversations').doc(convo2Id).set(convo2);

  const convo2Messages = [
    {
      conversationId: convo2Id,
      senderId: reviewerUid,
      content: 'Hey! The Jazz Night was amazing. Thanks for suggesting it!',
      type: 'text',
      createdAt: isoPast(9),
      readAt: isoNow(),
      isDeleted: false,
    },
    {
      conversationId: convo2Id,
      senderId: mockUid,
      content: 'Right?! The saxophonist was unreal. Want to check out the next one?',
      type: 'text',
      createdAt: isoPast(9),
      readAt: isoNow(),
      isDeleted: false,
    },
    {
      conversationId: convo2Id,
      senderId: reviewerUid,
      content: 'That jazz night was incredible! We should go again next month.',
      type: 'text',
      createdAt: isoPast(9),
      readAt: isoNow(),
      isDeleted: false,
    },
  ];
  for (const msg of convo2Messages) {
    await db.collection('directMessages').add(msg);
  }
  console.log(`  Created conversation 2: Jazz Night chat (${convo2Messages.length} messages)`);
  console.log();

  // ── 6. Create Premium Subscription ──────────────────────────────────────
  console.log('[6/6] Granting Premium subscription...');
  const expiresFar = new Date('2099-12-31T23:59:59.999Z').toISOString();
  await db
    .collection('users')
    .doc(reviewerUid)
    .set(
      {
        isPremium: true,
        subscription: {
          tier: 'premium',
          isPremium: true,
          status: 'active',
          expiresAt: expiresFar,
          updatedAt: isoNow(),
          lastEvent: 'INITIAL_PURCHASE',
          productId: 'premium_yearly',
          environment: 'PRODUCTION',
        },
      },
      { merge: true },
    );
  console.log('  Premium subscription granted (expires 2099).');
  console.log();

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('=== Provision Complete ===');
  console.log();
  console.log('Login credentials:');
  console.log(`  Email:    ${REVIEWER_EMAIL}`);
  console.log(`  Password: ${REVIEWER_PASSWORD}`);
  console.log();
  console.log('Seeded data:');
  console.log(`  Events:   ${events.length} (1 upcoming, 2 past)`);
  console.log(`  DMs:      2 conversations with mock user`);
  console.log(`  Tier:     Premium (no paywall)`);
  console.log();
  if (!process.env.REVIEWER_PASSWORD) {
    console.warn(
      'WARNING: Password was auto-generated. Set REVIEWER_PASSWORD env var to use a custom password.',
    );
    console.warn('         Save this password before closing this terminal!');
  }
}

main().catch((err) => {
  console.error('Provisioning failed:', err);
  process.exit(1);
});
