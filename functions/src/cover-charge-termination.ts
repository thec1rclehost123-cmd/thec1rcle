/**
 * Cover Wallet Termination Cloud Function
 *
 * Runs on two triggers:
 *   1. Scheduled: Every 15 minutes (catches the 5 AM window precisely)
 *   2. Event lifecycle change: When event.lifecycle transitions to 'completed'
 *
 * Idempotent: safe to run multiple times — expired wallets are already in EXPIRED state.
 */

import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import {
  terminateExpiredWallets,
  generateReconciliation,
} from '../../packages/core/cover-charge-engine.js';

if (!admin.apps.length) {
  admin.initializeApp();
}

const logger = functions.logger;

// ---------------------------------------------------------------------------
// 1. Scheduled sweep — runs every 15 minutes
// ---------------------------------------------------------------------------

export const sweepExpiredCoverWallets = functions.scheduler.onSchedule(
  {
    schedule: 'every 15 minutes',
    timeZone: 'Asia/Kolkata',
    region: 'asia-south1',
  },
  async () => {
    const db = admin.firestore();

    // Find all active wallets whose terminationTime has passed
    const now = new Date().toISOString();
    const expiredWalletsSnap = await db
      .collection('cover_wallets')
      .where('state', '==', 'ACTIVE')
      .where('rules.terminationTime', '<=', now)
      .get();

    if (expiredWalletsSnap.empty) {
      logger.info('[CoverWallet] No expired wallets to process');
      return;
    }

    // Group by eventId for batched reconciliation
    const eventIds = new Set<string>();
    for (const doc of expiredWalletsSnap.docs) {
      eventIds.add(doc.data().eventId);
    }

    for (const eventId of eventIds) {
      try {
        const { terminated, errors } = await terminateExpiredWallets(eventId);
        logger.info(`[CoverWallet] Event ${eventId}: terminated=${terminated}`);

        if (errors.length > 0) {
          logger.error(`[CoverWallet] Event ${eventId} errors: ${errors.join(', ')}`);
        }

        // Check if the event is completed — if so, generate reconciliation
        const eventDoc = await db.collection('events').doc(eventId).get();
        if (eventDoc.exists && eventDoc.data()?.lifecycle === 'completed') {
          const venueId = eventDoc.data()?.venueId || '';
          await generateReconciliation(eventId, venueId);
          logger.info(`[CoverWallet] Reconciliation generated for event ${eventId}`);
        }
      } catch (err: any) {
        logger.error(`[CoverWallet] Failed to process event ${eventId}: ${err.message}`);
      }
    }
  },
);

// ---------------------------------------------------------------------------
// 2. Event lifecycle trigger — when event transitions to 'completed'
// ---------------------------------------------------------------------------

export const onEventCompleted = functions.firestore.onDocumentUpdated(
  {
    document: 'events/{eventId}',
    region: 'asia-south1',
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;
    if (before.lifecycle === after.lifecycle) return;
    if (after.lifecycle !== 'completed') return;

    const eventId = event.params.eventId;
    const venueId = after.venueId || '';

    logger.info(`[CoverWallet] Event ${eventId} completed — running termination sweep`);

    try {
      const { terminated, errors } = await terminateExpiredWallets(eventId);
      logger.info(`[CoverWallet] Terminated ${terminated} wallets for event ${eventId}`);

      if (errors.length > 0) {
        logger.error(`[CoverWallet] Errors: ${errors.join(', ')}`);
      }

      await generateReconciliation(eventId, venueId);
      logger.info(`[CoverWallet] Reconciliation generated for event ${eventId}`);
    } catch (err: any) {
      logger.error(`[CoverWallet] Failed to terminate/reconcile event ${eventId}: ${err.message}`);
    }
  },
);
