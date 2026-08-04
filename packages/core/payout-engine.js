/**
 * Legacy payout compatibility surface.
 *
 * partner_ledger is the only financial authority. All payout mutations stay
 * fail-closed until the provider-backed, idempotent payout workflow is launch
 * approved. The split calculator remains read-only for legacy previews/tests;
 * it must never be used to post ledger rows.
 */

import { getAdminDb } from './admin.js';

function disabledError(operation) {
  const error = new Error(
    `LEGACY_PAYOUT_ENGINE_DISABLED: ${operation} must use the canonical partner_ledger payout workflow`,
  );
  error.code = 'LEGACY_PAYOUT_ENGINE_DISABLED';
  return error;
}

export async function settleEvent() {
  throw disabledError('event settlement');
}

export async function getEligibleEventsForSettlement(options = {}) {
  const { minDaysSinceCompletion = 3, limit = 20 } = options;
  const db = getAdminDb();
  const threshold = new Date(
    Date.now() - minDaysSinceCompletion * 24 * 60 * 60 * 1000,
  ).toISOString();
  const snapshot = await db
    .collection('events')
    .where('lifecycle', '==', 'completed')
    .where('updatedAt', '<=', threshold)
    .where('settlementStatus', '==', 'pending')
    .limit(limit)
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * @deprecated Preview-only legacy calculator. Atomic sale posting uses the
 * immutable split snapshot stored on the order and partner-ledger-service.
 */
export function calculateOrderSplits(order, event, resolvedPromoterCommission = null) {
  const total = Number(order.totalAmount);
  if (total === 0) return [];

  const splits = [];
  let remaining = total;
  if (order.promoterLinkId) {
    const commissionAmount = resolvedPromoterCommission
      ? resolvedPromoterCommission.amount
      : order.promoterAttribution?.commissionAmount || Math.round(total * 0.1);
    const promoterId = resolvedPromoterCommission
      ? resolvedPromoterCommission.promoterId
      : order.promoterAttribution?.promoterId || 'UNKNOWN_PROMOTER';
    if (commissionAmount > 0) {
      splits.push({
        actorId: promoterId,
        actorType: 'promoter',
        amount: Math.min(commissionAmount, remaining),
        description: `Promoter Commission for ${order.id}`,
      });
      remaining -= splits[splits.length - 1].amount;
    }
  }

  const platformFee = Math.round(total * 0.05);
  splits.push({
    actorId: 'C1RCLE_OVERHEAD',
    actorType: 'system',
    amount: Math.min(platformFee, remaining),
    description: 'Platform Service Fee (5%)',
  });
  remaining -= splits[splits.length - 1].amount;

  const isHostEvent = event.creatorRole === 'host';
  const venueId = event.venueId || event.clubId;
  const hostId = event.creatorId;
  if (isHostEvent && hostId && venueId) {
    const hostShare = Math.round(remaining * 0.3);
    splits.push({
      actorId: hostId,
      actorType: 'host',
      amount: hostShare,
      description: 'Host Revenue Share (30% of Net)',
    });
    splits.push({
      actorId: venueId,
      actorType: 'venue',
      amount: remaining - hostShare,
      description: 'Club Revenue Share (70% of Net)',
    });
  } else {
    splits.push({
      actorId: venueId || hostId || 'UNKNOWN_PARTNER',
      actorType: event.creatorRole || 'venue',
      amount: remaining,
      description: 'Final Revenue Settlement',
    });
  }
  return splits;
}

export async function processPartnerPayout() {
  throw disabledError('partner payout');
}

export async function getPromoterPayoutBalance(promoterId) {
  const db = getAdminDb();
  const doc = await db.collection('partner_finance_aggregates').doc(promoterId).get();
  const balances = doc.exists ? doc.data()?.balances || {} : {};
  const availablePaise = Number(balances.settled || 0);
  const pendingPaise = Number(balances.pending || 0);
  return {
    available: availablePaise / 100,
    pending: pendingPaise / 100,
    totalEarned: (availablePaise + pendingPaise) / 100,
    availablePaise,
    pendingPaise,
    totalEarnedPaise: availablePaise + pendingPaise,
    currency: 'INR',
    source: 'partner_ledger',
  };
}

export async function requestPromoterPayout() {
  throw disabledError('promoter payout request');
}
