/**
 * THE C1RCLE - Search Sync API (BFF Proxy)
 * Delegates search index synchronization to the API Gateway
 * Used by admin panel and automated workflows
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

/**
 * POST /api/search/sync
 * Sync events to Meilisearch via Gateway
 * Body: { action: "index" | "remove" | "init" | "full-sync", eventId?, event? }
 */
export async function POST(request) {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    return proxyToGateway(request, `${GATEWAY_URL}/api/v1/search/sync`, {
        method: "POST",
        body: JSON.stringify(body)
    });
}

