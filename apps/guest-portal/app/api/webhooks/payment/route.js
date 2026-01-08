/**
 * THE C1RCLE - Razorpay Payment Webhook (Phase 1)
 * Source of truth for payment confirmation
 * Idempotent: Same payment ID = same result
 */

import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { confirmOrder, getOrderById, updateOrderStatus } from "@/lib/server/orderStore";
import { getEvent } from "@/lib/server/eventStore";
import { sendTicketEmail } from "@/lib/email";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";

// Collection to track processed webhooks (idempotency)
const WEBHOOK_LOGS_COLLECTION = "payment_webhook_logs";
const fallbackWebhookLogs = new Map();

// Verify Razorpay webhook signature
function verifyWebhookSignature(body, signature, secret) {
    if (!secret) {
        console.warn('[Webhook] No secret configured, skipping signature verification');
        return true; // Allow in development
    }

    const expectedSignature = createHmac('sha256', secret)
        .update(body)
        .digest('hex');

    return expectedSignature === signature;
}

// Check if webhook was already processed (idempotency)
async function wasWebhookProcessed(paymentId) {
    if (!isFirebaseConfigured()) {
        return fallbackWebhookLogs.has(paymentId);
    }

    const db = getAdminDb();
    const doc = await db.collection(WEBHOOK_LOGS_COLLECTION).doc(paymentId).get();
    return doc.exists;
}

// Log webhook processing (idempotency)
async function logWebhookProcessed(paymentId, orderId, status) {
    const logEntry = {
        paymentId,
        orderId,
        status,
        processedAt: new Date().toISOString()
    };

    if (!isFirebaseConfigured()) {
        fallbackWebhookLogs.set(paymentId, logEntry);
        return;
    }

    const db = getAdminDb();
    await db.collection(WEBHOOK_LOGS_COLLECTION).doc(paymentId).set(logEntry);
}

export async function POST(request) {
    let rawBody;

    try {
        // Get raw body for signature verification
        rawBody = await request.text();
        const payload = JSON.parse(rawBody);

        // Verify signature in production
        const signature = request.headers.get("x-razorpay-signature");
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

        if (process.env.NODE_ENV === 'production' && webhookSecret) {
            if (!signature || !verifyWebhookSignature(rawBody, signature, webhookSecret)) {
                console.error('[Webhook] Invalid signature');
                return NextResponse.json(
                    { error: "Invalid signature" },
                    { status: 401 }
                );
            }
        }

        // Parse event type
        const eventType = payload.event || payload.type;
        console.log(`[Webhook] Received event: ${eventType}`);

        // Handle payment.captured event
        if (eventType === "payment.captured" || eventType === "payment_success") {
            const paymentEntity = payload.payload?.payment?.entity || payload;
            const paymentId = paymentEntity.id || payload.paymentId;
            const orderId = paymentEntity.notes?.orderId || payload.orderId;

            if (!paymentId || !orderId) {
                console.error('[Webhook] Missing paymentId or orderId');
                return NextResponse.json(
                    { error: "Missing paymentId or orderId" },
                    { status: 400 }
                );
            }

            console.log(`[Webhook] Processing payment ${paymentId} for order ${orderId}`);

            // Check idempotency - was this payment already processed?
            if (await wasWebhookProcessed(paymentId)) {
                console.log(`[Webhook] Payment ${paymentId} already processed, skipping`);
                return NextResponse.json({
                    status: "already_processed",
                    message: "This payment was already processed"
                });
            }

            // Get order and verify status
            const order = await getOrderById(orderId);

            if (!order) {
                console.error(`[Webhook] Order ${orderId} not found`);
                return NextResponse.json(
                    { error: "Order not found" },
                    { status: 404 }
                );
            }

            // Skip if already confirmed
            if (order.status === 'confirmed' || order.status === 'checked_in') {
                console.log(`[Webhook] Order ${orderId} already confirmed, skipping`);
                await logWebhookProcessed(paymentId, orderId, 'already_confirmed');
                return NextResponse.json({
                    status: "already_confirmed",
                    message: "Order was already confirmed"
                });
            }

            // Confirm the order (this generates QR codes and handles promoter tracking)
            const paymentDetails = {
                razorpayPaymentId: paymentId,
                razorpayOrderId: paymentEntity.order_id,
                provider: "razorpay",
                method: paymentEntity.method,
                amount: paymentEntity.amount / 100, // Convert from paise
                paidAt: new Date().toISOString()
            };

            const confirmedOrder = await confirmOrder(orderId, paymentDetails);

            if (!confirmedOrder) {
                console.error(`[Webhook] Failed to confirm order ${orderId}`);
                return NextResponse.json(
                    { error: "Failed to confirm order" },
                    { status: 500 }
                );
            }

            // Log successful processing (idempotency)
            await logWebhookProcessed(paymentId, orderId, 'confirmed');

            // Send confirmation email
            try {
                const eventDetails = await getEvent(order.eventId);

                if (eventDetails && order.userEmail) {
                    const origin = new URL(request.url).origin;
                    const posterUrl = eventDetails.image?.startsWith('http')
                        ? eventDetails.image
                        : `${origin}${eventDetails.image || '/placeholder.jpg'}`;

                    await sendTicketEmail({
                        to: order.userEmail,
                        userName: order.userName || "Guest",
                        eventName: eventDetails.title,
                        eventDate: new Date(eventDetails.startDate).toLocaleDateString('en-IN', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: 'numeric',
                            timeZone: 'Asia/Kolkata'
                        }),
                        eventLocation: eventDetails.location,
                        eventPosterUrl: posterUrl,
                        orderId: order.id,
                        tickets: order.tickets,
                        totalAmount: order.totalAmount
                    });

                    console.log(`[Webhook] Email sent for order ${orderId}`);
                }
            } catch (emailError) {
                // Don't fail webhook for email errors
                console.error(`[Webhook] Email failed for order ${orderId}:`, emailError.message);
            }

            console.log(`[Webhook] Successfully processed payment ${paymentId} for order ${orderId}`);

            return NextResponse.json({
                status: "success",
                message: "Order confirmed",
                orderId
            });
        }

        // Handle payment.failed event
        if (eventType === "payment.failed") {
            const paymentEntity = payload.payload?.payment?.entity || payload;
            const orderId = paymentEntity.notes?.orderId || payload.orderId;

            if (orderId) {
                console.log(`[Webhook] Payment failed for order ${orderId}`);

                // Update order status back to reserved (user can retry)
                await updateOrderStatus(orderId, 'reserved', {
                    paymentFailedAt: new Date().toISOString(),
                    failureReason: paymentEntity.error_description || 'Payment failed'
                });
            }

            return NextResponse.json({
                status: "handled",
                message: "Payment failure recorded"
            });
        }

        // Handle refund events
        if (eventType === "refund.processed" || eventType === "refund.created") {
            const refundEntity = payload.payload?.refund?.entity || payload;
            const paymentId = refundEntity.payment_id;

            console.log(`[Webhook] Refund processed for payment ${paymentId}`);

            // Refund handling is managed by refundService
            // This hook is for logging only

            return NextResponse.json({
                status: "handled",
                message: "Refund event logged"
            });
        }

        // Unhandled event type
        console.log(`[Webhook] Ignoring event type: ${eventType}`);
        return NextResponse.json({
            status: "ignored",
            message: `Event type '${eventType}' not handled`
        });

    } catch (error) {
        console.error("[Webhook] Error:", error);

        // Return 200 even on error to prevent Razorpay from retrying
        // Log the error for investigation
        return NextResponse.json({
            status: "error",
            message: error.message
        }, { status: 200 }); // Return 200 to acknowledge receipt
    }
}
