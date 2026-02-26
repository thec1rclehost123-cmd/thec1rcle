/**
 * POST /api/orders/[orderId]/cancel
 * 
 * Guest-facing order cancellation with automatic Razorpay refund.
 * 
 * Flow:
 *   1. Verify the requesting user owns the order
 *   2. Check cancellation eligibility (time window, event status)
 *   3. Initiate Razorpay refund (for paid orders)
 *   4. Cancel the order in Firestore (restore inventory, revoke entitlements)
 *   5. Record refund in ledger
 *   6. Notify user
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { getOrderById, cancelOrder } from "@/lib/server/orderStore";
import { getEvent } from "@/lib/server/eventStore";
import { initiateRefund } from "@/lib/server/payments/razorpay";

// Cancellation policies
const CANCELLATION_WINDOW_HOURS = 48; // Allow cancellation up to 48h before event
const FREE_CANCELLATION_HOURS = 24;   // Full refund if cancelled within 24h of purchase

export async function POST(request, { params }) {
    try {
        const orderId = params.orderId;

        // ── 1. Authentication ──
        const decodedToken = await verifyAuth(request);
        if (!decodedToken) {
            return NextResponse.json(
                { error: "Authentication required" },
                { status: 401 }
            );
        }

        // ── 2. Fetch Order ──
        const order = await getOrderById(orderId);
        if (!order) {
            return NextResponse.json(
                { error: "Order not found" },
                { status: 404 }
            );
        }

        // Verify ownership
        if (order.userId !== decodedToken.uid) {
            return NextResponse.json(
                { error: "You can only cancel your own orders" },
                { status: 403 }
            );
        }

        // ── 3. Check Cancellation Eligibility ──
        const now = new Date();

        // Already cancelled?
        if (order.status === "cancelled") {
            return NextResponse.json(
                { error: "This order is already cancelled", alreadyCancelled: true },
                { status: 409 }
            );
        }

        // Only confirmed and pending_payment orders can be cancelled
        if (!["confirmed", "pending_payment", "reserved"].includes(order.status)) {
            return NextResponse.json(
                { error: `Orders with status "${order.status}" cannot be cancelled` },
                { status: 400 }
            );
        }

        // Check-in already done?
        if (order.status === "checked_in") {
            return NextResponse.json(
                { error: "Cannot cancel — you have already checked in" },
                { status: 400 }
            );
        }

        // Fetch event to check time constraints
        const event = await getEvent(order.eventId);
        let cancellationAllowed = true;
        let refundPercentage = 100;
        let denialReason = null;

        if (event) {
            const eventStart = new Date(event.startDate || event.date);
            const hoursUntilEvent = (eventStart - now) / (1000 * 60 * 60);

            // Event already started?
            if (hoursUntilEvent <= 0) {
                cancellationAllowed = false;
                denialReason = "Cannot cancel — the event has already started";
            }

            // Within cancellation window?
            if (hoursUntilEvent > 0 && hoursUntilEvent < CANCELLATION_WINDOW_HOURS) {
                // Allow but with reduced refund
                refundPercentage = 75; // 75% refund if within 48h window
            }

            // Check event-level cancellation policy
            if (event.cancellationPolicy === "no_refund") {
                refundPercentage = 0;
            } else if (event.cancellationPolicy === "partial") {
                refundPercentage = event.cancellationRefundPercent || 50;
            }

            // Free cancellation within 24h of purchase
            const purchaseDate = new Date(order.createdAt);
            const hoursSincePurchase = (now - purchaseDate) / (1000 * 60 * 60);
            if (hoursSincePurchase <= FREE_CANCELLATION_HOURS) {
                refundPercentage = 100; // Override — always full refund within 24h of purchase
            }

            // Event is already cancelled? Always allow guest cancellation
            if (event.lifecycle === "cancelled") {
                refundPercentage = 100;
            }
        }

        if (!cancellationAllowed) {
            return NextResponse.json(
                { error: denialReason, cancellationAllowed: false },
                { status: 400 }
            );
        }

        // ── 4. Parse request body for optional reason ──
        let reason = "User requested cancellation";
        try {
            const body = await request.json();
            if (body.reason) reason = body.reason;
        } catch (e) {
            // No body provided, use default reason
        }

        // ── 5. Initiate Razorpay Refund (for paid orders) ──
        let refundResult = null;
        const isPaidOrder = order.status === "confirmed" && order.totalAmount > 0;
        const paymentId = order.payment?.razorpayPaymentId || order.paymentDetails?.razorpayPaymentId;

        if (isPaidOrder && paymentId && refundPercentage > 0) {
            try {
                const refundAmountPaise = Math.round(order.totalAmount * (refundPercentage / 100) * 100);

                refundResult = await initiateRefund(paymentId, refundAmountPaise, {
                    speed: "normal",
                    notes: {
                        orderId,
                        eventId: order.eventId,
                        reason,
                        refundPercentage,
                        initiatedBy: "guest",
                    },
                });

                console.log(`[OrderCancel] Razorpay refund initiated: ${refundResult.id} for ₹${refundAmountPaise / 100}`);
            } catch (refundError) {
                console.error(`[OrderCancel] Razorpay refund failed for order ${orderId}:`, refundError);
                // Don't block cancellation if refund fails — track for manual processing
                refundResult = { status: "failed", error: refundError.message };
            }
        }

        // ── 6. Cancel Order (restore inventory, revoke entitlements + persist metadata) ──
        // cancelOrder in orderStore handles DB persistence and notification dispatch
        await cancelOrder(orderId, {
            cancellationReason: reason,
            cancelledBy: decodedToken.uid,
            cancelledByType: "guest",
            refundPercentage,
            razorpayRefundId: refundResult?.id || null,
            refundStatus: refundResult?.status === "failed"
                ? "failed"
                : refundResult?.id ? "processing"
                    : (refundPercentage === 0 ? "not_applicable" : "pending"),
        });

        // ── Response ──
        const refundAmount = Math.round(order.totalAmount * (refundPercentage / 100) * 100) / 100;

        return NextResponse.json({
            success: true,
            orderId,
            status: "cancelled",
            refund: {
                percentage: refundPercentage,
                amount: refundAmount,
                status: refundResult?.id ? "processing" : (refundPercentage === 0 ? "not_applicable" : "pending"),
                razorpayRefundId: refundResult?.id || null,
                estimatedDays: "5-7 business days",
            },
            message: refundPercentage === 100
                ? "Order cancelled. A full refund has been initiated."
                : refundPercentage > 0
                    ? `Order cancelled. A ${refundPercentage}% refund (₹${refundAmount}) has been initiated.`
                    : "Order cancelled. No refund applicable per event policy.",
        });

    } catch (error) {
        console.error("[OrderCancel] Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to cancel order" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/orders/[orderId]/cancel
 * Check cancellation eligibility without actually cancelling
 */
export async function GET(request, { params }) {
    try {
        const orderId = params.orderId;

        const decodedToken = await verifyAuth(request);
        if (!decodedToken) {
            return NextResponse.json({ error: "Authentication required" }, { status: 401 });
        }

        const order = await getOrderById(orderId);
        if (!order) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        if (order.userId !== decodedToken.uid) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        // Check eligibility
        const now = new Date();
        let canCancel = true;
        let refundPercentage = 100;
        let reason = null;

        if (order.status === "cancelled") {
            return NextResponse.json({
                canCancel: false,
                reason: "Order is already cancelled",
                refundPercentage: 0,
            });
        }

        if (!["confirmed", "pending_payment", "reserved"].includes(order.status)) {
            return NextResponse.json({
                canCancel: false,
                reason: `Orders with status "${order.status}" cannot be cancelled`,
                refundPercentage: 0,
            });
        }

        const event = await getEvent(order.eventId);
        if (event) {
            const eventStart = new Date(event.startDate || event.date);
            const hoursUntilEvent = (eventStart - now) / (1000 * 60 * 60);

            if (hoursUntilEvent <= 0) {
                canCancel = false;
                reason = "Event has already started";
            } else if (hoursUntilEvent < CANCELLATION_WINDOW_HOURS) {
                refundPercentage = 75;
            }

            if (event.cancellationPolicy === "no_refund") {
                refundPercentage = 0;
            } else if (event.cancellationPolicy === "partial") {
                refundPercentage = event.cancellationRefundPercent || 50;
            }

            // Free cancellation within 24h of purchase
            const purchaseDate = new Date(order.createdAt);
            const hoursSincePurchase = (now - purchaseDate) / (1000 * 60 * 60);
            if (hoursSincePurchase <= FREE_CANCELLATION_HOURS) {
                refundPercentage = 100;
            }

            if (event.lifecycle === "cancelled") {
                refundPercentage = 100;
            }
        }

        const refundAmount = Math.round(order.totalAmount * (refundPercentage / 100) * 100) / 100;

        return NextResponse.json({
            canCancel,
            reason,
            refundPercentage,
            refundAmount,
            orderTotal: order.totalAmount,
            eventTitle: event?.title || null,
            freeCancellationWindow: `${FREE_CANCELLATION_HOURS}h from purchase`,
        });

    } catch (error) {
        console.error("[OrderCancel] Eligibility check error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to check cancellation eligibility" },
            { status: 500 }
        );
    }
}
