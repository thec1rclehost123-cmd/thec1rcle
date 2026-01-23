/**
 * THE C1RCLE - Ticket Claim API
 * Claims a ticket slot from a share bundle token
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { claimTicketSlot, getShareBundleByToken } from "@/lib/server/ticketShareStore";
import { getEvent } from "@/lib/server/eventStore";
import { withRateLimit } from "@/lib/server/rateLimit";

/**
 * GET /api/tickets/claim?token=...
 * Preview a share bundle before claiming
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const token = searchParams.get("token");

        if (!token) {
            return NextResponse.json({ error: "Token is required" }, { status: 400 });
        }

        const bundle = await getShareBundleByToken(token);
        if (!bundle) {
            return NextResponse.json({ error: "Invalid or expired share link" }, { status: 404 });
        }

        const event = await getEvent(bundle.eventId);

        return NextResponse.json({
            success: true,
            bundle: {
                ...bundle,
                eventTitle: event?.title,
                eventImage: event?.image,
                eventDate: event?.date,
                eventLocation: event?.location,
            }
        });

    } catch (error) {
        console.error("[Claim API] GET Error:", error);
        return NextResponse.json({
            error: error.message || "Failed to fetch share info"
        }, { status: 500 });
    }
}

/**
 * POST /api/tickets/claim
 * Actually claim the slot
 */
async function handler(request) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: "Authentication required to claim ticket" }, { status: 401 });
        }

        const body = await request.json();
        const { token } = body;

        if (!token) {
            return NextResponse.json({ error: "Token is required" }, { status: 400 });
        }

        const result = await claimTicketSlot(token, user.uid);

        return NextResponse.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error("[Claim API] POST Error:", error);
        return NextResponse.json({
            error: error.message || "Failed to claim ticket"
        }, { status: 500 });
    }
}

export const POST = withRateLimit(handler, 5);
