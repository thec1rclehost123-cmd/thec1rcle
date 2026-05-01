import { NextRequest, NextResponse } from "next/server";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

function authError(
    req: NextRequest,
    status: number,
    error: string | { code?: string; message?: string; requestId?: string }
) {
    const normalized = typeof error === "string"
        ? {
            code: status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : "BAD_REQUEST",
            message: error,
            requestId: req.headers.get("x-request-id") || crypto.randomUUID(),
        }
        : {
            code: error.code || (status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : "BAD_REQUEST"),
            message: error.message || "Request failed",
            requestId: error.requestId || req.headers.get("x-request-id") || crypto.randomUUID(),
        };

    return NextResponse.json({
        success: false,
        error: normalized,
    }, { status });
}

export async function GET(req: NextRequest) {
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return authError(req, ctx.status, ctx.error);

    const { searchParams } = new URL(req.url);
    searchParams.set("hostId", ctx.hostId);
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/partners/hosts/events?${searchParams.toString()}`, {});
}
