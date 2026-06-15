import process from 'node:process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';
import { getAdminDb, isFirebaseConfigured } from '@c1rcle/core/admin';

const EVENT_COLLECTION = 'events';
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

[
  resolve(REPO_ROOT, '.env'),
  resolve(REPO_ROOT, 'apps/partner-dashboard/.env.local'),
  resolve(REPO_ROOT, 'apps/partner-dashboard/.env.development'),
  resolve(REPO_ROOT, 'apps/partner-dashboard/.env.production'),
  resolve(REPO_ROOT, 'apps/partner-dashboard/.env.staging'),
  resolve(REPO_ROOT, 'apps/guest-portal/.env.local'),
  resolve(REPO_ROOT, 'apps/guest-portal/.env.development'),
  resolve(REPO_ROOT, 'apps/guest-portal/.env.production'),
  resolve(REPO_ROOT, 'apps/guest-portal/.env.staging'),
].forEach((envPath) => {
  if (existsSync(envPath)) {
    loadEnv({ path: envPath, override: false });
  }
});

const slugifyPartnerValue = (value) => {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

const buildPartnerSnapshot = (doc, type, fallbackName) => {
  if (!doc?.exists) return null;
  const data = doc.data() || {};
  const name =
    data.name || data.displayName || data.venueName || data.hostName || fallbackName || doc.id;

  const handle = data.handle || null;
  const slug = data.slug || slugifyPartnerValue(handle || name || doc.id) || doc.id;

  const photoURL = data.photoURL || data.avatar || data.image || data.logo || null;
  const coverURL = data.coverURL || data.cover || data.image || null;

  return {
    id: doc.id,
    type,
    slug,
    handle,
    name,
    avatar: data.avatar || photoURL,
    photoURL,
    image: data.image || photoURL,
    cover: data.cover || coverURL,
    coverURL,
    verified: Boolean(data.verified),
    role: data.role || type,
    city: data.city || null,
    neighborhood: data.neighborhood || null,
  };
};

const normalizeCreatorRole = (value) => {
  if (value === 'club') return 'venue';
  return value;
};

const parseArgs = (argv) => {
  const options = {
    write: false,
    limit: null,
    eventId: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--write') {
      options.write = true;
      continue;
    }

    if (arg === '--limit') {
      options.limit = Number(argv[index + 1]) || null;
      index += 1;
      continue;
    }

    if (arg === '--event') {
      options.eventId = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
  }

  return options;
};

const resolveTargetRefs = (event) => {
  const normalizedRole = normalizeCreatorRole(event.creatorRole);

  return {
    hostId: event.hostId || (normalizedRole === 'host' ? event.creatorId : null),
    venueId: event.venueId || (normalizedRole === 'venue' ? event.creatorId : null),
    hostFallbackName: event.host || event.hostName || null,
    venueFallbackName: event.venueName || event.venue || null,
  };
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));

  if (!isFirebaseConfigured()) {
    throw new Error('Firebase admin credentials are not configured. Aborting backfill.');
  }

  const db = getAdminDb();
  let docs = [];

  if (options.eventId) {
    const doc = await db.collection(EVENT_COLLECTION).doc(options.eventId).get();
    if (!doc.exists) {
      console.log('No matching events found.');
      return;
    }
    docs = [doc];
  } else {
    let query = db.collection(EVENT_COLLECTION);
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      console.log('No matching events found.');
      return;
    }

    docs = snapshot.docs;
  }

  let scanned = 0;
  let changed = 0;
  let skipped = 0;

  for (const doc of docs) {
    scanned += 1;
    const event = doc.data() || {};
    const { hostId, venueId, hostFallbackName, venueFallbackName } = resolveTargetRefs(event);

    const [hostDoc, venueDoc] = await Promise.all([
      hostId
        ? db
            .collection('hosts')
            .doc(hostId)
            .get()
            .catch(() => null)
        : Promise.resolve(null),
      venueId
        ? db
            .collection('venues')
            .doc(venueId)
            .get()
            .catch(() => null)
        : Promise.resolve(null),
    ]);

    const nextHostData = event.hostData || buildPartnerSnapshot(hostDoc, 'host', hostFallbackName);
    const nextVenueData =
      event.venueData || buildPartnerSnapshot(venueDoc, 'venue', venueFallbackName);

    const needsHostBackfill = !event.hostData && nextHostData;
    const needsVenueBackfill = !event.venueData && nextVenueData;

    if (!needsHostBackfill && !needsVenueBackfill) {
      skipped += 1;
      continue;
    }

    changed += 1;
    const updates = {
      ...(needsHostBackfill ? { hostData: nextHostData } : {}),
      ...(needsVenueBackfill ? { venueData: nextVenueData } : {}),
      updatedAt: new Date().toISOString(),
    };

    if (options.write) {
      await doc.ref.update(updates);
    }

    console.log(
      `${options.write ? 'UPDATED' : 'DRY-RUN'} ${doc.id} ` +
        `${needsHostBackfill ? '[hostData]' : ''}${needsVenueBackfill ? '[venueData]' : ''}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        mode: options.write ? 'write' : 'dry-run',
        scanned,
        changed,
        skipped,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error('[backfill-event-partner-snapshots] failed:', error);
  process.exitCode = 1;
});
