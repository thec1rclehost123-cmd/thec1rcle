import { NextResponse } from "next/server";
import {
    createRazorpayOrder,
    verifyPaymentSignature,
    getRazorpayClientConfig
} from "../../../lib/server/payments/razorpay";
import { getOrderById, confirmOrder } from "../../../lib/server/orderStore";
import { getAdminDb, isFirebaseConfigured } from "../../../lib/firebase/admin";
import { verifyAuth } from "../../../lib/server/auth";
import { generateOrderQRCodes } from "../../../lib/server/qrStore";

const PAYMENTS_COLLECTION = "payments";

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

        // Store payment initiation
        if (isFirebaseConfigured()) {
            const db = getAdminDb();
            await db.collection(PAYMENTS_COLLECTION).add({
                orderId,
                razorpayOrderId: razorpayOrder.id,
                amount: order.totalAmount,
                currency: order.currency || "INR",
                status: "initiated",
                userId: decodedToken.uid,
                createdAt: new Date().toISOString()
            });
        }

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

        // Verify signature
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

        // Get the order
        const order = await getOrderById(orderId);
        if (!order) {
            return NextResponse.json(
                { error: "Order not found" },
                { status: 404 }
            );
        }

        // Update payment record
        if (isFirebaseConfigured()) {
            const db = getAdminDb();
            const paymentQuery = await db.collection(PAYMENTS_COLLECTION)
                .where("orderId", "==", orderId)
                .where("razorpayOrderId", "==", razorpay_order_id)
                .limit(1)
                .get();

            if (!paymentQuery.empty) {
                await paymentQuery.docs[0].ref.update({
                    razorpayPaymentId: razorpay_payment_id,
                    razorpaySignature: razorpay_signature,
                    status: "verified",
                    verifiedAt: new Date().toISOString()
                });
            }
        }

        // Confirm the order
        const confirmedOrder = await confirmOrder(orderId, {
            paymentId: razorpay_payment_id,
            paymentMethod: "razorpay"
        });

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
