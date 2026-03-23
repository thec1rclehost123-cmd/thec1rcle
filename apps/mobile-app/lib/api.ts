/**
 * THE C1RCLE - Mobile API Client
 * Connects mobile app to the SAME guest-portal backend APIs
 * ensuring full sync with web checkout, payments, and inventory.
 */

import Constants from "expo-constants";
import { getFirebaseAuth } from "./firebase";

// The guest-portal base URL — same backend used by the website
const API_BASE =
    process.env.EXPO_PUBLIC_API_BASE_URL || "https://thec1rcle.com";

/**
 * Get the current user's Firebase ID token for authenticated requests.
 */
async function getAuthToken(): Promise<string | null> {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
}

/**
 * Core fetch wrapper with auth, error handling, and retries.
 */
async function apiFetch<T = any>(
    path: string,
    options: RequestInit & { requireAuth?: boolean; _retry?: boolean } = {}
): Promise<T> {
    const { requireAuth = true, _retry = false, ...fetchOptions } = options;

    const appVersion = Constants.expoConfig?.version ?? "unknown";
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-App-Version": appVersion,
        ...(fetchOptions.headers as Record<string, string>),
    };

    if (requireAuth) {
        // Pass forceRefresh=true if this is a retry
        const auth = getFirebaseAuth();
        const user = auth.currentUser;
        if (!user) {
            throw new Error("Authentication required. Please sign in.");
        }

        const token = await user.getIdToken(_retry);
        headers["Authorization"] = `Bearer ${token}`;
    }

    const url = `${API_BASE}${path}`;

    // Step 1: Set timeout based on path
    const isCheckout = path.includes("/checkout") || path.includes("/payments");
    const timeout = isCheckout ? 30000 : 15000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...fetchOptions,
            headers,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        // Handle 401 Unauthorized — potentially expired token
        if (response.status === 401 && requireAuth && !_retry) {
            if (__DEV__) console.log("[API] 401 detected, attempting token refresh retry...");
            return apiFetch<T>(path, { ...options, _retry: true });
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || data.message || `Request failed (${response.status})`
            );
        }

        return data as T;
    } catch (error: any) {
        // If it's already an Error with a message from above, rethrow
        if (error.message && !error.message.includes("fetch")) {
            throw error;
        }

        // Handle network/timeout errors
        throw new Error(error.message || "Network request failed. Please check your connection.");
    }
}

// ─── Checkout APIs (same as guest-portal) ────────────────────────

export interface ReserveRequest {
    eventId: string;
    items: { tierId: string; quantity: number }[];
    deviceId?: string;
}

export interface ReserveResponse {
    success: boolean;
    reservationId: string;
    items: any[];
    expiresAt: string;
    expiresInSeconds: number;
}

/**
 * Step 1: Reserve inventory — atomically locks tickets in Firestore
 * Uses: POST /api/checkout/reserve
 */
export async function reserveTickets(
    payload: ReserveRequest
): Promise<ReserveResponse> {
    return apiFetch<ReserveResponse>("/api/checkout/reserve", {
        method: "POST",
        body: JSON.stringify({
            eventId: payload.eventId,
            items: payload.items,
            deviceId: payload.deviceId || `mobile-${getFirebaseAuth().currentUser?.uid || "anon"}`,
        }),
    });
}

export interface CalculateRequest {
    eventId?: string;
    reservationId?: string;
    items?: { tierId: string; quantity: number; price?: number; subtotal?: number }[];
    promoCode?: string | null;
    promoterCode?: string | null;
}

export interface PricingResult {
    success: boolean;
    pricing: {
        subtotal: number;
        discount: number;
        platformFee: number;
        grandTotal: number;
        items: any[];
    };
}

/**
 * Step 2: Calculate server-side pricing (discounts, fees, etc.)
 * Uses: POST /api/checkout/calculate
 */
export async function calculatePricing(
    payload: CalculateRequest
): Promise<PricingResult> {
    return apiFetch<PricingResult>("/api/checkout/calculate", {
        method: "POST",
        requireAuth: false,
        body: JSON.stringify(payload),
    });
}

export interface InitiateCheckoutRequest {
    reservationId: string;
    userName: string;
    userEmail: string;
    userPhone?: string;
    promoCode?: string | null;
    promoterCode?: string | null;
}

export interface InitiateCheckoutResponse {
    success: boolean;
    requiresPayment: boolean;
    order: {
        id: string;
        totalAmount?: number;
    };
    pricing?: {
        grandTotal: number;
    };
    razorpay?: {
        orderId: string;
        amount: number;
        currency: string;
        key?: string;
    };
    message?: string;
}

/**
 * Step 3: Initiate checkout — creates the order and (if paid) the Razorpay order
 * Uses: POST /api/checkout/initiate
 */
export async function initiateCheckout(
    payload: InitiateCheckoutRequest
): Promise<InitiateCheckoutResponse> {
    return apiFetch<InitiateCheckoutResponse>("/api/checkout/initiate", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export interface VerifyPaymentRequest {
    orderId: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
}

export interface VerifyPaymentResponse {
    success: boolean;
    order?: any;
    error?: string;
}

/**
 * Step 4: Verify payment signature with backend
 * Uses: PATCH /api/payments
 */
export async function verifyPayment(
    payload: VerifyPaymentRequest
): Promise<VerifyPaymentResponse> {
    return apiFetch<VerifyPaymentResponse>("/api/payments", {
        method: "PATCH",
        body: JSON.stringify(payload),
    });
}

/**
 * Cancel an order and release inventory
 * Uses: POST /api/checkout/cancel
 */
export async function cancelOrder(orderId: string): Promise<{ success: boolean }> {
    return apiFetch("/api/checkout/cancel", {
        method: "POST",
        body: JSON.stringify({ orderId }),
    });
}

// ─── Promo Code API ──────────────────────────────────────────────

export interface ValidatePromoRequest {
    eventId: string;
    code: string;
    items?: { tierId: string; quantity: number; price?: number; subtotal?: number }[];
}

export interface ValidatePromoResponse {
    valid: boolean;
    discountAmount?: number;
    label?: string;
    error?: string;
}

/**
 * Validate a promo code against the backend promo-service
 * Uses: POST /api/checkout/promo
 */
export async function validatePromoCode(
    payload: ValidatePromoRequest
): Promise<ValidatePromoResponse> {
    return apiFetch<ValidatePromoResponse>("/api/checkout/promo", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

// ─── Orders API ──────────────────────────────────────────────────

/**
 * Get user's orders
 * Uses: GET /api/orders
 */
export async function getOrders(): Promise<{ orders: any[] }> {
    return apiFetch("/api/orders");
}

/**
 * Cancel a specific order
 * Uses: POST /api/orders/[orderId]/cancel
 */
export async function cancelUserOrder(orderId: string): Promise<any> {
    return apiFetch(`/api/orders/${orderId}/cancel`, {
        method: "POST",
    });
}

// ─── Events API ──────────────────────────────────────────────────

/**
 * Fetch events list
 * Uses: GET /api/events
 */
export async function fetchEvents(params?: {
    category?: string;
    city?: string;
    limit?: number;
}): Promise<{ events: any[] }> {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set("category", params.category);
    if (params?.city) searchParams.set("city", params.city);
    if (params?.limit) searchParams.set("limit", params.limit.toString());

    const query = searchParams.toString();
    return apiFetch(`/api/events${query ? `?${query}` : ""}`, {
        requireAuth: false,
    });
}

/**
 * Search events
 * Uses: GET /api/search
 */
export async function searchEvents(query: string): Promise<{ results: any[] }> {
    return apiFetch(`/api/search?q=${encodeURIComponent(query)}`, {
        requireAuth: false,
    });
}

// ─── Notifications API ──────────────────────────────────────────

/**
 * Get user notifications
 * Uses: GET /api/notifications
 */
export async function getNotifications(): Promise<{ notifications: any[] }> {
    return apiFetch("/api/notifications");
}

// ─── Ticket Sharing + Formal Transfers (guest-portal parity) ───────────────

/**
 * Preview a share bundle (no auth required).
 * Uses: GET /api/tickets/claim?token=...
 */
export async function getShareBundle(token: string): Promise<any> {
    return apiFetch(`/api/tickets/claim?token=${encodeURIComponent(token)}`, {
        requireAuth: false,
    });
}

/**
 * Claim a share bundle slot (auth required).
 * Uses: POST /api/tickets/claim
 */
export async function claimShareTicket(token: string): Promise<any> {
    return apiFetch(`/api/tickets/claim`, {
        method: "POST",
        body: JSON.stringify({ token }),
    });
}

/**
 * Create a share bundle for a ticket tier (auth required).
 * Uses: POST /api/tickets/share
 */
export async function createShareBundle(payload: {
    orderId: string;
    eventId: string;
    quantity: number;
    tierId: string;
    expiresAt?: string;
}): Promise<any> {
    return apiFetch(`/api/tickets/share`, {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

/**
 * Fetch formal transfer details by code for preview (no auth required).
 * Uses: GET /api/tickets/transfer?code=...
 */
export async function getTransferDetails(code: string): Promise<any> {
    return apiFetch(`/api/tickets/transfer?code=${encodeURIComponent(code)}`, {
        requireAuth: false,
    });
}

/**
 * Initiate a formal ticket transfer (auth required).
 * Uses: POST /api/tickets/transfer
 */
export async function initiateFormalTransfer(payload: {
    ticketId: string;
    recipientEmail?: string;
}): Promise<any> {
    return apiFetch(`/api/tickets/transfer`, {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

/**
 * Accept a formal ticket transfer (auth required).
 * Uses: PATCH /api/tickets/transfer
 */
export async function acceptFormalTransfer(payload: {
    transferCode: string;
}): Promise<any> {
    return apiFetch(`/api/tickets/transfer`, {
        method: "PATCH",
        body: JSON.stringify(payload),
    });
}

/**
 * Cancel a pending formal ticket transfer (auth required).
 * Uses: DELETE /api/tickets/transfer
 */
export async function cancelFormalTransfer(payload: {
    transferId: string;
}): Promise<any> {
    return apiFetch(`/api/tickets/transfer`, {
        method: "DELETE",
        body: JSON.stringify(payload),
    });
}

/**
 * Fetch all pending transfers for the current user (auth required).
 * Uses: GET /api/tickets/transfer/pending
 */
export async function getPendingFormalTransfers(): Promise<any> {
    return apiFetch(`/api/tickets/transfer/pending`);
}

/**
 * Fetch share bundles + assignments for an order (auth required).
 * Uses: GET /api/tickets/share?orderId=...
 */
export async function getTicketShares(orderId: string): Promise<any> {
    return apiFetch(`/api/tickets/share?orderId=${encodeURIComponent(orderId)}`);
}

/**
 * Reclaim one slot from an active share bundle (auth required).
 * Uses: DELETE /api/tickets/share
 */
export async function reclaimSharedTicket(payload: {
    bundleId: string;
    slotIndex: number;
}): Promise<any> {
    return apiFetch(`/api/tickets/share`, {
        method: "DELETE",
        body: JSON.stringify(payload),
    });
}

/**
 * Cancel an active share bundle entirely (auth required).
 * Uses: DELETE /api/tickets/share
 */
export async function cancelShareBundle(payload: {
    bundleId: string;
}): Promise<any> {
    return apiFetch(`/api/tickets/share`, {
        method: "DELETE",
        body: JSON.stringify(payload),
    });
}

export { getAuthToken, apiFetch, API_BASE };
