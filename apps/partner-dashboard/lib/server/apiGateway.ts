import { NextResponse } from "next/server";

export const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

/**
 * Standard utility wrapper for API Gateway proxy requests.
 * Parses the JSON response automatically and ensures a properly formatted NextResponse.
 */
export async function proxyToGateway(req: Request, url: string, init: RequestInit): Promise<NextResponse> {
    if (!GATEWAY_URL) {
        return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    try {
        const forwardedHeaders = new Headers(init.headers);
    
        // Forward critical headers
        ['authorization', 'x-partner-id', 'x-venue-id', 'x-host-id', 'content-type'].forEach(h => {
            const val = req.headers.get(h);
            if (val && !forwardedHeaders.has(h)) {
                forwardedHeaders.set(h, val);
            }
        });

        const updatedInit: RequestInit = {
            ...init,
            headers: forwardedHeaders,
        };

        const res = await fetch(url, updatedInit);
        const data = await res.json().catch(() => ({}));
        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        console.error("[API Gateway Proxy Error]", err);
        return NextResponse.json({ error: "Failed to communicate with underlying service" }, { status: 502 });
    }
}

/**
 * Attempt to proxy to gateway, but return null on failure (for fallback logic).
 */
export async function tryProxyToGateway(req: Request, url: string, init: RequestInit): Promise<any | null> {
    if (!GATEWAY_URL) return null;
    try {
        const forwardedHeaders = new Headers(init.headers);
        ['authorization', 'x-partner-id', 'x-venue-id', 'x-host-id', 'content-type'].forEach(h => {
            const val = req.headers.get(h);
            if (val && !forwardedHeaders.has(h)) forwardedHeaders.set(h, val);
        });

        const res = await fetch(url, { ...init, headers: forwardedHeaders, signal: AbortSignal.timeout(4000) });
        if (!res.ok) return null;
        return await res.json().catch(() => null);
    } catch {
        return null;
    }
}
