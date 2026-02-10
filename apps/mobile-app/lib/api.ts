/**
 * THE C1RCLE - Mobile API Client
 * Connects mobile app to the SAME guest-portal backend APIs
 * ensuring full sync with web checkout, payments, and inventory.
 */

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
    options: RequestInit & { requireAuth?: boolean } = {}
): Promise<T> {
    const { requireAuth = true, ...fetchOptions } = options;

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(fetchOptions.headers as Record<string, string>),
    };

    if (requireAuth) {
        const token = await getAuthToken();
        if (!token) {
            throw new Error("Authentication required. Please sign in.");
        }
        headers["Authorization"] = `Bearer ${token}`;
    }

    const url = `${API_BASE}${path}`;

    const response = await fetch(url, {
        ...fetchOptions,
        headers,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.error || data.message || `Request failed (${response.status})`
        );
    }

    return data as T;
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

// ─── Tickets API ─────────────────────────────────────────────────

/**
 * Transfer a ticket
 * Uses: POST /api/tickets/transfer
 */
export async function transferTicket(payload: {
    ticketId: string;
    recipientEmail: string;
}): Promise<any> {
    return apiFetch("/api/tickets/transfer", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

/**
 * Claim a transferred ticket
 * Uses: POST /api/tickets/claim
 */
export async function claimTicket(payload: {
    transferId: string;
}): Promise<any> {
    return apiFetch("/api/tickets/claim", {
        method: "POST",
        body: JSON.stringify(payload),
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

export { getAuthToken, apiFetch, API_BASE };
