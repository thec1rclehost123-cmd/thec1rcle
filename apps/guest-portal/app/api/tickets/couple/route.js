/**
 * THE C1RCLE - Couple Ticket API
 * GET  /api/tickets/couple?bundleId=  — Couple ticket status (partial / complete)
 * DELETE /api/tickets/couple          — Cancel partner slot (owner only)
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { getCoupleTicketStatus, cancelPartnerSlot } from "@/lib/server/ticketShareStore";
import { withRateLimit } from "@/lib/server/rateLimit";

/**
 * GET /api/tickets/couple?bundleId=...
 * Returns the couple ticket state: which slots are claimed and by whom.
 */
export async function GET(request) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: "Authentication required" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const bundleId = searchParams.get("bundleId");

        if (!bundleId) {
            return NextResponse.json({ error: "bundleId is required" }, { status: 400 });
        }

        const status = await getCoupleTicketStatus(bundleId);
        if (!status) {
            return NextResponse.json({ error: "Couple ticket not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, ...status });
    } catch (error) {
        console.error("[Couple API] GET Error:", error);
        return NextResponse.json({ error: error.message || "Failed to fetch couple status" }, { status: 500 });
    }
}

/**
 * DELETE /api/tickets/couple
 * Body: { bundleId }
 * Cancels the partner's claimed slot so the owner can re-invite someone else.
 */
async function deleteHandler(request) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: "Authentication required" }, { status: 401 });
        }

        const body = await request.json();
        const { bundleId } = body;

        if (!bundleId) {
            return NextResponse.json({ error: "bundleId is required" }, { status: 400 });
        }

        const result = await cancelPartnerSlot(bundleId, user.uid);
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error("[Couple API] DELETE Error:", error);
        const status = error.message?.startsWith("Unauthorized") ? 403 : 500;
        return NextResponse.json({ error: error.message || "Failed to cancel partner slot" }, { status });
    }
}

export const DELETE = withRateLimit(deleteHandler, 10);
