import { NextResponse } from "next/server";
import { adminStore } from "@/lib/server/adminStore";
import { withAdminAuth } from "@/lib/server/adminMiddleware";

export const dynamic = 'force-dynamic';

const ALLOWED_STATES = ['pending', 'approved', 'rejected', 'executed', 'expired'];

async function handler(req) {
    try {
        const { searchParams } = new URL(req.url);
        const entityId = searchParams.get("entityId");
        const actorId = searchParams.get("actorId");
        const state = searchParams.get("state");
        const rawLimit = parseInt(searchParams.get("limit") || "100", 10);

        if (isNaN(rawLimit) || rawLimit <= 0) {
            return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
        }
        const limit = Math.min(rawLimit, 500);

        if (state && !ALLOWED_STATES.includes(state)) {
            return NextResponse.json({ error: "Invalid state filter" }, { status: 400 });
        }

        const entries = await adminStore.getLedgerEntries({ entityId, actorId, state, limit });

        return NextResponse.json({ data: entries });
    } catch (err) {
        console.error("Ledger API error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export const GET = withAdminAuth(handler);
