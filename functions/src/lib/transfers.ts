import { db } from './firebase';
import * as crypto from 'crypto';

const TRANSFERS_COLLECTION = "transfers";
const ORDERS_COLLECTION = "orders";

/**
 * Initiate a ticket transfer from the server
 */
export async function initiateTransferInternal(payload: {
    orderId: string,
    fromUserId: string,
    ticketDetails: { name: string, quantity: number },
    recipientEmail?: string,
    recipientPhone?: string
}) {
    const { orderId, fromUserId, ticketDetails, recipientEmail, recipientPhone } = payload;

    const transferCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    return await db.runTransaction(async (transaction) => {
        const orderRef = db.collection(ORDERS_COLLECTION).doc(orderId);
        const orderDoc = await transaction.get(orderRef);

        if (!orderDoc.exists) throw new Error("Order not found");
        const order = orderDoc.data()!;

        if (order.userId !== fromUserId) throw new Error("Unauthorized: Order ownership mismatch");
        if (order.status !== 'confirmed') throw new Error("Only confirmed orders can be transferred");

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

        const transferRef = db.collection(TRANSFERS_COLLECTION).doc();
        transaction.set(transferRef, transferData);

        transaction.update(orderRef, {
            transferPending: true,
            transferId: transferRef.id,
            updatedAt: now.toISOString(),
        });

        return { success: true, transferId: transferRef.id, transferCode };
    });
}

/**
 * Accept a ticket transfer from the server
 */
export async function acceptTransferInternal(transferCode: string, recipientUserId: string) {
    const transferQuery = db.collection(TRANSFERS_COLLECTION)
        .where("transferCode", "==", transferCode)
        .where("status", "==", "pending")
        .limit(1);

    const transferSnap = await transferQuery.get();
    if (transferSnap.empty) throw new Error("Invalid or expired transfer code");

    const transferDoc = transferSnap.docs[0];
    const transfer = transferDoc.data();
    const now = new Date();

    if (new Date(transfer.expiresAt) < now) {
        throw new Error("Transfer has expired");
    }

    return await db.runTransaction(async (transaction: any) => {
        const orderRef = db.collection(ORDERS_COLLECTION).doc(transfer.orderId);
        const orderDoc = await transaction.get(orderRef);

        if (!orderDoc.exists) throw new Error("Original order not found");
        const originalOrder = orderDoc.data()!;

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
        const newOrderRef = db.collection(ORDERS_COLLECTION).doc(newOrderId);

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
        const attendeeRef = db.collection('public_attendees').doc(`${recipientUserId}_${originalOrder.eventId}`);

        // Fetch profile for denormalization
        const userDoc = await transaction.get(db.collection('users').doc(recipientUserId));
        const userData = userDoc.exists ? userDoc.data() : {};

        transaction.set(attendeeRef, {
            userId: recipientUserId,
            userName: userData?.displayName || "C1RCLE Member",
            userAvatar: userData?.photoURL || null,
            eventId: originalOrder.eventId,
            orderId: newOrderId,
            joinedAt: now.toISOString(),
            type: 'transfer'
        });

        return { success: true, orderId: newOrderId };
    });
}

/**
 * Cancel a ticket transfer from the server
 */
export async function cancelTransferInternal(transferId: string, userId: string) {
    const transferRef = db.collection(TRANSFERS_COLLECTION).doc(transferId);

    return await db.runTransaction(async (transaction) => {
        const transferDoc = await transaction.get(transferRef);
        if (!transferDoc.exists) throw new Error("Transfer not found");
        const transfer = transferDoc.data()!;

        if (transfer.fromUserId !== userId) throw new Error("Unauthorized");
        if (transfer.status !== 'pending') throw new Error("Only pending transfers can be cancelled");

        const orderRef = db.collection(ORDERS_COLLECTION).doc(transfer.orderId);

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
