import { NextRequest, NextResponse } from "next/server";
import { requireGuestOpsAccess } from "@/lib/server/guestOpsMiddleware";
import { verifyAuth } from "@/lib/server/auth";
import { getScanStream } from "@/lib/server/scanLogStore";
import { PAGE_SIZE_MAX_GUESTS } from "@/lib/constants";

const isDev = process.env.NODE_ENV === "development";

export async function GET(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
    const { eventId } = await params;
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");

        if (isDev) {
            const user = await verifyAuth(req);
            if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        } else {
            const auth = await requireGuestOpsAccess(req, venueId!, eventId, ["VIEW_REAL_TIME_SCANS", "VIEW_GUESTLIST"]);
            if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const limit = Math.min(Number(searchParams.get("limit") ?? 100), PAGE_SIZE_MAX_GUESTS);
        const scans = await getScanStream(eventId, limit);
        return NextResponse.json({ scans });
    } catch (err: any) {
        console.error("GET scanner/stream error", err);
        return NextResponse.json({ error: "Failed to load scan stream" }, { status: 500 });
    }
}
