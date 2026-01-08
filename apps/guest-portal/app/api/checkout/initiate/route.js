/**
 * THE C1RCLE - Initiate Checkout API
 * Converts reservation to order and initiates payment
 */

import { NextResponse } from "next/server";
import { initiateCheckout } from "@/lib/server/checkoutService";
import { createRazorpayOrder } from "@/lib/server/payments/razorpay";
import { createOrder } from "@/lib/server/orderStore";
import { getEvent } from "@/lib/server/eventStore";
import { verifyAuth } from "@/lib/server/auth";
import { withRateLimit } from "@/lib/server/rateLimit";

async function handler(request) {
    try {
        const payload = await request.json();

        // Verify authentication
        const decodedToken = await verifyAuth(request);
        if (!decodedToken) {
            return NextResponse.json(
                { error: "Authentication required to complete checkout" },
                { status: 401 }
            );
        }

        // Validate required fields
        if (!payload.reservationId) {
            return NextResponse.json(
                { error: "Reservation ID is required" },
                { status: 400 }
            );
        }

        // User details
        const userDetails = {
            name: payload.userName || decodedToken.name || 'Guest',
            email: decodedToken.email || payload.userEmail,
            phone: payload.userPhone || ''
        };

        if (!userDetails.email) {
            return NextResponse.json(
                { error: "Email is required" },
                { status: 400 }
            );
        }

        // Initiate checkout
        const result = await initiateCheckout(
            payload.reservationId,
            decodedToken.uid,
            userDetails,
            {
                promoCode: payload.promoCode || null,
                promoterCode: payload.promoterCode || null
            }
        );

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        // If free order, return the confirmed order
        if (!result.requiresPayment) {
            return NextResponse.json({
                success: true,
                requiresPayment: false,
                order: result.order,
                message: result.message
            });
        }

        // For paid orders, create the Razorpay order using the draft order from orchestrator
        const order = result.order;

        // Create Razorpay order
        const razorpayOrder = await createRazorpayOrder({
            amount: Math.round(result.pricing.grandTotal * 100), // Convert to paise
            currency: 'INR',
            receipt: order.id,
            notes: {
                orderId: order.id,
                eventId: order.eventId,
                userId: decodedToken.uid
            }
        });

        return NextResponse.json({
            success: true,
            requiresPayment: true,
            order: {
                id: order.id,
                totalAmount: result.pricing.grandTotal
            },
            pricing: result.pricing,
            razorpay: {
                orderId: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency
            }
        });

    } catch (error) {
        console.error("POST /api/checkout/initiate error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to initiate checkout" },
            { status: 500 }
        );
    }
}

// Rate limit: 5 checkouts per minute per IP
export const POST = withRateLimit(handler, 5);
