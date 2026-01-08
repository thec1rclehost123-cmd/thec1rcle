/**
 * THE C1RCLE - Price Calculation API
 * Calculates order total with discounts and fees
 */

import { NextResponse } from "next/server";
import { calculatePricing, getReservation } from "@/lib/server/checkoutService";
import { withRateLimit } from "@/lib/server/rateLimit";

async function handler(request) {
    try {
        const payload = await request.json();

        // Can use either reservationId or direct items
        let eventId = payload.eventId;
        let items = payload.items;

        // If reservationId provided, use reservation data
        if (payload.reservationId) {
            const reservation = await getReservation(payload.reservationId);

            if (!reservation) {
                return NextResponse.json(
                    { error: "Reservation not found" },
                    { status: 404 }
                );
            }

            if (reservation.status !== 'active') {
                return NextResponse.json(
                    { error: `Reservation is ${reservation.status}` },
                    { status: 400 }
                );
            }

            if (new Date(reservation.expiresAt) < new Date()) {
                return NextResponse.json(
                    { error: "Reservation has expired" },
                    { status: 400 }
                );
            }

            eventId = reservation.eventId;
            items = reservation.items;
        }

        // Validate required fields
        if (!eventId) {
            return NextResponse.json(
                { error: "Event ID is required" },
                { status: 400 }
            );
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json(
                { error: "Items are required" },
                { status: 400 }
            );
        }

        // Calculate pricing
        const result = await calculatePricing(eventId, items, {
            promoCode: payload.promoCode || null,
            promoterCode: payload.promoterCode || null
        });

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            pricing: result.pricing
        });

    } catch (error) {
        console.error("POST /api/checkout/calculate error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to calculate pricing" },
            { status: 500 }
        );
    }
}

// Rate limit: 30 calculations per minute per IP
export const POST = withRateLimit(handler, 30);
