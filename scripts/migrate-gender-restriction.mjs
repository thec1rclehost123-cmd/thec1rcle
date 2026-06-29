#!/usr/bin/env node

/**
 * THE C1RCLE - Gender Restriction Field Migration Script
 *
 * Backfills the canonical `genderRestriction` field on existing
 * events, orders, entitlements, ticket_assignments, and transfers
 * by inferring it from legacy fields.
 *
 * Inference logic mirrors inferGenderRequirement() in ticket-share-engine.js:
 *   genderRestriction = genderRestriction || genderRequirement || requiredGender || gender || (entryType)
 *
 * Usage:
 *   node scripts/migrate-gender-restriction.mjs          # live run
 *   node scripts/migrate-gender-restriction.mjs --dry-run # preview only
 *
 * Environment (tried in order):
 *   • Explicit env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *   • apps/partner-dashboard/.env.local
 *   • apps/api-gateway/.env.development
 *   • .env.local (repo root)
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');

// ── Credential loading ──
const ENV_PATHS = [
  path.resolve(__dirname, '../apps/partner-dashboard/.env.local'),
  path.resolve(__dirname, '../apps/api-gateway/.env.development'),
  path.resolve(__dirname, '../.env.local'),
];

if (!process.env.FIREBASE_PROJECT_ID) {
  for (const envPath of ENV_PATHS) {
    dotenv.config({ path: envPath });
    if (process.env.FIREBASE_PROJECT_ID) break;
  }
}

// ── Config ──
const BATCH_SIZE = 490; // Firestore limit is 500, keep margin

function inferGenderRestriction(doc) {
  const explicit =
    doc.genderRestriction || doc.genderRequirement || doc.requiredGender || doc.gender || '';
  const str = String(explicit).toLowerCase().trim();
  if (str === 'female' || str === 'male') return str;

  const entryType = String(doc.entryType || '')
    .toLowerCase()
    .trim();
  if (entryType === 'female') return 'female';
  if (entryType === 'stag' || entryType === 'male') return 'male';

  return null;
}

async function chunkedUpdates(db, collectionName, updates) {
  if (updates.length === 0) return;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = updates.slice(i, i + BATCH_SIZE);
    for (const { ref, data } of chunk) {
      batch.update(ref, data);
    }
    if (!DRY_RUN) {
      await batch.commit();
    }
  }
}

async function migrate() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      'Missing Firebase credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.',
    );
    if (DRY_RUN) {
      console.log('Dry-run cannot proceed without credentials. Exit.');
    }
    process.exit(1);
  }

  if (!getApps().length) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }

  const db = getFirestore();

  if (DRY_RUN) {
    console.log('═══ DRY RUN — no writes will be performed ═══');
  }

  let totalUpdated = 0;

  // ── 1. Events: ticketCatalog.tiers[].genderRestriction ──
  console.log('\n── Migrating events …');
  const eventsSnap = await db.collection('events').select('ticketCatalog', 'tickets').get();
  const eventUpdates = [];
  for (const doc of eventsSnap.docs) {
    const data = doc.data();
    let needsUpdate = false;
    const tiers = data.ticketCatalog?.tiers || data.tickets || [];
    for (const tier of tiers) {
      if (tier.genderRestriction) continue;
      const inferred = inferGenderRestriction(tier);
      if (inferred) {
        tier.genderRestriction = inferred;
        needsUpdate = true;
      }
    }
    if (needsUpdate) {
      const ref = db.collection('events').doc(doc.id);
      if (data.ticketCatalog) {
        eventUpdates.push({ ref, data: { 'ticketCatalog.tiers': tiers } });
      } else {
        eventUpdates.push({ ref, data: { tickets: tiers } });
      }
    }
  }
  await chunkedUpdates(db, 'events', eventUpdates);
  console.log(`  ${DRY_RUN ? 'Would update' : 'Updated'} ${eventUpdates.length} events`);
  totalUpdated += eventUpdates.length;

  // ── 2. Orders: tickets[].genderRestriction ──
  console.log('\n── Migrating orders …');
  const ordersSnap = await db.collection('orders').select('tickets').get();
  const orderUpdates = [];
  for (const doc of ordersSnap.docs) {
    const data = doc.data();
    const tickets = data.tickets || [];
    let needsUpdate = false;
    for (const ticket of tickets) {
      if (ticket.genderRestriction) continue;
      const inferred = inferGenderRestriction(ticket);
      if (inferred) {
        ticket.genderRestriction = inferred;
        needsUpdate = true;
      }
    }
    if (needsUpdate) {
      orderUpdates.push({ ref: db.collection('orders').doc(doc.id), data: { tickets } });
    }
  }
  await chunkedUpdates(db, 'orders', orderUpdates);
  console.log(`  ${DRY_RUN ? 'Would update' : 'Updated'} ${orderUpdates.length} orders`);
  totalUpdated += orderUpdates.length;

  // ── 3. Entitlements: genderConstraint -> genderRestriction ──
  console.log('\n── Migrating entitlements …');
  const entsSnap = await db.collection('entitlements').select('genderConstraint').get();
  const entUpdates = [];
  for (const doc of entsSnap.docs) {
    const data = doc.data();
    if (data.genderConstraint && data.genderConstraint !== 'none') {
      entUpdates.push({
        ref: db.collection('entitlements').doc(doc.id),
        data: { genderRestriction: data.genderConstraint },
      });
    }
  }
  await chunkedUpdates(db, 'entitlements', entUpdates);
  console.log(`  ${DRY_RUN ? 'Would update' : 'Updated'} ${entUpdates.length} entitlements`);
  totalUpdated += entUpdates.length;

  // ── 4. Ticket assignments ──
  console.log('\n── Migrating ticket assignments …');
  const assignSnap = await db.collection('ticket_assignments').select('requiredGender').get();
  const assignUpdates = [];
  for (const doc of assignSnap.docs) {
    const data = doc.data();
    if (data.requiredGender && data.requiredGender !== 'any') {
      assignUpdates.push({
        ref: db.collection('ticket_assignments').doc(doc.id),
        data: { genderRestriction: data.requiredGender },
      });
    }
  }
  await chunkedUpdates(db, 'ticket_assignments', assignUpdates);
  console.log(
    `  ${DRY_RUN ? 'Would update' : 'Updated'} ${assignUpdates.length} ticket assignments`,
  );
  totalUpdated += assignUpdates.length;

  // ── 5. Transfers ──
  console.log('\n── Migrating transfers …');
  const transferSnap = await db.collection('transfers').select('requiredGender').get();
  const transferUpdates = [];
  for (const doc of transferSnap.docs) {
    const data = doc.data();
    if (data.requiredGender && data.requiredGender !== 'any') {
      transferUpdates.push({
        ref: db.collection('transfers').doc(doc.id),
        data: { genderRestriction: data.requiredGender },
      });
    }
  }
  await chunkedUpdates(db, 'transfers', transferUpdates);
  console.log(`  ${DRY_RUN ? 'Would update' : 'Updated'} ${transferUpdates.length} transfers`);
  totalUpdated += transferUpdates.length;

  console.log(
    `\n${DRY_RUN ? '🔍 Dry-run complete' : '✅ Migration complete'}. ${totalUpdated} documents to update.`,
  );
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
