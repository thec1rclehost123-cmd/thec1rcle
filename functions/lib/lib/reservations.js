"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReservation = exports.cleanupExpiredReservations = exports.releaseInventory = exports.createCartReservation = void 0;
const firebase_1 = require("./firebase");
const pricing_1 = require("./pricing");
const crypto = __importStar(require("crypto"));
const RESERVATIONS_COLLECTION = "cart_reservations";
const RESERVATION_MINUTES = 10;
function generateUUID() {
    return crypto.randomUUID();
}
/**
 * Create a cart reservation (holds inventory temporarily)
 * ATOMIC TRANSACTION: Ensures no overselling even under high concurrency (100k users).
 */
async function createCartReservation(eventId, customerId, deviceId, items, options = {}) {
    const eventRef = firebase_1.db.collection('events').doc(eventId);
    const reservationId = generateUUID();
    try {
        const result = await firebase_1.db.runTransaction(async (transaction) => {
            var _a, _b, _c;
            const eventDoc = await transaction.get(eventRef);
            if (!eventDoc.exists || !eventDoc.data()) {
                return { success: false, error: 'Event not found' };
            }
            const event = eventDoc.data();
            const tiers = ((_a = event.ticketCatalog) === null || _a === void 0 ? void 0 : _a.tiers) || event.tickets || [];
            const updatedTiers = [...tiers];
            const reservedItems = [];
            const now = new Date();
            // 1. Validate availability atomically
            for (const item of items) {
                const tierIndex = updatedTiers.findIndex((t) => t.id === item.tierId);
                if (tierIndex === -1) {
                    throw new Error(`Ticket tier not found: ${item.tierId}`);
                }
                const tier = updatedTiers[tierIndex];
                const quantity = Number(item.quantity);
                // Sales window check
                const salesEnd = tier.salesEnd ? new Date(tier.salesEnd) : null;
                if (salesEnd && now > salesEnd) {
                    throw new Error(`${tier.name} sales have ended`);
                }
                // Purchase limits
                const minPerOrder = tier.minPerOrder || 1;
                const maxPerOrder = tier.maxPerOrder || 10;
                if (quantity < minPerOrder || quantity > maxPerOrder) {
                    throw new Error(`Invalid quantity for ${tier.name}. Limits: ${minPerOrder}-${maxPerOrder}`);
                }
                // Inventory check (Atomic: Remaining - Locked)
                const remaining = Number((_c = (_b = tier.remaining) !== null && _b !== void 0 ? _b : tier.quantity) !== null && _c !== void 0 ? _c : 0);
                const currentLocked = Number(tier.lockedQuantity || 0);
                const available = Math.max(0, remaining - currentLocked);
                if (quantity > available) {
                    throw new Error(available === 0 ? `${tier.name} is sold out` : `Only ${available} ${tier.name} tickets available`);
                }
                // 2. Optimistic lock increment
                updatedTiers[tierIndex] = Object.assign(Object.assign({}, tier), { lockedQuantity: currentLocked + quantity });
                const priceInfo = (0, pricing_1.getEffectivePrice)(tier);
                reservedItems.push({
                    tierId: tier.id,
                    tierName: tier.name,
                    entryType: tier.entryType || 'general',
                    quantity: quantity,
                    unitPrice: priceInfo.price,
                    priceLabel: priceInfo.label,
                    subtotal: priceInfo.price * quantity
                });
            }
            // 3. Commit Reservation & Event Update
            const expiresAt = new Date(now.getTime() + RESERVATION_MINUTES * 60 * 1000);
            const reservation = {
                id: reservationId,
                eventId,
                customerId,
                deviceId: deviceId || null,
                items: reservedItems,
                status: 'active',
                createdAt: now.toISOString(),
                expiresAt: expiresAt.toISOString()
            };
            const reservationRef = firebase_1.db.collection(RESERVATIONS_COLLECTION).doc(reservationId);
            transaction.set(reservationRef, reservation);
            if (event.ticketCatalog) {
                transaction.update(eventRef, { 'ticketCatalog.tiers': updatedTiers });
            }
            else {
                transaction.update(eventRef, { tickets: updatedTiers });
            }
            return {
                success: true,
                reservationId: reservation.id,
                items: reservedItems,
                expiresAt: reservation.expiresAt,
                expiresInSeconds: RESERVATION_MINUTES * 60
            };
        });
        return result;
    }
    catch (error) {
        console.error('[Reservations] Atomic reservation failed:', error);
        return { success: false, error: error.message || 'Inventory lock failed' };
    }
}
exports.createCartReservation = createCartReservation;
/**
 * Release inventory back to the pool (on expiry or manual cancellation)
 */
async function releaseInventory(reservationId) {
    const resRef = firebase_1.db.collection(RESERVATIONS_COLLECTION).doc(reservationId);
    return await firebase_1.db.runTransaction(async (transaction) => {
        var _a;
        const resDoc = await transaction.get(resRef);
        if (!resDoc.exists)
            return { success: false, error: 'Reservation not found' };
        const reservation = resDoc.data();
        if (reservation.status !== 'active')
            return { success: true, message: 'Already released' };
        const eventRef = firebase_1.db.collection('events').doc(reservation.eventId);
        const eventDoc = await transaction.get(eventRef);
        if (eventDoc.exists) {
            const event = eventDoc.data();
            const tiers = ((_a = event.ticketCatalog) === null || _a === void 0 ? void 0 : _a.tiers) || event.tickets || [];
            const updatedTiers = [...tiers];
            for (const item of reservation.items) {
                const tierIndex = updatedTiers.findIndex((t) => t.id === item.tierId);
                if (tierIndex !== -1) {
                    const t = updatedTiers[tierIndex];
                    updatedTiers[tierIndex] = Object.assign(Object.assign({}, t), { lockedQuantity: Math.max(0, (t.lockedQuantity || 0) - item.quantity) });
                }
            }
            if (event.ticketCatalog) {
                transaction.update(eventRef, { 'ticketCatalog.tiers': updatedTiers });
            }
            else {
                transaction.update(eventRef, { tickets: updatedTiers });
            }
        }
        transaction.update(resRef, { status: 'expired', updatedAt: new Date().toISOString() });
        return { success: true };
    });
}
exports.releaseInventory = releaseInventory;
/**
 * Background cleanup for stale reservations
 */
async function cleanupExpiredReservations() {
    const now = new Date();
    const snapshot = await firebase_1.db.collection(RESERVATIONS_COLLECTION)
        .where('status', '==', 'active')
        .where('expiresAt', '<', now.toISOString())
        .limit(50)
        .get();
    console.log(`[Cleanup] Found ${snapshot.size} expired reservations`);
    const results = [];
    for (const doc of snapshot.docs) {
        results.push(await releaseInventory(doc.id));
    }
    return results;
}
exports.cleanupExpiredReservations = cleanupExpiredReservations;
async function getReservation(reservationId) {
    const doc = await firebase_1.db.collection(RESERVATIONS_COLLECTION).doc(reservationId).get();
    return doc.exists ? Object.assign({ id: doc.id }, doc.data()) : null;
}
exports.getReservation = getReservation;
//# sourceMappingURL=reservations.js.map