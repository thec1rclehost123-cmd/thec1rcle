/**
 * THE C1RCLE - Event Codes API (BFF Proxy)
 * Delegates to API Gateway for scanner code management
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/server/withAuth";
import { fail } from "@/lib/server/apiResponse";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

/**
 * GET /api/event-codes?eventId=XXX
 */
export const GET = withAuth(async (req: NextRequest) => {
    if (!GATEWAY_URL) return fail("Service unavailable", 503);
    const { searchParams } = new URL(req.url);
    return proxyToGateway(
        `${GATEWAY_URL}/api/v1/scan/codes?${searchParams.toString()}`,
        { headers: { Authorization: req.headers.get("Authorization") || "" } }
    );
});

/**
 * POST /api/event-codes
 * Create a new scanner access code
 */
export const POST = withAuth(async (req: NextRequest, auth) => {
    if (!GATEWAY_URL) return fail("Service unavailable", 503);
    const body = await req.json();
    return proxyToGateway(`${GATEWAY_URL}/api/v1/scan/codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: req.headers.get("Authorization") || "" },
        body: JSON.stringify({ ...body, createdBy: { uid: auth.uid, name: (auth as any).name || (auth as any).email } })
    });
});

/**
 * DELETE /api/event-codes?id=XXX
 * Revoke a scanner access code
 */
export const DELETE = withAuth(async (req: NextRequest, auth) => {
    if (!GATEWAY_URL) return fail("Service unavailable", 503);
    const { searchParams } = new URL(req.url);
    const codeId = searchParams.get("id");
    if (!codeId) return fail("id required", 400);

    return proxyToGateway(`${GATEWAY_URL}/api/v1/scan/codes/${codeId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: req.headers.get("Authorization") || "" },
        body: JSON.stringify({ revokedBy: { uid: auth.uid, name: (auth as any).name || (auth as any).email } })
    });
});
