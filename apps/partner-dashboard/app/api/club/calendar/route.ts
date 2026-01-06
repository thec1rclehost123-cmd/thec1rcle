import { NextRequest, NextResponse } from "next/server";
import { getUnifiedClubCalendar, blockDate, unblockDate } from "@/lib/server/calendarStore";
import { verifyAuth } from "@/lib/server/auth";

export async function GET(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const clubId = searchParams.get("clubId");
        const startDate = searchParams.get("startDate") || new Date().toISOString().split('T')[0];
        const endDate = searchParams.get("endDate") || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        if (!clubId) {
            return NextResponse.json({ error: "clubId is required" }, { status: 400 });
        }

        const data = await getUnifiedClubCalendar(clubId, startDate, endDate);
        return NextResponse.json(data);

    } catch (error: any) {
        console.error("Error fetching unified calendar:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { action, clubId, date, reason } = body;

        if (action === "block") {
            const result = await blockDate(clubId, date, reason, {
                uid: decodedToken.uid,
                role: "club",
            });
            return NextResponse.json({ success: true, entry: result });
        }

        if (action === "unblock") {
            const result = await unblockDate(clubId, date, {
                uid: decodedToken.uid,
                role: "club",
            });
            return NextResponse.json({ success: true, entry: result });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    } catch (error: any) {
        console.error("Error updating calendar:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
