#!/usr/bin/env node

import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { FieldPath, getFirestore } from 'firebase-admin/firestore';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const projectArgIndex = process.argv.indexOf('--project-id');
const projectId =
  projectArgIndex >= 0 ? process.argv[projectArgIndex + 1] : process.env.FIREBASE_PROJECT_ID;

if (!projectId) {
  throw new Error('FIREBASE_PROJECT_ID or --project-id is required');
}

if (getApps().length === 0) {
  initializeApp({ credential: applicationDefault(), projectId });
}

const db = getFirestore();
const pageSize = 400;
let cursor = null;
let scanned = 0;
let eligible = 0;
let invalid = 0;
let updated = 0;

for (;;) {
  let query = db.collection('cover_wallets').orderBy(FieldPath.documentId()).limit(pageSize);
  if (cursor) query = query.startAfter(cursor);
  const snapshot = await query.get();
  if (snapshot.empty) break;

  const batch = db.batch();
  let batchWrites = 0;
  for (const document of snapshot.docs) {
    scanned += 1;
    const wallet = document.data();
    if (Number.isSafeInteger(wallet.terminationAtMs) && wallet.terminationAtMs > 0) continue;
    const terminationAtMs = new Date(wallet.rules?.terminationTime || '').getTime();
    if (!Number.isSafeInteger(terminationAtMs) || terminationAtMs <= 0) {
      invalid += 1;
      continue;
    }
    eligible += 1;
    if (apply) {
      batch.update(document.ref, {
        terminationAtMs,
        terminationAtBackfilledAt: new Date().toISOString(),
      });
      batchWrites += 1;
    }
  }
  if (apply && batchWrites > 0) {
    await batch.commit();
    updated += batchWrites;
  }
  cursor = snapshot.docs.at(-1);
  if (snapshot.size < pageSize) break;
}

console.log(
  JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    projectId,
    scanned,
    eligible,
    updated,
    invalid,
  }),
);

if (invalid > 0) process.exitCode = 2;
