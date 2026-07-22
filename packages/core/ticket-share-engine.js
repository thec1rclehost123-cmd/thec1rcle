import { getAdminDb } from '@c1rcle/core/admin';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import {
  applyPreparedEntitlementRevocationWithReplacement,
  applyPreparedEntitlementTransfer,
  ENTITLEMENT_STATES,
  prepareEntitlementTransfer,
  transferEntitlement,
} from '@c1rcle/core/entitlement-engine';
import {
  applyPreparedInventoryDeduction,
  deductInventory,
  prepareInventoryDeduction,
} from '@c1rcle/core/inventory-engine';
import { getTicketSecret } from './secret-registry.js';
import { getUserSubscriptionContext, PremiumRequiredError } from './subscription-service.js';
import { createNotification } from './guest-notification-engine.js';

function isFirebaseConfigured() {
  try {
    const db = getAdminDb();
    return !!db && typeof db.collection === 'function';
  } catch {
    return false;
  }
}

async function getOrderById(id) {
  const doc = await getAdminDb().collection('orders').doc(id).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function getEvent(id) {
  const doc = await getAdminDb().collection('events').doc(id).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

function inferGenderRequirement(ticket = {}) {
  const explicitRequirement = String(
    ticket.genderRequirement || ticket.requiredGender || ticket.gender || '',
  ).toLowerCase();
  if (
    explicitRequirement === 'female' ||
    explicitRequirement === 'male' ||
    explicitRequirement === 'couple'
  )
    return explicitRequirement;
  const entryType = String(ticket.entryType || '').toLowerCase();
  if (entryType === 'female') return 'female';
  if (entryType === 'stag' || entryType === 'male') return 'male';
  return 'any';
}

function isCoupleTicket(ticket = {}) {
  const entryType = String(ticket.entryType || '').toLowerCase();
  const name = String(ticket.name || '').toLowerCase();
  return (
    Boolean(ticket.isCouple) ||
    entryType === 'couple' ||
    name.includes('couple') ||
    name.includes('pair')
  );
}

export function buildStoredOrderTicket(selectedTicket = {}, eventTicket = {}) {
  const ticketId =
    selectedTicket.ticketId || selectedTicket.tierId || selectedTicket.id || eventTicket.id;
  const quantity = Number(selectedTicket.quantity || 1);
  const price = Number(selectedTicket.price ?? eventTicket.price ?? eventTicket.amount ?? 0);

  return {
    ...selectedTicket,
    ticketId,
    tierId: selectedTicket.tierId || ticketId,
    name: selectedTicket.name || eventTicket.name || 'General Admission',
    tierName:
      selectedTicket.tierName || selectedTicket.name || eventTicket.name || 'General Admission',
    entryType: selectedTicket.entryType || eventTicket.entryType || null,
    genderRequirement:
      selectedTicket.genderRequirement ||
      eventTicket.genderRequirement ||
      eventTicket.requiredGender ||
      null,
    quantity,
    price,
    unitPrice: Number(selectedTicket.unitPrice ?? price),
    total: Number(selectedTicket.total ?? price * quantity),
    isCouple: selectedTicket.isCouple ?? eventTicket.isCouple ?? isCoupleTicket(eventTicket),
  };
}

function getBundleInventoryMode(order = null) {
  return order?.isRSVP ? 'claim_based' : 'precommitted';
}

function shouldReduceInventoryOnBundleCreation(inventoryMode, hasOwnerClaimed) {
  return inventoryMode === 'claim_based' && hasOwnerClaimed;
}

function shouldReduceInventoryOnBundleClaim(inventoryMode) {
  return inventoryMode === 'claim_based';
}

function parseDirectTicketId(ticketId) {
  const parts = String(ticketId || '').split('-');
  if (parts.length < 3) throw new Error('Invalid ticket reference');
  const slotIndex = Number(parts[parts.length - 1]);
  if (!Number.isInteger(slotIndex) || slotIndex < 1) throw new Error('Invalid ticket reference');
  return {
    orderId: parts.slice(0, parts.length - 2).join('-'),
    tierId: parts[parts.length - 2],
    slotIndex,
  };
}

function deriveDirectTransferMetadata(ticketId, order, event = null) {
  const parsed = parseDirectTicketId(ticketId);
  const sourceTicket = order?.tickets?.find((ticket) => ticket.ticketId === parsed.tierId);
  if (!sourceTicket) throw new Error('Ticket not found in order');
  // if (isCoupleTicket(sourceTicket))
  //   throw new Error('Couple entries must be managed through the couple ticket flow.');
  const eventTicket = event?.tickets?.find((ticket) => ticket.id === parsed.tierId) || null;
  return {
    orderId: parsed.orderId,
    tierId: parsed.tierId,
    slotIndex: parsed.slotIndex,
    ticketType: sourceTicket.name || eventTicket?.name || 'Ticket',
    requiredGender: inferGenderRequirement({ ...eventTicket, ...sourceTicket }),
  };
}

const ORDERS_COLLECTION = 'orders';
const SHARE_BUNDLES_COLLECTION = 'share_bundles';
const TICKET_ASSIGNMENTS_COLLECTION = 'ticket_assignments';
const TRANSFERS_COLLECTION = 'transfers';

async function assertCanCreateTransfer(db, senderId, ticketId) {
  const context = await getUserSubscriptionContext(db, senderId);
  return context;
}

/**
 * Generate a non-guessable token for the share link or transfer
 */
function generateToken(length = 16) {
  return randomBytes(length).toString('hex');
}

function toDateValue(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value._seconds === 'number') return new Date(value._seconds * 1000);
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function directTicketDocumentId(orderId, tierId, slotIndex) {
  const safe = (value) =>
    String(value || 'GEN')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);
  return `TKT-${safe(orderId)}-${safe(tierId)}-${Number(slotIndex)}`.toUpperCase();
}

/**
 * Sign a ticket payload for QR verification.
 * Token format: ticketId:redeemerId:issuedAt:hmac
 * - Uses full 64-char HMAC (no truncation)
 * - Binds signature to redeemerId so stolen tokens are useless to others
 * - issuedAt enables TTL expiry validation at scan time
 * @param {string} ticketId
 * @param {string} redeemerId
 * @returns {{ token: string, issuedAt: number }}
 */
function signTicketPayload(ticketId, redeemerId) {
  if (!redeemerId) {
    throw new Error('redeemerId is required to sign a ticket payload');
  }
  const secret = getTicketSecret();
  if (!secret) {
    throw new Error('TICKET_SECRET env var is not configured');
  }
  const issuedAt = Date.now();
  const payload = `${ticketId}:${redeemerId}:${issuedAt}`;
  const signature = createHmac('sha256', secret).update(payload).digest('hex'); // full 64 chars
  return { token: `${ticketId}:${redeemerId}:${issuedAt}:${signature}`, issuedAt };
}

/**
 * Verify a signed ticket token.
 * @param {string} token - The full token string from QR code
 * @param {{ ttlMs?: number }} options
 * @returns {{ valid: boolean, ticketId?: string, userId?: string, reason?: string }}
 */
export function verifyTicketToken(token, { ttlMs = 24 * 60 * 60 * 1000 } = {}) {
  const secret = getTicketSecret();
  if (!secret) return { valid: false, reason: 'misconfigured' };

  const parts = token?.split(':');
  if (!parts || parts.length !== 4) return { valid: false, reason: 'malformed' };

  const [ticketId, userId, issuedAtStr, receivedSig] = parts;
  const issuedAt = parseInt(issuedAtStr, 10);

  if (!ticketId || !userId || isNaN(issuedAt) || !receivedSig) {
    return { valid: false, reason: 'malformed' };
  }

  // Check TTL
  if (Date.now() - issuedAt > ttlMs) {
    return { valid: false, reason: 'expired' };
  }

  // Constant-time HMAC comparison
  const expectedSig = createHmac('sha256', secret)
    .update(`${ticketId}:${userId}:${issuedAt}`)
    .digest('hex');
  const expected = Buffer.from(expectedSig, 'hex');
  const received = Buffer.from(receivedSig.padEnd(64, '0'), 'hex');
  if (expected.length !== received.length || !expected.equals(received)) {
    return { valid: false, reason: 'invalid_signature' };
  }

  return { valid: true, ticketId, userId };
}

/**
 * Internal helper to log ticket lifecycle events
 * @private
 */
async function logAuditEvent(type, metadata, db = null) {
  try {
    const adminDb = db || getAdminDb();
    await adminDb.collection('audit_logs').add({
      type: `ticket_${type}`,
      ...metadata,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[TicketAudit] Logging failed:', e);
  }
}

/**
 * Check if a user is blocked/banned
 * @private
 */
async function isUserBlocked(userId, db = null) {
  const adminDb = db || getAdminDb();
  const userDoc = await adminDb.collection('users').doc(userId).get();
  if (!userDoc.exists) return false;
  const data = userDoc.data();
  return data.isBlocked === true || data.status === 'banned';
}

/**
 * @typedef {Object} TicketSlot
 * @property {number} slotIndex
 * @property {string} slotType - 'owner_locked' | 'shareable'
 * @property {string|null} currentOwnerUserId
 * @property {string} claimStatus - 'claimed' | 'unclaimed'
 * @property {string} [claimedAt]
 * @property {string} [requiredGender] - 'male' | 'female' | 'any'
 * @property {string} [couplePairId]
 * @property {string} [entitlementId]
 * @property {string} [issuedTicketId]
 */

/**
 * @typedef {Object} ShareBundle
 * @property {string} orderId
 * @property {string} eventId
 * @property {string} tierId
 * @property {string} userId
 * @property {string} mode - 'individual' | 'shared_qr'
 * @property {number} totalSlots
 * @property {number} remainingSlots
 * @property {number|null} scanCreditsRemaining
 * @property {string|null} groupQrPayload
 * @property {string} groupTicketId
 * @property {TicketSlot[]} slots
 * @property {string} genderRequirement
 * @property {boolean} isCouple
 * @property {string} token
 * @property {string} status - 'active' | 'exhausted' | 'cancelled'
 * @property {string} createdAt
 * @property {string} expiresAt
 */

/**
 * Initialize slots for a bundle with gender and couple pairing logic
 *
 * @param {number} quantity
 * @param {string} userId
 * @param {any} tier
 * @param {string} buyerGender
 * @returns {TicketSlot[]}
 */
function initializeSlots(quantity, userId, tier, buyerGender = 'any', skipOwnerSlot = false) {
  const slots = [];
  const { genderRequirement, isCouple } = tier || {};

  // Total physical slots to create
  // If it's a couple ticket, 1 unit = 2 slots
  const effectiveQuantity = isCouple ? quantity * 2 : quantity;

  // Slot 1: Auto-assign to buyer if eligible and not already assigned in order
  let ownerSlotIndex = 1;
  let ownerRequiredGender = buyerGender;

  if (skipOwnerSlot) {
    ownerSlotIndex = 0;
  } else if (isCouple) {
    ownerRequiredGender = buyerGender === 'female' ? 'female' : 'male';
  } else if (genderRequirement && genderRequirement !== 'any') {
    if (genderRequirement !== buyerGender && buyerGender !== 'any') {
      ownerSlotIndex = 0;
    } else {
      ownerRequiredGender = genderRequirement;
    }
  }

  if (ownerSlotIndex === 1) {
    slots.push(_createOwnerSlot(userId, ownerRequiredGender, isCouple));
  }

  // Remaining slots
  for (let i = ownerSlotIndex === 1 ? 2 : 1; i <= effectiveQuantity; i++) {
    slots.push(_createShareableSlot(i, userId, slots, buyerGender, isCouple, genderRequirement));
  }
  return slots;
}

/**
 * Internal helper to create the owner's locked slot
 * @private
 */
function _createOwnerSlot(userId, requiredGender, isCouple) {
  const slot = {
    slotIndex: 1,
    slotType: 'owner_locked',
    currentOwnerUserId: userId,
    claimStatus: 'claimed',
    claimedAt: new Date().toISOString(),
    requiredGender: requiredGender,
  };

  if (isCouple) {
    slot.couplePairId = `PAIR-${userId.slice(0, 4)}-${randomBytes(3).toString('hex')}`;
  }

  return slot;
}

/**
 * Internal helper to create shareable slots
 * @private
 */
function _createShareableSlot(
  index,
  userId,
  existingSlots,
  buyerGender,
  isCouple,
  genderRequirement,
) {
  const slot = {
    slotIndex: index,
    slotType: 'shareable',
    currentOwnerUserId: null,
    claimStatus: 'unclaimed',
  };

  if (isCouple) {
    // Primary slots (odd: 1, 3…) follow the buyer's gender.
    // Partner slots (even: 2, 4…) are the opposite gender of the buyer.
    const buyerIsKnown = buyerGender === 'male' || buyerGender === 'female';
    const partnerGender = buyerGender === 'female' ? 'male' : 'female';
    if (index % 2 === 0) {
      slot.requiredGender = buyerIsKnown ? partnerGender : 'female';
    } else {
      slot.requiredGender = index === 1 && buyerIsKnown ? buyerGender : 'male';
    }

    // Link pairing
    if (index % 2 === 0) {
      slot.couplePairId = existingSlots[index - 2].couplePairId;
    } else {
      slot.couplePairId = `PAIR-${userId.slice(0, 4)}-${randomBytes(3).toString('hex')}`;
    }
  } else if (genderRequirement && genderRequirement !== 'any') {
    slot.requiredGender = genderRequirement;
  }

  return slot;
}

/**
 * Fetch user gender from profiles.
 * Returns "male" | "female" | null.
 * null means the user has not set their gender — callers must block gender-restricted actions.
 */
async function getUserGender(userId) {
  if (!isFirebaseConfigured()) return 'male'; // Mock fallback
  const db = getAdminDb();
  const doc = await db.collection('users').doc(userId).get();
  if (!doc.exists) return null;
  const gender = doc.data().gender;
  if (gender === 'male' || gender === 'female') return gender;
  return null; // missing or non-binary value — treat as unset
}

/**
 * Create or upgrade a share bundle for an order, event, and tier
 */
export async function createShareBundle(
  orderId,
  userId,
  eventId,
  quantity,
  tierId = null,
  customExpiresAt = null,
) {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase not configured');
  }

  const db = getAdminDb();
  const requestedQuantity = Math.floor(Number(quantity));
  if (!Number.isInteger(requestedQuantity) || requestedQuantity < 1) {
    throw new Error('Quantity must be a positive integer');
  }

  const transactionResult = await db.runTransaction(async (tx) => {
    const orderRef = db.collection(ORDERS_COLLECTION).doc(orderId);
    const orderDoc = await tx.get(orderRef);
    if (!orderDoc.exists) throw new Error('Order not found');

    const order = { id: orderDoc.id, ...orderDoc.data() };
    if (order.userId !== userId) throw new Error('Unauthorized');
    if (order.status !== 'confirmed') throw new Error('Order must be confirmed before sharing');
    if (!order.eventId) throw new Error('Order is missing its event reference');
    if (eventId && eventId !== order.eventId) {
      throw new Error('Order does not belong to the requested event');
    }

    const actualTierId = tierId || order.tickets?.[0]?.ticketId || order.tickets?.[0]?.tierId;
    const sourceTicket = order.tickets?.find(
      (ticket) =>
        ticket.ticketId === actualTierId ||
        ticket.tierId === actualTierId ||
        ticket.id === actualTierId,
    );
    if (!sourceTicket) throw new Error('Ticket tier was not purchased in this order');

    const purchasedQuantity = Math.max(0, Math.floor(Number(sourceTicket.quantity) || 0));
    const bundleQuantity = Math.min(requestedQuantity, purchasedQuantity);
    if (bundleQuantity < 1) throw new Error('No purchasable tickets found for this tier');

    const canonicalEventId = order.eventId;
    const bundleKey = createHash('sha256')
      .update(`${orderId}:${actualTierId}`)
      .digest('hex')
      .slice(0, 40);
    const bundleRef = db.collection(SHARE_BUNDLES_COLLECTION).doc(`share_${bundleKey}`);
    const allBundlesQuery = db
      .collection(SHARE_BUNDLES_COLLECTION)
      .where('orderId', '==', orderId);
    const entitlementsQuery = db
      .collection('entitlements')
      .where('orderId', '==', orderId)
      .where('metadata.tierId', '==', actualTierId);

    const [bundleDoc, allBundlesSnapshot, eventDoc, userDoc, entsSnapshot] = await Promise.all([
      tx.get(bundleRef),
      tx.get(allBundlesQuery),
      tx.get(db.collection('events').doc(canonicalEventId)),
      tx.get(db.collection('users').doc(userId)),
      tx.get(entitlementsQuery),
    ]);

    const existingBundle = allBundlesSnapshot.docs.find((doc) => {
      const data = doc.data();
      return data.tierId === actualTierId && data.status !== 'cancelled';
    });
    if (existingBundle) {
      return { created: false, bundle: { id: existingBundle.id, ...existingBundle.data() } };
    }
    if (bundleDoc.exists && bundleDoc.data().status !== 'cancelled') {
      return { created: false, bundle: { id: bundleDoc.id, ...bundleDoc.data() } };
    }
    if (!eventDoc.exists) throw new Error('Event not found');

    const event = { id: eventDoc.id, ...eventDoc.data() };
    const eventTiers = event.ticketCatalog?.tiers || event.tickets || [];
    const tier = eventTiers.find((candidate) => candidate.id === actualTierId);
    if (!tier) throw new Error('Ticket tier no longer exists on this event');

    const now = new Date();
    const eventExpiryValue = event.endDate || event.endAt || event.startDate || event.startAt;
    const eventExpiry = toDateValue(eventExpiryValue);
    const canonicalExpiry =
      eventExpiry && Number.isFinite(eventExpiry.getTime())
        ? eventExpiry
        : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (canonicalExpiry.getTime() <= now.getTime()) {
      throw new Error('Cannot share tickets for an event that has ended');
    }

    let expiresAt = canonicalExpiry;
    if (customExpiresAt) {
      const requestedExpiry = new Date(customExpiresAt);
      if (!Number.isFinite(requestedExpiry.getTime()) || requestedExpiry.getTime() <= now.getTime()) {
        throw new Error('Share expiry must be a valid future date');
      }
      expiresAt = new Date(Math.min(requestedExpiry.getTime(), canonicalExpiry.getTime()));
    }

    const buyerGenderValue = userDoc.exists ? userDoc.data().gender : null;
    const buyerGender = buyerGenderValue === 'male' || buyerGenderValue === 'female' ? buyerGenderValue : 'any';
    const hasExistingOwnerSlot = allBundlesSnapshot.docs.some(
      (doc) =>
        doc.data().status !== 'cancelled' &&
        doc.data().slots?.some((slot) => slot.slotType === 'owner_locked'),
    );
    const orderEnts = entsSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter(
        (entitlement) =>
          entitlement.ownerUserId === userId &&
          (entitlement.state === ENTITLEMENT_STATES.ISSUED ||
            entitlement.state === ENTITLEMENT_STATES.ACTIVE),
      );
    orderEnts.sort((left, right) => (left.metadata?.index || 0) - (right.metadata?.index || 0));
    const orderEntitlementsByIndex = new Map(
      orderEnts.map((entitlement) => [Number(entitlement.metadata?.index || 0), entitlement]),
    );

    const slots = initializeSlots(
      bundleQuantity,
      userId,
      tier,
      buyerGender,
      hasExistingOwnerSlot,
    );
    slots.forEach((slot) => {
      const entitlementIndex = tier.isCouple ? Math.ceil(slot.slotIndex / 2) : slot.slotIndex;
      const entitlement = orderEntitlementsByIndex.get(entitlementIndex);
      if (entitlement) slot.entitlementId = entitlement.id;
    });
    if (orderEnts.length > 0 && slots.some((slot) => !slot.entitlementId)) {
      throw new Error('One or more purchased ticket entitlements are unavailable for sharing');
    }

    const effectiveSlotsCount = slots.length;
    const hasOwnerClaimed = slots.some(
      (slot) => slot.slotType === 'owner_locked' && slot.claimStatus === 'claimed',
    );
    const inventoryMode = getBundleInventoryMode(order);
    const inventoryDeduction = shouldReduceInventoryOnBundleCreation(
      inventoryMode,
      hasOwnerClaimed,
    )
      ? await prepareInventoryDeduction(tx, db, canonicalEventId, actualTierId, 1)
      : null;

    const bundle = {
      orderId,
      eventId: canonicalEventId,
      tierId: actualTierId,
      userId,
      mode: 'individual',
      totalSlots: effectiveSlotsCount,
      remainingSlots: hasOwnerClaimed ? effectiveSlotsCount - 1 : effectiveSlotsCount,
      scanCreditsRemaining: null,
      groupQrPayload: null,
      groupTicketId: `GROUP-${orderId}-${actualTierId}`,
      slots,
      genderRequirement: tier.genderRequirement || 'any',
      isCouple: !!tier.isCouple,
      inventoryMode,
      token: generateToken(),
      status: 'active',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    if (inventoryDeduction) applyPreparedInventoryDeduction(tx, inventoryDeduction);
    tx.set(bundleRef, bundle);
    return { created: true, bundle: { id: bundleRef.id, ...bundle } };
  });

  if (transactionResult.created) {
    const bundle = transactionResult.bundle;
    await logAuditEvent(
      'share_created',
      {
        bundleId: bundle.id,
        orderId,
        userId,
        eventId: bundle.eventId,
        tierId: bundle.tierId,
        slots: bundle.totalSlots,
      },
      db,
    );
  }

  return transactionResult.bundle;
}

/**
 * Get share bundle by token
 */
export async function getShareBundleByToken(token) {
  if (!isFirebaseConfigured()) return null;

  const db = getAdminDb();
  const snapshot = await db
    .collection(SHARE_BUNDLES_COLLECTION)
    .where('token', '==', token)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

/**
 * Claim a ticket slot from a bundle
 */
export async function claimTicketSlot(token, redeemerId) {
  if (!isFirebaseConfigured()) throw new Error('Firebase not configured');

  const db = getAdminDb();

  // Resolve user policy inputs before the transaction so retries do not perform
  // untracked reads against a changing profile.
  const [userGender, userBlocked] = await Promise.all([
    getUserGender(redeemerId),
    isUserBlocked(redeemerId, db),
  ]);
  if (userBlocked) {
    throw new Error('Your account has been restricted from claiming tickets.');
  }

  const transactionResult = await db.runTransaction(async (transaction) => {
    const bundleSnapshot = await transaction.get(
      db.collection(SHARE_BUNDLES_COLLECTION).where('token', '==', token).limit(1),
    );

    if (bundleSnapshot.empty) {
      throw new Error('Invalid share link');
    }

    const bundleDoc = bundleSnapshot.docs[0];
    const bundle = bundleDoc.data();
    const bundleId = bundleDoc.id;
    if (bundle.status !== 'active' || bundle.remainingSlots <= 0) {
      throw new Error('All tickets have been claimed');
    }

    if (new Date(bundle.expiresAt) < new Date()) {
      throw new Error('Share link has expired');
    }

    if (bundle.userId === redeemerId) {
      throw new Error('You are the owner of this bundle');
    }

    // Block claim if the ticket is gender-restricted and the user hasn't set their gender
    const bundleGenderRestricted = (bundle.slots || []).some(
      (s) => s.slotType === 'shareable' && s.requiredGender && s.requiredGender !== 'any',
    );
    if (bundleGenderRestricted && userGender === null) {
      throw new Error(
        'Please complete your profile and set your gender before claiming this ticket.',
      );
    }

    const existingClaimSnapshot = await transaction.get(
      db
        .collection(TICKET_ASSIGNMENTS_COLLECTION)
        .where('bundleId', '==', bundleId)
        .where('redeemerId', '==', redeemerId)
        .limit(1),
    );

    if (!existingClaimSnapshot.empty) {
      const existingClaim = {
        id: existingClaimSnapshot.docs[0].id,
        ...existingClaimSnapshot.docs[0].data(),
      };
      if (
        existingClaim.isRevoked ||
        existingClaim.status === 'cancelled' ||
        existingClaim.status === 'voided'
      ) {
        throw new Error('Your previous claim from this link was revoked by the ticket owner.');
      }
      return {
        alreadyClaimed: true,
        assignment: existingClaim,
      };
    }

    const slots = bundle.slots || [];

    // Filter to find slots that the user's gender IS ALLOWED to claim
    const eligibleSlots = slots.filter(
      (s) =>
        s.slotType === 'shareable' &&
        s.claimStatus === 'unclaimed' &&
        (!s.requiredGender || s.requiredGender === 'any' || s.requiredGender === userGender),
    );

    if (eligibleSlots.length === 0) {
      // Check if there are ANY unclaimed shareable slots
      const unclaimedSlots = slots.filter(
        (s) => s.slotType === 'shareable' && s.claimStatus === 'unclaimed',
      );

      if (unclaimedSlots.length > 0) {
        // There are slots, but none match this user's gender
        const required = unclaimedSlots[0].requiredGender;
        const requiredLabel = required === 'female' ? 'Female' : 'Male';
        throw new Error(
          `This ticket is not valid for your profile. This ticket is for ${requiredLabel}s only.`,
        );
      } else {
        throw new Error('All tickets from this share link have already been claimed.');
      }
    }

    const slotToAssign = eligibleSlots[0];

    const assignmentId =
      bundle.mode === 'shared_qr'
        ? `CLAIM-GRP-${bundleId}-${redeemerId}-${Date.now().toString(36)}`
        : `CLAIM-${bundleId}-${redeemerId}-${Date.now().toString(36)}`;

    const qrPayload =
      bundle.mode === 'shared_qr'
        ? bundle.groupQrPayload
        : signTicketPayload(assignmentId, redeemerId);

    const claimedAt = new Date().toISOString();
    const assignment = {
      bundleId,
      orderId: bundle.orderId,
      eventId: bundle.eventId,
      tierId: bundle.tierId,
      slotIndex: slotToAssign.slotIndex,
      requiredGender: slotToAssign.requiredGender || 'any',
      couplePairId: slotToAssign.couplePairId || null,
      entitlementId: slotToAssign.entitlementId || null,
      redeemerId,
      originalPurchaserId: bundle.userId,
      assignmentId,
      qrPayload,
      isSharedQr: bundle.mode === 'shared_qr',
      status: 'active',
      claimedAt,
      createdAt: claimedAt,
      updatedAt: claimedAt,
    };

    const updatedSlots = slots.map((s) =>
      s.slotIndex === slotToAssign.slotIndex
        ? {
            ...s,
            currentOwnerUserId: redeemerId,
            claimStatus: 'claimed',
            claimedAt: assignment.claimedAt,
            issuedTicketId: assignmentId,
          }
        : s,
    );

    // Build the complete transaction read set before any write. This is required
    // by Firestore and keeps claim capacity and entitlement ownership atomic.
    const inventoryDeduction = shouldReduceInventoryOnBundleClaim(bundle.inventoryMode)
      ? await prepareInventoryDeduction(transaction, db, bundle.eventId, bundle.tierId, 1)
      : null;
    const entitlementTransfer =
      slotToAssign.entitlementId && !bundle.isCouple
        ? await prepareEntitlementTransfer(slotToAssign.entitlementId, transaction)
        : null;
    const directTicketRef = db
      .collection('tickets')
      .doc(directTicketDocumentId(bundle.orderId, bundle.tierId, slotToAssign.slotIndex));
    const directTicketDoc = await transaction.get(directTicketRef);
    if (directTicketDoc.exists) {
      const directTicket = directTicketDoc.data();
      if (
        directTicket.userId !== bundle.userId ||
        directTicket.orderId !== bundle.orderId ||
        directTicket.tierId !== bundle.tierId ||
        Number(directTicket.slotIndex) !== Number(slotToAssign.slotIndex) ||
        directTicket.status !== 'active'
      ) {
        throw new Error('The selected ticket slot is no longer available for sharing');
      }
      assignment.originalTicketId = directTicketDoc.id;
    }

    if (inventoryDeduction) {
      applyPreparedInventoryDeduction(transaction, inventoryDeduction);
    }
    if (entitlementTransfer) {
      const transferredEntitlement = applyPreparedEntitlementTransfer(
        entitlementTransfer,
        redeemerId,
        bundle.userId,
        transaction,
        userGender,
      );
      assignment.entitlementId = transferredEntitlement.id;
      const claimedSlot = updatedSlots.find(
        (slot) => slot.slotIndex === slotToAssign.slotIndex,
      );
      if (claimedSlot) claimedSlot.entitlementId = transferredEntitlement.id;
    } else if (slotToAssign.entitlementId && bundle.isCouple) {
      transaction.update(db.collection('entitlements').doc(slotToAssign.entitlementId), {
        'metadata.couplePartnerId': redeemerId,
        'metadata.partnerClaimedAt': assignment.claimedAt,
        boundGender: userGender,
      });
    }

    transaction.update(bundleDoc.ref, {
      remainingSlots: bundle.remainingSlots - 1,
      slots: updatedSlots,
      status: bundle.remainingSlots - 1 === 0 ? 'exhausted' : 'active',
    });
    const assignmentRef = db.collection(TICKET_ASSIGNMENTS_COLLECTION).doc(assignmentId);
    transaction.set(assignmentRef, assignment);
    if (directTicketDoc.exists) {
      transaction.update(directTicketRef, {
        status: 'shared',
        sharedAssignmentId: assignmentId,
        sharedToUserId: redeemerId,
        sharedAt: assignment.claimedAt,
        updatedAt: assignment.claimedAt,
      });
    }

    return {
      alreadyClaimed: false,
      assignment,
      bundleOwnerId: bundle.userId,
      claimBundleId: bundleId,
    };
  });

  if (!transactionResult.alreadyClaimed) {
    await logAuditEvent(
      'claim_succeeded',
      {
        bundleId: transactionResult.claimBundleId,
        redeemerId,
        assignmentId: transactionResult.assignment.assignmentId,
        slotIndex: transactionResult.assignment.slotIndex,
      },
      db,
    );
  }

  if (!transactionResult.alreadyClaimed && transactionResult.bundleOwnerId) {
    createNotification({
      userId: transactionResult.bundleOwnerId,
      type: 'ticket_claimed',
      title: 'Ticket Claimed',
      body: 'Someone claimed a ticket from your share link',
      data: { bundleId: transactionResult.claimBundleId, redeemerId },
    }).catch(() => {});
  }

  return {
    alreadyClaimed: transactionResult.alreadyClaimed,
    assignment: transactionResult.assignment,
  };
}

/**
 * Get all assignments for a user (tickets they claimed)
 */
export async function getUserClaimedTickets(userId) {
  if (!isFirebaseConfigured()) return [];

  const db = getAdminDb();
  const snapshot = await db
    .collection(TICKET_ASSIGNMENTS_COLLECTION)
    .where('redeemerId', '==', userId)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get all share bundles for an order
 */
export async function getOrderShareBundles(orderId) {
  if (!isFirebaseConfigured()) return [];

  const db = getAdminDb();
  const snapshot = await db
    .collection(SHARE_BUNDLES_COLLECTION)
    .where('orderId', '==', orderId)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get all assignments for an order (claimed or transferred)
 */
export async function getOrderAssignments(orderId) {
  if (!isFirebaseConfigured()) return [];

  const db = getAdminDb();
  const snapshot = await db
    .collection(TICKET_ASSIGNMENTS_COLLECTION)
    .where('orderId', '==', orderId)
    .get();

  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((a) => a.status !== 'cancelled' && a.status !== 'voided');
}

/**
 * Validate and scan a ticket (Used by Scanner)
 * Works for both direct order tickets and claimed tickets
 */
export async function validateAndScanTicket(ticketId, token, eventId, scannerId, options = {}) {
  if (!isFirebaseConfigured()) throw new Error('Firebase not configured');

  const { directPayload = null } = options;

  // If we have a directPayload, it means the signature was already verified by the route handler
  // using the more complex qrStore.verifyQRPayload() logic.
  if (!directPayload) {
    const verification = verifyTicketToken(token);
    if (!verification.valid) {
      return { valid: false, reason: verification.reason || 'invalid_signature' };
    }
    ticketId = verification.ticketId;
  }

  const db = getAdminDb();
  const now = new Date().toISOString();

  return await db.runTransaction(async (transaction) => {
    // 1. Try Assignment (Claimed/Transferred)
    const assignmentRef = db.collection(TICKET_ASSIGNMENTS_COLLECTION).doc(ticketId);
    const assignmentDoc = await transaction.get(assignmentRef);
    if (assignmentDoc.exists) {
      return await _handleAssignmentScan(transaction, assignmentDoc, eventId, scannerId, now);
    }

    // 2. Try Group QR
    if (ticketId.startsWith('GROUP-')) {
      return await _handleGroupScan(transaction, ticketId, eventId, scannerId, now);
    }

    // 3. Try Direct Order Ticket
    const orderScan = await _handleOrderScan(transaction, ticketId, eventId, scannerId, now);

    if (!orderScan.valid) {
      await logAuditEvent(
        'scan_denied',
        {
          ticketId,
          eventId,
          scannerId,
          reason: orderScan.reason,
        },
        db,
      );
    }

    return orderScan;
  });
}

/**
 * Validates a compact QR code by looking up the order and finding a matching ticket signature.
 */
export async function validateShortQR(orderId, shortSignature, eventId, scannerId) {
  if (!isFirebaseConfigured()) throw new Error('Firebase not configured');

  const db = getAdminDb();
  const orderRef = db.collection('orders').doc(orderId);
  const orderDoc = await orderRef.get();

  if (!orderDoc.exists) return { valid: false, reason: 'order_not_found' };
  const order = orderDoc.data();

  if (order.eventId !== eventId) return { valid: false, reason: 'event_mismatch' };

  // Try finding assignments first
  const assignmentsSnapshot = await db
    .collection(TICKET_ASSIGNMENTS_COLLECTION)
    .where('orderId', '==', orderId)
    .get();

  for (const doc of assignmentsSnapshot.docs) {
    const data = doc.data();
    if (data.qrPayload?.sig === shortSignature || data.assignmentId?.includes(shortSignature)) {
      return await validateAndScanTicket(doc.id, shortSignature, eventId, scannerId, {
        directPayload: data.qrPayload,
      });
    }
  }

  // fallback to standard order tickets
  for (const ticket of order.tickets) {
    // Broadly check the first quantity unit
    const ticketId = `${orderId}-${ticket.ticketId}-1`;
    const result = await validateAndScanTicket(ticketId, shortSignature, eventId, scannerId);
    if (result.valid) return result;
  }

  return {
    valid: false,
    reason: 'invalid_signature',
    message: 'No matching ticket found for this signature',
  };
}

/**
 * @private
 */
async function _handleAssignmentScan(transaction, doc, eventId, scannerId, now) {
  const data = doc.data();
  if (data.eventId !== eventId) return { valid: false, reason: 'event_mismatch' };
  if (data.status === 'used')
    return { valid: false, reason: 'already_used', scannedAt: data.scannedAt };
  if (data.isRevoked || data.status === 'cancelled' || data.status === 'voided') {
    return {
      valid: false,
      reason: data.isRevoked ? 'revoked' : 'cancelled',
      ticket: data,
    };
  }

  const db = getAdminDb();
  const orderRef = db.collection('orders').doc(data.orderId);
  const orderDoc = await transaction.get(orderRef);
  if (
    orderDoc.exists &&
    (orderDoc.data().status === 'cancelled' || orderDoc.data().status === 'refunded')
  ) {
    return { valid: false, reason: 'cancelled' };
  }

  const userGender = await getUserGender(data.redeemerId);
  if (data.requiredGender && data.requiredGender !== 'any') {
    if (userGender === null) {
      return {
        valid: false,
        reason: 'gender_missing',
        required: data.requiredGender,
        actual: null,
      };
    }
    if (data.requiredGender !== userGender) {
      return {
        valid: false,
        reason: 'gender_mismatch',
        required: data.requiredGender,
        actual: userGender,
      };
    }
  }

  if (data.couplePairId) {
    const siblingsSnapshot = await transaction.get(
      db.collection(TICKET_ASSIGNMENTS_COLLECTION).where('couplePairId', '==', data.couplePairId),
    );
    const siblings = siblingsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    const partnerSlot = siblings.find((s) => s.assignmentId !== data.assignmentId);

    if (partnerSlot && partnerSlot.status !== 'used') {
      transaction.update(doc.ref, {
        status: 'used',
        scannedAt: now,
        scannedBy: scannerId,
      });
      return { valid: true, ticket: data, note: 'partial_couple_waiting_for_partner' };
    }
  }

  transaction.update(doc.ref, {
    status: 'used',
    scannedAt: now,
    scannedBy: scannerId,
  });

  await logAuditEvent(
    'scan_approved',
    {
      ticketId: data.assignmentId || doc.id,
      eventId,
      scannerId,
      type: 'assignment',
    },
    db,
  );

  return { valid: true, ticket: data };
}

/**
 * @private
 */
async function _handleGroupScan(transaction, ticketId, eventId, scannerId, now) {
  const db = getAdminDb();
  const bundleSnapshot = await transaction.get(
    db.collection(SHARE_BUNDLES_COLLECTION).where('groupTicketId', '==', ticketId).limit(1),
  );
  if (bundleSnapshot.empty) return { valid: false, reason: 'invalid_group_ticket' };

  const bundleDoc = bundleSnapshot.docs[0];
  const bundle = bundleDoc.data();

  if (bundle.status === 'cancelled') return { valid: false, reason: 'cancelled' };
  if (bundle.scanCreditsRemaining <= 0) return { valid: false, reason: 'scan_limit_reached' };

  transaction.update(bundleDoc.ref, {
    scanCreditsRemaining: bundle.scanCreditsRemaining - 1,
  });

  const scanRef = db.collection('ticket_scans').doc(`${ticketId}-scan-${Date.now()}`);
  transaction.set(scanRef, {
    ticketId,
    bundleId: bundleDoc.id,
    eventId,
    scannedAt: now,
    scannedBy: scannerId,
    isGroupScan: true,
  });

  const roster = bundle.slots
    .filter((s) => s.claimStatus === 'claimed')
    .map((s) => ({
      userId: s.currentOwnerUserId,
      slotIndex: s.slotIndex,
      claimedAt: s.claimedAt,
    }));

  return {
    valid: true,
    ticket: { ...bundle, ticketId },
    scansRemaining: bundle.scanCreditsRemaining - 1,
    roster,
  };
}

/**
 * @private
 */
async function _handleOrderScan(transaction, ticketId, eventId, scannerId, now) {
  const parts = ticketId.split('-');
  if (parts.length < 3) return { valid: false, reason: 'invalid_format' };

  const orderId = parts.slice(0, parts.length - 2).join('-');
  const db = getAdminDb();
  const scanRef = db.collection('ticket_scans').doc(ticketId);
  const scanDoc = await transaction.get(scanRef);

  if (scanDoc.exists) {
    return { valid: false, reason: 'already_used', scannedAt: scanDoc.data().scannedAt };
  }

  const orderRef = db.collection('orders').doc(orderId);
  const orderDoc = await transaction.get(orderRef);

  if (!orderDoc.exists) return { valid: false, reason: 'order_not_found' };
  const order = orderDoc.data();

  if (order.status !== 'confirmed') return { valid: false, reason: 'order_not_confirmed' };
  if (order.eventId !== eventId) return { valid: false, reason: 'event_mismatch' };

  const userGender = await getUserGender(order.userId);
  const event = await getEvent(order.eventId);
  const tier = event?.tickets?.find((t) => t.id === parts[parts.length - 2]);
  const requiredGender =
    tier?.requiredGender ||
    (tier?.genderRequirement !== 'any' ? tier?.genderRequirement || 'any' : 'any');

  if (requiredGender !== 'any') {
    if (userGender === null) {
      return { valid: false, reason: 'gender_missing', required: requiredGender, actual: null };
    }
    if (requiredGender !== userGender) {
      return {
        valid: false,
        reason: 'gender_mismatch',
        required: requiredGender,
        actual: userGender,
      };
    }
  }

  transaction.set(scanRef, {
    ticketId,
    orderId,
    eventId,
    scannedAt: now,
    scannedBy: scannerId,
  });

  return { valid: true, ticket: { ...order, ticketId } };
}

/**
 * Couple Ticket specific logic
 */
export async function getCoupleAssignment(ticketId) {
  if (!isFirebaseConfigured()) return null;
  const db = getAdminDb();
  const doc = await db.collection('couple_assignments').doc(ticketId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

export async function assignPartner(ticketId, ownerId, partnerId, metadata = {}) {
  if (!isFirebaseConfigured()) throw new Error('Firebase not configured');
  const db = getAdminDb();
  const assignmentRef = db.collection('couple_assignments').doc(ticketId);
  const doc = await assignmentRef.get();

  if (doc.exists && doc.data().ownerId !== ownerId) throw new Error('Unauthorized');

  const ownerGender = await getUserGender(ownerId);
  const partnerGender = await getUserGender(partnerId);
  const expectedPartnerGender = ownerGender === 'female' ? 'male' : 'female';

  if (partnerGender === null) {
    throw new Error(
      'Partner must complete their profile and set their gender before being assigned.',
    );
  }
  if (partnerGender !== expectedPartnerGender) {
    const label = expectedPartnerGender === 'female' ? 'Female' : 'Male';
    throw new Error(`Restricted: The partner slot in this couple ticket is for ${label}s only.`);
  }

  const update = {
    ownerId,
    partnerId,
    status: 'fully_assigned',
    ...metadata,
    updatedAt: new Date().toISOString(),
  };

  await assignmentRef.set(update, { merge: true });
  return { id: ticketId, ...update };
}

export async function createPartnerClaimLink(ticketId, ownerId, eventId) {
  if (!isFirebaseConfigured()) throw new Error('Firebase not configured');
  const db = getAdminDb();
  const token = randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const claim = {
    ticketId,
    ownerId,
    eventId,
    token,
    status: 'active',
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  await db.collection('couple_claims').add(claim);
  return { token };
}

export async function claimPartnerSlot(token, userId) {
  if (!isFirebaseConfigured()) throw new Error('Firebase not configured');
  const db = getAdminDb();

  let claimOwnerId = null;
  let claimTicketId = null;
  let claimEventId = null;

  const partnerResult = await db.runTransaction(async (transaction) => {
    const claimSnapshot = await transaction.get(
      db
        .collection('couple_claims')
        .where('token', '==', token)
        .where('status', '==', 'active')
        .limit(1),
    );

    if (claimSnapshot.empty) throw new Error('Invalid or expired claim link');
    const claimDoc = claimSnapshot.docs[0];
    const claim = claimDoc.data();

    if (new Date(claim.expiresAt) < new Date()) throw new Error('Claim link expired');
    if (claim.ownerId === userId) throw new Error('You cannot claim your own couple ticket slot');

    const ownerGender = await getUserGender(claim.ownerId);
    const userGender = await getUserGender(userId);
    const expectedGender = ownerGender === 'female' ? 'male' : 'female';

    if (userGender === null) {
      throw new Error(
        'Please complete your profile and set your gender before claiming this ticket.',
      );
    }
    if (userGender !== expectedGender) {
      const label = expectedGender === 'female' ? 'Female' : 'Male';
      throw new Error(`Restricted: This couple partner slot is for ${label}s only.`);
    }

    claimOwnerId = claim.ownerId;
    claimTicketId = claim.ticketId;
    claimEventId = claim.eventId;

    const assignmentRef = db.collection('couple_assignments').doc(claim.ticketId);

    transaction.set(
      assignmentRef,
      {
        ownerId: claim.ownerId,
        partnerId: userId,
        status: 'fully_assigned',
        eventId: claim.eventId,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    transaction.update(claimDoc.ref, { status: 'claimed', claimedBy: userId });
    return { ticketId: claim.ticketId, eventId: claim.eventId };
  });

  if (claimOwnerId) {
    createNotification({
      userId: claimOwnerId,
      type: 'couple_partner_claimed',
      title: 'Partner Slot Claimed',
      body: 'Someone claimed your couple partner slot',
      data: { ticketId: claimTicketId, eventId: claimEventId, partnerId: userId },
    }).catch(() => {});
  }

  return partnerResult;
}

/**
 * Get couple ticket status from a share bundle.
 * Returns state "partial" (one slot filled) or "complete" (both slots filled).
 */
export async function getCoupleTicketStatus(bundleId) {
  if (!isFirebaseConfigured()) return null;
  const db = getAdminDb();
  const doc = await db.collection(SHARE_BUNDLES_COLLECTION).doc(bundleId).get();
  if (!doc.exists) return null;

  const bundle = doc.data();
  if (!bundle.isCouple) return null;

  const slots = bundle.slots || [];
  const ownerSlot = slots.find((s) => s.slotIndex === 1);
  const partnerSlot = slots.find((s) => s.slotIndex === 2);

  const ownerClaimed = ownerSlot?.claimStatus === 'claimed';
  const partnerClaimed = partnerSlot?.claimStatus === 'claimed';

  return {
    state: ownerClaimed && partnerClaimed ? 'complete' : 'partial',
    ownerSlot: {
      gender: ownerSlot?.requiredGender || null,
      claimed: ownerClaimed,
      userId: ownerSlot?.currentOwnerUserId || null,
    },
    partnerSlot: {
      gender: partnerSlot?.requiredGender || null,
      claimed: partnerClaimed,
      userId: partnerSlot?.currentOwnerUserId || null,
    },
  };
}

/**
 * Cancel the partner's claimed slot in a couple bundle.
 * Only the bundle owner can do this. Resets slot 2 to unclaimed and voids the partner's assignment.
 */
export async function cancelPartnerSlot(bundleId, ownerId) {
  if (!isFirebaseConfigured()) throw new Error('Firebase not configured');
  const db = getAdminDb();

  return await db.runTransaction(async (transaction) => {
    const bundleRef = db.collection(SHARE_BUNDLES_COLLECTION).doc(bundleId);
    const bundleDoc = await transaction.get(bundleRef);
    if (!bundleDoc.exists) throw new Error('Bundle not found');

    const bundle = bundleDoc.data();
    if (bundle.userId !== ownerId)
      throw new Error('Unauthorized: Only the ticket owner can cancel the partner slot');
    if (!bundle.isCouple) throw new Error('Not a couple ticket');

    const slots = bundle.slots || [];
    const partnerSlot = slots.find((s) => s.slotIndex === 2 && s.claimStatus === 'claimed');
    if (!partnerSlot) throw new Error('No partner has claimed this slot yet');

    const partnerId = partnerSlot.currentOwnerUserId;

    // Void the partner's assignment document
    const assignmentsSnapshot = await transaction.get(
      db
        .collection(TICKET_ASSIGNMENTS_COLLECTION)
        .where('bundleId', '==', bundleId)
        .where('redeemerId', '==', partnerId)
        .limit(1),
    );
    if (!assignmentsSnapshot.empty) {
      transaction.update(assignmentsSnapshot.docs[0].ref, {
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancelledBy: ownerId,
      });
    }

    // Reset partner slot to unclaimed
    const updatedSlots = slots.map((s) =>
      s.slotIndex === 2
        ? {
            ...s,
            currentOwnerUserId: null,
            claimStatus: 'unclaimed',
            claimedAt: null,
            issuedTicketId: null,
          }
        : s,
    );

    transaction.update(bundleRef, {
      slots: updatedSlots,
      remainingSlots: (bundle.remainingSlots || 0) + 1,
      status: 'active',
    });

    await logAuditEvent(
      'couple_partner_cancelled',
      {
        bundleId,
        ownerId,
        partnerId,
      },
      db,
    );

    return { success: true, releasedPartnerId: partnerId };
  });
}

/**
 * Initiate a ticket transfer
 */
export async function initiateTransfer(ticketId, senderId, recipientEmail = null) {
  if (!isFirebaseConfigured()) throw new Error('Firebase not configured');
  const db = getAdminDb();

  const assignmentRef = db.collection(TICKET_ASSIGNMENTS_COLLECTION).doc(ticketId);
  const directTicketRef = db.collection('tickets').doc(ticketId);
  const [assignmentCandidate, directTicketCandidate] = await Promise.all([
    assignmentRef.get(),
    directTicketRef.get(),
  ]);
  const isAssignmentRecord = assignmentCandidate.exists;
  if (
    !isAssignmentRecord &&
    (ticketId.startsWith('CLAIM-') || ticketId.startsWith('TRANS-'))
  ) {
    throw new Error('Ticket assignment not found');
  }
  let orderId = null;

  let eventId;
  let currentOwnerId;
  let entitlementId = null;
  let tierId = null;
  let slotIndex = null;
  let requiredGender = 'any';
  let ticketType = 'Ticket';

  // 1. Ownership and State Check
  if (isAssignmentRecord) {
    const data = assignmentCandidate.data();
    if (data.redeemerId !== senderId)
      throw new Error('Unauthorized: You do not own this claimed ticket');
    if (data.status === 'used')
      throw new Error('Ticket has already been scanned and cannot be transferred');
    if (data.status !== 'active')
      throw new Error('This ticket is no longer valid');

    eventId = data.eventId;
    currentOwnerId = data.redeemerId;
    entitlementId = data.entitlementId || null;
    orderId = data.orderId || null;
    tierId = data.tierId || null;
    slotIndex = data.slotIndex ?? null;
    requiredGender = data.requiredGender || 'any';
    ticketType = data.ticketType || 'Transferred Ticket';
  }

  let event = null;

  if (!isAssignmentRecord) {
    const directTicket = directTicketCandidate.exists ? directTicketCandidate.data() : null;
    const parsedTicket = directTicket ? null : parseDirectTicketId(ticketId);
    orderId = directTicket ? directTicket.orderId : parsedTicket.orderId;

    // Direct order ticket
    const orderRef = db.collection(ORDERS_COLLECTION).doc(orderId);
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) throw new Error('Order not found');

    const order = orderDoc.data();
    if (order.userId !== senderId) throw new Error('Unauthorized: You do not own this order');
    if (order.status !== 'confirmed') throw new Error('Only confirmed orders can be transferred');

    eventId = order.eventId;
    currentOwnerId = order.userId;
    event = await getEvent(eventId);
    if (directTicket) {
      if (directTicket.userId !== senderId) {
        throw new Error('Unauthorized: You do not own this ticket');
      }
      if (directTicket.status !== 'active') {
        throw new Error('This ticket is no longer transferable');
      }
    }
    const directMetadata = directTicket
      ? {
          orderId: directTicket.orderId,
          tierId: directTicket.tierId,
          slotIndex: directTicket.slotIndex,
          ticketType: directTicket.tierName || directTicket.ticketType || 'Ticket',
          requiredGender: inferGenderRequirement(directTicket),
        }
      : deriveDirectTransferMetadata(ticketId, order, event);
    orderId = directMetadata.orderId;
    tierId = directMetadata.tierId;
    slotIndex = directMetadata.slotIndex;
    requiredGender = directMetadata.requiredGender;
    ticketType = directMetadata.ticketType;

    // Check if this specific ticket index has been checked in
    const scanRef = db.collection('ticket_scans').doc(ticketId);
    const scanDoc = await scanRef.get();
    if (scanDoc.exists) throw new Error('This ticket has already been used');

    // Check if it's already assigned/transferred
    const assignmentSnapshot = await db
      .collection(TICKET_ASSIGNMENTS_COLLECTION)
      .where('originalTicketId', '==', ticketId)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    if (!assignmentSnapshot.empty) {
      const assignment = assignmentSnapshot.docs[0].data();
      if (assignment.redeemerId !== senderId)
        throw new Error('This ticket is currently owned by someone else via transfer.');
    }
    const entitlementsSnapshot = await db
      .collection('entitlements')
      .where('orderId', '==', orderId)
      .where('metadata.tierId', '==', tierId)
      .where('metadata.index', '==', slotIndex)
      .limit(1)
      .get();
    if (!entitlementsSnapshot.empty) {
      entitlementId = entitlementsSnapshot.docs[0].id;
    }
  }

  if (!event) {
    event = await getEvent(eventId);
  }

  if (event) {
    const start = toDateValue(event.startDate || event.startAt);
    if (!start) throw new Error('Event start time is invalid');
    const hoursUntilEvent = (start.getTime() - Date.now()) / 36e5;
    if (hoursUntilEvent < 2) {
      throw new Error(`Transfers are locked 2 hours before the event.`);
    }
  }

  await assertCanCreateTransfer(db, senderId, ticketId);

  // 4. Create Transfer Record
  const token = generateToken(20);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  const senderProfile = await db.collection('users').doc(senderId).get();
  const senderData = senderProfile.exists ? senderProfile.data() : {};

  const transfer = {
    ticketId,
    sourceKind: isAssignmentRecord ? 'assignment' : 'direct',
    ticketDocumentId: directTicketCandidate.exists ? ticketId : null,
    orderId,
    tierId,
    slotIndex,
    ticketType,
    requiredGender,
    entitlementId,
    senderId,
    senderName: senderData.displayName || senderData.name || 'Member',
    recipientEmail: recipientEmail ? recipientEmail.toLowerCase() : null,
    eventId,
    eventTitle: event?.title || 'Event',
    status: 'pending',
    token,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  const transferRef = db
    .collection(TRANSFERS_COLLECTION)
    .doc(`XFER-${randomBytes(12).toString('hex')}`);
  const lockRef = db
    .collection('ticket_transfer_locks')
    .doc(createHash('sha256').update(`${senderId}:${ticketId}`).digest('hex'));
  const creation = await db.runTransaction(async (transaction) => {
    const lockDoc = await transaction.get(lockRef);
    const activeTransferRef = lockDoc.exists && lockDoc.data().transferId
      ? db.collection(TRANSFERS_COLLECTION).doc(lockDoc.data().transferId)
      : null;
    const activeTransferDoc = activeTransferRef
      ? await transaction.get(activeTransferRef)
      : null;

    if (activeTransferDoc?.exists) {
      const activeTransfer = activeTransferDoc.data();
      if (
        activeTransfer.status === 'pending' &&
        new Date(activeTransfer.expiresAt).getTime() > Date.now()
      ) {
        return { created: false, id: activeTransferDoc.id, transfer: activeTransfer };
      }
    }

    const now = new Date().toISOString();
    if (activeTransferDoc?.exists && activeTransferDoc.data().status === 'pending') {
      transaction.update(activeTransferDoc.ref, { status: 'expired', updatedAt: now });
    }
    transaction.set(transferRef, transfer);
    transaction.set(lockRef, {
      senderId,
      ticketId,
      transferId: transferRef.id,
      updatedAt: now,
    });
    return { created: true, id: transferRef.id, transfer };
  });

  if (!creation.created) {
    return { id: creation.id, ...creation.transfer };
  }

  await logAuditEvent(
    'transfer_initiated',
    {
      transferId: creation.id,
      ticketId,
      senderId,
      recipientEmail: transfer.recipientEmail,
      method: recipientEmail ? 'email' : 'link',
    },
    db,
  );

  if (transfer.recipientEmail) {
    const recipientSnapshot = await db
      .collection('users')
      .where('email', '==', transfer.recipientEmail)
      .limit(1)
      .get();
    if (!recipientSnapshot.empty) {
      const recipientId = recipientSnapshot.docs[0].id;
      createNotification({
        userId: recipientId,
        type: 'transfer_received',
        title: 'Ticket Transfer Received',
        body: `${transfer.senderName || 'Someone'} sent you a ticket`,
        data: { transferId: creation.id, ticketId, senderId },
      }).catch(() => {});
    }
  }

  return { id: creation.id, ...transfer };
}

/**
 * Accept a ticket transfer
 */
export async function acceptTransfer(tokenOrId, recipientId, authenticatedEmail = null) {
  if (!isFirebaseConfigured()) throw new Error('Firebase not configured');
  const db = getAdminDb();

  let transferRef = db.collection(TRANSFERS_COLLECTION).doc(tokenOrId);
  let transferLookup = await transferRef.get();
  if (!transferLookup.exists) {
    const tokenQuery = await db
      .collection(TRANSFERS_COLLECTION)
      .where('token', '==', tokenOrId)
      .limit(1)
      .get();
    if (tokenQuery.empty) throw new Error('Transfer link is invalid or has been revoked.');
    transferRef = tokenQuery.docs[0].ref;
    transferLookup = tokenQuery.docs[0];
  }

  const [recipientGender, recipientBlocked, recipientProfile] = await Promise.all([
    getUserGender(recipientId),
    isUserBlocked(recipientId, db),
    db.collection('users').doc(recipientId).get(),
  ]);
  if (recipientBlocked) {
    throw new Error('Your account is restricted from accepting ticket transfers.');
  }
  const recipientEmail = String(
    authenticatedEmail || (recipientProfile.exists ? recipientProfile.data().email : '') || '',
  ).toLowerCase();

  const transferResult = await db.runTransaction(async (transaction) => {
    const transferDoc = await transaction.get(transferRef);
    if (!transferDoc.exists) throw new Error('Transfer link is invalid or has been revoked.');

    const transfer = transferDoc.data();
    const transferId = transferDoc.id;

    // 1. Validation Logic
    if (transfer.status !== 'pending') {
      if (transfer.status === 'accepted') throw new Error('This ticket has already been claimed.');
      if (transfer.status === 'cancelled')
        throw new Error('This transfer was cancelled by the sender.');
      throw new Error(`This transfer is no longer valid (Status: ${transfer.status})`);
    }

    if (new Date(transfer.expiresAt) < new Date()) {
      transaction.update(transferRef, { status: 'expired', updatedAt: new Date().toISOString() });
      return {
        success: false,
        terminalError: 'This transfer link has expired. Please ask the sender to generate a new one.',
      };
    }

    if (transfer.senderId === recipientId) {
      throw new Error('You already own this ticket.');
    }

    // SECURITY: Verify recipient email matches if transfer was email-bound
    if (transfer.recipientEmail && recipientEmail !== transfer.recipientEmail) {
      throw new Error(
        'This transfer was sent to a specific email address. Please sign in with the email address that received the transfer invitation.',
      );
    }

    const ticketId = transfer.ticketId;
    const transferGenderRequirement = transfer.requiredGender || 'any';
    if (transferGenderRequirement !== 'any') {
      if (recipientGender === null) {
        throw new Error(
          'Please complete your profile and set your gender before accepting this ticket transfer.',
        );
      }
      if (recipientGender !== transferGenderRequirement) {
        throw new Error(
          `Restricted: This ticket is for ${transferGenderRequirement === 'female' ? 'Females' : 'Males'} only.`,
        );
      }
    }
    const sourceKind =
      transfer.sourceKind ||
      (ticketId.startsWith('CLAIM-') || ticketId.startsWith('TRANS-')
        ? 'assignment'
        : 'direct');
    let assignmentRef = null;
    let assignmentData = null;
    let directOrder = null;
    let directOrderId = transfer.orderId || null;
    let sourceTicketDocumentRef = null;

    // 2. Resolve and verify the complete ownership read set.
    if (sourceKind === 'assignment') {
      const assignmentRef = db.collection(TICKET_ASSIGNMENTS_COLLECTION).doc(ticketId);
      const assignmentDoc = await transaction.get(assignmentRef);
      assignmentData = assignmentDoc.exists ? assignmentDoc.data() : null;
      if (
        !assignmentData ||
        assignmentData.redeemerId !== transfer.senderId ||
        assignmentData.status !== 'active'
      ) {
        transaction.update(transferRef, {
          status: 'invalidated',
          updatedAt: new Date().toISOString(),
        });
        return { success: false, terminalError: "This ticket is no longer in the sender's wallet." };
      }
    } else {
      const parsedTicket = directOrderId ? null : parseDirectTicketId(ticketId);
      directOrderId = directOrderId || parsedTicket.orderId;
      const orderRef = db.collection(ORDERS_COLLECTION).doc(directOrderId);
      const scanRef = db.collection('ticket_scans').doc(ticketId);
      const directTicketRef = transfer.ticketDocumentId
        ? db.collection('tickets').doc(transfer.ticketDocumentId)
        : null;
      sourceTicketDocumentRef = directTicketRef;
      const activeAssignmentQuery = db
        .collection(TICKET_ASSIGNMENTS_COLLECTION)
        .where('originalTicketId', '==', ticketId)
        .where('status', '==', 'active')
        .limit(1);
      const [orderDoc, scanDoc, activeAssignmentSnapshot, directTicketDoc] = await Promise.all([
        transaction.get(orderRef),
        transaction.get(scanRef),
        transaction.get(activeAssignmentQuery),
        directTicketRef ? transaction.get(directTicketRef) : Promise.resolve(null),
      ]);
      directOrder = orderDoc.exists ? orderDoc.data() : null;
      const activeAssignment = activeAssignmentSnapshot.empty
        ? null
        : activeAssignmentSnapshot.docs[0].data();
      if (
        !directOrder ||
        directOrder.userId !== transfer.senderId ||
        directOrder.status !== 'confirmed' ||
        scanDoc.exists ||
        (directTicketRef &&
          (!directTicketDoc?.exists ||
            directTicketDoc.data().userId !== transfer.senderId ||
            directTicketDoc.data().status !== 'active')) ||
        (activeAssignment && activeAssignment.redeemerId !== transfer.senderId)
      ) {
        transaction.update(transferRef, {
          status: 'invalidated',
          updatedAt: new Date().toISOString(),
        });
        return {
          success: false,
          terminalError: 'The sender no longer owns this ticket.',
        };
      }
    }

    const entitlementTransfer = transfer.entitlementId
      ? await prepareEntitlementTransfer(transfer.entitlementId, transaction)
      : null;

    // 3. Atomic Handoff — all transaction reads are complete above.
    const now = new Date().toISOString();
    const transferredEntitlement = entitlementTransfer
      ? applyPreparedEntitlementTransfer(
          entitlementTransfer,
          recipientId,
          transfer.senderId,
          transaction,
        )
      : null;

    if (sourceKind === 'assignment') {
      assignmentRef = db.collection(TICKET_ASSIGNMENTS_COLLECTION).doc(ticketId);
      transaction.update(assignmentRef, {
        redeemerId: recipientId,
        qrPayload: signTicketPayload(ticketId, recipientId),
        entitlementId: transferredEntitlement?.id || assignmentData.entitlementId || null,
        previousOwnerId: transfer.senderId,
        updatedAt: now,
        transferSource: 'formal_transfer',
        receivedFrom: transfer.senderName || 'Unknown',
      });
    } else {
      // Convert direct order ticket to an assignment for the new user
      const assignmentId = `TRANS-${ticketId}-${recipientId.slice(0, 5)}-${randomBytes(4).toString('hex')}`;
      const qrPayload = signTicketPayload(assignmentId, recipientId);

      const assignment = {
        originalTicketId: ticketId,
        orderId: directOrderId,
        tierId: transfer.tierId ?? parseDirectTicketId(ticketId).tierId,
        slotIndex: transfer.slotIndex ?? parseDirectTicketId(ticketId).slotIndex,
        redeemerId: recipientId,
        originalPurchaserId: transfer.senderId,
        senderId: transfer.senderId,
        eventId: transfer.eventId,
        status: 'active',
        assignmentId,
        qrPayload,
        requiredGender: transferGenderRequirement,
        entitlementId: transferredEntitlement?.id || null,
        ticketType: transfer.ticketType || 'Transferred Pass',
        transferredAt: now,
        createdAt: now,
        updatedAt: now,
        receivedFrom: transfer.senderName || 'Unknown',
      };

      transaction.set(db.collection(TICKET_ASSIGNMENTS_COLLECTION).doc(assignmentId), assignment);
      if (sourceTicketDocumentRef) {
        transaction.update(sourceTicketDocumentRef, {
          status: 'transferred',
          transferredTo: recipientId,
          transferredAt: now,
          updatedAt: now,
        });
      }
    }

    // 4. Finalize Transfer Record
    transaction.update(transferRef, {
      status: 'accepted',
      recipientId: recipientId,
      acceptedAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      ticketId,
      transferId,
      senderId: transfer.senderId,
      sourceKind,
    };
  });

  if (!transferResult.success) {
    throw new Error(transferResult.terminalError || 'Transfer could not be accepted.');
  }

  await logAuditEvent(
    'transfer_accepted',
    {
      transferId: transferResult.transferId,
      senderId: transferResult.senderId,
      recipientId,
      ticketId: transferResult.ticketId,
    },
    db,
  );

  if (transferResult.senderId) {
    createNotification({
      userId: transferResult.senderId,
      type: 'transfer_accepted',
      title: 'Transfer Accepted',
      body: 'Your ticket transfer has been accepted',
      data: {
        transferId: transferResult.transferId,
        ticketId: transferResult.ticketId,
        recipientId,
      },
    }).catch(() => {});
  }

  return { success: true, ticketId: transferResult.ticketId };
}

export async function getPendingTransfers(userId, email = null) {
  if (!isFirebaseConfigured()) return [];
  const db = getAdminDb();
  const now = new Date();

  // Fetch transfers where user is sender
  const sentSnapshot = await db
    .collection(TRANSFERS_COLLECTION)
    .where('senderId', '==', userId)
    .where('status', '==', 'pending')
    .get();

  const sent = sentSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    isSender: true,
  }));

  // Fetch transfers where user is recipient
  let received = [];
  if (email) {
    const receivedSnapshot = await db
      .collection(TRANSFERS_COLLECTION)
      .where('recipientEmail', '==', email.toLowerCase())
      .where('status', '==', 'pending')
      .get();
    received = receivedSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      isSender: false,
    }));
  }

  // Filter out expired transfers and batch-update them as expired
  const valid = [];
  for (const transfer of [...sent, ...received]) {
    if (new Date(transfer.expiresAt) < now) {
      await db
        .collection(TRANSFERS_COLLECTION)
        .doc(transfer.id)
        .update({ status: 'expired', updatedAt: now.toISOString() })
        .catch(() => {});
    } else {
      valid.push(transfer);
    }
  }

  return valid;
}

export async function transferCoupleTicket(ticketId, currentOwnerId, newOwnerId) {
  if (!isFirebaseConfigured()) throw new Error('Firebase not configured');
  const db = getAdminDb();

  return await db.runTransaction(async (transaction) => {
    const assignmentRef = db.collection('couple_assignments').doc(ticketId);
    const doc = await transaction.get(assignmentRef);

    const currentOwner = doc.exists ? doc.data().ownerId : currentOwnerId;
    if (currentOwner !== currentOwnerId) throw new Error('Unauthorized');

    transaction.set(
      assignmentRef,
      {
        ownerId: newOwnerId,
        partnerId: null,
        status: 'unassigned',
        transferLog: [
          ...(doc.data()?.transferLog || []),
          {
            from: currentOwnerId,
            to: newOwnerId,
            at: new Date().toISOString(),
          },
        ],
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    return { success: true };
  });
}

export async function cancelTransfer(transferId, userId) {
  if (!isFirebaseConfigured()) throw new Error('Firebase not configured');
  const db = getAdminDb();

  const transferRef = db.collection(TRANSFERS_COLLECTION).doc(transferId);
  const doc = await transferRef.get();

  if (!doc.exists) throw new Error('Transfer not found');
  if (doc.data().senderId !== userId) throw new Error('Unauthorized');

  await transferRef.update({
    status: 'cancelled',
    updatedAt: new Date().toISOString(),
  });

  await logAuditEvent(
    'transfer_cancelled',
    {
      transferId,
      userId,
    },
    db,
  );

  return { success: true };
}

/**
 * Invalidate all ticket shares/assignments for a cancelled/refunded order
 */
export async function invalidateOrderTickets(orderId, reason = 'refunded') {
  if (!isFirebaseConfigured()) return;
  const db = getAdminDb();

  console.log(`[TicketShareStore] Invalidating tickets for order ${orderId}. Reason: ${reason}`);

  // 1. Cancel Bundles
  const bundles = await db
    .collection(SHARE_BUNDLES_COLLECTION)
    .where('orderId', '==', orderId)
    .get();
  const batch = db.batch();

  bundles.docs.forEach((doc) => {
    batch.update(doc.ref, {
      status: 'cancelled',
      cancellationReason: reason,
      updatedAt: new Date().toISOString(),
    });
  });

  // 2. Void Assignments
  const assignments = await db
    .collection(TICKET_ASSIGNMENTS_COLLECTION)
    .where('orderId', '==', orderId)
    .get();
  assignments.docs.forEach((doc) => {
    batch.update(doc.ref, {
      status: 'voided',
      voidReason: reason,
      updatedAt: new Date().toISOString(),
    });
  });

  // 3. Cancel Transfers
  const transfers = await db.collection(TRANSFERS_COLLECTION).where('orderId', '==', orderId).get();
  transfers.docs.forEach((doc) => {
    if (doc.data().status === 'pending') {
      batch.update(doc.ref, {
        status: 'cancelled',
        cancellationReason: reason,
        updatedAt: new Date().toISOString(),
      });
    }
  });

  await batch.commit();

  await logAuditEvent(
    'order_invalidated',
    {
      orderId,
      reason,
      bundlesAffected: bundles.size,
      assignmentsAffected: assignments.size,
    },
    db,
  );
}

/**
 * Reclaim an unclaimed slot from a share bundle
 */
export async function reclaimUnclaimedSlot(bundleId, userId, slotIndex) {
  if (!isFirebaseConfigured()) throw new Error('Firebase not configured');
  const db = getAdminDb();

  return await db.runTransaction(async (transaction) => {
    const bundleRef = db.collection(SHARE_BUNDLES_COLLECTION).doc(bundleId);
    const doc = await transaction.get(bundleRef);

    if (!doc.exists) throw new Error('Share link not found');
    const bundle = doc.data();

    if (bundle.userId !== userId) throw new Error('Unauthorized');
    if (bundle.status === 'cancelled') throw new Error('Share link is already cancelled');

    const slots = bundle.slots || [];
    const slotIdx = slots.findIndex((s) => s.slotIndex === slotIndex);

    if (slotIdx === -1) throw new Error('Slot not found');
    if (slots[slotIdx].claimStatus !== 'unclaimed') {
      throw new Error('This ticket has already been claimed and cannot be reclaimed.');
    }

    // To reclaim, we simply mark it back to the owner or just remove it from shareable pool
    // In our model, owner slots are 'owner_locked'.
    // Reclaiming means this slot is no longer available via this bundle's token.

    const updatedSlots = [...slots];
    updatedSlots[slotIdx].claimStatus = 'reclaimed';
    updatedSlots[slotIdx].reclaimedAt = new Date().toISOString();

    transaction.update(bundleRef, {
      slots: updatedSlots,
      remainingSlots: bundle.remainingSlots - 1,
      status: bundle.remainingSlots - 1 === 0 ? 'exhausted' : 'active',
    });

    await logAuditEvent(
      'slot_reclaimed',
      {
        bundleId,
        userId,
        slotIndex,
      },
      db,
    );

    return { success: true };
  });
}

/**
 * Revoke an already-claimed ticket from a share bundle.
 * Only the bundle owner (host) can revoke. Nullifies the assignment and resets
 * the slot so a real friend can claim it.
 */
export async function revokeClaimedTicket(bundleId, hostUserId, slotIndex) {
  if (!isFirebaseConfigured()) throw new Error('Firebase not configured');
  const db = getAdminDb();

  const result = await db.runTransaction(async (transaction) => {
    const bundleRef = db.collection(SHARE_BUNDLES_COLLECTION).doc(bundleId);
    const doc = await transaction.get(bundleRef);

    if (!doc.exists) throw new Error('Share bundle not found');
    const bundle = doc.data();

    if (bundle.userId !== hostUserId)
      throw new Error('Unauthorized: Only the ticket owner can revoke claimed tickets');
    if (bundle.status === 'cancelled') throw new Error('Share bundle is already cancelled');

    const slots = bundle.slots || [];
    const slotIdx = slots.findIndex((s) => s.slotIndex === slotIndex);

    if (slotIdx === -1) throw new Error('Slot not found');
    if (slots[slotIdx].claimStatus !== 'claimed') {
      throw new Error('This ticket has not been claimed yet and cannot be revoked.');
    }

    const claimedUserId = slots[slotIdx].currentOwnerUserId;
    const issuedTicketId = slots[slotIdx].issuedTicketId;
    if (!claimedUserId) throw new Error('Claimed slot is missing its current owner');

    // Resolve one exact assignment before writing anything. If identity cannot
    // be proven, fail closed and leave capacity unchanged.
    let assignmentRef = null;
    let assignment = null;

    // Path 1: Void by issuedTicketId (direct assignment reference)
    if (issuedTicketId) {
      const directAssignmentRef = db
        .collection(TICKET_ASSIGNMENTS_COLLECTION)
        .doc(issuedTicketId);
      const assignmentDoc = await transaction.get(directAssignmentRef);
      if (assignmentDoc.exists) {
        const candidate = assignmentDoc.data();
        if (candidate.bundleId === bundleId && candidate.redeemerId === claimedUserId) {
          assignmentRef = directAssignmentRef;
          assignment = candidate;
        }
      }
    }

    // Path 2: Fallback lookup by bundleId + redeemerId if path 1 didn't match
    if (!assignment) {
      const altSnapshot = await transaction.get(
        db
          .collection(TICKET_ASSIGNMENTS_COLLECTION)
          .where('bundleId', '==', bundleId)
          .where('redeemerId', '==', claimedUserId)
          .where('status', '==', 'active')
          .limit(2),
      );
      const matchingAssignments = altSnapshot.docs.filter(
        (candidate) => candidate.data().slotIndex === slotIndex,
      );
      if (matchingAssignments.length === 1) {
        assignmentRef = matchingAssignments[0].ref;
        assignment = matchingAssignments[0].data();
      } else if (matchingAssignments.length > 1) {
        throw new Error('Multiple active assignments found for this ticket slot');
      }
    }

    if (!assignment || !assignmentRef) {
      throw new Error('Cannot safely revoke: active ticket assignment could not be verified');
    }
    if (assignment.status === 'used') {
      throw new Error('Cannot revoke a ticket that has already been scanned for entry');
    }
    if (assignment.status !== 'active') {
      throw new Error(`Cannot revoke a ticket in status: ${assignment.status}`);
    }

    const entitlementId = assignment.entitlementId || slots[slotIdx].entitlementId || null;
    let preparedEntitlement = null;
    if (entitlementId) {
      const entitlementRef = db.collection('entitlements').doc(entitlementId);
      const entitlementDoc = await transaction.get(entitlementRef);
      if (!entitlementDoc.exists) {
        throw new Error('Cannot safely revoke: linked entitlement was not found');
      }
      const entitlement = entitlementDoc.data();
      if (entitlement.ownerUserId !== claimedUserId) {
        throw new Error('Cannot safely revoke: entitlement owner does not match the ticket owner');
      }
      if (entitlement.state === ENTITLEMENT_STATES.CONSUMED) {
        throw new Error('Cannot revoke a ticket that has already been scanned for entry');
      }
      if (
        entitlement.state !== ENTITLEMENT_STATES.ISSUED &&
        entitlement.state !== ENTITLEMENT_STATES.ACTIVE
      ) {
        throw new Error(`Cannot safely revoke entitlement in state: ${entitlement.state}`);
      }
      preparedEntitlement = { entitlementId, entRef: entitlementRef, entitlement };
    }
    const directTicketRef = db
      .collection('tickets')
      .doc(
        assignment.originalTicketId ||
          directTicketDocumentId(bundle.orderId, bundle.tierId, slotIndex),
      );
    const directTicketDoc = await transaction.get(directTicketRef);
    if (
      directTicketDoc.exists &&
      (directTicketDoc.data().userId !== bundle.userId ||
        directTicketDoc.data().orderId !== bundle.orderId ||
        Number(directTicketDoc.data().slotIndex) !== Number(slotIndex))
    ) {
      throw new Error('Cannot safely revoke: source ticket ownership does not match the bundle');
    }

    const now = new Date().toISOString();
    transaction.update(assignmentRef, {
      status: 'cancelled',
      isRevoked: true,
      revokedAt: now,
      cancelledBy: hostUserId,
      voidReason: 'revoked_by_host',
    });
    if (directTicketDoc.exists) {
      transaction.update(directTicketRef, {
        status: 'active',
        sharedAssignmentId: null,
        sharedToUserId: null,
        sharedAt: null,
        updatedAt: now,
      });
    }
    const replacementEntitlement = preparedEntitlement
      ? applyPreparedEntitlementRevocationWithReplacement(
          preparedEntitlement,
          bundle.userId,
          hostUserId,
          'SHARE_REVOKED',
          transaction,
        )
      : null;

    // Reset slot to unclaimed
    const updatedSlots = slots.map((s) =>
      s.slotIndex === slotIndex
        ? {
            ...s,
            currentOwnerUserId: null,
            claimStatus: 'unclaimed',
            claimedAt: null,
            issuedTicketId: null,
            entitlementId: replacementEntitlement?.id || s.entitlementId || null,
          }
        : s,
    );

    transaction.update(bundleRef, {
      slots: updatedSlots,
      remainingSlots: (bundle.remainingSlots || 0) + 1,
      status: 'active',
    });

    return {
      success: true,
      revokedUserId: claimedUserId,
      releasedSlot: slotIndex,
      assignmentId: assignmentRef.id,
    };
  });

  await logAuditEvent(
    'revoke_succeeded',
    {
      bundleId,
      hostUserId,
      revokedUserId: result.revokedUserId,
      slotIndex,
      assignmentId: result.assignmentId,
    },
    db,
  );

  return {
    success: true,
    revokedUserId: result.revokedUserId,
    releasedSlot: result.releasedSlot,
  };
}

/**
 * Cancel an entire share bundle (invalidates the token and reclaims all unclaimed slots)
 */
export async function cancelShareBundle(bundleId, userId) {
  if (!isFirebaseConfigured()) throw new Error('Firebase not configured');
  const db = getAdminDb();

  return await db.runTransaction(async (transaction) => {
    const bundleRef = db.collection('share_bundles').doc(bundleId);
    const doc = await transaction.get(bundleRef);

    if (!doc.exists) throw new Error('Share link not found');
    const bundle = doc.data();

    if (bundle.userId !== userId) throw new Error('Unauthorized');
    if (bundle.status === 'cancelled') return { success: true };

    const slots = bundle.slots || [];
    const updatedSlots = slots.map((s) => {
      if (s.claimStatus === 'unclaimed') {
        return { ...s, claimStatus: 'reclaimed', reclaimedAt: new Date().toISOString() };
      }
      return s;
    });

    transaction.update(bundleRef, {
      status: 'cancelled',
      slots: updatedSlots,
      remainingSlots: 0,
      updatedAt: new Date().toISOString(),
    });

    await logAuditEvent(
      'bundle_cancelled',
      {
        bundleId,
        userId,
        orderId: bundle.orderId,
      },
      db,
    );

    return { success: true };
  });
}
