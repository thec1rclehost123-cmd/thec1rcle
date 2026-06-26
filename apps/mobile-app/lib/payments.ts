/**
 * THE C1RCLE - Mobile Payment Service
 * Uses the same backend APIs as the guest-portal website.
 * Flow: reserve → initiate → Razorpay SDK → verify → webhook confirms
 *
 * The mobile app NEVER creates orders client-side.
 * All pricing, order creation, and payment verification happens server-side.
 */

import { Alert } from 'react-native';
import { useCartStore } from '@/store/cartStore';
import { useTicketsStore } from '@/store/ticketsStore';
import { useSubscriptionStore, type PremiumFeature } from '@/store/subscriptionStore';
import { reserveTickets, initiateCheckout, verifyPayment } from './api';

// Razorpay key for the frontend SDK (public key only — secret stays on server)
const RAZORPAY_KEY = process.env.EXPO_PUBLIC_RAZORPAY_KEY;

if (!RAZORPAY_KEY && !__DEV__) {
  throw new Error('EXPO_PUBLIC_RAZORPAY_KEY is missing. Payment system cannot initialize.');
}

// ─── Types ───────────────────────────────────────────────────────

export interface CheckoutItem {
  tierId: string;
  quantity: number;
}

export interface CheckoutParams {
  eventId: string;
  eventTitle: string;
  items: CheckoutItem[];
  userName: string;
  userEmail: string;
  userPhone?: string;
  promoCode?: string | null;
  promoterCode?: string | null;
  onStatusChange?: (status: CheckoutStatus) => void;
}

export type CheckoutStatus =
  | 'reserving'
  | 'initiating'
  | 'awaiting_payment'
  | 'verifying'
  | 'confirmed'
  | 'failed'
  | 'cancelled';

export interface CheckoutResult {
  success: boolean;
  orderId?: string;
  error?: string;
  requiresPayment?: boolean;
  premiumRequired?: boolean;
}

function premiumFeatureFromError(error: any): PremiumFeature {
  const feature = error?.details?.feature;
  if (feature === 'premiumOnlyEvent' || feature === 'earlyAccessDrop') return feature;
  return 'premiumOnlyEvent';
}

function matchesReservationSelection(
  reservation: { eventId: string; items: { tierId: string; quantity: number }[] } | null,
  params: CheckoutParams,
): boolean {
  if (!reservation || reservation.eventId !== params.eventId) {
    return false;
  }

  return JSON.stringify(reservation.items) === JSON.stringify(params.items);
}

function createCheckoutActionId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `mobile-checkout-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildPhaseIdempotencyKey(actionId: string, phase: string): string {
  return `${actionId}:${phase}`;
}

function buildVerifyIdempotencyKey(paymentId: string): string {
  return `verify:${paymentId}`;
}

async function refreshTicketWallet(): Promise<void> {
  try {
    await useTicketsStore.getState().fetchUserOrders('');
  } catch (error) {
    if (__DEV__) console.warn('[Checkout] Wallet refresh after checkout failed:', error);
  }
}

// ─── Main Checkout Flow ──────────────────────────────────────────

/**
 * Full checkout flow — mirrors the guest-portal CheckoutContainer.jsx exactly.
 *
 * 1. POST /api/checkout/reserve   → Lock inventory
 * 2. POST /api/checkout/initiate  → Create order + Razorpay order
 * 3. Razorpay native SDK          → Collect payment
 * 4. POST /api/checkout/verify    → Verify signature
 * 5. Webhook confirms in background (same as web)
 */
export async function processFullCheckout(params: CheckoutParams): Promise<CheckoutResult> {
  const { onStatusChange } = params;
  const checkoutActionId = createCheckoutActionId();

  try {
    // ── Step 1: Reserve Inventory ──
    onStatusChange?.('reserving');

    const cartState = useCartStore.getState();
    const existingReservation = cartState.pendingReservation;
    const canReuseReservation =
      Boolean(existingReservation) &&
      matchesReservationSelection(existingReservation, params) &&
      new Date(existingReservation!.expiresAt).getTime() > Date.now();

    const reservation = canReuseReservation
      ? {
          success: true,
          reservationId: existingReservation!.reservationId,
          items: existingReservation!.items,
          expiresAt: existingReservation!.expiresAt,
          expiresInSeconds: Math.max(
            0,
            Math.floor((new Date(existingReservation!.expiresAt).getTime() - Date.now()) / 1000),
          ),
        }
      : await reserveTickets(
          {
            eventId: params.eventId,
            items: params.items,
          },
          {
            headers: {
              'x-idempotency-key': buildPhaseIdempotencyKey(checkoutActionId, 'reserve'),
            },
          },
        );

    if (!reservation.success) {
      throw new Error('Failed to reserve tickets. They may no longer be available.');
    }

    useCartStore.getState().setPendingReservation({
      reservationId: reservation.reservationId,
      eventId: params.eventId,
      eventTitle: params.eventTitle,
      expiresAt: reservation.expiresAt,
      items: params.items,
      userName: params.userName,
      userEmail: params.userEmail,
      userPhone: params.userPhone,
      promoCode: params.promoCode,
      promoterCode: params.promoterCode,
    });

    // ── Step 2: Initiate Checkout (server creates order + Razorpay order) ──
    onStatusChange?.('initiating');

    const checkout = await initiateCheckout(
      {
        reservationId: reservation.reservationId,
        userName: params.userName,
        userEmail: params.userEmail,
        userPhone: params.userPhone,
        promoCode: params.promoCode,
        promoterCode: params.promoterCode,
      },
      {
        headers: {
          'x-idempotency-key': buildPhaseIdempotencyKey(checkoutActionId, 'initiate'),
        },
      },
    );

    if (!checkout.success) {
      if (
        String((checkout as any).error || '')
          .toLowerCase()
          .includes('expired')
      ) {
        useCartStore.getState().clearPendingReservation();
      }
      throw new Error('Failed to initiate checkout.');
    }

    // ── Step 3: Branch — Free vs Paid ──
    if (!checkout.requiresPayment) {
      // Free order — already confirmed server-side
      useCartStore.getState().clearPendingReservation();
      useCartStore.getState().setPendingPaymentOrderId(null);
      useCartStore.getState().clearCart();
      await refreshTicketWallet();
      onStatusChange?.('confirmed');
      return {
        success: true,
        orderId: checkout.order.id,
        requiresPayment: false,
      };
    }

    // ── Step 4: Open Razorpay Native SDK ──
    onStatusChange?.('awaiting_payment');

    // PERSIST FOR RECOVERY: Survives app kill mid-payment
    useCartStore.getState().setPendingPaymentOrderId(checkout.order.id);

    const paymentResult = await openNativeRazorpay({
      key: checkout.razorpay!.key || RAZORPAY_KEY,
      razorpayOrderId: checkout.razorpay!.orderId,
      amount: checkout.razorpay!.amount,
      currency: checkout.razorpay!.currency || 'INR',
      eventTitle: params.eventTitle,
      prefill: {
        name: params.userName,
        email: params.userEmail,
        contact: params.userPhone || '',
      },
    });

    if (!paymentResult.success) {
      onStatusChange?.('cancelled');
      return {
        success: false,
        orderId: checkout.order.id,
        requiresPayment: true,
        error: paymentResult.error || 'Payment was cancelled',
      };
    }

    // ── Step 5: Verify payment signature with backend ──
    onStatusChange?.('verifying');

    const verification = await verifyPayment(
      {
        orderId: checkout.order.id,
        razorpay_order_id: paymentResult.razorpay_order_id!,
        razorpay_payment_id: paymentResult.razorpay_payment_id!,
        razorpay_signature: paymentResult.razorpay_signature!,
      },
      {
        headers: {
          'x-idempotency-key': buildVerifyIdempotencyKey(paymentResult.razorpay_payment_id!),
        },
      },
    );

    if (!verification.success) {
      throw new Error(verification.error || 'Payment verification failed');
    }

    // SUCCESS: Clear recovery state and cart
    useCartStore.getState().clearPendingReservation();
    useCartStore.getState().setPendingPaymentOrderId(null);
    useCartStore.getState().clearCart();
    await refreshTicketWallet();

    onStatusChange?.('confirmed');
    return {
      success: true,
      orderId: checkout.order.id,
      requiresPayment: true,
    };
  } catch (error: any) {
    onStatusChange?.('failed');
    if (__DEV__) console.error('[Checkout] Error:', error);
    if (error.code === 'PREMIUM_REQUIRED') {
      useSubscriptionStore
        .getState()
        .openPaywall(premiumFeatureFromError(error), error.message || undefined);
      return {
        success: false,
        premiumRequired: true,
        error: error.message || 'C1RCLE Premium is required.',
      };
    }
    return {
      success: false,
      error: error.message || 'Something went wrong with the checkout',
    };
  }
}

// ─── Razorpay Native SDK Integration ─────────────────────────────
let razorpayCheckoutForTests: any | null = null;

export function __setRazorpayCheckoutForTests(checkout: any | null): void {
  if (__DEV__) {
    razorpayCheckoutForTests = checkout;
  }
}

interface RazorpayOptions {
  key?: string;
  razorpayOrderId: string;
  amount: number; // in paise
  currency: string;
  eventTitle: string;
  prefill: {
    name: string;
    email: string;
    contact: string;
  };
}

interface RazorpayResult {
  success: boolean;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  error?: string;
}

/**
 * Opens the native Razorpay checkout SDK.
 * In production, uses react-native-razorpay.
 * Falls back to a dev simulation in __DEV__ mode ONLY if the SDK is unavailable.
 */
async function openNativeRazorpay(options: RazorpayOptions): Promise<RazorpayResult> {
  try {
    // Attempt to use the native Razorpay SDK
    const RazorpayCheckout = await importRazorpaySDK();

    if (RazorpayCheckout) {
      const rzpOptions = {
        key: options.key || RAZORPAY_KEY,
        amount: options.amount,
        currency: options.currency,
        name: 'THE C1RCLE',
        description: `Passes for ${options.eventTitle}`,
        order_id: options.razorpayOrderId,
        prefill: options.prefill,
        theme: {
          color: '#1d1d1f',
        },
      };

      const response = await RazorpayCheckout.open(rzpOptions);

      return {
        success: true,
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      };
    }

    // SDK not available — development fallback
    if (__DEV__) {
      return devPaymentFallback(options);
    }

    throw new Error('Payment SDK not available. Please update the app.');
  } catch (error: any) {
    // Razorpay SDK throws on user cancellation
    if (
      error.code === 'PAYMENT_CANCELLED' ||
      error.description?.includes('cancelled') ||
      error.message?.includes('cancelled')
    ) {
      return { success: false, error: 'Payment cancelled by user' };
    }

    return {
      success: false,
      error: error.description || error.message || 'Payment failed',
    };
  }
}

/**
 * Dynamically import react-native-razorpay.
 * Returns null if not installed (e.g. in Expo Go).
 */
async function importRazorpaySDK(): Promise<any | null> {
  if (razorpayCheckoutForTests) return razorpayCheckoutForTests;

  try {
    const mod = await import('react-native-razorpay');
    return mod.default || mod;
  } catch {
    if (__DEV__) console.warn('[Payments] react-native-razorpay not available');
    return null;
  }
}

/**
 * Development-only fallback when native SDK is not available (e.g. Expo Go).
 * This ONLY works in __DEV__ mode and clearly labels itself as a simulation.
 */
function devPaymentFallback(options: RazorpayOptions): Promise<RazorpayResult> {
  return new Promise((resolve) => {
    Alert.alert(
      '🔧 DEV MODE — Payment Simulation',
      `Amount: ₹${(options.amount / 100).toFixed(0)}\nOrder: ${options.razorpayOrderId}\n\nThis is a DEVELOPMENT simulation. In production, the native Razorpay SDK opens here.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => resolve({ success: false, error: 'Payment cancelled' }),
        },
        {
          text: '✓ Simulate Success',
          onPress: () =>
            resolve({
              success: true,
              razorpay_order_id: options.razorpayOrderId,
              razorpay_payment_id: `pay_dev_${Date.now()}`,
              razorpay_signature: `sig_dev_${Date.now()}`,
            }),
        },
      ],
    );
  });
}

export { RAZORPAY_KEY };
