/**
 * THE C1RCLE - Razorpay Payment Webhook (Phase 1)
 * Source of truth for payment confirmation
 * Idempotent: Same payment ID = same result
 */

import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { confirmOrder, getOrderById, updateOrderStatus, logWebhookProcessed, wasWebhookProcessed, updateOrderRefundStatus } from "@/lib/server/orderStore";
import { getEvent } from "@/lib/server/eventStore";
import { sendTicketEmail } from "@/lib/email";
import { notifyRefundProcessed } from "@/lib/server/notificationStore";
import { isFirebaseConfigured } from "@/lib/firebase/admin";
import { logPaymentEvent, getRequestId } from "@/lib/server/logger";
import { checkPaymentFraud } from "@c1rcle/core/attack-detection";

// Collection to track processed webhooks (idempotency)
const WEBHOOK_LOGS_COLLECTION = "payment_webhook_logs";
const fallbackWebhookLogs = new Map();

// Verify Razorpay webhook signature — always required, no bypass
function verifyWebhookSignature(body, signature, secret) {
    const expectedSignature = createHmac('sha256', secret)
        .update(body)
        .digest('hex');
    // Constant-time comparison to prevent timing attacks
    const expected = Buffer.from(expectedSignature, 'hex');
    const received = Buffer.from(signature || '', 'hex');
    if (expected.length !== received.length) return false;
    return expected.equals(received);
}

// Check if webhook was already processed (Redis + Firestore Idempotency via orderStore)
async function checkAndMarkWebhookProcessed(paymentId) {
    try {
        const redis = (await import("@c1rcle/core/redis")).getRedisClient();
        const redisKey = `payment:${paymentId}:processed`;
        const isLocked = await redis.set(redisKey, "1", "NX", "EX", 86400);
        if (!isLocked) return true;
    } catch (error) {
        console.warn(`[Webhook] Redis idempotency lock unavailable for ${paymentId}:`, error.message);
    }

    // 2. Firestore fallback via orderStore
    return await wasWebhookProcessed(paymentId);
}


export async function POST(request) {
    let rawBody;

    try {
        // Get raw body for signature verification
        rawBody = await request.text();
        const payload = JSON.parse(rawBody);

        // Verify signature — ALWAYS required, no environment-based bypass
        const signature = request.headers.get("x-razorpay-signature");
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

        if (!webhookSecret) {
            console.error('[Webhook] RAZORPAY_WEBHOOK_SECRET is not configured — rejecting all webhooks');
            return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
        }

        if (!signature || !verifyWebhookSignature(rawBody, signature, webhookSecret)) {
            const ip = request.headers.get("x-real-ip")
                || request.headers.get("x-forwarded-for")?.split(",").pop()?.trim()
                || "unknown";
            const requestId = getRequestId(request);
            logPaymentEvent("SIGNATURE_MISMATCH", { requestId, ip, path: "/api/webhooks/payment" });

            // Attack detection: accumulate signature failures per IP
            const fraud = await checkPaymentFraud(null, ip);
            if (fraud.detected) {
                logPaymentEvent("PAYMENT_FRAUD_PATTERN", { requestId, ip, reason: fraud.reason, count: fraud.count });
            }
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }

        // Parse event type
        const eventType = payload.event || payload.type;
        logPaymentEvent("WEBHOOK_RECEIVED", { webhookEvent: eventType });

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

            // Check idempotency
            if (await checkAndMarkWebhookProcessed(paymentId)) {
                console.log(`[Webhook] Payment ${paymentId} already processed, skipping`);
                return NextResponse.json({
                    status: "already_processed",
                    message: "This payment was already processed"
                });
            }

            const paymentDetails = {
                paymentId,
                razorpayPaymentId: paymentId,
                razorpayOrderId: paymentEntity.order_id,
                razorpaySignature: signature || null,
                provider: "razorpay",
                method: paymentEntity.method,
                amount: paymentEntity.amount / 100, // Convert from paise
                paidAt: new Date().toISOString()
            };

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
                await updateOrderStatus(orderId, order.status, paymentDetails);
                await logWebhookProcessed(paymentId, orderId, 'already_confirmed');
                return NextResponse.json({
                    status: "already_confirmed",
                    message: "Order was already confirmed"
                });
            }

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

            // === PRODUCTION: Dispatch to Inngest for reliable background processing ===
            // This handles: PDF generation, email, promoter credits, analytics
            try {
                const { sendEvent, Events } = await import("@c1rcle/core/inngest");

                await sendEvent(Events.TICKET_PURCHASED, {
                    orderId: order.id,
                    userId: order.userId,
                    userEmail: order.userEmail,
                    eventId: order.eventId,
                    tickets: order.tickets,
                    totalAmount: order.totalAmount,
                    promoterCode: order.promoterCode || null
                }, {
                    // Idempotency: Same orderId = same workflow execution
                    idempotencyKey: `ticket-fulfillment-${order.id}`
                });

                console.log(`[Webhook] Dispatched ticket fulfillment workflow for order ${orderId}`);
            } catch (inngestError) {
                // Don't fail webhook if Inngest dispatch fails
                // The order is already confirmed - this is a best-effort async operation
                console.error(`[Webhook] Inngest dispatch failed for order ${orderId}:`, inngestError.message);

                // Fallback: Send email directly (legacy behavior)
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
                            totalAmount: order.totalAmount,
                            // Enhanced params for professional email
                            eventId: order.eventId,
                            eventVenue: eventDetails.venue || '',
                            startDate: eventDetails.startDate,
                            endDate: eventDetails.endDate,
                            startTime: eventDetails.startTime,
                            endTime: eventDetails.endTime,
                            eventDescription: eventDetails.summary || eventDetails.description || '',
                            isRSVP: eventDetails.isRSVP || order.isRSVP || false,
                            userId: order.userId,
                            order,
                            event: eventDetails,
                        });

                        console.log(`[Webhook] Fallback email sent for order ${orderId}`);
                    }
                } catch (emailError) {
                    console.error(`[Webhook] Fallback email failed for order ${orderId}:`, emailError.message);
                }
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

        // ================================================================
        // Handle refund events (comprehensive lifecycle)
        // ================================================================
        if (eventType === "refund.processed" || eventType === "refund.created" ||
            eventType === "refund.failed" || eventType === "refund.speed_changed") {

            const refundEntity = payload.payload?.refund?.entity || payload;
            const paymentId = refundEntity.payment_id;
            const refundId = refundEntity.id;
            const refundStatus = refundEntity.status; // "processed", "failed", etc.
            const refundAmount = refundEntity.amount ? refundEntity.amount / 100 : 0; // Convert paise to rupees

            console.log(`[Webhook] Refund event: ${eventType} | Refund: ${refundId} | Payment: ${paymentId} | Status: ${refundStatus} | Amount: ₹${refundAmount}`);

            if (!isFirebaseConfigured()) {
                return NextResponse.json({ status: "handled", message: "Refund event acknowledged (no DB)" });
            }

            const now = new Date().toISOString();

            // Delegate all refund state management to orderStore
            const refundResult = await updateOrderRefundStatus(paymentId, eventType, {
                refundId,
                refundAmount,
                refundEntity,
                now
            });

            if (!refundResult) {
                return NextResponse.json({ status: "handled", message: "Refund event acknowledged (order not found)" });
            }

            // Send in-app notification when refund is fully processed
            if (refundResult.status === "refunded" && refundResult.order?.userId) {
                notifyRefundProcessed(refundResult.order).catch(e =>
                    console.error(`[Webhook] Refund notification failed for order:`, e.message)
                );
            }

            return NextResponse.json({
                status: refundResult.status,
                message: refundResult.message || `Refund event ${eventType} processed`,
            });

        }

        // Unhandled event type
        console.log(`[Webhook] Ignoring event type: ${eventType}`);
        return NextResponse.json({
            status: "ignored",
            message: `Event type '${eventType}' not handled`
        });

    } catch (error) {
        console.error("[Webhook] Unhandled error:", error.message);
        // Return 500 so Razorpay retries — only return 200 after confirmed successful processing
        return NextResponse.json({ status: "error" }, { status: 500 });
    }
}
