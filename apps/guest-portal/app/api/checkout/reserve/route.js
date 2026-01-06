/**
 * THE C1RCLE - Cart Reservation API
 * Creates a cart reservation to hold inventory
 */

import { NextResponse } from "next/server";
import { createCartReservation } from "../../../../lib/server/checkoutService";
import { verifyAuth } from "../../../../lib/server/auth";
import { withRateLimit } from "../../../../lib/server/rateLimit";
import { getSurgeStatus, recordMetric } from "../../../../lib/server/surgeStore";
import { validateAdmission } from "../../../../lib/server/queueStore";

async function handler(request) {
    try {
        const payload = await request.json();

        // Record metric
        if (payload.eventId) {
            await recordMetric(payload.eventId, "checkout_initiate");
        }

        // Surge Protection Check
        const surgeStatus = await getSurgeStatus(payload.eventId);
        if (surgeStatus.status === "surge") {
            const admissionToken = request.headers.get("x-admission-token") || payload.admissionToken;
            const decodedToken = await verifyAuth(request);
            const userId = decodedToken?.uid || 'anonymous';

            const isValid = await validateAdmission(payload.eventId, userId, admissionToken);
            if (!isValid) {
                return NextResponse.json(
                    { error: "Queue admission required during surge. Please join the waiting room.", code: "SURGE_REQUIRED" },
                    { status: 403 }
                );
            }
        }

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

        // If in surge, consume the admission token
        if (surgeStatus.status === "surge") {
            const admissionToken = request.headers.get("x-admission-token") || payload.admissionToken;
            if (admissionToken) {
                const parts = admissionToken.split(":");
                if (parts.length === 4) {
                    const queueId = parts[2];
                    await consumeAdmission(queueId).catch(err =>
                        console.error("[ReserveAPI] Failed to consume admission:", err)
                    );
                }
            }
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
