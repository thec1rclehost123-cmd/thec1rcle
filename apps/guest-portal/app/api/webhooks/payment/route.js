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

// Check if webhook was already processed (Redis + Firestore Idempotency)
async function wasWebhookProcessed(paymentId) {
    // 1. Check Redis first (Fast path - prevents duplicate calls within a window)
    const redis = (await import("@c1rcle/core/redis")).getRedisClient();
    const redisKey = `payment:${paymentId}:processed`;
    const isLocked = await redis.set(redisKey, "1", "NX", "EX", 86400); // 24h safety

    // If we couldn't set the key, it means it's already in Redis (processed or processing)
    if (!isLocked) {
        return true;
    }

    // 2. Double-check Firestore (Persistence path)
    if (!isFirebaseConfigured()) {
        return fallbackWebhookLogs.has(paymentId);
    }

    const db = getAdminDb();
    const doc = await db.collection(WEBHOOK_LOGS_COLLECTION).doc(paymentId).get();

    // If it exists in Firestore but not Redis (e.g. Redis restart), we're still safe
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
                    promoterCode: order.promoCode || null
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

            const db = getAdminDb();

            // Find the associated order
            const orderSnapshot = await db.collection("orders")
                .where("payment.razorpayPaymentId", "==", paymentId)
                .limit(1)
                .get();

            // Also check alternate field path
            let orderId = null;
            let orderDoc = null;

            if (!orderSnapshot.empty) {
                orderDoc = orderSnapshot.docs[0];
                orderId = orderDoc.id;
            } else {
                // Try alternate payment field
                const altSnapshot = await db.collection("orders")
                    .where("paymentDetails.razorpayPaymentId", "==", paymentId)
                    .limit(1)
                    .get();

                if (!altSnapshot.empty) {
                    orderDoc = altSnapshot.docs[0];
                    orderId = orderDoc.id;
                }
            }

            const now = new Date().toISOString();

            // ── Handle REFUND PROCESSED ──
            if (eventType === "refund.processed" && orderId) {
                console.log(`[Webhook] ✅ Refund ${refundId} processed for order ${orderId} — ₹${refundAmount}`);

                // Update order refund status
                await orderDoc.ref.update({
                    refundStatus: "completed",
                    refundCompletedAt: now,
                    razorpayRefundId: refundId,
                    refundAmount: refundAmount,
                    updatedAt: now,
                });

                // Invalidate tickets
                try {
                    const { invalidateOrderTickets } = await import("@/lib/server/ticketShareStore");
                    await invalidateOrderTickets(orderId, "refunded");
                    console.log(`[Webhook] Invalidated tickets for refunded order ${orderId}`);
                } catch (invalidateErr) {
                    console.error(`[Webhook] Failed to invalidate tickets for ${orderId}:`, invalidateErr);
                }

                // Finalize ledger entry
                try {
                    const { finalizeRefund } = await import("@c1rcle/core/ledger-engine");
                    await finalizeRefund(orderId, refundAmount, refundId);
                    console.log(`[Webhook] Ledger refund finalized for order ${orderId}`);
                } catch (ledgerErr) {
                    console.error(`[Webhook] Ledger finalization failed for ${orderId}:`, ledgerErr);
                }

                // Notify user — refund successful
                const orderData = orderDoc.data();
                if (orderData.userId) {
                    try {
                        const notifRef = db.collection("notifications").doc();
                        await notifRef.set({
                            id: notifRef.id,
                            userId: orderData.userId,
                            type: "refund_completed",
                            title: "Refund Processed",
                            body: `Your refund of ₹${refundAmount.toLocaleString("en-IN")} has been processed and will reflect in your account within 5-7 business days.`,
                            data: {
                                orderId,
                                refundId,
                                refundAmount,
                                paymentId,
                            },
                            read: false,
                            createdAt: now,
                        });
                    } catch (notifErr) {
                        console.error(`[Webhook] Failed to notify user about refund:`, notifErr);
                    }
                }

                // Update event-level cancellation summary if exists
                if (orderData.eventId) {
                    try {
                        const eventRef = db.collection("events").doc(orderData.eventId);
                        const eventDoc = await eventRef.get();
                        if (eventDoc.exists && eventDoc.data().cancellationSummary) {
                            const summary = eventDoc.data().cancellationSummary;
                            await eventRef.update({
                                "cancellationSummary.refundsCompleted": (summary.refundsCompleted || 0) + 1,
                                "cancellationSummary.totalRefundedAmount": (summary.totalRefundedAmount || 0) + refundAmount,
                                updatedAt: now,
                            });
                        }
                    } catch (e) {
                        // Non-critical
                    }
                }

                return NextResponse.json({
                    status: "success",
                    message: `Refund ${refundId} processed for order ${orderId}`,
                });
            }

            // ── Handle REFUND FAILED ──
            if (eventType === "refund.failed" && orderId) {
                console.error(`[Webhook] ❌ Refund ${refundId} FAILED for order ${orderId}`);

                await orderDoc.ref.update({
                    refundStatus: "failed",
                    refundFailedAt: now,
                    refundFailureReason: refundEntity.error?.description || "Unknown failure",
                    updatedAt: now,
                });

                // Notify user — refund failed
                const orderData = orderDoc.data();
                if (orderData.userId) {
                    try {
                        const notifRef = db.collection("notifications").doc();
                        await notifRef.set({
                            id: notifRef.id,
                            userId: orderData.userId,
                            type: "refund_failed",
                            title: "Refund Issue",
                            body: `We encountered an issue processing your refund of ₹${refundAmount.toLocaleString("en-IN")}. Our support team has been notified and will resolve this shortly.`,
                            data: {
                                orderId,
                                refundId,
                                refundAmount,
                            },
                            read: false,
                            createdAt: now,
                        });
                    } catch (notifErr) {
                        console.error(`[Webhook] Failed to notify user about failed refund:`, notifErr);
                    }
                }

                // TODO: Alert support team (Slack/email) about failed refund

                return NextResponse.json({
                    status: "handled",
                    message: `Refund failure recorded for order ${orderId}`,
                });
            }

            // ── Handle REFUND SPEED CHANGED ──
            if (eventType === "refund.speed_changed" && orderId) {
                const newSpeed = refundEntity.speed_processed || refundEntity.speed_requested;
                console.log(`[Webhook] ⚡ Refund speed changed for order ${orderId}: ${newSpeed}`);

                await orderDoc.ref.update({
                    refundSpeed: newSpeed,
                    updatedAt: now,
                });

                return NextResponse.json({
                    status: "handled",
                    message: `Refund speed change recorded for order ${orderId}`,
                });
            }

            // Generic refund event (refund.created)
            if (orderId) {
                await orderDoc.ref.update({
                    refundStatus: "initiated",
                    razorpayRefundId: refundId,
                    updatedAt: now,
                });
            }

            return NextResponse.json({
                status: "handled",
                message: "Refund event processed",
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
