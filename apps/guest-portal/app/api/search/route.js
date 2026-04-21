import { NextResponse } from "next/server";
import { adaptSearchResponse, searchPublicDiscovery } from "../../../lib/server/publicDiscoveryBridge.js";

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const type = searchParams.get("type") || "events";
    const limit = Math.min(parseInt(searchParams.get("limit") || (type === "suggestions" ? "5" : "20"), 10), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

    try {
        if (type === "suggestions" && query.length < 2) {
            return NextResponse.json({ suggestions: [] });
        }

        const data = await searchPublicDiscovery({
            ...Object.fromEntries(searchParams.entries()),
            limit: String(Math.min(limit + offset, 100)),
        }, {
            requestId: request.headers.get("x-request-id") || undefined,
        });

        return NextResponse.json(adaptSearchResponse(data, { type, query, limit, offset }));
    } catch (error) {
        console.error("[Search API bridge] Error:", error);

        return NextResponse.json({
            type,
            query,
            hits: [],
            totalHits: 0,
            error: process.env.NODE_ENV === "development" ? error.message : "Search unavailable",
        }, { status: 200 });
    }
}
