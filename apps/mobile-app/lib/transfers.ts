// Ticket transfer service
import {
    doc,
    updateDoc,
    addDoc,
    collection,
    query,
    where,
    getDocs,
    serverTimestamp,
    runTransaction,
} from "firebase/firestore";
import { getFirebaseDb } from "./firebase";

export interface TransferRequest {
    orderId: string;
    ticketIndex: number; // Which ticket in the order to transfer
    recipientEmail?: string;
    recipientPhone?: string;
}

export interface Transfer {
    id: string;
    orderId: string;
    fromUserId: string;
    toUserId?: string;
    toEmail?: string;
    toPhone?: string;
    ticketDetails: {
        tierName: string;
        quantity: number;
    };
    status: "pending" | "accepted" | "declined" | "cancelled";
    transferCode: string;
    createdAt: any;
    expiresAt: any;
}

// Generate unique transfer code
function generateTransferCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Initiate ticket transfer
export async function initiateTransfer(
    orderId: string,
    fromUserId: string,
    ticketDetails: { tierName: string; quantity: number },
    recipientEmail?: string,
    recipientPhone?: string
): Promise<{ success: boolean; transferId?: string; transferCode?: string; error?: string }> {
    try {
        const db = getFirebaseDb();
        const transferCode = generateTransferCode();

        // Create transfer record
        const transferData: Omit<Transfer, "id"> = {
            orderId,
            fromUserId,
            toEmail: recipientEmail || null,
            toPhone: recipientPhone || null,
            ticketDetails,
            status: "pending",
            transferCode,
            createdAt: serverTimestamp(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        };

        const docRef = await addDoc(collection(db, "transfers"), transferData);

        // Update order to mark ticket as pending transfer
        const orderRef = doc(db, "orders", orderId);
        await updateDoc(orderRef, {
            transferPending: true,
            transferId: docRef.id,
            updatedAt: serverTimestamp(),
        });

        return {
            success: true,
            transferId: docRef.id,
            transferCode,
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Accept transfer (by recipient)
export async function acceptTransfer(
    transferCode: string,
    recipientUserId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const db = getFirebaseDb();

        // Find transfer by code
        const transferQuery = query(
            collection(db, "transfers"),
            where("transferCode", "==", transferCode),
            where("status", "==", "pending")
        );
        const transferSnap = await getDocs(transferQuery);

        if (transferSnap.empty) {
            return { success: false, error: "Invalid or expired transfer code" };
        }

        const transferDoc = transferSnap.docs[0];
        const transfer = transferDoc.data() as Transfer;

        // Check expiry
        if (new Date(transfer.expiresAt.toDate()) < new Date()) {
            return { success: false, error: "Transfer has expired" };
        }

        // Use transaction to update transfer and create new order
        await runTransaction(db, async (transaction) => {
            // Update transfer status
            const transferRef = doc(db, "transfers", transferDoc.id);
            transaction.update(transferRef, {
                status: "accepted",
                toUserId: recipientUserId,
                acceptedAt: serverTimestamp(),
            });

            // Get original order
            const orderRef = doc(db, "orders", transfer.orderId);
            const orderDoc = await transaction.get(orderRef);

            if (!orderDoc.exists()) {
                throw new Error("Original order not found");
            }

            const originalOrder = orderDoc.data();

            // Update original order
            transaction.update(orderRef, {
                status: "transferred",
                transferredTo: recipientUserId,
                transferPending: false,
                updatedAt: serverTimestamp(),
            });

            // Create new order for recipient
            const newOrderId = `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const newOrderRef = doc(db, "orders", newOrderId);

            transaction.set(newOrderRef, {
                id: newOrderId,
                userId: recipientUserId,
                eventId: originalOrder.eventId,
                eventTitle: originalOrder.eventTitle,
                eventDate: originalOrder.eventDate,
                venueLocation: originalOrder.venueLocation,
                status: "confirmed",
                tickets: [{
                    tierName: transfer.ticketDetails.tierName,
                    quantity: transfer.ticketDetails.quantity,
                }],
                totalAmount: 0, // No charge for transferred ticket
                transferredFrom: transfer.fromUserId,
                originalOrderId: transfer.orderId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Cancel transfer (by sender)
export async function cancelTransfer(
    transferId: string,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const db = getFirebaseDb();
        const transferRef = doc(db, "transfers", transferId);

        // Verify ownership
        const transferSnap = await getDocs(
            query(collection(db, "transfers"), where("fromUserId", "==", userId))
        );

        if (transferSnap.empty) {
            return { success: false, error: "Transfer not found" };
        }

        await updateDoc(transferRef, {
            status: "cancelled",
            cancelledAt: serverTimestamp(),
        });

        // Update original order
        const transferData = transferSnap.docs[0].data();
        const orderRef = doc(db, "orders", transferData.orderId);
        await updateDoc(orderRef, {
            transferPending: false,
            transferId: null,
            updatedAt: serverTimestamp(),
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Get pending transfers for user
export async function getPendingTransfers(
    userId: string
): Promise<Transfer[]> {
    try {
        const db = getFirebaseDb();

        // Transfers sent by user
        const sentQuery = query(
            collection(db, "transfers"),
            where("fromUserId", "==", userId),
            where("status", "==", "pending")
        );

        const sentSnap = await getDocs(sentQuery);

        return sentSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as Transfer[];
    } catch (error) {
        console.error("Error fetching transfers:", error);
        return [];
    }
}
