import { NextRequest, NextResponse } from "next/server";
import { requireGuestOpsAccess } from "@/lib/server/guestOpsMiddleware";
import { getGuestOpsSummary } from "@/lib/server/scanLogStore";

export async function GET(req: NextRequest, context: { params: Promise<{ eventId: string }> }) {
    const { eventId } = await context.params;
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");

        const auth = await requireGuestOpsAccess(req, venueId!, eventId, ["VIEW_GUESTLIST"]);
        if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

        const summary = await getGuestOpsSummary(eventId, venueId!);
        return NextResponse.json(summary);
    } catch (err: any) {
        console.error("GET guest-ops/summary error", err);
        return NextResponse.json({ error: "Failed to load summary" }, { status: 500 });
    }
}
