import { randomUUID, createHmac } from 'node:crypto';
import { getAdminDb } from './admin.js';
import { getQrSecret } from './secret-registry.js';

const ENTITLEMENT_COLLECTION = 'entitlements';
const SCAN_LEDGER_COLLECTION = 'scan_ledger';

/**
 * Price threshold (INR) above which tickets use the rotating "Magic Ticket" QR.
 * Exported so qrStore, mobile app, and scanner all read from one place.
 */
export const MAGIC_TICKET_THRESHOLD = 5000;

let _QR_SECRET = null;
function QR_SECRET() {
  if (!_QR_SECRET) _QR_SECRET = getQrSecret();
  return _QR_SECRET;
}

export const ENTITLEMENT_STATES = {
  ISSUED: 'ISSUED', // Created, potentially unclaimed slot
  ACTIVE: 'ACTIVE', // Assigned to a user, ready for entry
  CONSUMED: 'CONSUMED', // Scanned and entry granted (Terminal)
  REVOKED: 'REVOKED', // Cancelled, refunded, or replaced (Terminal)
  EXPIRED: 'EXPIRED', // Event ended (Terminal)
};

/**
 * Issue entitlements for an order.
 * IDs are deterministic (ENT-{orderId}-{tierId}-{index}) so concurrent retries
 * are safe: the idempotency check runs inside the transaction against known doc refs,
 * eliminating the TOCTOU race that existed when the check was outside the transaction.
 */
export async function issueEntitlements(order, items, transaction = null) {
  const db = getAdminDb();

  if (!items || items.length === 0) return [];

  // Fetch event summary for denormalization — read outside transaction (no write contention).
  let eventSummary = null;
  if (order.eventId) {
    const eventDoc = await db.collection('events').doc(order.eventId).get();
    if (eventDoc.exists) {
      const ev = eventDoc.data();
      eventSummary = {
        title: ev.title || order.eventTitle || null,
        startAt: ev.startDate || ev.startAt || null,
        venue: ev.venue || ev.venueName || ev.location || null,
        city: ev.city || null,
        posterUrl: ev.image || null,
      };
    }
  }

  const entitlements = [];

  for (const item of items) {
    for (let i = 0; i < (item.quantity || 1); i++) {
      // Deterministic ID: stable across retries, no UUID randomness.
      const tierId = (item.ticketId || item.tierId || 'GEN').replace(/\//g, '-');
      const entitlement = {
        id: `ENT-${order.id}-${tierId}-${i + 1}`.toUpperCase(),
        eventId: order.eventId,
        orderId: order.id,
        ownerUserId: order.userId,
        ticketType: order.isRSVP ? 'rsvp' : item.entryType === 'couple' ? 'couple' : 'paid',
        genderConstraint: item.genderRequirement || 'none',
        scanCountAllowed: item.entryType === 'couple' ? 2 : 1,
        scanCountUsed: 0,
        state: ENTITLEMENT_STATES.ISSUED,
        issuedAt: new Date().toISOString(),
        ...(eventSummary ? { eventSummary } : {}),
        metadata: {
          tierId: item.ticketId,
          tierName: item.name,
          index: i + 1,
          entryType: item.entryType || 'general',
        },
      };
      entitlements.push(entitlement);
    }
  }

  const saveOp = async (t) => {
    // Idempotency check inside the transaction: reads and writes are atomic,
    // so two concurrent fulfillment tasks cannot both pass and double-write.
    const firstRef = db.collection(ENTITLEMENT_COLLECTION).doc(entitlements[0].id);
    const firstDoc = await t.get(firstRef);
    if (firstDoc.exists) {
      const allDocs = await Promise.all(
        entitlements.map((ent) => t.get(db.collection(ENTITLEMENT_COLLECTION).doc(ent.id))),
      );
      return allDocs.filter((d) => d.exists).map((d) => ({ id: d.id, ...d.data() }));
    }
    for (const ent of entitlements) {
      t.set(db.collection(ENTITLEMENT_COLLECTION).doc(ent.id), ent);
    }
    return entitlements;
  };

  if (transaction) {
    return await saveOp(transaction);
  } else {
    return await db.runTransaction(saveOp);
  }
}

/**
 * Generate a rotating QR payload for an entitlement
 * Time window: 30 seconds
 */
export function generateEntitlementQR(entitlementId) {
  const timestamp = Math.floor(Date.now() / 1000);
  const window = Math.floor(timestamp / 30);

  const dataToSign = `${entitlementId}:${window}`;
  const signature = createHmac('sha256', QR_SECRET())
    .update(dataToSign)
    .digest('hex')
    .substring(0, 16);

  return {
    eid: entitlementId,
    ts: timestamp,
    sig: signature,
  };
}

/**
 * Verify Entitlement QR (Signature + Freshness)
 */
export function verifyEntitlementQR(payload) {
  const { eid, ts, sig } = payload;
  if (!eid || !ts || !sig) return { valid: false, error: 'INVALID_QR' };

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 65) {
    // 65s grace period for clock drift
    return { valid: false, error: 'STALE_QR' };
  }

  const window = Math.floor(ts / 30);

  // Check current and prev window to be extra safe with timing
  const verifyWindow = (w) => {
    const dataToSign = `${eid}:${w}`;
    const expected = createHmac('sha256', QR_SECRET())
      .update(dataToSign)
      .digest('hex')
      .substring(0, 16);
    return sig === expected;
  };

  if (!verifyWindow(window) && !verifyWindow(window - 1)) {
    return { valid: false, error: 'INVALID_QR' };
  }

  return { valid: true, entitlementId: eid };
}

/**
 * Process Entry Scan (Deterministic Entry Truth)
 * Returns { success: boolean, reason?: string, entitlement?: any }
 */
export async function processEntryScan(qrPayload, scannerId, eventId, context = {}) {
  const db = getAdminDb();
  const timestamp = new Date().toISOString();

  // 1. Validate QR Signature & Timing
  const qrResult = verifyEntitlementQR(qrPayload);
  if (!qrResult.valid) {
    await recordScanLedgerEntry({
      entitlementId: qrPayload.eid || 'UNKNOWN',
      eventId,
      scannerId,
      result: 'DENIED',
      reasonCode: qrResult.error,
      metadata: { ...context, rawPayload: qrPayload },
    });
    return { success: false, reason: qrResult.error };
  }

  const { entitlementId } = qrResult;

  return await db.runTransaction(async (t) => {
    const entRef = db.collection(ENTITLEMENT_COLLECTION).doc(entitlementId);
    const entDoc = await t.get(entRef);

    if (!entDoc.exists) {
      await recordScanLedgerEntry(
        {
          entitlementId,
          eventId,
          scannerId,
          result: 'DENIED',
          reasonCode: 'ENTITLEMENT_NOT_FOUND',
          metadata: context,
        },
        t,
      );
      return { success: false, reason: 'ENTITLEMENT_NOT_FOUND' };
    }

    const entitlement = entDoc.data();

    // 2. Validate Event & State
    if (entitlement.eventId !== eventId) {
      await recordScanLedgerEntry(
        {
          entitlementId,
          eventId,
          scannerId,
          result: 'DENIED',
          reasonCode: 'EVENT_MISMATCH',
          metadata: { ...context, entEventId: entitlement.eventId },
        },
        t,
      );
      return { success: false, reason: 'EVENT_MISMATCH' };
    }

    if (
      entitlement.state === ENTITLEMENT_STATES.CONSUMED ||
      entitlement.scanCountUsed >= entitlement.scanCountAllowed
    ) {
      await recordScanLedgerEntry(
        {
          entitlementId,
          eventId,
          scannerId,
          result: 'DENIED',
          reasonCode: 'ALREADY_CONSUMED',
          metadata: context,
        },
        t,
      );
      return { success: false, reason: 'ALREADY_CONSUMED' };
    }

    if (entitlement.state === ENTITLEMENT_STATES.REVOKED) {
      await recordScanLedgerEntry(
        {
          entitlementId,
          eventId,
          scannerId,
          result: 'DENIED',
          reasonCode: 'ENTITLEMENT_NOT_ACTIVE',
          metadata: { ...context, state: entitlement.state },
        },
        t,
      );
      return { success: false, reason: 'REVOKED' };
    }

    // 3. Rule Enforcement
    // Gender Constraint — prefer boundGender (locked at claim time) over live profile to prevent
    // post-claim profile changes from causing door rejections.
    if (entitlement.genderConstraint && entitlement.genderConstraint !== 'none') {
      const effectiveGender = entitlement.boundGender || context.userGender;
      if (effectiveGender && entitlement.genderConstraint !== effectiveGender) {
        await recordScanLedgerEntry(
          {
            entitlementId,
            eventId,
            scannerId,
            result: 'DENIED',
            reasonCode: 'GENDER_MISMATCH',
            metadata: {
              ...context,
              required: entitlement.genderConstraint,
              actual: effectiveGender,
            },
          },
          t,
        );
        return { success: false, reason: 'GENDER_MISMATCH' };
      }
    }

    // Couple Logic — allow sequential entry; first partner enters immediately, second triggers CONSUMED.
    // Do NOT block entry if the other partner hasn't arrived yet.
    if (entitlement.ticketType === 'couple') {
      const isFirstScan = entitlement.scanCountUsed === 0;
      const newCountUsed = entitlement.scanCountUsed + 1;
      const isFull = newCountUsed >= entitlement.scanCountAllowed;
      const coupleSlot = isFirstScan ? 'primary' : 'partner';

      t.update(entRef, {
        scanCountUsed: newCountUsed,
        state: isFull ? ENTITLEMENT_STATES.CONSUMED : entitlement.state,
        lastScannerId: scannerId,
        consumedMetadata: context,
        ...(isFirstScan
          ? { primaryEnteredAt: timestamp, primaryScannerId: scannerId }
          : { partnerEnteredAt: timestamp, partnerScannerId: scannerId, consumedAt: timestamp }),
      });

      await recordScanLedgerEntry(
        {
          entitlementId,
          eventId,
          scannerId,
          result: 'GRANTED',
          metadata: { ...context, coupleSlot },
        },
        t,
      );

      return {
        success: true,
        couplePartialEntry: !isFull,
        entitlement: { ...entitlement, scanCountUsed: newCountUsed },
      };
    }

    // 4. Atomic State Transition (non-couple tickets)
    const newCountUsed = entitlement.scanCountUsed + 1;
    const newState = ENTITLEMENT_STATES.CONSUMED;

    t.update(entRef, {
      scanCountUsed: newCountUsed,
      state: newState,
      consumedAt: timestamp,
      lastScannerId: scannerId,
      consumedMetadata: context,
    });

    // 5. Immutable Scan Ledger
    await recordScanLedgerEntry(
      {
        entitlementId,
        eventId,
        scannerId,
        result: 'GRANTED',
        metadata: context,
      },
      t,
    );

    return {
      success: true,
      entitlement: { ...entitlement, state: newState, scanCountUsed: newCountUsed },
    };
  });
}

/**
 * Record an immutable scan attempt
 */
async function recordScanLedgerEntry(data, transaction = null) {
  const db = getAdminDb();
  const entry = {
    scanId: `SCAN-${randomUUID().substring(0, 12).toUpperCase()}`,
    timestamp: new Date().toISOString(),
    ...data,
  };

  const ref = db.collection(SCAN_LEDGER_COLLECTION).doc(entry.scanId);
  if (transaction) {
    transaction.set(ref, entry);
  } else {
    await ref.set(entry);
  }
  return entry;
}

/**
 * Transfer Entitlement (Revoke old, Issue new)
 */
export async function transferEntitlement(
  entitlementId,
  newOwnerUserId,
  actorId,
  transaction = null,
  boundGender = null,
) {
  const db = getAdminDb();
  const now = new Date().toISOString();

  const transferLogic = async (t) => {
    const entRef = db.collection(ENTITLEMENT_COLLECTION).doc(entitlementId);
    const entDoc = await t.get(entRef);

    if (!entDoc.exists) throw new Error('Entitlement not found');
    const oldEnt = entDoc.data();

    if (oldEnt.state !== ENTITLEMENT_STATES.ISSUED && oldEnt.state !== ENTITLEMENT_STATES.ACTIVE) {
      throw new Error(`Cannot transfer entitlement in state: ${oldEnt.state}`);
    }

    // Revoke old
    t.update(entRef, {
      state: ENTITLEMENT_STATES.REVOKED,
      revokedAt: now,
      revokedReason: 'TRANSFER',
      revokedBy: actorId,
      transferredTo: newOwnerUserId,
    });

    // Issue new
    const newEnt = {
      ...oldEnt,
      id: `ENT-${randomUUID().substring(0, 12).toUpperCase()}`,
      ownerUserId: newOwnerUserId,
      state: ENTITLEMENT_STATES.ISSUED,
      issuedAt: now,
      scanCountUsed: 0,
      consumedAt: null,
      ...(boundGender ? { boundGender } : {}),
      metadata: {
        ...oldEnt.metadata,
        transferredFrom: oldEnt.id,
        transferHistory: [...(oldEnt.metadata.transferHistory || []), oldEnt.id],
      },
    };

    t.set(db.collection(ENTITLEMENT_COLLECTION).doc(newEnt.id), newEnt);
    return newEnt;
  };

  if (transaction) {
    return await transferLogic(transaction);
  } else {
    return await db.runTransaction(transferLogic);
  }
}

/**
 * Revoke Entitlement (Refund/Admin)
 */
export async function revokeEntitlement(entitlementId, reason, actorId, transaction = null) {
  const db = getAdminDb();
  const now = new Date().toISOString();

  const revokeOp = async (t) => {
    t.update(db.collection(ENTITLEMENT_COLLECTION).doc(entitlementId), {
      state: ENTITLEMENT_STATES.REVOKED,
      revokedAt: now,
      revokedReason: reason,
      revokedBy: actorId,
    });
  };

  if (transaction) {
    await revokeOp(transaction);
  } else {
    await db.runTransaction(revokeOp);
  }
}
