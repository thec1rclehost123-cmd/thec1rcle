import { NextResponse } from "next/server";
import { fetchPublicHost } from "../../../../lib/server/publicDiscoveryBridge.js";

export async function GET(request, { params }) {
    try {
        const { slug } = await params;
        const data = await fetchPublicHost(slug, {
            requestId: request.headers.get("x-request-id") || undefined,
        });

        if (!data) {
            return NextResponse.json({ error: "Host not found" }, { status: 404 });
        }

        return NextResponse.json(data.host || data);
    } catch (error) {
        console.error("GET /api/hosts/[slug] bridge error", error);
        return NextResponse.json({ error: "Failed to load host" }, { status: 500 });
    }
}
