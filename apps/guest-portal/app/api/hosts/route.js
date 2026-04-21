import { NextResponse } from "next/server";
import { adaptPublicList, fetchPublicHosts } from "../../../lib/server/publicDiscoveryBridge.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const data = await fetchPublicHosts(Object.fromEntries(searchParams.entries()), {
            requestId: request.headers.get("x-request-id") || undefined,
        });

        return NextResponse.json(adaptPublicList(data, "hosts"), {
            headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" },
        });
    } catch (error) {
        console.error("GET /api/hosts bridge error", error);
        return NextResponse.json({ error: "Failed to load hosts" }, { status: 500 });
    }
}
