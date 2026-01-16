import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { createHmac, randomBytes } from "node:crypto";
import { getOrderById } from "./orderStore";
import { MONEY_STATES } from "@c1rcle/core/ledger-engine";
import { transferEntitlement } from "@c1rcle/core/entitlement-engine";
import { getEvent } from "./eventStore";
import { SECURITY_CONFIG } from "./security";

const SHARE_BUNDLES_COLLECTION = "share_bundles";
const TICKET_ASSIGNMENTS_COLLECTION = "ticket_assignments";
const TRANSFERS_COLLECTION = "transfers";

/**
 * Generate a non-guessable token for the share link or transfer
 */
function generateToken(length = 16) {
    return randomBytes(length).toString("hex");
}

/**
 * Sign a ticket payload for QR verification
 */
function signTicketPayload(ticketId) {
    const secret = process.env.TICKET_SECRET || "c1rcle-secret-2025";
    const signature = createHmac("sha256", secret).update(ticketId).digest("hex").slice(0, 16);
    return `${ticketId}:${signature}`;
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
function initializeSlots(quantity, userId, tier, buyerGender = "any", skipOwnerSlot = false) {
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
        ownerRequiredGender = (buyerGender === "female") ? "female" : "male";
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
    for (let i = (ownerSlotIndex === 1 ? 2 : 1); i <= effectiveQuantity; i++) {
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
        slotType: "owner_locked",
        currentOwnerUserId: userId,
        claimStatus: "claimed",
        claimedAt: new Date().toISOString(),
        requiredGender: requiredGender
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
function _createShareableSlot(index, userId, existingSlots, buyerGender, isCouple, genderRequirement) {
    const slot = {
        slotIndex: index,
        slotType: "shareable",
        currentOwnerUserId: null,
        claimStatus: "unclaimed",
    };

    if (isCouple) {
        // In this ecosystem, the partner slot (index 2, 4, etc.) is strictly for Females.
        // The primary slots (1, 3, etc.) follow the buyer's gender or are 'any'.
        if (index % 2 === 0) {
            slot.requiredGender = "female";
        } else {
            slot.requiredGender = (index === 1 && buyerGender !== "any") ? buyerGender : "male";
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
 * Fetch user gender from profiles
 */
async function getUserGender(userId) {
    if (!isFirebaseConfigured()) return "male"; // Mock fallback
    const db = getAdminDb();
    const doc = await db.collection("users").doc(userId).get();
    return doc.exists ? (doc.data().gender || "any") : "any";
}

/**
 * Create or upgrade a share bundle for an order, event, and tier
 */
export async function createShareBundle(orderId, userId, eventId, quantity, tierId = null) {
    if (!isFirebaseConfigured()) {
        throw new Error("Firebase not configured");
    }

    console.log(`[TicketShareStore] Creating share bundle. orderId=${orderId}, userId=${userId}, tierId=${tierId}`);
    const order = await getOrderById(orderId);

    if (!order) {
        throw new Error("Order not found");
    }

    if (order.userId !== userId) {
        throw new Error("Unauthorized");
    }

    if (order.status !== "confirmed") {
        throw new Error("Order must be confirmed before sharing");
    }

    const db = getAdminDb();

    // Check if bundle already exists for this order+tier
    const query = db.collection(SHARE_BUNDLES_COLLECTION)
        .where("orderId", "==", orderId)
        .where("tierId", "==", tierId || (order.tickets[0]?.ticketId));

    const existingSnapshot = await query.get();
    if (!existingSnapshot.empty) {
        const bundle = { id: existingSnapshot.docs[0].id, ...existingSnapshot.docs[0].data() };
        if (bundle.status !== "cancelled") return bundle;
    }

    const token = generateToken();
    const now = new Date();
    const event = await getEvent(eventId);
    const expiresAt = event?.startDate ? new Date(event.startDate) : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const actualTierId = tierId || (order.tickets[0]?.ticketId);
    const tier = event?.tickets?.find(t => t.id === actualTierId);
    const buyerGender = await getUserGender(userId);

    // Check if ANY bundle in this order already has an owner_locked slot
    const allBundlesSnapshot = await db.collection(SHARE_BUNDLES_COLLECTION)
        .where("orderId", "==", orderId)
        .get();

    const hasExistingOwnerSlot = allBundlesSnapshot.docs.some(doc => {
        const d = doc.data();
        return d.slots?.some(s => s.slotType === "owner_locked");
    });

    // Fetch entitlements for this order and tier to link them to slots
    const entsSnapshot = await db.collection("entitlements")
        .where("orderId", "==", orderId)
        .where("metadata.tierId", "==", actualTierId)
        .get();
    const orderEnts = entsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    orderEnts.sort((a, b) => (a.metadata.index || 0) - (b.metadata.index || 0));

    const slots = initializeSlots(quantity, userId, tier, buyerGender, hasExistingOwnerSlot);

    // Link Entitlement IDs to slots
    slots.forEach(slot => {
        if (tier?.isCouple) {
            // For couple tickets, both slots in a pair share the same entitlement
            const pairIndex = Math.ceil(slot.slotIndex / 2);
            const ent = orderEnts[pairIndex - 1];
            if (ent) slot.entitlementId = ent.id;
        } else {
            const ent = orderEnts[slot.slotIndex - 1];
            if (ent) slot.entitlementId = ent.id;
        }
    });

    const effectiveSlotsCount = slots.length;
    const hasOwnerClaimed = slots.some(s => s.slotType === "owner_locked" && s.claimStatus === "claimed");

    // Default to 'individual' mode for Per-Ticket Identity (Refinement 155)
    const isSharedQrMode = false;
    const groupTicketId = `GROUP-${orderId}-${actualTierId}`;
    const groupQrPayload = isSharedQrMode ? signTicketPayload(groupTicketId) : null;

    const bundle = {
        orderId,
        eventId,
        tierId: actualTierId,
        userId,
        mode: isSharedQrMode ? "shared_qr" : "individual",
        totalSlots: effectiveSlotsCount,
        remainingSlots: hasOwnerClaimed ? effectiveSlotsCount - 1 : effectiveSlotsCount,
        scanCreditsRemaining: isSharedQrMode ? effectiveSlotsCount : null,
        groupQrPayload,
        groupTicketId,
        slots,
        genderRequirement: tier?.genderRequirement || "any",
        isCouple: !!tier?.isCouple,
        token,
        status: "active",
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
    };

    // HANDLE DEFERRED INVENTORY FOR OWNER SLOT
    if (hasOwnerClaimed && tier) {
        const isClaimBasedFreeTier = (tier.price === 0 || tier.isFree) && (tier.genderRequirement || order.isRSVP);
        if (isClaimBasedFreeTier) {
            const eventRef = db.collection("events").doc(eventId);
            await db.runTransaction(async (transaction) => {
                const eDoc = await transaction.get(eventRef);
                if (eDoc.exists) {
                    const eData = eDoc.data();
                    const updatedTiers = [...(eData.tickets || [])];
                    const tIdx = updatedTiers.findIndex(t => t.id === actualTierId);
                    if (tIdx !== -1) {
                        const currentRem = Number(updatedTiers[tIdx].remaining ?? updatedTiers[tIdx].quantity) || 0;
                        if (currentRem > 0) {
                            updatedTiers[tIdx].remaining = currentRem - 1;
                            transaction.update(eventRef, { tickets: updatedTiers, updatedAt: now.toISOString() });
                        }
                    }
                }
            });
        }
    }

    const docRef = await db.collection(SHARE_BUNDLES_COLLECTION).add(bundle);
    return { id: docRef.id, ...bundle };
}

/**
 * Get share bundle by token
 */
export async function getShareBundleByToken(token) {
    if (!isFirebaseConfigured()) return null;

    const db = getAdminDb();
    const snapshot = await db.collection(SHARE_BUNDLES_COLLECTION)
        .where("token", "==", token)
        .limit(1)
        .get();

    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

/**
 * Claim a ticket slot from a bundle
 */
export async function claimTicketSlot(token, redeemerId) {
    if (!isFirebaseConfigured()) throw new Error("Firebase not configured");

    const db = getAdminDb();

    return await db.runTransaction(async (transaction) => {
        const bundleSnapshot = await transaction.get(
            db.collection(SHARE_BUNDLES_COLLECTION).where("token", "==", token).limit(1)
        );

        if (bundleSnapshot.empty) {
            throw new Error("Invalid share link");
        }

        const bundleDoc = bundleSnapshot.docs[0];
        const bundle = bundleDoc.data();
        const bundleId = bundleDoc.id;

        if (bundle.status !== "active" || bundle.remainingSlots <= 0) {
            throw new Error("All tickets have been claimed");
        }

        if (new Date(bundle.expiresAt) < new Date()) {
            throw new Error("Share link has expired");
        }

        if (bundle.userId === redeemerId) {
            throw new Error("You are the owner of this bundle");
        }

        const userGender = await getUserGender(redeemerId);

        const existingClaimSnapshot = await transaction.get(
            db.collection(TICKET_ASSIGNMENTS_COLLECTION)
                .where("bundleId", "==", bundleId)
                .where("redeemerId", "==", redeemerId)
                .limit(1)
        );

        if (!existingClaimSnapshot.empty) {
            return {
                alreadyClaimed: true,
                assignment: {
                    id: existingClaimSnapshot.docs[0].id,
                    ...existingClaimSnapshot.docs[0].data()
                }
            };
        }

        const slots = bundle.slots || [];

        // Filter to find slots that the user's gender IS ALLOWED to claim
        const eligibleSlots = slots.filter(s =>
            s.slotType === "shareable" &&
            s.claimStatus === "unclaimed" &&
            (!s.requiredGender || s.requiredGender === "any" || s.requiredGender === userGender)
        );

        if (eligibleSlots.length === 0) {
            // Check if there are ANY unclaimed shareable slots
            const unclaimedSlots = slots.filter(s => s.slotType === "shareable" && s.claimStatus === "unclaimed");

            if (unclaimedSlots.length > 0) {
                // There are slots, but none match this user's gender
                const required = unclaimedSlots[0].requiredGender;
                throw new Error(`Restricted: This slot is for ${required === 'female' ? 'Females' : 'Males'} only.`);
            } else {
                throw new Error("All tickets from this share link have already been claimed.");
            }
        }

        const slotToAssign = eligibleSlots[0];

        const assignmentId = bundle.mode === "shared_qr"
            ? `CLAIM-GRP-${bundleId}-${redeemerId}-${Date.now().toString(36)}`
            : `CLAIM-${bundleId}-${redeemerId}-${Date.now().toString(36)}`;

        const qrPayload = bundle.mode === "shared_qr"
            ? bundle.groupQrPayload
            : signTicketPayload(assignmentId);

        const assignment = {
            bundleId,
            orderId: bundle.orderId,
            eventId: bundle.eventId,
            tierId: bundle.tierId,
            slotIndex: slotToAssign.slotIndex,
            requiredGender: slotToAssign.requiredGender || "any",
            couplePairId: slotToAssign.couplePairId || null,
            redeemerId,
            originalPurchaserId: bundle.userId,
            assignmentId,
            qrPayload,
            isSharedQr: bundle.mode === "shared_qr",
            status: "active",
            claimedAt: new Date().toISOString(),
        };

        const updatedSlots = slots.map(s =>
            s.slotIndex === slotToAssign.slotIndex
                ? { ...s, currentOwnerUserId: redeemerId, claimStatus: "claimed", claimedAt: assignment.claimedAt, issuedTicketId: assignmentId }
                : s
        );

        transaction.update(bundleDoc.ref, {
            remainingSlots: bundle.remainingSlots - 1,
            slots: updatedSlots,
            status: bundle.remainingSlots - 1 === 0 ? "exhausted" : "active"
        });

        // DEFERRED INVENTORY REDUCTION (Refinement 237)
        const eventRef = db.collection("events").doc(bundle.eventId);
        const eventDoc = await transaction.get(eventRef);
        if (eventDoc.exists) {
            const currentEvent = eventDoc.data();
            const updatedEventTickets = [...(currentEvent.tickets || [])];
            const ticketIndex = updatedEventTickets.findIndex(t => t.id === bundle.tierId);

            if (ticketIndex !== -1) {
                const tier = updatedEventTickets[ticketIndex];
                const isClaimBasedFreeTier = tier.price === 0 && tier.genderRequirement;

                if (isClaimBasedFreeTier) {
                    const currentRemaining = Number(tier.remaining ?? tier.quantity) || 0;
                    if (currentRemaining > 0) {
                        updatedEventTickets[ticketIndex].remaining = currentRemaining - 1;
                        transaction.update(eventRef, {
                            tickets: updatedEventTickets,
                            updatedAt: new Date().toISOString()
                        });
                    } else {
                        throw new Error("This ticket tier is now sold out");
                    }
                }
            }
        }

        const assignmentRef = db.collection(TICKET_ASSIGNMENTS_COLLECTION).doc(assignmentId);
        transaction.set(assignmentRef, assignment);

        // ENTITLEMENT ENGINE INTEGRATION
        if (slotToAssign.entitlementId && !bundle.isCouple) {
            await transferEntitlement(slotToAssign.entitlementId, redeemerId, bundle.userId, transaction);
        } else if (slotToAssign.entitlementId && bundle.isCouple) {
            // For couple tickets, we don't transfer ownership yet, just pair them
            // Metadata update handled elsewhere or here
            transaction.update(db.collection("entitlements").doc(slotToAssign.entitlementId), {
                "metadata.couplePartnerId": redeemerId,
                "metadata.partnerClaimedAt": assignment.claimedAt
            });
        }

        return { alreadyClaimed: false, assignment };
    });
}

/**
 * Get all assignments for a user (tickets they claimed)
 */
export async function getUserClaimedTickets(userId) {
    if (!isFirebaseConfigured()) return [];

    const db = getAdminDb();
    const snapshot = await db.collection(TICKET_ASSIGNMENTS_COLLECTION)
        .where("redeemerId", "==", userId)
        .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get all share bundles for an order
 */
export async function getOrderShareBundles(orderId) {
    if (!isFirebaseConfigured()) return [];

    const db = getAdminDb();
    const snapshot = await db.collection(SHARE_BUNDLES_COLLECTION)
        .where("orderId", "==", orderId)
        .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get all assignments for an order (claimed or transferred)
 */
export async function getOrderAssignments(orderId) {
    if (!isFirebaseConfigured()) return [];

    const db = getAdminDb();
    const snapshot = await db.collection(TICKET_ASSIGNMENTS_COLLECTION)
        .where("orderId", "==", orderId)
        .get();

    return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(a => a.status !== "cancelled" && a.status !== "voided");
}

/**
 * Validate and scan a ticket (Used by Scanner)
 * Works for both direct order tickets and claimed tickets
 */
export async function validateAndScanTicket(ticketId, signature, eventId, scannerId) {
    if (!isFirebaseConfigured()) throw new Error("Firebase not configured");

    const expectedPayload = signTicketPayload(ticketId);
    if (`${ticketId}:${signature}` !== expectedPayload) {
        return { valid: false, reason: "invalid_signature" };
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
        if (ticketId.startsWith("GROUP-")) {
            return await _handleGroupScan(transaction, ticketId, eventId, scannerId, now);
        }

        // 3. Try Direct Order Ticket
        return await _handleOrderScan(transaction, ticketId, eventId, scannerId, now);
    });
}

/**
 * @private
 */
async function _handleAssignmentScan(transaction, doc, eventId, scannerId, now) {
    const data = doc.data();
    if (data.eventId !== eventId) return { valid: false, reason: "event_mismatch" };
    if (data.status === "used") return { valid: false, reason: "already_used", scannedAt: data.scannedAt };
    if (data.status === "cancelled" || data.status === "voided") return { valid: false, reason: "cancelled" };

    const db = getAdminDb();
    const orderRef = db.collection("orders").doc(data.orderId);
    const orderDoc = await transaction.get(orderRef);
    if (orderDoc.exists && (orderDoc.data().status === "cancelled" || orderDoc.data().status === "refunded")) {
        return { valid: false, reason: "cancelled" };
    }

    const userGender = await getUserGender(data.redeemerId);
    if (data.requiredGender && data.requiredGender !== "any" && data.requiredGender !== userGender) {
        return { valid: false, reason: "gender_mismatch", required: data.requiredGender, actual: userGender };
    }

    if (data.couplePairId) {
        const siblingsSnapshot = await transaction.get(
            db.collection(TICKET_ASSIGNMENTS_COLLECTION)
                .where("couplePairId", "==", data.couplePairId)
        );
        const siblings = siblingsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const partnerSlot = siblings.find(s => s.assignmentId !== data.assignmentId);

        if (partnerSlot && partnerSlot.status !== "used") {
            transaction.update(doc.ref, {
                status: "used",
                scannedAt: now,
                scannedBy: scannerId
            });
            return { valid: true, ticket: data, note: "partial_couple_waiting_for_partner" };
        }
    }

    transaction.update(doc.ref, {
        status: "used",
        scannedAt: now,
        scannedBy: scannerId
    });

    return { valid: true, ticket: data };
}

/**
 * @private
 */
async function _handleGroupScan(transaction, ticketId, eventId, scannerId, now) {
    const db = getAdminDb();
    const bundleSnapshot = await transaction.get(
        db.collection(SHARE_BUNDLES_COLLECTION).where("groupTicketId", "==", ticketId).limit(1)
    );
    if (bundleSnapshot.empty) return { valid: false, reason: "invalid_group_ticket" };

    const bundleDoc = bundleSnapshot.docs[0];
    const bundle = bundleDoc.data();

    if (bundle.status === "cancelled") return { valid: false, reason: "cancelled" };
    if (bundle.scanCreditsRemaining <= 0) return { valid: false, reason: "scan_limit_reached" };

    transaction.update(bundleDoc.ref, {
        scanCreditsRemaining: bundle.scanCreditsRemaining - 1
    });

    const scanRef = db.collection("ticket_scans").doc(`${ticketId}-scan-${Date.now()}`);
    transaction.set(scanRef, {
        ticketId,
        bundleId: bundleDoc.id,
        eventId,
        scannedAt: now,
        scannedBy: scannerId,
        isGroupScan: true
    });

    const roster = bundle.slots
        .filter(s => s.claimStatus === "claimed")
        .map(s => ({
            userId: s.currentOwnerUserId,
            slotIndex: s.slotIndex,
            claimedAt: s.claimedAt
        }));

    return {
        valid: true,
        ticket: { ...bundle, ticketId },
        scansRemaining: bundle.scanCreditsRemaining - 1,
        roster
    };
}

/**
 * @private
 */
async function _handleOrderScan(transaction, ticketId, eventId, scannerId, now) {
    const parts = ticketId.split("-");
    if (parts.length < 3) return { valid: false, reason: "invalid_format" };

    const orderId = parts.slice(0, parts.length - 2).join("-");
    const db = getAdminDb();
    const scanRef = db.collection("ticket_scans").doc(ticketId);
    const scanDoc = await transaction.get(scanRef);

    if (scanDoc.exists) {
        return { valid: false, reason: "already_used", scannedAt: scanDoc.data().scannedAt };
    }

    const orderRef = db.collection("orders").doc(orderId);
    const orderDoc = await transaction.get(orderRef);

    if (!orderDoc.exists) return { valid: false, reason: "order_not_found" };
    const order = orderDoc.data();

    if (order.status !== "confirmed") return { valid: false, reason: "order_not_confirmed" };
    if (order.eventId !== eventId) return { valid: false, reason: "event_mismatch" };

    const userGender = await getUserGender(order.userId);
    const event = await getEvent(order.eventId);
    const tier = event?.tickets?.find(t => t.id === parts[parts.length - 2]);
    const requiredGender = tier?.requiredGender || (tier?.genderRequirement === "couple" ? "male" : (tier?.genderRequirement || "any"));

    if (requiredGender !== "any" && requiredGender !== userGender) {
        return { valid: false, reason: "gender_mismatch", required: requiredGender, actual: userGender };
    }

    transaction.set(scanRef, {
        ticketId,
        orderId,
        eventId,
        scannedAt: now,
        scannedBy: scannerId
    });

    return { valid: true, ticket: { ...order, ticketId } };
}

/**
 * Couple Ticket specific logic
 */
export async function getCoupleAssignment(ticketId) {
    if (!isFirebaseConfigured()) return null;
    const db = getAdminDb();
    const doc = await db.collection("couple_assignments").doc(ticketId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

export async function assignPartner(ticketId, ownerId, partnerId, metadata = {}) {
    if (!isFirebaseConfigured()) throw new Error("Firebase not configured");
    const db = getAdminDb();
    const assignmentRef = db.collection("couple_assignments").doc(ticketId);
    const doc = await assignmentRef.get();

    if (doc.exists && doc.data().ownerId !== ownerId) throw new Error("Unauthorized");

    const ownerGender = await getUserGender(ownerId);
    const partnerGender = await getUserGender(partnerId);

    // Couple logic: Partner slot is specifically for the opposite/female attendee
    if (partnerGender !== "female") {
        throw new Error("Restricted: The partner slot in a couple ticket is for Females only.");
    }

    const update = {
        ownerId,
        partnerId,
        status: "fully_assigned",
        ...metadata,
        updatedAt: new Date().toISOString()
    };

    await assignmentRef.set(update, { merge: true });
    return { id: ticketId, ...update };
}

export async function createPartnerClaimLink(ticketId, ownerId, eventId) {
    if (!isFirebaseConfigured()) throw new Error("Firebase not configured");
    const db = getAdminDb();
    const token = randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const claim = {
        ticketId,
        ownerId,
        eventId,
        token,
        status: "active",
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString()
    };

    await db.collection("couple_claims").add(claim);
    return { token };
}

export async function claimPartnerSlot(token, userId) {
    if (!isFirebaseConfigured()) throw new Error("Firebase not configured");
    const db = getAdminDb();

    return await db.runTransaction(async (transaction) => {
        const claimSnapshot = await transaction.get(
            db.collection("couple_claims").where("token", "==", token).where("status", "==", "active").limit(1)
        );

        if (claimSnapshot.empty) throw new Error("Invalid or expired claim link");
        const claimDoc = claimSnapshot.docs[0];
        const claim = claimDoc.data();

        if (new Date(claim.expiresAt) < new Date()) throw new Error("Claim link expired");
        if (claim.ownerId === userId) throw new Error("You cannot claim your own couple ticket slot");

        const userGender = await getUserGender(userId);
        if (userGender !== "female") {
            throw new Error("Restricted: This couple partner slot is for Females only.");
        }

        const assignmentRef = db.collection("couple_assignments").doc(claim.ticketId);

        transaction.set(assignmentRef, {
            ownerId: claim.ownerId,
            partnerId: userId,
            status: "fully_assigned",
            eventId: claim.eventId,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        transaction.update(claimDoc.ref, { status: "claimed", claimedBy: userId });
        return { ticketId: claim.ticketId, eventId: claim.eventId };
    });
}

/**
 * Initiate a ticket transfer
 */
export async function initiateTransfer(ticketId, senderId, recipientEmail) {
    if (!isFirebaseConfigured()) throw new Error("Firebase not configured");
    const db = getAdminDb();

    const parts = ticketId.split("-");
    const orderId = parts.slice(0, parts.length - 2).join("-");

    const orderRef = db.collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) throw new Error("Order not found");
    const order = orderDoc.data();

    if (order.userId === senderId) {
        const assignmentRef = db.collection(TICKET_ASSIGNMENTS_COLLECTION)
            .where("orderId", "==", orderId)
            .where("originalTicketId", "==", ticketId)
            .limit(1);
        const assignmentSnapshot = await assignmentRef.get();
        if (!assignmentSnapshot.empty) {
            const assignment = assignmentSnapshot.docs[0].data();
            if (assignment.redeemerId !== senderId) throw new Error("This ticket has already been transferred.");
        }
    } else {
        const assignmentRef = db.collection(TICKET_ASSIGNMENTS_COLLECTION).doc(ticketId);
        const assignmentDoc = await assignmentRef.get();
        if (!assignmentDoc.exists || assignmentDoc.data().redeemerId !== senderId) throw new Error("Unauthorized");
    }

    const eventDoc = await db.collection("events").doc(eventId).get();
    if (eventDoc.exists) {
        const event = eventDoc.data();
        const start = new Date(event.startDate || event.startAt);
        const hoursUntilEvent = (start - new Date()) / 36e5;
        if (hoursUntilEvent < SECURITY_CONFIG.TRANSFER_BLOCK_HOURS_BEFORE_EVENT) {
            throw new Error(`Transfers disabled ${SECURITY_CONFIG.TRANSFER_BLOCK_HOURS_BEFORE_EVENT}h before event.`);
        }
    }

    const token = generateToken(20);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Find entitlement if available
    const entsSnapshot = await db.collection("entitlements")
        .where("orderId", "==", orderId)
        .where("metadata.tierId", "==", parts[parts.length - 2])
        .where("metadata.index", "==", parseInt(parts[parts.length - 1]) + 1) // index is 1-based, parts[last] is 0-based in some cases
        .limit(1).get();

    // Actually, sometimes ticketId format is different. 
    // Let's just find ANY active entitlement owned by sender for this event/order
    // But better to be precise. 
    // In our issueEntitlements, index is i+1.
    // In orderStore, ticketId is `${orderId}-${ticketId}-${i}` (0-based)

    const entId = entsSnapshot.docs[0]?.id;

    const transfer = {
        ticketId,
        entitlementId: entId || null,
        senderId,
        recipientEmail: recipientEmail.toLowerCase(),
        eventId,
        status: "pending",
        token,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
    };

    const docRef = await db.collection(TRANSFERS_COLLECTION).add(transfer);
    return { id: docRef.id, ...transfer };
}

/**
 * Accept a ticket transfer
 */
export async function acceptTransfer(transferId, recipientId) {
    if (!isFirebaseConfigured()) throw new Error("Firebase not configured");
    const db = getAdminDb();

    return await db.runTransaction(async (transaction) => {
        const transferRef = db.collection(TRANSFERS_COLLECTION).doc(transferId);
        const transferDoc = await transaction.get(transferRef);

        if (!transferDoc.exists) throw new Error("Transfer not found");
        const transfer = transferDoc.data();
        if (transfer.status !== "pending") throw new Error("Transfer not pending");

        const ticketId = transfer.ticketId;
        const parts = ticketId.split("-");

        let requiredGender = "any";

        if (ticketId.startsWith("CLAIM-")) {
            const assignmentRef = db.collection(TICKET_ASSIGNMENTS_COLLECTION).doc(ticketId);
            const assignmentDoc = await transaction.get(assignmentRef);
            if (assignmentDoc.exists) {
                requiredGender = assignmentDoc.data().requiredGender || "any";
            }
        } else {
            // Find in share bundle slots if it's an order-based ticket
            const orderId = parts.slice(0, parts.length - 2).join("-");
            const slotIndex = parseInt(parts[parts.length - 1]) + 1;

            const bundleSnapshot = await transaction.get(
                db.collection(SHARE_BUNDLES_COLLECTION).where("orderId", "==", orderId).limit(1)
            );

            if (!bundleSnapshot.empty) {
                const bundle = bundleSnapshot.docs[0].data();
                const slot = bundle.slots?.find(s => s.slotIndex === slotIndex);
                if (slot) {
                    requiredGender = slot.requiredGender || "any";
                }
            }
        }

        const userGender = await getUserGender(recipientId);
        if (requiredGender !== "any" && userGender !== requiredGender && userGender !== "any") {
            throw new Error(`Gender Mismatch: You cannot accept this ticket (${requiredGender} only).`);
        }

        if (ticketId.startsWith("CLAIM-")) {
            const assignmentRef = db.collection(TICKET_ASSIGNMENTS_COLLECTION).doc(ticketId);
            transaction.update(assignmentRef, { redeemerId: recipientId, updatedAt: new Date().toISOString() });
        } else {
            const assignmentId = `TRANS-${ticketId}-${recipientId}-${Date.now().toString(36)}`;
            const qrPayload = signTicketPayload(assignmentId);
            const assignment = {
                originalTicketId: ticketId,
                orderId: parts.slice(0, parts.length - 2).join("-"),
                redeemerId: recipientId,
                senderId: transfer.senderId,
                status: "active",
                assignmentId,
                qrPayload,
                requiredGender,
                transferredAt: new Date().toISOString(),
            };
            transaction.set(db.collection(TICKET_ASSIGNMENTS_COLLECTION).doc(assignmentId), assignment);
        }

        // ENTITLEMENT ENGINE INTEGRATION
        if (transfer.entitlementId) {
            await transferEntitlement(transfer.entitlementId, recipientId, transfer.senderId, transaction);
        }

        transaction.update(transferRef, { status: "accepted", acceptedAt: new Date().toISOString() });
        return { success: true };
    });
}

export async function getPendingTransfers(userId, email = null) {
    if (!isFirebaseConfigured()) return [];
    const db = getAdminDb();

    // Fetch transfers where user is sender
    const sentSnapshot = await db.collection(TRANSFERS_COLLECTION)
        .where("senderId", "==", userId)
        .where("status", "==", "pending")
        .get();

    const sent = sentSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isSender: true
    }));

    // Fetch transfers where user is recipient
    let received = [];
    if (email) {
        const receivedSnapshot = await db.collection(TRANSFERS_COLLECTION)
            .where("recipientEmail", "==", email.toLowerCase())
            .where("status", "==", "pending")
            .get();
        received = receivedSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            isSender: false
        }));
    }

    return [...sent, ...received];
}

export async function transferCoupleTicket(ticketId, currentOwnerId, newOwnerId) {
    if (!isFirebaseConfigured()) throw new Error("Firebase not configured");
    const db = getAdminDb();

    return await db.runTransaction(async (transaction) => {
        const assignmentRef = db.collection("couple_assignments").doc(ticketId);
        const doc = await transaction.get(assignmentRef);

        const currentOwner = doc.exists ? doc.data().ownerId : currentOwnerId;
        if (currentOwner !== currentOwnerId) throw new Error("Unauthorized");

        transaction.set(assignmentRef, {
            ownerId: newOwnerId,
            partnerId: null,
            status: "unassigned",
            transferLog: [...(doc.data()?.transferLog || []), {
                from: currentOwnerId,
                to: newOwnerId,
                at: new Date().toISOString()
            }],
            updatedAt: new Date().toISOString()
        }, { merge: true });

        return { success: true };
    });
}

export async function cancelTransfer(transferId, userId) {
    if (!isFirebaseConfigured()) throw new Error("Firebase not configured");
    const db = getAdminDb();

    const transferRef = db.collection(TRANSFERS_COLLECTION).doc(transferId);
    const doc = await transferRef.get();

    if (!doc.exists) throw new Error("Transfer not found");
    if (doc.data().senderId !== userId) throw new Error("Unauthorized");

    await transferRef.update({
        status: "cancelled",
        updatedAt: new Date().toISOString()
    });

    return { success: true };
}
