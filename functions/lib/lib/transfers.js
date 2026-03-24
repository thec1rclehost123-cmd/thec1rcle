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
exports.cancelTransferInternal = exports.acceptTransferInternal = exports.initiateTransferInternal = void 0;
const firebase_1 = require("./firebase");
const crypto = __importStar(require("crypto"));
const TRANSFERS_COLLECTION = "transfers";
const ORDERS_COLLECTION = "orders";
/**
 * Initiate a ticket transfer from the server
 */
async function initiateTransferInternal(payload) {
    const { orderId, fromUserId, ticketDetails, recipientEmail, recipientPhone } = payload;
    const transferCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
    return await firebase_1.db.runTransaction(async (transaction) => {
        const orderRef = firebase_1.db.collection(ORDERS_COLLECTION).doc(orderId);
        const orderDoc = await transaction.get(orderRef);
        if (!orderDoc.exists)
            throw new Error("Order not found");
        const order = orderDoc.data();
        if (order.userId !== fromUserId)
            throw new Error("Unauthorized: Order ownership mismatch");
        if (order.status !== 'confirmed')
            throw new Error("Only confirmed orders can be transferred");
        const transferData = {
            orderId,
            fromUserId,
            toEmail: recipientEmail || null,
            toPhone: recipientPhone || null,
            ticketDetails,
            status: "pending",
            transferCode,
            createdAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
        };
        const transferRef = firebase_1.db.collection(TRANSFERS_COLLECTION).doc();
        transaction.set(transferRef, transferData);
        transaction.update(orderRef, {
            transferPending: true,
            transferId: transferRef.id,
            updatedAt: now.toISOString(),
        });
        return { success: true, transferId: transferRef.id, transferCode };
    });
}
exports.initiateTransferInternal = initiateTransferInternal;
/**
 * Accept a ticket transfer from the server
 */
async function acceptTransferInternal(transferCode, recipientUserId) {
    const transferQuery = firebase_1.db.collection(TRANSFERS_COLLECTION)
        .where("transferCode", "==", transferCode)
        .where("status", "==", "pending")
        .limit(1);
    const transferSnap = await transferQuery.get();
    if (transferSnap.empty)
        throw new Error("Invalid or expired transfer code");
    const transferDoc = transferSnap.docs[0];
    const transfer = transferDoc.data();
    const now = new Date();
    if (new Date(transfer.expiresAt) < now) {
        throw new Error("Transfer has expired");
    }
    return await firebase_1.db.runTransaction(async (transaction) => {
        const orderRef = firebase_1.db.collection(ORDERS_COLLECTION).doc(transfer.orderId);
        const orderDoc = await transaction.get(orderRef);
        if (!orderDoc.exists)
            throw new Error("Original order not found");
        const originalOrder = orderDoc.data();
        // 1. Mark transfer as accepted
        transaction.update(transferDoc.ref, {
            status: "accepted",
            toUserId: recipientUserId,
            acceptedAt: now.toISOString(),
            updatedAt: now.toISOString()
        });
        // 2. Update original order
        transaction.update(orderRef, {
            status: "transferred",
            transferredTo: recipientUserId,
            transferPending: false,
            updatedAt: now.toISOString(),
        });
        // 3. Create new order for recipient
        const newOrderId = `transfer_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        const newOrderRef = firebase_1.db.collection(ORDERS_COLLECTION).doc(newOrderId);
        const newOrderData = {
            id: newOrderId,
            userId: recipientUserId,
            eventId: originalOrder.eventId,
            eventTitle: originalOrder.eventTitle,
            eventDate: originalOrder.eventDate,
            eventLocation: originalOrder.eventLocation,
            status: "confirmed",
            tickets: [{
                    name: transfer.ticketDetails.name,
                    quantity: transfer.ticketDetails.quantity,
                }],
            totalAmount: 0,
            transferredFrom: transfer.fromUserId,
            originalOrderId: transfer.orderId,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
        };
        transaction.set(newOrderRef, newOrderData);
        // 4. Sync to public attendees
        const attendeeRef = firebase_1.db.collection('public_attendees').doc(`${recipientUserId}_${originalOrder.eventId}`);
        // Fetch profile for denormalization
        const userDoc = await transaction.get(firebase_1.db.collection('users').doc(recipientUserId));
        const userData = userDoc.exists ? userDoc.data() : {};
        transaction.set(attendeeRef, {
            userId: recipientUserId,
            userName: (userData === null || userData === void 0 ? void 0 : userData.displayName) || "C1RCLE Member",
            userAvatar: (userData === null || userData === void 0 ? void 0 : userData.photoURL) || null,
            eventId: originalOrder.eventId,
            orderId: newOrderId,
            joinedAt: now.toISOString(),
            type: 'transfer'
        });
        return { success: true, orderId: newOrderId };
    });
}
exports.acceptTransferInternal = acceptTransferInternal;
/**
 * Cancel a ticket transfer from the server
 */
async function cancelTransferInternal(transferId, userId) {
    const transferRef = firebase_1.db.collection(TRANSFERS_COLLECTION).doc(transferId);
    return await firebase_1.db.runTransaction(async (transaction) => {
        const transferDoc = await transaction.get(transferRef);
        if (!transferDoc.exists)
            throw new Error("Transfer not found");
        const transfer = transferDoc.data();
        if (transfer.fromUserId !== userId)
            throw new Error("Unauthorized");
        if (transfer.status !== 'pending')
            throw new Error("Only pending transfers can be cancelled");
        const orderRef = firebase_1.db.collection(ORDERS_COLLECTION).doc(transfer.orderId);
        transaction.update(transferRef, {
            status: "cancelled",
            cancelledAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        transaction.update(orderRef, {
            transferPending: false,
            transferId: null,
            updatedAt: new Date().toISOString()
        });
        return { success: true };
    });
}
exports.cancelTransferInternal = cancelTransferInternal;
//# sourceMappingURL=transfers.js.map