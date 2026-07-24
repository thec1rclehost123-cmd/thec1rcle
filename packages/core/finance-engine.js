/**
 * THE C1RCLE - canonical, read-only finance compatibility surface.
 *
 * New code should use the API Gateway FinanceService. These reads remain for
 * compatibility, but they are intentionally backed only by partner_ledger.
 * Refund mutation is disabled here because provider execution and canonical
 * ledger finalization must pass through the Gateway refund workflow.
 */

import { getAdminDb } from './admin.js';

function toPaise(value) {
  const amount = Number(value);
  return Number.isSafeInteger(amount) ? amount : 0;
}

function activeEntries(snapshot) {
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((entry) => entry.status !== 'reversed');
}

function sumEntries(entries, type, allocationTypes = null) {
  return entries
    .filter(
      (entry) =>
        entry.type === type &&
        (!allocationTypes || allocationTypes.includes(String(entry.allocationType || ''))),
    )
    .reduce((sum, entry) => sum + toPaise(entry.amountPaise), 0);
}

export async function getFinancialSummary(entityId, type = 'venue') {
  const db = getAdminDb();

  if (String(type).toLowerCase() === 'event') {
    const snapshot = await db.collection('partner_ledger').where('eventId', '==', entityId).get();
    const entries = activeEntries(snapshot);
    const grossPaise = sumEntries(entries, 'ticket_revenue');
    const refundPaise = Math.abs(sumEntries(entries, 'refund'));
    const commissionsPaise =
      sumEntries(entries, 'promoter_commission') +
      sumEntries(entries, 'refund', ['promoter_commission']);
    const feesPaise =
      sumEntries(entries, 'platform_fee') + sumEntries(entries, 'refund', ['platform_fee']);
    const partnerNetPaise =
      sumEntries(entries, 'host_payout') +
      sumEntries(entries, 'venue_share') +
      sumEntries(entries, 'refund', ['host_payout', 'venue_share']);
    const netPaise = grossPaise - refundPaise;

    return {
      entityId,
      type: 'event',
      gross: grossPaise / 100,
      grossPaise,
      net: netPaise / 100,
      netPaise,
      partnerNet: partnerNetPaise / 100,
      partnerNetPaise,
      commissions: commissionsPaise / 100,
      commissionsPaise,
      fees: feesPaise / 100,
      feesPaise,
      refunds: refundPaise / 100,
      refundPaise,
      currency: 'INR',
      source: 'partner_ledger',
    };
  }

  const snapshot = await db.collection('partner_ledger').where('toPartnerId', '==', entityId).get();
  const entries = activeEntries(snapshot);
  const pendingPaise = entries
    .filter((entry) => entry.status === 'pending')
    .reduce((sum, entry) => sum + toPaise(entry.amountPaise), 0);
  const availablePaise = entries
    .filter((entry) => entry.status === 'settled')
    .reduce((sum, entry) => sum + toPaise(entry.amountPaise), 0);

  return {
    entityId,
    type,
    netRevenue: (pendingPaise + availablePaise) / 100,
    netRevenuePaise: pendingPaise + availablePaise,
    availableBalance: availablePaise / 100,
    availablePaise,
    pendingBalance: pendingPaise / 100,
    pendingPaise,
    currency: 'INR',
    source: 'partner_ledger',
  };
}

export async function getTransactionHistory(entityId, options = {}) {
  const { limit = 50, state = null } = options;
  const db = getAdminDb();
  let query = db.collection('partner_ledger').where('toPartnerId', '==', entityId);
  if (state) query = query.where('status', '==', String(state).toLowerCase());
  const snapshot = await query.orderBy('createdAt', 'desc').limit(limit).get();

  return activeEntries(snapshot).map((entry) => ({
    ...entry,
    amount: toPaise(entry.amountPaise) / 100,
    currency: entry.currency || 'INR',
    source: 'partner_ledger',
  }));
}

export async function processRefund() {
  const error = new Error(
    'LEGACY_REFUND_ENGINE_DISABLED: use POST /api/v1/refunds/request and provider webhook finalization',
  );
  error.code = 'LEGACY_REFUND_ENGINE_DISABLED';
  throw error;
}
