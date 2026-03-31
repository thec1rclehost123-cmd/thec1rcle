import { NextResponse } from "next/server";

/**
 * Edge middleware — runs before every request.
 *
 * Responsibilities:
 * 1. Inject x-request-id if not already present (set by Vercel or upstream proxy).
 *    This ID flows through to API route logs so events can be correlated end-to-end.
 * 2. Forward x-request-id on the response so clients and downstream services can trace requests.
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
    // Run on all API routes; skip Next.js internals and static files
    matcher: ["/api/:path*"],
};
