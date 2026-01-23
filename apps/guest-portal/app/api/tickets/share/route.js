/**
 * THE C1RCLE - Ticket Sharing API
 * Creates a share bundle for an order/tier
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { createShareBundle, getOrderShareBundles, getOrderAssignments } from "@/lib/server/ticketShareStore";
import { withRateLimit } from "@/lib/server/rateLimit";

async function handler(request) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { orderId, eventId, quantity, tierId, expiresAt: customExpiresAt } = body;

        if (!orderId || !eventId || !quantity) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Create share bundle
        const bundle = await createShareBundle(orderId, user.uid, eventId, quantity, tierId, customExpiresAt);

        return NextResponse.json({
            success: true,
            bundle
        });

    } catch (error) {
        console.error("[Share API] Error:", error);
        return NextResponse.json({
            error: error.message || "Failed to create share link"
        }, { status: 500 });
    }
}

/**
 * GET /api/tickets/share?orderId=...
 * Fetch shares and assignments for an order
 */
export async function GET(request) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const orderId = searchParams.get("orderId");

        if (!orderId) {
            return NextResponse.json({ error: "orderId is required" }, { status: 400 });
        }

        // Fetch bundles and assignments
        const [bundles, assignments] = await Promise.all([
            getOrderShareBundles(orderId),
            getOrderAssignments(orderId)
        ]);

        return NextResponse.json({
            success: true,
            bundles,
            assignments
        });

    } catch (error) {
        console.error("[Share API] GET Error:", error);
        return NextResponse.json({
            error: error.message || "Failed to fetch sharing info"
        }, { status: 500 });
    }
}

/**
 * DELETE /api/tickets/share
 * Reclaim an unclaimed slot
 */
async function deleteHandler(request) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { bundleId, slotIndex } = body;

        const { reclaimUnclaimedSlot, cancelShareBundle } = await import("@/lib/server/ticketShareStore");

        if (slotIndex !== undefined) {
            await reclaimUnclaimedSlot(bundleId, user.uid, slotIndex);
        } else {
            await cancelShareBundle(bundleId, user.uid);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[Share API] DELETE Error:", error);
        return NextResponse.json({
            error: error.message || "Failed to reclaim ticket"
        }, { status: 500 });
    }
}

export const POST = withRateLimit(handler, 10);
export const DELETE = withRateLimit(deleteHandler, 10);
