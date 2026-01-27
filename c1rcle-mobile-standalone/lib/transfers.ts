// Ticket transfer service (Mobile - Server-authoritative)
import {
    query,
    collection,
    where,
    getDocs,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirebaseDb, functions } from "./firebase";

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
        name: string;
        quantity: number;
    };
    status: "pending" | "accepted" | "declined" | "cancelled";
    transferCode: string;
    createdAt: any;
    expiresAt: any;
}

/**
 * Initiate ticket transfer via Cloud Function
 */
export async function initiateTransfer(
    orderId: string,
    fromUserId: string, // Kept for API compatibility, but server uses context.auth.uid
    ticketDetails: { name: string; quantity: number },
    recipientEmail?: string,
    recipientPhone?: string
): Promise<{ success: boolean; transferId?: string; transferCode?: string; error?: string }> {
    try {
        const createTransferFn = httpsCallable<{
            orderId: string,
            ticketDetails: { name: string, quantity: number },
            recipientEmail?: string,
            recipientPhone?: string
        }, { success: boolean, transferId: string, transferCode: string }>(functions, 'initiateTransfer');

        const result = await createTransferFn({
            orderId,
            ticketDetails,
            recipientEmail,
            recipientPhone
        });

        return {
            success: true,
            transferId: result.data.transferId,
            transferCode: result.data.transferCode,
        };
    } catch (error: any) {
        console.error("Transfer Initiation Error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Accept transfer via Cloud Function
 */
export async function acceptTransfer(
    transferCode: string,
    recipientUserId: string // Kept for compatibility
): Promise<{ success: boolean; error?: string }> {
    try {
        const acceptTransferFn = httpsCallable<{ transferCode: string }, { success: boolean }>(functions, 'acceptTransfer');
        await acceptTransferFn({ transferCode });
        return { success: true };
    } catch (error: any) {
        console.error("Accept Transfer Error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Cancel transfer via Cloud Function
 */
export async function cancelTransfer(
    transferId: string,
    userId: string // Kept for compatibility
): Promise<{ success: boolean; error?: string }> {
    try {
        const cancelTransferFn = httpsCallable<{ transferId: string }, { success: boolean }>(functions, 'cancelTransfer');
        await cancelTransferFn({ transferId });
        return { success: true };
    } catch (error: any) {
        console.error("Cancel Transfer Error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Get pending transfers for user (Read-only, allowed by rules)
 */
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
