/**
 * THE C1RCLE - Search Sync API (BFF Proxy)
 * Delegates search index synchronization to the API Gateway
 * Used by admin panel and automated workflows
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

/**
 * POST /api/search/sync
 * Sync events to Meilisearch via Gateway
 * Body: { action: "index" | "remove" | "init" | "full-sync", eventId?, event? }
 */
export async function POST(request) {
    if (!GATEWAY_URL) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const res = await fetch(`${GATEWAY_URL}/api/v1/search/sync`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": request.headers.get("Authorization") || ""
        },
        body: JSON.stringify(body)
    });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
