import { NextRequest, NextResponse } from "next/server";
import { requirePromoterAccess } from "@/lib/server/promoterAuthMiddleware";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

export async function POST(req: NextRequest) {
    const ctx = await requirePromoterAccess(req);
    if ("error" in ctx) return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
    const formData = await req.formData();
    formData.set("promoterId", ctx.promoterId);
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/promoter/upload`, {
        method: "POST",
        body: formData,
    });
}
