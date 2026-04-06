import { NextResponse } from "next/server";
import {
    createRazorpayOrder,
    verifyPaymentSignature,
    fetchPayment,
    getRazorpayClientConfig,
    isRazorpayConfigured
} from "../../../lib/server/payments/razorpay";
import { getOrderById, confirmOrder } from "../../../lib/server/orderStore";
import { invalidateTicketsCache } from "../../../lib/server/profileStore";
import { verifyAuth } from "../../../lib/server/auth";
import { generateOrderQRCodes } from "../../../lib/server/qrStore";
import { isUserBlocked } from "@c1rcle/core/security-state";
import { logPaymentEvent, getRequestId } from "@/lib/server/logger";

const PAYMENTS_COLLECTION = "payments";

/**
 * Extract real client IP — x-real-ip first (not user-controllable), then rightmost XFF.
 */
function getClientIp(request) {
    const realIp = request.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        const ips = forwarded.split(",").map(s => s.trim()).filter(Boolean);
        if (ips.length) return ips[ips.length - 1];
    }
    return "unknown";
}

/**
 * GET /api/payments
 * Get Razorpay client configuration
 */
export async function GET(request) {
    try {
        const config = getRazorpayClientConfig();
        return NextResponse.json({ config });
    } catch (error) {
        console.error("[Payments API] GET Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to get payment config" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/payments
 * Create a Razorpay order for payment
 */
export async function POST(request) {
    try {
        const decodedToken = await verifyAuth(request);
        if (!decodedToken) {
            return NextResponse.json(
                { error: "Authentication required" },
                { status: 401 }
            );
        }

        // Active defense: block users flagged for payment fraud before any Razorpay call
        const userStatus = await isUserBlocked(decodedToken.uid);
        if (userStatus.blocked) {
            logPaymentEvent("BLOCKED_USER_PAYMENT_ATTEMPT", {
                requestId: getRequestId(request),
                uid: decodedToken.uid,
                ip: getClientIp(request),
                reason: userStatus.reason,
            });
            return NextResponse.json(
                { error: "Payment temporarily unavailable. Please contact support." },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { orderId } = body;

        if (!orderId) {
            return NextResponse.json(
                { error: "orderId is required" },
                { status: 400 }
            );
        }

        // Get the order
        const order = await getOrderById(orderId);
        if (!order) {
            return NextResponse.json(
                { error: "Order not found" },
                { status: 404 }
            );
        }

        // Verify order belongs to user
        if (order.userId !== decodedToken.uid) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 403 }
            );
        }

        // Check order status
        if (order.status !== "pending_payment") {
            return NextResponse.json(
                { error: `Order is ${order.status}, not pending payment` },
                { status: 400 }
            );
        }

        // Create Razorpay order
        const razorpayOrder = await createRazorpayOrder({
            amount: Math.round(order.totalAmount * 100), // Convert to paise
            currency: order.currency || "INR",
            receipt: orderId,
            notes: {
                orderId,
                eventId: order.eventId,
                userId: decodedToken.uid
            }
        });

        return NextResponse.json({
            razorpayOrderId: razorpayOrder.id,
            amount: order.totalAmount,
            currency: order.currency || "INR",
            config: getRazorpayClientConfig()
        });
    } catch (error) {
        console.error("[Payments API] POST Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to create payment" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/payments
 * Verify payment and confirm order
 */
export async function PATCH(request) {
    try {
        const decodedToken = await verifyAuth(request);
        if (!decodedToken) {
            return NextResponse.json(
                { error: "Authentication required" },
                { status: 401 }
            );
        }

        const body = await request.json();
        const {
            orderId,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = body;

        if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return NextResponse.json(
                { error: "Missing payment verification data" },
                { status: 400 }
            );
        }

        // Step 1: Verify HMAC signature (prevents tampered payload from client)
        const isValid = verifyPaymentSignature({
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        });

        if (!isValid) {
            console.error("[Payments API] Invalid signature for order:", orderId);
            return NextResponse.json(
                { error: "Payment verification failed" },
                { status: 400 }
            );
        }

        // Step 2: Fetch payment directly from Razorpay API to verify status and amount
        // This prevents replay attacks where a valid signature is reused with a different order
        let rzpPayment;
        try {
            rzpPayment = await fetchPayment(razorpay_payment_id);
        } catch (err) {
            console.error("[Payments API] Failed to fetch payment from Razorpay:", err.message);
            return NextResponse.json(
                { error: "Could not verify payment with gateway" },
                { status: 502 }
            );
        }

        if (rzpPayment.status !== "captured") {
            console.error("[Payments API] Payment not captured. Status:", rzpPayment.status);
            return NextResponse.json(
                { error: "Payment not captured" },
                { status: 400 }
            );
        }

        // Skip Razorpay-specific cross-checks in dev mock mode (no real payment was made)
        const isMockPayment = !isRazorpayConfigured();

        if (!isMockPayment && rzpPayment.order_id !== razorpay_order_id) {
            console.error("[Payments API] Razorpay order_id mismatch");
            return NextResponse.json(
                { error: "Payment verification failed" },
                { status: 400 }
            );
        }

        // Step 3: Get our order and verify ownership + amount
        const order = await getOrderById(orderId);
        if (!order) {
            return NextResponse.json(
                { error: "Order not found" },
                { status: 404 }
            );
        }

        if (order.userId !== decodedToken.uid) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 403 }
            );
        }

        // Verify amount paid matches order total — skip in dev mock mode
        if (!isMockPayment) {
            const expectedPaise = Math.round(order.totalAmount * 100);
            if (rzpPayment.amount !== expectedPaise) {
                console.error(`[Payments API] Amount mismatch: expected ${expectedPaise} paise, got ${rzpPayment.amount}`);
                return NextResponse.json(
                    { error: "Payment amount mismatch" },
                    { status: 400 }
                );
            }
        }

        // Step 4: Confirm the order
        const confirmedOrder = await confirmOrder(orderId, {
            paymentId: razorpay_payment_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpayOrderId: razorpay_order_id,
            razorpaySignature: razorpay_signature,
            provider: "razorpay",
            paymentMethod: rzpPayment.method || "razorpay",
            paidAt: new Date().toISOString()
        });

        // Bust tickets cache so the tab reflects the new ticket immediately
        invalidateTicketsCache(decodedToken.uid).catch(() => {});

        return NextResponse.json({
            success: true,
            order: confirmedOrder,
            message: "Payment verified and order confirmed!"
        });
    } catch (error) {
        console.error("[Payments API] PATCH Error:", error);
        return NextResponse.json(
            { error: error.message || "Payment verification failed" },
            { status: 500 }
        );
    }
}
