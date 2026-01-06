import { NextRequest, NextResponse } from "next/server";
import { getClubCalendar, getDateAvailability, blockDate, unblockDate } from "@/lib/server/calendarStore";
import { checkPartnership } from "@/lib/server/partnershipStore";
import { verifyAuth } from "@/lib/server/auth";
import { getAdminDb } from "@/lib/firebase/admin";

/**
 * GET /api/clubs/[id]/calendar
 * Get club availability calendar
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { searchParams } = new URL(req.url);
        const clubId = params.id;
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const hostId = searchParams.get("hostId");

        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!startDate || !endDate) {
            // Default to next 30 days
            const today = new Date();
            const defaultStart = today.toISOString().split("T")[0];
            const defaultEnd = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
                .toISOString().split("T")[0];

            const calendar = await getClubCalendar(clubId, defaultStart, defaultEnd, hostId || undefined);
            return NextResponse.json({ calendar });
        }

        // Security: If not admin/club staff, must be a host with an active partnership
        const token = decodedToken as any;
        if (token.role !== 'admin' && token.role !== 'club') {
            const effectiveHostId = hostId || token.partnerId || token.uid;
            const hasPartnership = await checkPartnership(effectiveHostId, clubId);

            if (!hasPartnership) {
                return NextResponse.json(
                    { error: "No active partnership with this club. Access denied." },
                    { status: 403 }
                );
            }
        }

        const calendar = await getClubCalendar(clubId, startDate, endDate, hostId || undefined);

        return NextResponse.json({ calendar });
    } catch (error: any) {
        console.error("[Calendar API] GET Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch calendar" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/clubs/[id]/calendar
 * Block or unblock a date (club action only)
 */
export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const clubId = params.id;
        const body = await req.json();
        const { action, date, reason, actor } = body;

        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!actor || !actor.uid || !actor.role) {
            return NextResponse.json(
                { error: "Actor information required" },
                { status: 400 }
            );
        }

        // Security: Ensure actor UID matches authenticated user
        if (actor.uid !== decodedToken.uid) {
            return NextResponse.json({ error: "Actor UID mismatch" }, { status: 403 });
        }

        // Verify actor is from this club
        if (actor.role !== "club" && actor.role !== "admin") {
            return NextResponse.json(
                { error: "Only club managers can modify the calendar" },
                { status: 403 }
            );
        }

        if (!date) {
            return NextResponse.json(
                { error: "Date is required" },
                { status: 400 }
            );
        }

        let result;

        switch (action) {
            case "block":
                result = await blockDate(clubId, date, reason || "", actor);
                break;

            case "unblock":
                result = await unblockDate(clubId, date, actor);
                break;

            case "availability":
                result = await getDateAvailability(clubId, date);
                break;

            default:
                return NextResponse.json(
                    { error: "Invalid action. Use: block, unblock, or availability" },
                    { status: 400 }
                );
        }

        return NextResponse.json({ result });
    } catch (error: any) {
        console.error("[Calendar API] POST Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to update calendar" },
            { status: 500 }
        );
    }
}
