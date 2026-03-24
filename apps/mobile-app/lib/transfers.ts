// Ticket transfer service (server-authoritative via Cloud Functions)
import { httpsCallable } from "firebase/functions";
import { getFirebaseFunctions } from "./firebase";

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

/**
 * Initiate ticket transfer via Cloud Function.
 * Mirrors the standalone app behavior and avoids client-side writes to `orders`,
 * which are admin-only under Firestore rules.
 */
export async function initiateTransfer(
    orderId: string,
    fromUserId: string, // kept for API compatibility; server uses context.auth.uid
    ticketDetails: { tierName: string; quantity: number } | { name: string; quantity: number },
    recipientEmail?: string,
    recipientPhone?: string
): Promise<{ success: boolean; transferId?: string; transferCode?: string; error?: string }> {
    try {
        const functions = getFirebaseFunctions();
        const createTransferFn = httpsCallable(functions, "initiateTransfer");

        const normalizedTicketDetails = ("tierName" in ticketDetails)
            ? { name: ticketDetails.tierName, quantity: ticketDetails.quantity }
            : ticketDetails;

        const result: any = await createTransferFn({
            orderId,
            ticketDetails: normalizedTicketDetails,
            recipientEmail,
            recipientPhone,
        });

        return result.data;
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Accept transfer via Cloud Function.
 */
export async function acceptTransfer(
    transferCode: string,
    recipientUserId: string // kept for API compatibility; server uses context.auth.uid
): Promise<{ success: boolean; error?: string }> {
    try {
        const functions = getFirebaseFunctions();
        const acceptTransferFn = httpsCallable(functions, "acceptTransfer");
        const result: any = await acceptTransferFn({ transferCode });
        return result.data;
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Cancel transfer via Cloud Function.
 */
export async function cancelTransfer(
    transferId: string,
    userId: string // kept for API compatibility; server uses context.auth.uid
): Promise<{ success: boolean; error?: string }> {
    try {
        const functions = getFirebaseFunctions();
        const cancelTransferFn = httpsCallable(functions, "cancelTransfer");
        const result: any = await cancelTransferFn({ transferId });
        return result.data;
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Pending transfers are currently surfaced via the wallet/orders view.
export async function getPendingTransfers(
    userId: string
): Promise<Transfer[]> {
    return [];
}
