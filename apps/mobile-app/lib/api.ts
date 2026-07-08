/**
 * THE C1RCLE - Mobile API Client
 * Connects mobile app to the SAME guest-portal backend APIs
 * ensuring full sync with web checkout, payments, and inventory.
 *
 * In DEMO_MODE, delegates to apiFetchMock so every screen works without a backend.
 * Screens no longer need `if (DEMO_MODE)` branches — the mock is transparent.
 */

import Constants from 'expo-constants';
import { getFirebaseAuth } from './firebase';
import { DEMO_MODE } from './demo';
import { apiFetchMock } from './api-mock';
import { Platform } from 'react-native';
// In-flight request deduplication cache
// Deduplicates concurrent requests to the same path+method across stores/components.
const inFlightRequests = new Map<string, Promise<any>>();

export function deduplicateRequest<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const inFlight = inFlightRequests.get(key);
  if (inFlight) return inFlight as Promise<T>;

  const promise = fetcher().finally(() => {
    inFlightRequests.delete(key);
  });
  inFlightRequests.set(key, promise);
  return promise;
}

function hostFromUri(value?: string | null): string | null {
  if (!value) return null;
  const hostMatch = value.match(/^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^@/\s]+@)?\[?([^:/\]\s]+)\]?/i);
  return hostMatch?.[1] ?? null;
}

function isLoopbackHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

// Fastify API Gateway base URL.
// In development, derive the gateway host from Expo's dev server. Prefer a LAN host
// when Expo exposes one; Android cannot reach a Mac through 127.0.0.1 unless adb reverse is set.
function getApiBase(): string {
  const explicitBase = process.env.EXPO_PUBLIC_API_BASE_URL || process.env.EXPO_PUBLIC_GATEWAY_URL;
  if (explicitBase) return explicitBase;

  if (__DEV__) {
    const hostCandidates = [
      Constants.expoConfig?.hostUri,
      (Constants as any).linkingUri,
      (Constants as any).expoGoConfig?.debuggerHost,
      (Constants.manifest2 as any)?.extra?.expoClient?.hostUri,
      (Constants.manifest as any)?.debuggerHost,
    ]
      .map(hostFromUri)
      .filter((host): host is string => Boolean(host));

    const host =
      hostCandidates.find((candidate) => !isLoopbackHost(candidate)) ??
      (Platform.OS === 'android' ? '10.0.2.2' : hostCandidates[0]);

    if (host) {
      const devUrl = `http://${host}:4000`;
      if (__DEV__) console.log(`[API] Dev mode - using gateway: ${devUrl}`);
      return devUrl;
    }
  }

  return 'https://api.thec1rcle.com';
}

const API_BASE = getApiBase();

// All mobile HTTP calls go through the versioned gateway prefix
const API_PREFIX = '/api/v1';

type AuthSyncResponse = {
  user?: any;
  profile?: any;
  data?: {
    user?: any;
    profile?: any;
  };
  claims?: Record<string, any>;
  requiresTokenRefresh?: boolean;
};

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
 * In DEMO_MODE, transparently returns mock data.
 */
async function apiFetch<T = any>(
  path: string,
  options: RequestInit & { requireAuth?: boolean; _retry?: boolean } = {},
): Promise<T> {
  // In demo mode, delegate to mock API
  if (DEMO_MODE) {
    return apiFetchMock<T>(path, options);
  }
  const { requireAuth = true, _retry = false, ...fetchOptions } = options;

  const appVersion = Constants.expoConfig?.version ?? 'unknown';
  const isFormData = fetchOptions.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    'X-App-Version': appVersion,
    ...(fetchOptions.headers as Record<string, string>),
  };

    if (requireAuth) {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Authentication required. Please sign in.');
      }

      let token;
      try {
        token = await user.getIdToken(_retry);
      } catch (error: any) {
      const isDisabled =
        error.code === 'auth/user-disabled' ||
        error.code === 'auth/user-not-found' ||
        error.message?.includes('auth/user-disabled') ||
        error.message?.includes('auth/user-not-found');
      if (isDisabled) {
        getFirebaseAuth()
          .signOut()
          .catch(() => {});
        throw new Error('Your account has been disabled or deleted. Please contact support.');
      }
      throw error;
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE}${path}`;

  // Step 1: Set timeout based on path
  const isCheckout = path.includes('/checkout') || path.includes('/payments');
  const timeout = isCheckout ? 30000 : 15000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    console.log(`[API] Fetching ${url}...`);
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });
    console.log(`[API] Fetch complete for ${url}. Status:`, response.status);
    clearTimeout(timeoutId);

    // Handle 429 Too Many Requests — rate limited
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || response.headers.get('retry-after');
      const waitSeconds = retryAfter ? parseInt(retryAfter, 10) : 60;
      const rateError = new Error(
        `Too many requests. Please wait ${waitSeconds} second${waitSeconds === 1 ? '' : 's'} before trying again.`,
      );
      (rateError as any).code = 'RATE_LIMITED';
      (rateError as any).retryAfter = waitSeconds;
      (rateError as any).status = 429;
      throw rateError;
    }

    // Handle 401 Unauthorized — potentially expired token
    if (response.status === 401 && requireAuth && !_retry) {
      if (__DEV__) console.log('[API] 401 detected, attempting token refresh retry...');
      return apiFetch<T>(path, { ...options, _retry: true });
    }

    const data = await response.json();

    if (!response.ok) {
      const errorMsg =
        typeof data.error === 'string'
          ? data.error
          : data.error?.message || data.message || `Request failed (${response.status})`;
      const requestError = new Error(errorMsg);
      (requestError as any).code = data.error?.code || data.code || null;
      (requestError as any).details = data.error?.details || data.details || null;
      (requestError as any).status = response.status;
      throw requestError;
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
    discounts?: Array<{
      code?: string;
      label?: string;
      amount?: number;
    }>;
    fees?: {
      platform?: number;
      platformFee?: number;
      payment?: number;
      paymentFee?: number;
      gst?: number;
      total?: number;
      waived?: boolean;
      waivedBreakdown?: Record<string, number>;
    };
    subscription?: {
      tier?: 'free' | 'premium';
      bookingFeesWaived?: boolean;
      bookingFeesSaved?: number;
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
  hostUpdatesOptIn?: boolean;
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
  orderId?: string;
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
 * Uses: POST /api/v1/checkout/verify
 */
export async function verifyPayment(
  payload: VerifyPaymentRequest,
  options: ApiRequestOptions = {},
): Promise<VerifyPaymentResponse> {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = payload;
  return apiFetch<VerifyPaymentResponse>(`${API_PREFIX}/checkout/verify`, {
    method: 'POST',
    headers: options.headers,
    body: JSON.stringify({ razorpay_order_id, razorpay_payment_id, razorpay_signature }),
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

export async function fetchPublicVenues(params?: {
  area?: string;
  search?: string;
  tablesOnly?: boolean;
  limit?: number;
}): Promise<{ venues: any[]; items: any[]; nextCursor?: string | null; hasMore?: boolean }> {
  const searchParams = new URLSearchParams();
  if (params?.area) searchParams.set('area', params.area);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.tablesOnly) searchParams.set('tablesOnly', 'true');
  searchParams.set('limit', String(params?.limit ?? 100));

  const query = searchParams.toString();
  const response = await apiFetch<{
    items?: any[];
    venues?: any[];
    nextCursor?: string | null;
    hasMore?: boolean;
  }>(`${API_PREFIX}/public/venues${query ? `?${query}` : ''}`, {
    requireAuth: false,
  });
  const items = response.items || response.venues || [];
  return { ...response, items, venues: items };
}

export async function syncAuthSession(): Promise<AuthSyncResponse> {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) {
    throw new Error('Authentication required. Please sign in.');
  }

  return apiFetch<AuthSyncResponse>(`${API_PREFIX}/auth/sync`, {
    method: 'POST',
    requireAuth: true,
    body: JSON.stringify({}),
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

/**
 * Revoke an already-claimed ticket from a share bundle (host only).
 * Uses: POST /api/v1/tickets/share/revoke
 */
export async function revokeSharedTicket(payload: {
  bundleId: string;
  slotIndex: number;
}): Promise<any> {
  return apiFetch(`${API_PREFIX}/tickets/share/revoke`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export { getAuthToken, apiFetch, API_BASE };
