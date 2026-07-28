/**
 * THE C1RCLE - Mobile Payment Service
 * Uses the same backend APIs as the guest-portal website.
 * Flow: reserve → initiate → Razorpay SDK → verify → webhook confirms
 *
 * The mobile app NEVER creates orders client-side.
 * All pricing, order creation, and payment verification happens server-side.
 */

import { Alert, DeviceEventEmitter, NativeModules, TurboModuleRegistry } from 'react-native';
import { useCartStore } from '@/store/cartStore';
import { useTicketsStore } from '@/store/ticketsStore';
import { useSubscriptionStore, type PremiumFeature } from '@/store/subscriptionStore';
import {
  cancelOrder,
  cancelReservation,
  getOrder,
  reserveTickets,
  initiateCheckout,
  verifyPayment,
} from './api';
import { formatPaiseInr } from './money';
import { getFirebaseAuth } from './firebase';

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
  hostUpdatesOptIn?: boolean;
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
  cancelled?: boolean;
}

function premiumFeatureFromError(error: any): PremiumFeature {
  const feature = error?.details?.feature;
  if (feature === 'premiumOnlyEvent' || feature === 'earlyAccessDrop') return feature;
  return 'premiumOnlyEvent';
}

function sortItems(
  items: { tierId: string; quantity: number }[],
): { tierId: string; quantity: number }[] {
  return [...items].sort((a, b) => a.tierId.localeCompare(b.tierId));
}

function matchesReservationSelection(
  reservation: { eventId: string; items: { tierId: string; quantity: number }[] } | null,
  params: CheckoutParams,
): boolean {
  if (!reservation || reservation.eventId !== params.eventId) {
    return false;
  }

  return JSON.stringify(sortItems(reservation.items)) === JSON.stringify(sortItems(params.items));
}

function createCheckoutActionId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `mobile-checkout-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildPhaseIdempotencyKey(actionId: string, phase: string): string {
  return `${actionId}::${phase}`;
}

function buildVerifyIdempotencyKey(paymentId: string): string {
  return `verify:${paymentId}`;
}

async function refreshTicketWallet(): Promise<void> {
  try {
    const uid = getFirebaseAuth().currentUser?.uid;
    if (uid) {
      await useTicketsStore.getState().fetchUserOrders();
    }
  } catch (error) {
    if (__DEV__) console.warn('[Checkout] Wallet refresh after checkout failed:', error);
  }
}

async function refreshPostCheckoutState(): Promise<void> {
  await Promise.all([
    refreshTicketWallet(),
    getFirebaseAuth()
      .currentUser?.getIdToken(true)
      .then(() => undefined)
      .catch((error) => {
        if (__DEV__) console.warn('[Checkout] Token refresh after checkout failed:', error);
      }),
  ]);
}

function isConfirmedOrder(order: any): boolean {
  return ['confirmed', 'paid', 'completed'].includes(
    String(order?.normalizedStatus || order?.status || '').toLowerCase(),
  );
}

async function recoverConfirmedCheckout(orderId: string): Promise<boolean> {
  try {
    const order = await getOrder(orderId, { includeEvent: false });
    if (!isConfirmedOrder(order)) return false;

    useCartStore.getState().clearCart();
    await refreshPostCheckoutState();
    return true;
  } catch (error) {
    if (__DEV__) console.warn('[Checkout] Confirmed-order recovery failed:', error);
    return false;
  }
}

/**
 * Cleanup for an abandoned checkout. Local recovery state is cleared only
 * after the backend confirms cancellation, so a failed network request never
 * hides inventory that is still reserved server-side.
 */
export async function discardPendingCheckout(): Promise<void> {
  const cart = useCartStore.getState();
  const orderId = cart.pendingPaymentOrderId;
  const reservationId = cart.pendingReservation?.reservationId;

  if (orderId) {
    if (await recoverConfirmedCheckout(orderId)) return;

    const result = await cancelOrder(orderId);
    if (!result?.success) throw new Error('The pending order could not be cancelled.');
  } else if (reservationId) {
    try {
      const result = await cancelReservation(reservationId);
      if (!result?.success) throw new Error('The ticket reservation could not be released.');
    } catch (error: any) {
      // A persisted cart can outlive its owning Firebase session. The Gateway
      // must continue to deny cancellation, but that foreign or already-cleaned
      // reservation must not permanently block the current user from creating
      // a new authenticated hold.
      if (error?.status !== 403 && error?.status !== 404) throw error;
    }
  }

  useCartStore.getState().clearPendingReservation();
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

  // Verify auth before making any API calls
  const currentUser = getFirebaseAuth().currentUser;
  if (!currentUser?.uid) {
    onStatusChange?.('failed');
    return {
      success: false,
      error: 'You must be signed in to complete checkout.',
    };
  }

  try {
    // ── Step 1: Reserve Inventory ──
    onStatusChange?.('reserving');

    let cartState = useCartStore.getState();
    let existingReservation = cartState.pendingReservation;

    // A previous Razorpay attempt or expired hold must be cancelled before a
    // new reservation is made, otherwise its inventory can remain unavailable.
    if (
      cartState.pendingPaymentOrderId ||
      (existingReservation && new Date(existingReservation.expiresAt).getTime() <= Date.now())
    ) {
      await discardPendingCheckout();
      cartState = useCartStore.getState();
      existingReservation = cartState.pendingReservation;
    }
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
        hostUpdatesOptIn: params.hostUpdatesOptIn === true,
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
      await refreshPostCheckoutState();
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

    const razorpayAmountPaise =
      checkout.razorpay!.amountPaise ?? Math.round(Number(checkout.razorpay!.amount || 0) * 100);
    if (!Number.isSafeInteger(razorpayAmountPaise) || razorpayAmountPaise <= 0) {
      throw new Error('The payment amount is invalid. Please restart checkout.');
    }

    const paymentResult = await openNativeRazorpay({
      key: checkout.razorpay!.key || RAZORPAY_KEY,
      razorpayOrderId: checkout.razorpay!.orderId,
      amount: razorpayAmountPaise,
      currency: checkout.razorpay!.currency || 'INR',
      eventTitle: params.eventTitle,
      prefill: {
        name: params.userName,
        email: params.userEmail,
        contact: params.userPhone || '',
      },
    });

    if (!paymentResult.success) {
      await discardPendingCheckout();
      onStatusChange?.(paymentResult.cancelled ? 'cancelled' : 'failed');
      return {
        success: false,
        orderId: checkout.order.id,
        requiresPayment: true,
        cancelled: Boolean(paymentResult.cancelled),
        error: paymentResult.error || 'Payment was cancelled',
      };
    }

    // ── Step 5: Verify payment signature with backend ──
    onStatusChange?.('verifying');

    let verification;
    try {
      verification = await verifyPayment(
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
    } catch (error) {
      if (await recoverConfirmedCheckout(checkout.order.id)) {
        onStatusChange?.('confirmed');
        return {
          success: true,
          orderId: checkout.order.id,
          requiresPayment: true,
        };
      }
      throw error;
    }

    if (!verification.success) {
      if (await recoverConfirmedCheckout(checkout.order.id)) {
        onStatusChange?.('confirmed');
        return {
          success: true,
          orderId: checkout.order.id,
          requiresPayment: true,
        };
      }
      throw new Error(verification.error || 'Payment verification failed');
    }

    // SUCCESS: Clear recovery state and cart
    useCartStore.getState().clearPendingReservation();
    useCartStore.getState().setPendingPaymentOrderId(null);
    useCartStore.getState().clearCart();
    await refreshPostCheckoutState();

    onStatusChange?.('confirmed');
    return {
      success: true,
      orderId: checkout.order.id,
      requiresPayment: true,
    };
  } catch (error: any) {
    if (
      String(error?.message || '')
        .toLowerCase()
        .includes('expired')
    ) {
      await discardPendingCheckout();
    }
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
  cancelled?: boolean;
}

/**
 * Opens the native Razorpay checkout SDK.
 * In production, uses react-native-razorpay.
 * Falls back to a dev simulation in __DEV__ mode ONLY if the SDK is unavailable.
 */
async function openNativeRazorpay(options: RazorpayOptions): Promise<RazorpayResult> {
  try {
    if (__DEV__ && options.razorpayOrderId.startsWith('order_mock_')) {
      return devPaymentFallback(options);
    }

    const RazorpayCheckout = getRazorpaySDK();

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
      error.code === 0 ||
      String(error.description || '')
        .toLowerCase()
        .includes('cancelled') ||
      String(error.message || '')
        .toLowerCase()
        .includes('cancelled')
    ) {
      return { success: false, cancelled: true, error: 'Payment cancelled by user' };
    }

    return {
      success: false,
      error: error.description || error.message || 'Payment failed',
    };
  }
}

/**
 * Resolve the native module directly. react-native-razorpay 3.0.0's JS wrapper
 * requires a RazorpayEventEmitter TurboModule that its Android package does not
 * register, while the linked native checkout correctly emits DeviceEventEmitter
 * events. Keeping this adapter app-owned avoids silently falling back to a fake
 * payment on bridgeless React Native builds.
 */
function getRazorpaySDK(): any | null {
  if (razorpayCheckoutForTests) return razorpayCheckoutForTests;

  try {
    const nativeModule =
      TurboModuleRegistry.get<any>('RNRazorpayCheckout') ?? NativeModules.RNRazorpayCheckout;
    if (!nativeModule?.open) return null;

    return {
      open(options: Record<string, unknown>) {
        return new Promise((resolve, reject) => {
          let successSubscription: { remove: () => void } | null = null;
          let errorSubscription: { remove: () => void } | null = null;
          const cleanup = () => {
            successSubscription?.remove();
            errorSubscription?.remove();
          };

          successSubscription = DeviceEventEmitter.addListener(
            'Razorpay::PAYMENT_SUCCESS',
            (response) => {
              cleanup();
              resolve(response);
            },
          );
          errorSubscription = DeviceEventEmitter.addListener('Razorpay::PAYMENT_ERROR', (error) => {
            cleanup();
            reject(error);
          });

          try {
            nativeModule.open(options);
          } catch (error) {
            cleanup();
            reject(error);
          }
        });
      },
    };
  } catch (error) {
    if (__DEV__) console.warn('[Payments] Native Razorpay module unavailable:', error);
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
      `Amount: ${formatPaiseInr(options.amount)}\nOrder: ${options.razorpayOrderId}\n\nThis is a DEVELOPMENT simulation. In production, the native Razorpay SDK opens here.`,
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
