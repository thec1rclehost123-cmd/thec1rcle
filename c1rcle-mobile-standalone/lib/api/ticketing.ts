/**
 * THE C1RCLE - Ticketing API Service
 * Replicates web ticketing backend interactions
 */

import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/client";
import { config } from "../config";
import { handleApiError } from "../errorHandler";
import { GUEST_PORTAL_API_BASE } from "./config";

import { getAuthHeaders as getAuthHeadersInternal } from "./config";

// Re-export for use elsewhere
export { GUEST_PORTAL_API_BASE };

/**
 * Get internal auth headers
 */
export async function getAuthHeaders() {
    return getAuthHeadersInternal();
}

export interface TicketingItem {
    tierId: string;
    quantity: number;
}

export interface ReservationResult {
    success: boolean;
    reservationId?: string;
    expiresAt?: string;
    expiresInSeconds?: number;
    items?: any[];
    error?: string;
}

export interface PricingResult {
    success: boolean;
    pricing?: {
        subtotal: number;
        discountTotal: number;
        discounts: any[];
        fees: {
            platform: number;
            payment: number;
            gst: number;
            total: number;
            formatted?: Record<string, string>;
        };
        grandTotal: number;
        isFree: boolean;
        items: any[];
        promoError?: string;
        // Hardened UI & Audit fields
        display?: {
            subtotal: string;
            discounts: string;
            fees: string;
            total: string;
        };
        ledger?: any;
    };
    error?: string;
}

export interface InitiateCheckoutResult {
    success: boolean;
    requiresPayment?: boolean;
    order?: any;
    razorpay?: {
        orderId: string;
        amount: number;
        currency: string;
    };
    pricing?: PricingResult['pricing'];
    message?: string;
    error?: string;
}

/**
 * Reserve tickets to hold inventory
 */
export async function reserveTickets(eventId: string, items: TicketingItem[], deviceId?: string): Promise<ReservationResult> {
    try {
        const reserveFn = httpsCallable(functions, 'reserveTickets');
        const result: any = await reserveFn({
            eventId,
            items,
            deviceId
        });

        return result.data;
    } catch (error: any) {
        console.error("reserveTickets Cloud Function Error:", error);
        return handleApiError(error, "reserveTickets");
    }
}

/**
 * Calculate final pricing with promo codes and discounts
 */
export async function calculatePricing(
    eventId: string,
    items: TicketingItem[],
    options: { promoCode?: string; promoterCode?: string; reservationId?: string } = {}
): Promise<PricingResult> {
    try {
        const calculateFn = httpsCallable(functions, 'calculatePricing');
        const result: any = await calculateFn({
            eventId,
            items,
            ...options
        });

        return { success: true, pricing: result.data };
    } catch (error: any) {
        console.error("calculatePricing Cloud Function Error:", error);
        return handleApiError(error, "calculatePricing");
    }
}

/**
 * Initiate checkout and get payment details
 */
export async function initiateCheckout(
    reservationId: string,
    userDetails: { userName?: string; userEmail?: string; userPhone?: string },
    options: { promoCode?: string; promoterCode?: string } = {}
): Promise<InitiateCheckoutResult> {
    try {
        const checkoutFn = httpsCallable(functions, 'initiateCheckout');
        const result: any = await checkoutFn({
            reservationId,
            userDetails,
            ...options
        });

        return result.data;
    } catch (error: any) {
        console.error("initiateCheckout Cloud Function Error:", error);
        return handleApiError(error, "initiateCheckout");
    }
}

/**
 * Verify payment with the backend
 */
export async function verifyPayment(payload: {
    orderId: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
}): Promise<{ success: boolean; order?: any; error?: string }> {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${GUEST_PORTAL_API_BASE}/payments`, {
            method: "PATCH",
            headers,
            body: JSON.stringify(payload),
        });

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error(`verifyPayment JSON parse error. URL: ${response.url}. Response body:`, text.substring(0, 200));
            return { success: false, error: `Payment verification failed at ${response.url}: ${response.status} ${response.statusText}` };
        }

        if (!response.ok) {
            return { success: false, error: data.error || "Payment verification failed" };
        }

        return data;
    } catch (error: any) {
        return handleApiError(error, "verifyPayment");
    }
}

/**
 * Validate a promo code independently
 */
export async function validatePromoCode(eventId: string, code: string): Promise<{ valid: boolean; discount?: number; error?: string }> {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${GUEST_PORTAL_API_BASE}/checkout/promo`, {
            method: "POST",
            headers,
            body: JSON.stringify({ eventId, code }),
        });

        const data = await response.json();
        return data;
    } catch (error: any) {
        return { valid: false, error: error.message };
    }
}
/**
 * Create a share bundle for a ticket tier
 */
export async function createShareBundle(
    orderId: string,
    eventId: string,
    quantity: number,
    tierId: string,
    expiresAt?: string
): Promise<{ success: boolean; bundle?: any; error?: string }> {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${GUEST_PORTAL_API_BASE}/tickets/share`, {
            method: "POST",
            headers,
            body: JSON.stringify({ orderId, eventId, quantity, tierId, expiresAt }),
        });

        const data = await response.json();
        return { success: response.ok, ...data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Fetch a share bundle by token for preview
 */
export async function getShareBundle(token: string): Promise<{ success: boolean; bundle?: any; error?: string }> {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${GUEST_PORTAL_API_BASE}/tickets/claim?token=${token}`, {
            headers,
        });

        const data = await response.json();
        return { success: response.ok, ...data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Claim a ticket slot from a bundle
 */
export async function claimTicket(token: string): Promise<{ success: boolean; assignment?: any; alreadyClaimed?: boolean; error?: string }> {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${GUEST_PORTAL_API_BASE}/tickets/claim`, {
            method: "POST",
            headers,
            body: JSON.stringify({ token }),
        });

        const data = await response.json();
        return { success: response.ok, ...data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Fetch formal transfer details by code for preview
 */
export async function getTransferDetails(code: string): Promise<{ success: boolean; transfer?: any; error?: string }> {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${GUEST_PORTAL_API_BASE}/tickets/transfer?code=${code}`, {
            headers,
        });

        const data = await response.json();
        return { success: response.ok, ...data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Initiate a formal ticket transfer
 */
export async function initiateTransfer(ticketId: string, recipientEmail?: string): Promise<{ success: boolean; transfer?: any; error?: string }> {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${GUEST_PORTAL_API_BASE}/tickets/transfer`, {
            method: "POST",
            headers,
            body: JSON.stringify({ ticketId, recipientEmail }),
        });

        const data = await response.json();
        return { success: response.ok, ...data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Accept a ticket transfer
 */
export async function acceptTransfer(transferCode: string): Promise<{ success: boolean; order?: any; error?: string }> {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${GUEST_PORTAL_API_BASE}/tickets/transfer`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ transferCode }),
        });

        const data = await response.json();
        return { success: response.ok, ...data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Reclaim an unclaimed shared ticket back to the owner
 */
export async function reclaimTicket(bundleId: string, slotIndex: number): Promise<{ success: boolean; error?: string }> {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${GUEST_PORTAL_API_BASE}/tickets/share`, {
            method: "DELETE",
            headers,
            body: JSON.stringify({ bundleId, slotIndex }),
        });

        const data = await response.json();
        return { success: response.ok, ...data };
    } catch (error: any) {
        return { success: false, error: error.message || "Reclaim failed" };
    }
}
/**
 * Cancel a pending ticket transfer
 */
export async function cancelTransfer(transferId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${GUEST_PORTAL_API_BASE}/tickets/transfer`, {
            method: "DELETE",
            headers,
            body: JSON.stringify({ transferId }),
        });

        const data = await response.json();
        return { success: response.ok, ...data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Fetch all pending transfers for the current user
 */
export async function getPendingTransfers(): Promise<{ success: boolean; transfers?: any[]; error?: string }> {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${GUEST_PORTAL_API_BASE}/tickets/transfer/pending`, {
            headers,
        });

        const data = await response.json();
        return { success: response.ok, ...data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
/**
 * Fetch all active share bundles for a specific order
 */
export async function getTicketShares(orderId: string): Promise<{ success: boolean; bundles?: any[]; error?: string }> {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${GUEST_PORTAL_API_BASE}/tickets/share?orderId=${orderId}`, {
            headers,
        });

        const data = await response.json();
        return { success: response.ok, ...data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
