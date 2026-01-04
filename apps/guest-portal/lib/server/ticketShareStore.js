import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { createHmac, randomBytes } from "node:crypto";
import { getOrderById } from "./orderStore";
import { getEvent } from "./eventStore";

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
 * Initialize slots for a bundle with gender and couple pairing logic
 */
function initializeSlots(quantity, userId, tier) {
    const slots = [];
    const { genderRequirement, isCouple } = tier || {};

    // Total physical slots to create
    // If it's a couple ticket, 1 unit = 2 slots
    const effectiveQuantity = isCouple ? quantity * 2 : quantity;

    // Slot 1 is always for the buyer (locked)
    const ownerSlot = {
        slotIndex: 1,
        slotType: "owner_locked",
        currentOwnerUserId: userId,
        claimStatus: "claimed",
        claimedAt: new Date().toISOString(),
    };

    if (isCouple) {
        ownerSlot.requiredGender = "male"; // Pair 1, Slot 1 is Male
        ownerSlot.couplePairId = `PAIR-${userId.slice(0, 4)}-${randomBytes(3).toString('hex')}`;
    } else if (genderRequirement && genderRequirement !== 'any') {
        ownerSlot.requiredGender = genderRequirement;
    }

    slots.push(ownerSlot);

    // Slots 2..N
    for (let i = 2; i <= effectiveQuantity; i++) {
        const slot = {
            slotIndex: i,
            slotType: "shareable",
            currentOwnerUserId: null,
            claimStatus: "unclaimed",
        };

        if (isCouple) {
            // Couples alternate: 1:M, 2:F, 3:M, 4:F...
            slot.requiredGender = i % 2 === 1 ? "male" : "female";

            // Link even slots back to the previous odd slot's pair ID
            if (i % 2 === 0) {
                slot.couplePairId = slots[i - 2].couplePairId;
            } else {
                slot.couplePairId = `PAIR-${userId.slice(0, 4)}-${randomBytes(3).toString('hex')}`;
            }
        } else if (genderRequirement && genderRequirement !== 'any') {
            slot.requiredGender = genderRequirement;
        }

        slots.push(slot);
    }
    return slots;
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

    const slots = initializeSlots(quantity, userId, tier);
    const effectiveSlotsCount = slots.length;

    // Shared QR Mode for PAID orders only (Refinement 237)
    const isSharedQrMode = !order.isRSVP;
    const groupTicketId = `GROUP-${orderId}-${actualTierId}`;
    const groupQrPayload = isSharedQrMode ? signTicketPayload(groupTicketId) : null;

    const bundle = {
        orderId,
        eventId,
        tierId: actualTierId,
        userId,
        mode: isSharedQrMode ? "shared_qr" : "individual",
        totalSlots: effectiveSlotsCount,
        remainingSlots: effectiveSlotsCount - 1,
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
        const slotToAssign = slots.find(s =>
            s.slotType === "shareable" &&
            s.claimStatus === "unclaimed" &&
            (!s.requiredGender || s.requiredGender === "any" || s.requiredGender === userGender)
        );

        if (!slotToAssign) {
            const genderLabel = bundle.isCouple ? `${userGender} ` : '';
            throw new Error(`No available ${genderLabel}slots left`);
        }

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
        const assignmentRef = db.collection(TICKET_ASSIGNMENTS_COLLECTION).doc(ticketId);
        const assignmentDoc = await transaction.get(assignmentRef);

        if (assignmentDoc.exists) {
            const data = assignmentDoc.data();
            if (data.eventId !== eventId) return { valid: false, reason: "event_mismatch" };
            if (data.status === "used") return { valid: false, reason: "already_used", scannedAt: data.scannedAt };
            if (data.status === "cancelled" || data.status === "voided") return { valid: false, reason: "cancelled" };

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
                    transaction.update(assignmentRef, {
                        status: "used",
                        scannedAt: now,
                        scannedBy: scannerId
                    });
                    return { valid: true, ticket: data, note: "partial_couple_waiting_for_partner" };
                }
            }

            transaction.update(assignmentRef, {
                status: "used",
                scannedAt: now,
                scannedBy: scannerId
            });

            return { valid: true, ticket: data };
        }

        if (ticketId.startsWith("GROUP-")) {
            const bundleSnapshot = await transaction.get(
                db.collection(SHARE_BUNDLES_COLLECTION).where("groupTicketId", "==", ticketId).limit(1)
            );
            if (!bundleSnapshot.empty) {
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
        }

        const parts = ticketId.split("-");
        if (parts.length < 3) return { valid: false, reason: "invalid_format" };

        const orderId = parts.slice(0, parts.length - 2).join("-");
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
    const assignmentRef = db.collection("couple_assignments").doc(ticketId);
    const doc = await assignmentRef.get();

    if (doc.exists && doc.data().ownerId !== ownerId) throw new Error("Unauthorized");

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

    const eventId = order.eventId || parts[0].split("_")[0];
    const eventDoc = await db.collection("events").doc(eventId).get();
    if (eventDoc.exists) {
        const event = eventDoc.data();
        if ((new Date(event.startAt) - new Date()) / 36e5 < 4) throw new Error("Transfers disabled 4h before event.");
    }

    const token = generateToken(20);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const transfer = {
        ticketId,
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
                transferredAt: new Date().toISOString(),
            };
            transaction.set(db.collection(TICKET_ASSIGNMENTS_COLLECTION).doc(assignmentId), assignment);
        }

        transaction.update(transferRef, { status: "accepted", acceptedAt: new Date().toISOString() });
        return { success: true };
    });
}

export async function getPendingTransfers(userId) {
    if (!isFirebaseConfigured()) return [];
    const db = getAdminDb();
    const snapshot = await db.collection(TRANSFERS_COLLECTION)
        .where("senderId", "==", userId)
        .where("status", "==", "pending")
        .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
