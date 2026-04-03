import { NextRequest, NextResponse } from "next/server";
import { requestPartnership } from "@/lib/server/partnershipStore";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { ok, fail } from "@/lib/server/apiResponse";

export async function POST(req: NextRequest) {
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    try {
        const { venueId, hostName, venueName } = await req.json();
        if (!venueId) return fail("venueId is required", 400);

        const result = await requestPartnership(ctx.hostId, venueId, hostName, venueName);
        return ok({ result });
    } catch (error: any) {
        return fail("Failed to request partnership");
    }
}
