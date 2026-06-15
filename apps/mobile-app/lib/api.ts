/**
 * THE C1RCLE - Mobile API Client
 * Connects mobile app to the SAME guest-portal backend APIs
 * ensuring full sync with web checkout, payments, and inventory.
 */

import Constants from 'expo-constants';

import { getFirebaseAuth } from './firebase';

// Fastify API Gateway base URL
// In development, dynamically derive the gateway URL from the Expo dev server host.
// This means it works on any machine/IP without needing to hardcode the env var.
// The API Gateway runs on port 4000, same machine as the Metro bundler.
function getApiBase(): string {
  // Explicit override via env var always wins
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }

  // In development, derive host from Expo's manifest
  if (__DEV__) {
    const debuggerHost =
      Constants.expoConfig?.hostUri ||
      (Constants.manifest2 as any)?.extra?.expoClient?.hostUri ||
      (Constants.manifest as any)?.debuggerHost;

    if (debuggerHost) {
      // debuggerHost is "10.x.x.x:8081" — strip the port
      const host = debuggerHost.split(':')[0];

      // 🛡️ ENHANCEMENT: If we have an explicit base URL from ENV, use it.
      // Otherwise default to the host machine on the standard dev port (4000).
      const devUrl = process.env.EXPO_PUBLIC_API_BASE_URL || `http://${host}:4000`;
      console.log(`[API] Dev mode — using gateway: ${devUrl}`);
      return devUrl;
    }
  }

  return 'https://api.thec1rcle.com';
}

const API_BASE = getApiBase();

// All mobile HTTP calls go through the versioned gateway prefix
const API_PREFIX = '/api/v1';

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
  options: RequestInit & { requireAuth?: boolean; _retry?: boolean } = {},
): Promise<T> {
  const { requireAuth = true, _retry = false, ...fetchOptions } = options;

  const appVersion = Constants.expoConfig?.version ?? 'unknown';
  const isFormData = fetchOptions.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    'X-App-Version': appVersion,
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (requireAuth) {
    // Pass forceRefresh=true if this is a retry
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Authentication required. Please sign in.');
    }

    const token = await user.getIdToken(_retry);
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE}${path}`;

  // Step 1: Set timeout based on path
  const isCheckout = path.includes('/checkout') || path.includes('/payments');
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
      if (__DEV__) console.log('[API] 401 detected, attempting token refresh retry...');
      return apiFetch<T>(path, { ...options, _retry: true });
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || `Request failed (${response.status})`);
    }

    return data as T;
  } catch (error: any) {
    // Handle explicit abort/timeout
    if (error.name === 'AbortError' || error.message?.includes('Aborted')) {
      const timeoutError = new Error('Request timed out. Please try again.');
      (timeoutError as any).isTimeout = true;
      (timeoutError as any).isAbort = true;
      throw timeoutError;
    }

    // If it's already an Error with a message from above, rethrow
    if (error.message && !error.message.includes('fetch')) {
      throw error;
    }

    // Handle network/timeout errors
    throw new Error(error.message || 'Network request failed. Please check your connection.');
  }
}

// ─── Checkout APIs (same as guest-portal) ────────────────────────

export interface ReserveRequest {
  eventId: string;
  items: { tierId: string; quantity: number }[];
  deviceId?: string;
}

interface ApiRequestOptions {
  headers?: Record<string, string>;
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
  payload: ReserveRequest,
  options: ApiRequestOptions = {},
): Promise<ReserveResponse> {
  return apiFetch<ReserveResponse>(`${API_PREFIX}/checkout/reserve`, {
    method: 'POST',
    headers: options.headers,
    body: JSON.stringify({
      eventId: payload.eventId,
      items: payload.items,
      deviceId: payload.deviceId || `mobile-${getFirebaseAuth().currentUser?.uid || 'anon'}`,
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
    discount?: number;
    discountTotal?: number;
    totalQuantity?: number;
    discounts?: {
      code?: string;
      label?: string;
      amount?: number;
    }[];
    fees?: {
      platform?: number;
      platformFee?: number;
      payment?: number;
      paymentFee?: number;
      gst?: number;
      total?: number;
    };
    platformFee?: number;
    grandTotal: number;
    items: any[];
    isFree?: boolean;
  };
}

/**
 * Step 2: Calculate server-side pricing (discounts, fees, etc.)
 * Uses: POST /api/checkout/calculate
 */
export async function calculatePricing(payload: CalculateRequest): Promise<PricingResult> {
  return apiFetch<PricingResult>(`${API_PREFIX}/checkout/calculate`, {
    method: 'POST',
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
  payload: InitiateCheckoutRequest,
  options: ApiRequestOptions = {},
): Promise<InitiateCheckoutResponse> {
  return apiFetch<InitiateCheckoutResponse>(`${API_PREFIX}/checkout/initiate`, {
    method: 'POST',
    headers: options.headers,
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
  payload: VerifyPaymentRequest,
  options: ApiRequestOptions = {},
): Promise<VerifyPaymentResponse> {
  return apiFetch<VerifyPaymentResponse>(`${API_PREFIX}/payments/verify`, {
    method: 'PATCH',
    headers: options.headers,
    body: JSON.stringify(payload),
  });
}

/**
 * Cancel an order and release inventory
 * Uses: POST /api/checkout/cancel
 */
export async function cancelOrder(orderId: string): Promise<{ success: boolean }> {
  return apiFetch(`${API_PREFIX}/checkout/cancel`, {
    method: 'POST',
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
  payload: ValidatePromoRequest,
): Promise<ValidatePromoResponse> {
  return apiFetch<ValidatePromoResponse>(`${API_PREFIX}/checkout/promo`, {
    method: 'POST',
    requireAuth: false,
    body: JSON.stringify(payload),
  });
}

// ─── Orders API ──────────────────────────────────────────────────

/**
 * Get user's orders
 * Uses: GET /api/orders
 */
export async function getOrders(): Promise<{ orders: any[] }> {
  return apiFetch(`${API_PREFIX}/orders`);
}

export async function getOrder(
  orderId: string,
  options: { includeEvent?: boolean } = {},
): Promise<any | null> {
  const includeEvent = options.includeEvent === true;
  const query = includeEvent ? '' : '?includeEvent=false';
  const data = await apiFetch<{ success: boolean; order?: any }>(
    `${API_PREFIX}/orders/${orderId}${query}`,
  );
  return data?.order || null;
}

/**
 * Cancel a specific order
 * Uses: POST /api/orders/[orderId]/cancel
 */
export async function cancelUserOrder(orderId: string): Promise<any> {
  return apiFetch(`${API_PREFIX}/orders/${orderId}/cancel`, {
    method: 'POST',
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
  if (params?.category) searchParams.set('category', params.category);
  if (params?.city) searchParams.set('city', params.city);
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const query = searchParams.toString();
  return apiFetch(`${API_PREFIX}/events${query ? `?${query}` : ''}`, {
    requireAuth: false,
  });
}

/**
 * Search events
 * Uses: GET /api/search
 */
export async function searchEvents(query: string): Promise<{ results: any[] }> {
  return apiFetch(`${API_PREFIX}/search?q=${encodeURIComponent(query)}`, {
    requireAuth: false,
  });
}

// ─── Notifications API ──────────────────────────────────────────

/**
 * Get user notifications
 * Uses: GET /api/v1/guest-notifications
 */
export async function getNotifications(): Promise<{ notifications: any[] }> {
  return apiFetch(`${API_PREFIX}/guest-notifications`);
}

// ─── Ticket Sharing + Formal Transfers (guest-portal parity) ───────────────

/**
 * Preview a share bundle (no auth required).
 * Uses: GET /api/tickets/claim?token=...
 */
export async function getShareBundle(token: string): Promise<any> {
  return apiFetch(`${API_PREFIX}/tickets/claim?token=${encodeURIComponent(token)}`, {
    requireAuth: false,
  });
}

/**
 * Claim a share bundle slot (auth required).
 * Uses: POST /api/tickets/claim
 */
export async function claimShareTicket(token: string): Promise<any> {
  return apiFetch(`${API_PREFIX}/tickets/claim/share`, {
    method: 'POST',
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
  return apiFetch(`${API_PREFIX}/tickets/share`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Fetch formal transfer details by code for preview (no auth required).
 * Uses: GET /api/tickets/transfer?code=...
 */
export async function getTransferDetails(code: string): Promise<any> {
  return apiFetch(`${API_PREFIX}/tickets/transfer?code=${encodeURIComponent(code)}`, {
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
  return apiFetch(`${API_PREFIX}/tickets/transfer`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Accept a formal ticket transfer (auth required).
 * Uses: PATCH /api/tickets/transfer
 */
export async function acceptFormalTransfer(payload: { transferCode: string }): Promise<any> {
  return apiFetch(`${API_PREFIX}/tickets/transfer`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/**
 * Cancel a pending formal ticket transfer (auth required).
 * Uses: DELETE /api/tickets/transfer
 */
export async function cancelFormalTransfer(payload: { transferId: string }): Promise<any> {
  return apiFetch(
    `${API_PREFIX}/tickets/transfer?transferId=${encodeURIComponent(payload.transferId)}`,
    {
      method: 'DELETE',
    },
  );
}

/**
 * Fetch all pending transfers for the current user (auth required).
 * Uses: GET /api/tickets/transfer/pending
 */
export async function getPendingFormalTransfers(): Promise<any> {
  return apiFetch(`${API_PREFIX}/tickets/transfer/pending`);
}

/**
 * Fetch share bundles + assignments for an order (auth required).
 * Uses: GET /api/tickets/share?orderId=...
 */
export async function getTicketShares(orderId: string): Promise<any> {
  return apiFetch(`${API_PREFIX}/tickets/share?orderId=${encodeURIComponent(orderId)}`);
}

/**
 * Reclaim one slot from an active share bundle (auth required).
 * Uses: DELETE /api/tickets/share
 */
export async function reclaimSharedTicket(payload: {
  bundleId: string;
  slotIndex: number;
}): Promise<any> {
  return apiFetch(`${API_PREFIX}/tickets/share`, {
    method: 'DELETE',
    body: JSON.stringify(payload),
  });
}

/**
 * Cancel an active share bundle entirely (auth required).
 * Uses: DELETE /api/v1/tickets/share
 */
export async function cancelShareBundle(payload: { bundleId: string }): Promise<any> {
  return apiFetch(`${API_PREFIX}/tickets/share`, {
    method: 'DELETE',
    body: JSON.stringify(payload),
  });
}

export { getAuthToken, apiFetch, API_BASE };
