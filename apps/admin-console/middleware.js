import { NextResponse } from "next/server";

/**
 * Edge middleware — runs before every request.
 *
 * Injects x-request-id for end-to-end tracing across the admin console API routes.
 * The ID is read by adminMiddleware.js and included in every log entry.
 */
export function middleware(request) {
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
