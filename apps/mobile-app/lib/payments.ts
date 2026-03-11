/**
 * THE C1RCLE - Mobile Payment Service
 * Uses the same backend APIs as the guest-portal website.
 * Flow: reserve → initiate → Razorpay SDK → verify → webhook confirms
 *
 * The mobile app NEVER creates orders client-side.
 * All pricing, order creation, and payment verification happens server-side.
 */

import { Alert, Platform } from "react-native";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import {
    reserveTickets,
    initiateCheckout,
    verifyPayment,
    cancelOrder,
    type ReserveResponse,
    type InitiateCheckoutResponse,
} from "./api";

// Razorpay key for the frontend SDK (public key only — secret stays on server)
const RAZORPAY_KEY = process.env.EXPO_PUBLIC_RAZORPAY_KEY;

if (!RAZORPAY_KEY && !__DEV__) {
    throw new Error("EXPO_PUBLIC_RAZORPAY_KEY is missing. Payment system cannot initialize.");
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
    | "reserving"
    | "initiating"
    | "awaiting_payment"
    | "verifying"
    | "confirmed"
    | "failed"
    | "cancelled";

export interface CheckoutResult {
    success: boolean;
    orderId?: string;
    error?: string;
    requiresPayment?: boolean;
}

// ─── Main Checkout Flow ──────────────────────────────────────────

/**
 * Full checkout flow — mirrors the guest-portal CheckoutContainer.jsx exactly.
 *
 * 1. POST /api/checkout/reserve   → Lock inventory
 * 2. POST /api/checkout/initiate  → Create order + Razorpay order
 * 3. Razorpay native SDK          → Collect payment
 * 4. PATCH /api/payments          → Verify signature
 * 5. Webhook confirms in background (same as web)
 */
export async function processFullCheckout(
    params: CheckoutParams
): Promise<CheckoutResult> {
    const { onStatusChange } = params;

    try {
        // ── Step 1: Reserve Inventory ──
        onStatusChange?.("reserving");

        const reservation = await reserveTickets({
            eventId: params.eventId,
            items: params.items,
        });

        if (!reservation.success) {
            throw new Error("Failed to reserve tickets. They may no longer be available.");
        }

        // ── Step 2: Initiate Checkout (server creates order + Razorpay order) ──
        onStatusChange?.("initiating");

        const checkout = await initiateCheckout({
            reservationId: reservation.reservationId,
            userName: params.userName,
            userEmail: params.userEmail,
            userPhone: params.userPhone,
            promoCode: params.promoCode,
            promoterCode: params.promoterCode,
        });

        if (!checkout.success) {
            throw new Error("Failed to initiate checkout.");
        }

        // ── Step 3: Branch — Free vs Paid ──
        if (!checkout.requiresPayment) {
            // Free order — already confirmed server-side
            onStatusChange?.("confirmed");
            return {
                success: true,
                orderId: checkout.order.id,
                requiresPayment: false,
            };
        }

        // ── Step 4: Open Razorpay Native SDK ──
        onStatusChange?.("awaiting_payment");

        // PERSIST FOR RECOVERY: Survives app kill mid-payment
        useCartStore.getState().setPendingPaymentOrderId(checkout.order.id);

        const paymentResult = await openNativeRazorpay({
            razorpayOrderId: checkout.razorpay!.orderId,
            amount: checkout.razorpay!.amount,
            currency: checkout.razorpay!.currency || "INR",
            eventTitle: params.eventTitle,
            prefill: {
                name: params.userName,
                email: params.userEmail,
                contact: params.userPhone || "",
            },
        });

        if (!paymentResult.success) {
            // User cancelled or payment failed — clear recovery & release inventory
            useCartStore.getState().setPendingPaymentOrderId(null);
            try {
                await cancelOrder(checkout.order.id);
            } catch (e) {
                console.error("[Checkout] Failed to cancel order after payment failure:", e);
            }
            onStatusChange?.("cancelled");
            return {
                success: false,
                error: paymentResult.error || "Payment was cancelled",
            };
        }

        // ── Step 5: Verify payment signature with backend ──
        onStatusChange?.("verifying");

        const verification = await verifyPayment({
            orderId: checkout.order.id,
            razorpay_order_id: paymentResult.razorpay_order_id!,
            razorpay_payment_id: paymentResult.razorpay_payment_id!,
            razorpay_signature: paymentResult.razorpay_signature!,
        });

        if (!verification.success) {
            throw new Error(verification.error || "Payment verification failed");
        }

        // SUCCESS: Clear recovery state and cart
        useCartStore.getState().setPendingPaymentOrderId(null);
        useCartStore.getState().clearCart();

        onStatusChange?.("confirmed");
        return {
            success: true,
            orderId: checkout.order.id,
            requiresPayment: true,
        };

    } catch (error: any) {
        onStatusChange?.("failed");
        console.error("[Checkout] Error:", error);
        return {
            success: false,
            error: error.message || "Something went wrong with the checkout",
        };
    }
}

// ─── Razorpay Native SDK Integration ─────────────────────────────

interface RazorpayOptions {
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
                key: RAZORPAY_KEY,
                amount: options.amount,
                currency: options.currency,
                name: "THE C1RCLE",
                description: `Passes for ${options.eventTitle}`,
                order_id: options.razorpayOrderId,
                prefill: options.prefill,
                theme: {
                    color: "#1d1d1f",
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

        throw new Error("Payment SDK not available. Please update the app.");

    } catch (error: any) {
        // Razorpay SDK throws on user cancellation
        if (
            error.code === "PAYMENT_CANCELLED" ||
            error.description?.includes("cancelled") ||
            error.message?.includes("cancelled")
        ) {
            return { success: false, error: "Payment cancelled by user" };
        }

        return {
            success: false,
            error: error.description || error.message || "Payment failed",
        };
    }
}

/**
 * Dynamically import react-native-razorpay.
 * Returns null if not installed (e.g. in Expo Go).
 */
async function importRazorpaySDK(): Promise<any | null> {
    try {
        const mod = await import("react-native-razorpay");
        return mod.default || mod;
    } catch {
        console.warn("[Payments] react-native-razorpay not available");
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
            "🔧 DEV MODE — Payment Simulation",
            `Amount: ₹${(options.amount / 100).toFixed(0)}\nOrder: ${options.razorpayOrderId}\n\nThis is a DEVELOPMENT simulation. In production, the native Razorpay SDK opens here.`,
            [
                {
                    text: "Cancel",
                    style: "cancel",
                    onPress: () => resolve({ success: false, error: "Payment cancelled" }),
                },
                {
                    text: "✓ Simulate Success",
                    onPress: () =>
                        resolve({
                            success: true,
                            razorpay_order_id: options.razorpayOrderId,
                            razorpay_payment_id: `pay_dev_${Date.now()}`,
                            razorpay_signature: `sig_dev_${Date.now()}`,
                        }),
                },
            ]
        );
    });
}

export { RAZORPAY_KEY };
