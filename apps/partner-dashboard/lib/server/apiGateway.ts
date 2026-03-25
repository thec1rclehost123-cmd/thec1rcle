import { NextResponse } from "next/server";

export const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

/**
 * Standard utility wrapper for API Gateway proxy requests.
 * Parses the JSON response automatically and ensures a properly formatted NextResponse.
 */
export async function proxyToGateway(url: string, init: RequestInit): Promise<NextResponse> {
    if (!GATEWAY_URL) {
        return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    try {
        const res = await fetch(url, init);
        const data = await res.json().catch(() => ({}));
        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        console.error("[API Gateway Proxy Error]", err);
        return NextResponse.json({ error: "Failed to communicate with underlying service" }, { status: 502 });
    }
}
