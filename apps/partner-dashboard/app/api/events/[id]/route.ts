import { NextRequest, NextResponse } from "next/server";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";
import { verifyAuth } from "@/lib/server/auth";

function unauthorized(req: NextRequest) {
    return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required", requestId: req.headers.get("x-request-id") || crypto.randomUUID() } },
        { status: 401 }
    );
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const decoded = await verifyAuth(req);
    if (!decoded) return unauthorized(req);
    const { id } = await params;
    const { search } = new URL(req.url);
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/events/${id}${search}`, {});
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const decoded = await verifyAuth(req);
    if (!decoded) return unauthorized(req);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/events/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
    });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const decoded = await verifyAuth(req);
    if (!decoded) return unauthorized(req);
    const { id } = await params;
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/events/${id}`, { method: "DELETE" });
}
