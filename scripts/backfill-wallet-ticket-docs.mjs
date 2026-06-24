import process from 'node:process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';
import { getAdminDb, isFirebaseConfigured } from '@c1rcle/core/admin';
import { generateTicketsForOrder } from '@c1rcle/core/ticket-checkout-wallet-service';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORDER_COLLECTIONS = ['orders', 'rsvp_orders'];

[
  resolve(REPO_ROOT, '.env'),
  resolve(REPO_ROOT, 'apps/api-gateway/.env.development'),
  resolve(REPO_ROOT, 'apps/api-gateway/.env.production'),
  resolve(REPO_ROOT, 'apps/partner-dashboard/.env.local'),
  resolve(REPO_ROOT, 'apps/partner-dashboard/.env.development'),
  resolve(REPO_ROOT, 'apps/partner-dashboard/.env.production'),
].forEach((envPath) => {
  if (existsSync(envPath)) {
    loadEnv({ path: envPath, override: false });
  }
});

function parseArgs(argv) {
  const options = {
    write: false,
    limit: null,
    orderId: '',
    collection: '',
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
    if (arg === '--order') {
      options.orderId = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (arg === '--collection') {
      options.collection = String(argv[index + 1] || '').trim();
      index += 1;
    }
  }

  return options;
}

function expectedTicketCount(order) {
  return Math.max(
    0,
    (Array.isArray(order.tickets) ? order.tickets : []).reduce(
      (total, ticket) => total + Math.max(1, Number(ticket.quantity || 1)),
      0,
    ),
  );
}

async function listCandidateDocs(db, collection, options) {
  if (options.orderId) {
    const doc = await db.collection(collection).doc(options.orderId).get();
    return doc.exists ? [doc] : [];
  }

  let query = db.collection(collection).where('status', '==', 'confirmed');
  if (options.limit) {
    query = query.limit(options.limit);
  }
  const snapshot = await query.get();
  return snapshot.docs;
}

async function countExistingTicketDocs(db, orderId) {
  const snapshot = await db.collection('tickets').where('orderId', '==', orderId).get();
  return snapshot.size;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const collections = options.collection ? [options.collection] : ORDER_COLLECTIONS;

  if (collections.some((collection) => !ORDER_COLLECTIONS.includes(collection))) {
    throw new Error(`Unsupported collection. Use one of: ${ORDER_COLLECTIONS.join(', ')}`);
  }
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase admin credentials are not configured. Aborting backfill.');
  }

  const db = getAdminDb();
  let scanned = 0;
  let alreadyComplete = 0;
  let candidates = 0;
  let changed = 0;

  for (const collection of collections) {
    const docs = await listCandidateDocs(db, collection, options);

    for (const doc of docs) {
      scanned += 1;
      const order = { id: doc.id, ...doc.data() };
      const expected = expectedTicketCount(order);
      const existing = await countExistingTicketDocs(db, doc.id);

      if (expected <= 0 || existing >= expected) {
        alreadyComplete += 1;
        continue;
      }

      candidates += 1;
      console.log(
        `${options.write ? 'BACKFILL' : 'DRY-RUN'} ${collection}/${doc.id} ` +
          `tickets=${existing}/${expected}`,
      );

      if (options.write) {
        const result = await generateTicketsForOrder({
          db,
          orderId: doc.id,
          orderCollection: collection,
        });
        changed += result?.createdTicketCount || 0;
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: options.write ? 'write' : 'dry-run',
        scanned,
        candidates,
        alreadyComplete,
        createdTicketDocs: changed,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error('[backfill-wallet-ticket-docs] failed:', error);
  process.exitCode = 1;
});
