import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { createHmac, randomBytes } from "node:crypto";
import { getOrderById } from "./orderStore";
import { getEvent } from "./eventStore";

const SHARE_BUNDLES_COLLECTION = "share_bundles";
const TICKET_ASSIGNMENTS_COLLECTION = "ticket_assignments";

/**
 * Generate a non-guessable token for the share link
 */
function generateToken() {
    return randomBytes(16).toString("hex");
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
 * Create a share bundle for an order and event
 */
export async function createShareBundle(orderId, userId, eventId, quantity) {
    if (!isFirebaseConfigured()) {
        throw new Error("Firebase not configured");
    }

    console.log(`[TicketShareStore] Creating share bundle. orderId=${orderId}, userId=${userId}`);
    const order = await getOrderById(orderId);

    if (!order) {
        console.error(`[TicketShareStore] Order not found for orderId=${orderId}`);
        throw new Error("Order not found");
    }
    console.log(`[TicketShareStore] Order found. eventId=${order.eventId}, status=${order.status}`);
    if (order.userId !== userId) {
        console.error(`[TicketShareStore] Unauthorized share attempt. orderUserId=${order.userId}, attemptUserId=${userId}`);
        throw new Error("Unauthorized");
    }
    if (order.eventId !== eventId) throw new Error("Event mismatch");

    // Calculate how many tickets are already shared for this order
    const db = getAdminDb();
    const existingBundles = await db.collection(SHARE_BUNDLES_COLLECTION)
        .where("orderId", "==", orderId)
        .get();

    let alreadyShared = 0;
    existingBundles.forEach(doc => {
        if (doc.data().status !== "cancelled") {
            alreadyShared += doc.data().totalSlots;
        }
    });

    const totalTicketsInOrder = order.tickets.reduce((sum, t) => sum + t.quantity, 0);
    const availableToShare = totalTicketsInOrder - alreadyShared;

    if (quantity > availableToShare) {
        throw new Error(`Cannot share ${quantity} tickets. Only ${availableToShare} available.`);
    }

    const token = generateToken();
    const now = new Date();

    // Default expiration: when event starts
    const event = await getEvent(eventId);
    const expiresAt = event?.startDate ? new Date(event.startDate) : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const bundle = {
        orderId,
        eventId,
        userId,
        totalSlots: quantity,
        remainingSlots: quantity,
        token,
        status: "active",
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
    };

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
        // 1. Get the bundle
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

        // 2. Check if user already claimed from THIS bundle
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

        // 3. Perform claim
        const assignmentId = `CLAIM-${bundleId}-${redeemerId}-${Date.now().toString(36)}`;
        const qrPayload = signTicketPayload(assignmentId);

        const assignment = {
            bundleId,
            orderId: bundle.orderId,
            eventId: bundle.eventId,
            redeemerId,
            originalPurchaserId: bundle.userId,
            assignmentId,
            qrPayload,
            status: "active",
            claimedAt: new Date().toISOString(),
        };

        // Update bundle
        transaction.update(bundleDoc.ref, {
            remainingSlots: bundle.remainingSlots - 1,
            status: bundle.remainingSlots - 1 === 0 ? "exhausted" : "active"
        });

        // Create assignment
        const assignmentRef = db.collection(TICKET_ASSIGNMENTS_COLLECTION).doc(assignmentId);
        transaction.set(assignmentRef, assignment);

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
        // Check if it's a claimed ticket
        const assignmentRef = db.collection(TICKET_ASSIGNMENTS_COLLECTION).doc(ticketId);
        const assignmentDoc = await transaction.get(assignmentRef);

        if (assignmentDoc.exists) {
            const data = assignmentDoc.data();
            if (data.eventId !== eventId) return { valid: false, reason: "event_mismatch" };
            if (data.status === "used") return { valid: false, reason: "already_used", scannedAt: data.scannedAt };
            if (data.status === "cancelled") return { valid: false, reason: "cancelled" };

            // Mark as used
            transaction.update(assignmentRef, {
                status: "used",
                scannedAt: now,
                scannedBy: scannerId
            });

            return { valid: true, ticket: data };
        }

        // If not a claimed ticket, it's a direct order ticket
        // Ticket ID format: {orderId}-{ticketTypeId}-{index}
        const parts = ticketId.split("-");
        if (parts.length < 3) return { valid: false, reason: "invalid_format" };

        const orderId = parts.slice(0, parts.length - 2).join("-");

        // We need to track scans for direct tickets too to prevent reuse
        // Using a "scans" collection to mark individual ticket indices as used
        const scanRef = db.collection("ticket_scans").doc(ticketId);
        const scanDoc = await transaction.get(scanRef);

        if (scanDoc.exists) {
            return { valid: false, reason: "already_used", scannedAt: scanDoc.data().scannedAt };
        }

        // Verify order exists and is confirmed
        const orderRef = db.collection("orders").doc(orderId);
        const orderDoc = await transaction.get(orderRef);

        if (!orderDoc.exists) return { valid: false, reason: "order_not_found" };
        const order = orderDoc.data();

        if (order.status !== "confirmed") return { valid: false, reason: "order_not_confirmed" };
        if (order.eventId !== eventId) return { valid: false, reason: "event_mismatch" };

        // Mark as scanned
        transaction.set(scanRef, {
            ticketId,
            orderId,
            eventId,
            scannedAt: now,
            scannedBy: scannerId
        });

        return { valid: true, ticket: { ...order, ticketId } };
    });
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

    // Security check: only owner can assign
    const assignmentRef = db.collection("couple_assignments").doc(ticketId);
    const doc = await assignmentRef.get();

    if (doc.exists && doc.data().ownerId !== ownerId) {
        throw new Error("Unauthorized");
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
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

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

        const assignmentRef = db.collection("couple_assignments").doc(claim.ticketId);
        const existingDoc = await transaction.get(assignmentRef);

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

export async function transferCoupleTicket(ticketId, currentOwnerId, newOwnerId) {
    if (!isFirebaseConfigured()) throw new Error("Firebase not configured");
    const db = getAdminDb();

    return await db.runTransaction(async (transaction) => {
        const assignmentRef = db.collection("couple_assignments").doc(ticketId);
        const doc = await transaction.get(assignmentRef);

        // If no assignment doc exists, the purchaser is the owner
        const currentOwner = doc.exists ? doc.data().ownerId : currentOwnerId;

        if (currentOwner !== currentOwnerId) throw new Error("Unauthorized");

        transaction.set(assignmentRef, {
            ownerId: newOwnerId,
            partnerId: null, // Reset partner on transfer
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
