import { NextRequest, NextResponse } from "next/server";
import { requireGuestOpsAccess } from "@/lib/server/guestOpsMiddleware";
import { getScanStream } from "@/lib/server/scanLogStore";

export async function GET(req: NextRequest, { params }: { params: { eventId: string } }) {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        const { eventId } = params;

        const auth = await requireGuestOpsAccess(req, venueId!, eventId, ["VIEW_REAL_TIME_SCANS", "VIEW_GUESTLIST"]);
        if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

        const limit = Number(searchParams.get("limit") ?? 100);
        const scans = await getScanStream(eventId, limit);
        return NextResponse.json({ scans });
    } catch (err: any) {
        console.error("GET scanner/stream error", err);
        return NextResponse.json({ error: "Failed to load scan stream" }, { status: 500 });
    }
}
