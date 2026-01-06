/**
 * THE C1RCLE - Promo Code Validation API
 * Validates a promo code for an event and calculates discount
 */

import { NextResponse } from "next/server";
import { validateAndCalculatePromoDiscount } from "../../../../lib/server/checkoutService";
import { verifyAuth } from "../../../../lib/server/auth";

export async function POST(request) {
    try {
        const user = await verifyAuth(request);
        const payload = await request.json();
        const { eventId, code, items } = payload;

        if (!eventId || !code) {
            return NextResponse.json(
                { error: "Event ID and code are required" },
                { status: 400 }
            );
        }

        // Validate and calculate discount
        const result = await validateAndCalculatePromoDiscount(eventId, code, items || [], user?.uid);

        if (result.valid) {
            return NextResponse.json({
                valid: true,
                discountAmount: result.amount,
                label: result.label
            });
        } else {
            return NextResponse.json({
                valid: false,
                error: result.error || "Invalid promo code"
            });
        }

    } catch (error) {
        console.error("POST /api/checkout/promo error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to validate promo code" },
            { status: 500 }
        );
    }
}
