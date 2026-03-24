import { NextRequest, NextResponse } from "next/server";
import { requireGuestOpsAccess } from "@/lib/server/guestOpsMiddleware";
import { getScannerDevices } from "@/lib/server/scanLogStore";

export async function GET(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
    const { eventId } = await params;
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");

        const auth = await requireGuestOpsAccess(req, venueId!, eventId, ["VIEW_REAL_TIME_SCANS", "VIEW_GUESTLIST"]);
        if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

        const devices = await getScannerDevices(eventId);
        return NextResponse.json({ devices });
    } catch (err: any) {
        console.error("GET scanner/devices error", err);
        return NextResponse.json({ error: "Failed to load scanner devices" }, { status: 500 });
    }
}
