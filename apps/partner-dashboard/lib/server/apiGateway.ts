import { NextResponse } from "next/server";

export const GATEWAY_URL = process.env.GATEWAY_URL;

/**
 * Standard utility wrapper for API Gateway proxy requests.
 * Parses the JSON response automatically and ensures a properly formatted NextResponse.
 * Hard-fails with 503 if GATEWAY_URL is not set, 502 if gateway is unreachable.
 */
export async function proxyToGateway(req: Request, url: string, init: RequestInit): Promise<NextResponse> {
    if (!GATEWAY_URL) {
        return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    try {
        const forwardedHeaders = new Headers(init.headers);

        ['authorization', 'x-partner-id', 'x-venue-id', 'x-host-id', 'x-workspace-id', 'x-request-id', 'x-forwarded-for', 'content-type'].forEach(h => {
            const val = req.headers.get(h);
            if (val && !forwardedHeaders.has(h)) {
                // Special case: Do NOT forward content-type for FormData, let fetch generate it with the correct boundary
                if (h === 'content-type' && init.body instanceof FormData) {
                    return;
                }
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
