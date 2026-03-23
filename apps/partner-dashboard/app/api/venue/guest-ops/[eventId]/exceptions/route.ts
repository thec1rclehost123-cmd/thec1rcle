import { NextRequest, NextResponse } from "next/server";
import { requireGuestOpsAccess } from "@/lib/server/guestOpsMiddleware";
import { getExceptions } from "@/lib/server/scanLogStore";

export async function GET(req: NextRequest, context: { params: Promise<{ eventId: string }> }) {
    const { eventId } = await context.params;
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");

        const auth = await requireGuestOpsAccess(req, venueId!, eventId, ["MANAGE_GUEST_OPS"]);
        if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

        const status = (searchParams.get("status") as any) ?? "open";
        const type = searchParams.get("type") ?? undefined;
        const result = await getExceptions(eventId, { status, type } as any);
        return NextResponse.json(result);
    } catch (err: any) {
        console.error("GET exceptions error", err);
        return NextResponse.json({ error: "Failed to load exceptions" }, { status: 500 });
    }
}
