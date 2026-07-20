import { readFileSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import {
  buildEventCardReadModel,
  buildHostSummaryReadModel,
  buildVenueSummaryReadModel,
  normalizeCityKey,
} from '@c1rcle/core/guest-discovery-engine';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const mobileDirectory = join(scriptDirectory, '..', 'mobile-app');
const demoSourcePath = join(mobileDirectory, 'lib', 'demo', 'index.ts');
const stagingEnvPath = join(scriptDirectory, '.env.staging');
const dryRun = process.argv.includes('--dry-run');

dotenv.config({ path: stagingEnvPath });

const STAGING_PROJECT_ID = 'c1rcle-staging';
const projectId = process.env.FIREBASE_PROJECT_ID;
if (projectId !== STAGING_PROJECT_ID) {
  throw new Error(
    `Refusing to seed project ${projectId || '(missing)'}. This script is locked to ${STAGING_PROJECT_ID}.`,
  );
}

const requiredEnvironment = ['FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
for (const key of requiredEnvironment) {
  if (!process.env[key]) throw new Error(`Missing required staging environment variable: ${key}`);
}

const posterAssetFiles: Record<string, string> = {
  afterhours: 'afterhours.jpg',
  aquaSundays: 'aqua-sundays.jpg',
  eclipse: 'eclipse.jpg',
  houseOfAfro: 'house-of-afro.jpg',
  logoCircle: 'logo-circle.jpg',
  midnightClub: 'midnight-club.jpg',
  neonDistrict: 'neon-district.jpg',
  noSignal: 'no-signal.jpg',
  redRoom: 'red-room.jpg',
  velvetNights: 'velvet-nights.jpg',
  newPoster1: 'playboy_delhi.png',
  newPoster2: 'new_poster_2.png',
  newPoster3: 'new_poster_3.png',
  newPoster4: 'new_poster_4.jpg',
  newPoster5: 'new_poster_5.png',
};

function slugify(value: unknown) {
  return (
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'unknown'
  );
}

function removeUndefined(value: any): any {
  if (Array.isArray(value)) return value.map(removeUndefined);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, removeUndefined(entry)]),
  );
}

function readDemoEvents(): any[] {
  const source = readFileSync(demoSourcePath, 'utf8');
  const exportStart = source.indexOf('export const DEMO_EVENTS');
  const equals = source.indexOf('=', exportStart);
  const arrayStart = source.indexOf('[', equals);
  const venueMarker = source.indexOf('// ── Venues', arrayStart);
  const arrayEnd = source.lastIndexOf(']', venueMarker);

  if ([exportStart, equals, arrayStart, venueMarker, arrayEnd].some((index) => index < 0)) {
    throw new Error(`Unable to locate DEMO_EVENTS in ${demoSourcePath}`);
  }

  const literal = source
    .slice(arrayStart, arrayEnd + 1)
    .replace(/DEMO_POSTERS\.([a-zA-Z0-9_]+)/g, '"poster://$1"');
  const events = Function(`"use strict"; return (${literal});`)();
  if (!Array.isArray(events)) throw new Error('DEMO_EVENTS did not evaluate to an array');
  return events;
}

function validateEvents(events: any[]) {
  const ids = new Set<string>();
  const now = Date.now();

  for (const event of events) {
    if (!event.id || ids.has(event.id))
      throw new Error(`Missing or duplicate event id: ${event.id}`);
    ids.add(event.id);

    const start = new Date(event.startDate).getTime();
    const end = new Date(event.endDate).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      throw new Error(`${event.id} has an invalid date`);
    }
    if (end <= start) throw new Error(`${event.id} ends before it starts`);
    if (end <= now) throw new Error(`${event.id} is not current or upcoming`);
    if (!Array.isArray(event.tickets) || event.tickets.length === 0) {
      throw new Error(`${event.id} has no ticket tiers`);
    }

    const tierIds = new Set<string>();
    for (const tier of event.tickets) {
      if (!tier.id || tierIds.has(tier.id)) throw new Error(`${event.id} has a duplicate tier id`);
      tierIds.add(tier.id);
      const capacity = Number(tier.quantity);
      const remaining = Number(tier.remaining);
      if (!Number.isInteger(capacity) || capacity <= 0) {
        throw new Error(`${event.id}/${tier.id} has invalid capacity`);
      }
      if (!Number.isInteger(remaining) || remaining < 0 || remaining > capacity) {
        throw new Error(`${event.id}/${tier.id} has invalid remaining inventory`);
      }
      if (!Number.isFinite(Number(tier.price)) || Number(tier.price) < 0) {
        throw new Error(`${event.id}/${tier.id} has an invalid price`);
      }
    }
  }
}

const app = initializeApp(
  {
    credential: cert({
      projectId,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }),
    storageBucket:
      process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  },
  'qa-demo-event-seeder',
);

async function uploadPosters(posterKeys: string[]) {
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) throw new Error('Staging Firebase Storage bucket is not configured');

  const bucket = getStorage(app).bucket(bucketName);
  const uniqueKeys = [...new Set(posterKeys)];
  const entries = await Promise.all(
    uniqueKeys.map(async (key) => {
      const assetFile = posterAssetFiles[key];
      if (!assetFile) throw new Error(`No local poster asset mapping for ${key}`);
      const sourcePath = join(mobileDirectory, 'assets', 'posters', assetFile);
      const extension = extname(assetFile).toLowerCase();
      const contentType = extension === '.png' ? 'image/png' : 'image/jpeg';
      const destination = `qa/demo-events/${key}${extension}`;
      const file = bucket.file(destination);

      await bucket.upload(sourcePath, {
        destination,
        metadata: {
          cacheControl: 'public, max-age=31536000, immutable',
          contentType,
          metadata: { seededBy: 'apps/api-gateway/seed-demo-events.ts' },
        },
      });
      const [url] = await file.getSignedUrl({ action: 'read', expires: '2070-01-01' });
      return [key, url] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<string, string>;
}

function preserveDynamicTierState(seedTier: any, existingTier: any) {
  if (!existingTier) return seedTier;

  return removeUndefined({
    ...existingTier,
    ...seedTier,
    // Re-seeding repairs fixture metadata, but it must never manufacture or
    // erase availability after QA purchases, holds, transfers, or claims.
    remaining: existingTier.remaining ?? seedTier.remaining,
    sold: existingTier.sold ?? seedTier.sold,
    soldQuantity: existingTier.soldQuantity ?? seedTier.soldQuantity,
    heldQuantity: existingTier.heldQuantity,
    lockedQuantity: existingTier.lockedQuantity,
    inventory: {
      ...seedTier.inventory,
      ...(existingTier.inventory || {}),
    },
  });
}

function canonicalizeEvent(
  source: any,
  posterUrls: Record<string, string>,
  now: string,
  existingEvent: any = null,
) {
  const posterKey = String(source.poster || source.image || source.coverImage).replace(
    'poster://',
    '',
  );
  const poster = posterUrls[posterKey];
  if (!poster) throw new Error(`No uploaded poster URL for ${source.id}`);

  const existingTiers = new Map(
    (Array.isArray(existingEvent?.tickets) ? existingEvent.tickets : []).map((tier: any) => [
      String(tier.tierId || tier.id),
      tier,
    ]),
  );
  const tickets = source.tickets.map((tier: any) => {
    const totalQuantity = Number(tier.quantity);
    const remaining = Number(tier.remaining);
    const soldQuantity = totalQuantity - remaining;
    const canonicalTier = {
      ...tier,
      tierId: tier.id,
      currency: 'INR',
      basePrice: Number(tier.price),
      price: Number(tier.price),
      quantity: totalQuantity,
      totalQuantity,
      remaining,
      sold: soldQuantity,
      soldQuantity,
      status: 'active',
      salesStart: '2026-07-01T00:00:00.000Z',
      salesEnd: source.startDate,
      limits: { minPerOrder: 1, maxPerOrder: Math.min(10, remaining) },
      inventory: {
        type: 'finite',
        totalQuantity,
        soldQuantity,
        heldQuantity: 0,
      },
    };
    return preserveDynamicTierState(
      canonicalTier,
      existingTiers.get(String(tier.id)),
    );
  });
  const prices = tickets.map((tier: any) => tier.price);
  const venueId = `demo-venue-${slugify(source.venue)}`;
  const hostSlug = slugify(source.hostName || source.hostId);
  const venueSlug = slugify(source.venue);
  const cityKey = normalizeCityKey(source.city || source.location);

  return {
    ...source,
    poster,
    image: poster,
    coverImage: poster,
    slug: `${slugify(source.title)}-${source.id.replace('demo-event-', '')}`,
    cityKey,
    startAt: source.startDate,
    endAt: source.endDate,
    startDateTime: source.startDate,
    timezone: 'Asia/Kolkata',
    lifecycle: 'scheduled',
    status: 'scheduled',
    visibility: 'public',
    isPrivate: false,
    isDeleted: false,
    isRSVP: false,
    settings: { showExplore: true, visibility: 'public' },
    creatorRole: 'host',
    creatorId: source.hostId,
    venueId,
    venueName: source.venue,
    host: source.hostName,
    hostSlug,
    venueSlug,
    hostData: {
      id: source.hostId,
      name: source.hostName,
      handle: `@${hostSlug}`,
      avatar: poster,
      photoURL: poster,
      slug: hostSlug,
      type: 'host',
    },
    venueData: {
      id: venueId,
      name: source.venue,
      slug: venueSlug,
      photoURL: poster,
      image: poster,
      area: source.location,
      type: 'venue',
    },
    tickets,
    priceMin: Math.min(...prices),
    priceMax: Math.max(...prices),
    priceRange: { min: Math.min(...prices), max: Math.max(...prices), currency: 'INR' },
    publishedAt: existingEvent?.publishedAt || now,
    createdAt: source.createdAt || existingEvent?.createdAt || now,
    stats: existingEvent?.stats || source.stats,
    heatScore: existingEvent?.heatScore ?? source.heatScore,
    updatedAt: now,
    qaSeed: { fixture: true, seededAt: now, environment: STAGING_PROJECT_ID },
  };
}

async function seed() {
  const sourceEvents = readDemoEvents();
  validateEvents(sourceEvents);
  console.log(`Validated ${sourceEvents.length} future demo events for ${STAGING_PROJECT_ID}.`);

  const posterKeys = sourceEvents.map((event) =>
    String(event.poster || event.image || event.coverImage).replace('poster://', ''),
  );
  const db = getFirestore(app);
  const posterUrls = dryRun
    ? Object.fromEntries(
        [...new Set(posterKeys)].map((key) => [key, `https://dry-run.invalid/${key}`]),
      )
    : await uploadPosters(posterKeys);
  const now = new Date().toISOString();
  // Dry runs intentionally read the current fixtures too. That makes the
  // preview prove which live inventory values would be preserved without
  // writing or uploading anything.
  const existingSnapshots = await db.getAll(
    ...sourceEvents.map((event) => db.collection('events').doc(event.id)),
  );
  const existingEvents = new Map(
    existingSnapshots
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => [snapshot.id, snapshot.data()]),
  );
  const events = sourceEvents.map((event) =>
    canonicalizeEvent(event, posterUrls, now, existingEvents.get(event.id)),
  );
  const eventCards = events.map((event) => buildEventCardReadModel(event, { readModelVersion: 2 }));

  const hosts = [...new Map(events.map((event) => [event.hostId, event])).values()].map(
    (event) => ({
      id: event.hostId,
      slug: event.hostSlug,
      handle: `@${event.hostSlug}`,
      name: event.hostName,
      displayName: event.hostName,
      city: event.city,
      cityKey: event.cityKey,
      avatar: event.poster,
      photoURL: event.poster,
      image: event.poster,
      coverURL: event.poster,
      bio: `Staging QA host profile for ${event.hostName}.`,
      verified: true,
      publicProfileEnabled: true,
      visibility: 'public',
      followersCount: Number(event.stats?.rsvps || 0),
      createdAt: now,
      updatedAt: now,
      qaSeed: { fixture: true, seededAt: now, environment: STAGING_PROJECT_ID },
    }),
  );
  const venues = [...new Map(events.map((event) => [event.venueId, event])).values()].map(
    (event) => ({
      id: event.venueId,
      slug: event.venueSlug,
      name: event.venue,
      displayName: event.venue,
      city: event.city,
      cityKey: event.cityKey,
      area: event.location,
      address: event.location,
      photoURL: event.poster,
      image: event.poster,
      coverURL: event.poster,
      coverImage: event.poster,
      description: `Staging QA venue profile for ${event.venue}.`,
      verified: true,
      isVerified: true,
      tablesAvailable: false,
      publicProfileEnabled: true,
      visibility: 'public',
      followersCount: Number(event.stats?.rsvps || 0),
      createdAt: now,
      updatedAt: now,
      qaSeed: { fixture: true, seededAt: now, environment: STAGING_PROJECT_ID },
    }),
  );
  const hostSummaries = hosts.map((host) => buildHostSummaryReadModel(host, eventCards));
  const venueSummaries = venues.map((venue) => buildVenueSummaryReadModel(venue, eventCards));

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          projectId,
          events: events.map((event) => ({
            id: event.id,
            startDate: event.startDate,
            endDate: event.endDate,
            tiers: event.tickets.map((tier: any) => ({
              id: tier.id,
              name: tier.name,
              totalQuantity: tier.totalQuantity,
              remaining: tier.remaining,
              sold: tier.sold,
              soldQuantity: tier.soldQuantity,
              inventory: tier.inventory,
            })),
          })),
          hosts: hosts.length,
          venues: venues.length,
        },
        null,
        2,
      ),
    );
    return;
  }

  const batch = db.batch();
  for (const event of events) {
    batch.set(db.collection('events').doc(event.id), removeUndefined(event), { merge: true });
  }
  for (const card of eventCards) {
    batch.set(db.collection('event_card_index').doc(card.id), removeUndefined(card), {
      merge: true,
    });
  }
  for (const host of hosts) {
    batch.set(db.collection('hosts').doc(host.id), removeUndefined(host), { merge: true });
  }
  for (const summary of hostSummaries) {
    batch.set(db.collection('host_summary').doc(summary.id), removeUndefined(summary), {
      merge: true,
    });
  }
  for (const venue of venues) {
    batch.set(db.collection('venues').doc(venue.id), removeUndefined(venue), { merge: true });
  }
  for (const summary of venueSummaries) {
    batch.set(db.collection('venue_summary').doc(summary.id), removeUndefined(summary), {
      merge: true,
    });
  }
  batch.set(
    db.collection('system_meta').doc('qa_demo_seed'),
    {
      projectId,
      seededAt: now,
      eventIds: events.map((event) => event.id),
      eventCount: events.length,
      hostCount: hosts.length,
      venueCount: venues.length,
      source: 'apps/mobile-app/lib/demo/index.ts',
    },
    { merge: true },
  );
  await batch.commit();
  console.log(
    `Seeded ${events.length} events, ${hosts.length} hosts, ${venues.length} venues, and public read models into ${projectId}.`,
  );
}

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
