import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

/**
 * Edge middleware — runs before every request.
 *
 * Injects x-request-id for end-to-end tracing across partner dashboard API routes.
 */
export function middleware(request: NextRequest) {
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
