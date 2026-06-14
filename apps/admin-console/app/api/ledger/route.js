import { NextResponse } from "next/server";
import { adminStore } from "@/lib/server/adminStore";
import { withAdminAuth } from "@/lib/server/adminMiddleware";

export const dynamic = "force-dynamic";

async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const entityId = searchParams.get("entityId");
    const actorId = searchParams.get("actorId");
    const state = searchParams.get("state");
    const limit = parseInt(searchParams.get("limit") || "100");

    const entries = await adminStore.getLedgerEntries({ entityId, actorId, state, limit });

    return NextResponse.json({ data: entries });
  } catch (err) {
    console.error("Ledger API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAdminAuth(handler);
