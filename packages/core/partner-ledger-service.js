import { FieldValue } from 'firebase-admin/firestore';

export const PARTNER_LEDGER_SCHEMA_VERSION = 1;

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function integerPaise(value, field) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw codedError(`${field} must be a non-negative integer paise amount`, 'INVALID_MONEY');
  }
  return amount;
}

function stableParticipants(order) {
  return {
    hostId: order.hostId || null,
    venueId: order.venueId || null,
    promoterId: order.promoterId || null,
    promoterLinkId: order.promoterLinkId || null,
  };
}

function stableEntryId(orderId, type, partnerId) {
  return `${orderId}__${type}__${partnerId || 'platform'}`
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 240);
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function buildPartnerLedgerEntries({ order, event, paymentId, createdAt }) {
  if (!order?.id || !order?.eventId || !paymentId) {
    throw codedError('Ledger posting requires order, event, and payment identity', 'BAD_REQUEST');
  }

  const participants = stableParticipants(order);
  if (!participants.hostId) {
    throw codedError('Paid order is missing host attribution', 'ORDER_ATTRIBUTION_MISSING');
  }

  const grossPaise = integerPaise(order.totalPaise, 'totalPaise');
  const platformFeePaise = integerPaise(order.platformFeePaise || 0, 'platformFeePaise');
  const venueSharePaise = integerPaise(order.venueSharePaise || 0, 'venueSharePaise');
  const promoterCommissionPaise = integerPaise(
    order.promoterCommissionPaise || 0,
    'promoterCommissionPaise',
  );
  const hostPayoutPaise = integerPaise(
    order.hostPayoutPaise ??
      grossPaise - platformFeePaise - venueSharePaise - promoterCommissionPaise,
    'hostPayoutPaise',
  );

  if (
    platformFeePaise + venueSharePaise + promoterCommissionPaise + hostPayoutPaise !==
    grossPaise
  ) {
    throw codedError('Ledger allocation does not reconcile to gross amount', 'LEDGER_UNBALANCED');
  }

  const base = {
    orderId: order.id,
    referenceId: order.id,
    eventId: order.eventId,
    paymentId,
    hostId: participants.hostId,
    venueId: participants.venueId,
    promoterId: participants.promoterId,
    promoterLinkId: participants.promoterLinkId,
    currency: order.currency || event?.currency || 'INR',
    grossPaise,
    schemaVersion: PARTNER_LEDGER_SCHEMA_VERSION,
    status: 'pending',
    settledAt: null,
    createdAt,
  };
  const entries = [
    {
      ...base,
      id: stableEntryId(order.id, 'ticket_revenue', participants.hostId),
      type: 'ticket_revenue',
      amountPaise: grossPaise,
      toPartnerId: 'platform',
      fromPartnerId: null,
    },
  ];

  if (platformFeePaise > 0) {
    entries.push({
      ...base,
      id: stableEntryId(order.id, 'platform_fee', 'platform'),
      type: 'platform_fee',
      amountPaise: platformFeePaise,
      toPartnerId: 'platform',
      fromPartnerId: participants.hostId,
    });
  }

  if (hostPayoutPaise > 0) {
    entries.push({
      ...base,
      id: stableEntryId(order.id, 'host_payout', participants.hostId),
      type: 'host_payout',
      amountPaise: hostPayoutPaise,
      toPartnerId: participants.hostId,
      fromPartnerId: null,
    });
  }

  if (participants.venueId && venueSharePaise > 0) {
    entries.push({
      ...base,
      id: stableEntryId(order.id, 'venue_share', participants.venueId),
      type: 'venue_share',
      amountPaise: venueSharePaise,
      toPartnerId: participants.venueId,
      fromPartnerId: participants.hostId,
    });
  }

  if (participants.promoterId && promoterCommissionPaise > 0) {
    entries.push({
      ...base,
      id: stableEntryId(order.id, 'promoter_commission', participants.promoterId),
      type: 'promoter_commission',
      amountPaise: promoterCommissionPaise,
      toPartnerId: participants.promoterId,
      fromPartnerId: participants.hostId,
      promoterLinkId: participants.promoterLinkId,
    });
  }

  return {
    entries,
    participants,
    grossPaise,
    allocation: {
      platformFeePaise,
      venueSharePaise,
      promoterCommissionPaise,
      hostPayoutPaise,
    },
  };
}

function markerMatches(marker, expected) {
  return (
    marker?.orderId === expected.orderId &&
    marker?.paymentId === expected.paymentId &&
    marker?.eventId === expected.eventId &&
    marker?.grossPaise === expected.grossPaise &&
    marker?.currency === expected.currency &&
    marker?.schemaVersion === expected.schemaVersion &&
    sameJson(marker?.participants || {}, expected.participants) &&
    sameJson(marker?.entryIds || [], expected.entryIds)
  );
}

function addAggregateWrite(transaction, db, entry, createdAt) {
  const partnerId = entry.toPartnerId;
  if (!partnerId || partnerId === 'platform') return;

  const dateKey = String(createdAt).slice(0, 10);
  const ref = db.collection('partner_finance_aggregates').doc(partnerId);
  const dailyRef = ref.collection('daily').doc(dateKey);
  const revenueFieldByType = {
    host_payout: 'hostPayout',
    venue_share: 'venueShare',
    promoter_commission: 'promoterCommission',
  };
  const aggregateType = entry.type === 'refund' ? entry.allocationType : entry.type;
  const increments = {
    updatedAt: createdAt,
    currency: entry.currency,
    balances: {
      [entry.status]: FieldValue.increment(entry.amountPaise),
    },
    totalsByType: {
      [entry.type]: FieldValue.increment(entry.amountPaise),
    },
  };

  transaction.set(ref, increments, { merge: true });
  const revenueField = revenueFieldByType[aggregateType];
  if (revenueField) {
    transaction.set(
      dailyRef,
      {
        partnerId,
        date: dateKey,
        updatedAt: createdAt,
        [revenueField]: FieldValue.increment(entry.amountPaise),
      },
      { merge: true },
    );
  }
}

function addHostSalesProjectionWrite(
  transaction,
  db,
  { hostId, currency, grossPaise, ticketCount, createdAt },
) {
  if (!hostId) return;

  const dateKey = String(createdAt).slice(0, 10);
  const ref = db.collection('partner_finance_aggregates').doc(hostId);
  const dailyRef = ref.collection('daily').doc(dateKey);

  transaction.set(
    ref,
    {
      updatedAt: createdAt,
      currency,
      analytics: {
        grossRevenuePaise: FieldValue.increment(grossPaise),
        ticketsSold: FieldValue.increment(ticketCount),
      },
    },
    { merge: true },
  );
  transaction.set(
    dailyRef,
    {
      partnerId: hostId,
      date: dateKey,
      updatedAt: createdAt,
      grossRevenue: FieldValue.increment(grossPaise),
      ticketsSold: FieldValue.increment(ticketCount),
    },
    { merge: true },
  );
}

/**
 * Writes the complete canonical sale posting into an existing Firestore
 * transaction. The caller must read markerSnapshot before performing writes.
 */
export function writePartnerLedgerInTransaction({
  db,
  transaction,
  order,
  event,
  paymentId,
  createdAt,
  markerSnapshot,
  ticketCount,
}) {
  const posting = buildPartnerLedgerEntries({ order, event, paymentId, createdAt });
  const normalizedTicketCount = Number(ticketCount);
  if (!Number.isSafeInteger(normalizedTicketCount) || normalizedTicketCount <= 0) {
    throw codedError(
      'Ledger posting requires a positive integer ticket count',
      'LEDGER_TICKET_COUNT_INVALID',
    );
  }
  const markerRef = db.collection('partner_ledger_idempotency').doc(order.id);
  const marker = {
    orderId: order.id,
    eventId: order.eventId,
    paymentId,
    currency: order.currency || event?.currency || 'INR',
    grossPaise: posting.grossPaise,
    participants: posting.participants,
    entryIds: posting.entries.map((entry) => entry.id),
    entryCount: posting.entries.length,
    ticketCount: normalizedTicketCount,
    schemaVersion: PARTNER_LEDGER_SCHEMA_VERSION,
    createdAt,
  };

  if (markerSnapshot?.exists) {
    const existing = markerSnapshot.data();
    if (!markerMatches(existing, marker)) {
      throw codedError(
        'Existing ledger marker conflicts with payment finalization',
        'LEDGER_IDEMPOTENCY_CONFLICT',
      );
    }
    return { ...posting, markerId: order.id, alreadyPosted: true };
  }

  for (const entry of posting.entries) {
    transaction.create(db.collection('partner_ledger').doc(entry.id), entry);
    addAggregateWrite(transaction, db, entry, createdAt);
  }
  addHostSalesProjectionWrite(transaction, db, {
    hostId: posting.participants.hostId,
    currency: marker.currency,
    grossPaise: posting.grossPaise,
    ticketCount: normalizedTicketCount,
    createdAt,
  });
  transaction.create(markerRef, marker);

  return { ...posting, markerId: order.id, alreadyPosted: false };
}

function buildRefundEntryId(orderId, refundId, allocationType, partnerId) {
  return `${orderId}__refund__${refundId}__${allocationType}__${partnerId || 'platform'}`
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 240);
}

function allocateRefundPaise(amountPaise, allocations) {
  const allocationTotal = allocations.reduce(
    (sum, allocation) => sum + Number(allocation.amountPaise || 0),
    0,
  );
  if (!Number.isSafeInteger(allocationTotal) || allocationTotal <= 0) {
    throw codedError('Original ledger allocation is missing or invalid', 'LEDGER_UNBALANCED');
  }
  if (amountPaise > allocationTotal) {
    throw codedError('Refund exceeds the original ledger allocation', 'LEDGER_UNBALANCED');
  }

  const rows = allocations.map((allocation) => {
    const numerator = amountPaise * allocation.amountPaise;
    return {
      allocation,
      amountPaise: Math.floor(numerator / allocationTotal),
      remainder: numerator % allocationTotal,
    };
  });
  let remainderPaise =
    amountPaise - rows.reduce((sum, row) => sum + Number(row.amountPaise || 0), 0);
  const remainderOrder = [...rows].sort(
    (left, right) =>
      right.remainder - left.remainder ||
      String(left.allocation.id).localeCompare(String(right.allocation.id)),
  );
  for (let index = 0; index < remainderPaise; index += 1) {
    remainderOrder[index].amountPaise += 1;
  }
  return rows.filter((row) => row.amountPaise > 0);
}

/**
 * Writes an immutable refund allocation into the caller's Firestore
 * transaction. The provider refund must already be confirmed or synchronously
 * reported as processed. The caller must read the marker and original sale
 * ledger query before invoking this function.
 */
export function writePartnerRefundInTransaction({
  db,
  transaction,
  order,
  refundId,
  providerRefundId,
  amountPaise,
  createdAt,
  markerSnapshot,
  saleEntries,
}) {
  if (!order?.id || !order?.eventId || !refundId || !providerRefundId) {
    throw codedError(
      'Refund ledger posting requires order, refund, and provider identity',
      'BAD_REQUEST',
    );
  }
  const refundPaise = integerPaise(amountPaise, 'refundAmountPaise');
  if (refundPaise === 0) {
    throw codedError('Refund amount must be greater than zero', 'INVALID_MONEY');
  }

  const allocations = (saleEntries || [])
    .filter(
      (entry) =>
        ['platform_fee', 'host_payout', 'venue_share', 'promoter_commission'].includes(
          entry.type,
        ) && entry.status !== 'reversed',
    )
    .map((entry) => ({
      ...entry,
      amountPaise: integerPaise(entry.amountPaise, `${entry.type}.amountPaise`),
    }))
    .filter((entry) => entry.amountPaise > 0);
  const allocatedRows = allocateRefundPaise(refundPaise, allocations);
  const currency = order.currency || allocations[0]?.currency || 'INR';
  const entries = allocatedRows.map(({ allocation, amountPaise: allocatedPaise }) => ({
    id: buildRefundEntryId(
      order.id,
      refundId,
      allocation.type,
      allocation.toPartnerId || 'platform',
    ),
    orderId: order.id,
    eventId: order.eventId,
    refundId,
    providerRefundId,
    referenceId: refundId,
    originalEntryId: allocation.id,
    allocationType: allocation.type,
    promoterId: order.promoterId || null,
    promoterLinkId: order.promoterLinkId || allocation.promoterLinkId || null,
    hostId: order.hostId || null,
    venueId: order.venueId || null,
    refundGrossPaise: refundPaise,
    type: 'refund',
    amountPaise: -allocatedPaise,
    currency,
    fromPartnerId: allocation.toPartnerId || null,
    toPartnerId: allocation.toPartnerId || 'platform',
    status: 'settled',
    settledAt: createdAt,
    schemaVersion: PARTNER_LEDGER_SCHEMA_VERSION,
    createdAt,
  }));
  if (entries.reduce((sum, entry) => sum + Math.abs(entry.amountPaise), 0) !== refundPaise) {
    throw codedError('Refund ledger allocation does not reconcile', 'LEDGER_UNBALANCED');
  }

  const markerId = `refund_${refundId}`;
  const markerRef = db.collection('partner_ledger_idempotency').doc(markerId);
  const marker = {
    orderId: order.id,
    eventId: order.eventId,
    refundId,
    providerRefundId,
    currency,
    refundPaise,
    entryIds: entries.map((entry) => entry.id),
    entryCount: entries.length,
    schemaVersion: PARTNER_LEDGER_SCHEMA_VERSION,
    createdAt,
  };

  if (markerSnapshot?.exists) {
    const existing = markerSnapshot.data();
    if (
      existing?.orderId !== marker.orderId ||
      existing?.eventId !== marker.eventId ||
      existing?.refundId !== marker.refundId ||
      existing?.providerRefundId !== marker.providerRefundId ||
      existing?.currency !== marker.currency ||
      existing?.refundPaise !== marker.refundPaise ||
      existing?.schemaVersion !== marker.schemaVersion ||
      !sameJson(existing?.entryIds || [], marker.entryIds)
    ) {
      throw codedError(
        'Existing refund ledger marker conflicts with provider refund',
        'LEDGER_IDEMPOTENCY_CONFLICT',
      );
    }
    return { entries, markerId, refundPaise, alreadyPosted: true };
  }

  for (const entry of entries) {
    transaction.create(db.collection('partner_ledger').doc(entry.id), entry);
    addAggregateWrite(transaction, db, entry, createdAt);
  }
  transaction.create(markerRef, marker);
  return { entries, markerId, refundPaise, alreadyPosted: false };
}
