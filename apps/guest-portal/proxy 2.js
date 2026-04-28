import { NextResponse } from "next/server";

/**
 * Next Proxy runs before matched requests.
 *
 * Responsibilities:
 * 1. Inject x-request-id if not already present from Vercel or an upstream proxy.
 * 2. Forward x-request-id on the response so clients and downstream services can trace requests.
 */
export function proxy(request) {
    const requestId = request.headers.get("x-request-id") || crypto.randomUUID();

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-request-id", requestId);

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("x-request-id", requestId);

    return response;
}

export const config = {
    matcher: ["/api/:path*"],
};
