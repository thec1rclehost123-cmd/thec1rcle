/**
 * THE C1RCLE - Cart Reservation API
 * Creates a cart reservation to hold inventory
 */

import { NextResponse } from "next/server";
import { createCartReservation } from "../../../../lib/server/checkoutService";
import { verifyAuth } from "../../../../lib/server/auth";
import { withRateLimit } from "../../../../lib/server/rateLimit";

async function handler(request) {
    try {
        const payload = await request.json();

        // Verify authentication (optional for browsing, required for checkout)
        const decodedToken = await verifyAuth(request);
        const customerId = decodedToken?.uid || payload.deviceId || 'anonymous';

        // Validate required fields
        if (!payload.eventId) {
            return NextResponse.json(
                { error: "Event ID is required" },
                { status: 400 }
            );
        }

        if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
            return NextResponse.json(
                { error: "At least one ticket item is required" },
                { status: 400 }
            );
        }

        // Validate items structure
        for (const item of payload.items) {
            if (!item.tierId || !item.quantity || item.quantity < 1) {
                return NextResponse.json(
                    { error: "Each item must have a tierId and quantity" },
                    { status: 400 }
                );
            }
        }

        // Create reservation
        const result = await createCartReservation(
            payload.eventId,
            customerId,
            payload.deviceId || null,
            payload.items
        );

        if (!result.success) {
            return NextResponse.json(
                { error: result.error || result.errors?.join(', ') || 'Failed to reserve tickets' },
                { status: 409 } // Conflict (availability issue)
            );
        }

        return NextResponse.json({
            success: true,
            reservationId: result.reservationId,
            items: result.items,
            expiresAt: result.expiresAt,
            expiresInSeconds: result.expiresInSeconds
        });

    } catch (error) {
        console.error("POST /api/checkout/reserve error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to reserve tickets" },
            { status: 500 }
        );
    }
}

// Rate limit: 10 reservations per minute per IP
export const POST = withRateLimit(handler, 10);
