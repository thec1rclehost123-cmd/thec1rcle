import { NextRequest, NextResponse } from "next/server";
import { listPartnerships, approvePartnership, rejectPartnership } from "@/lib/server/partnershipStore";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const clubId = searchParams.get("clubId");
        const hostId = searchParams.get("hostId");
        const status = searchParams.get("status");

        const filters: any = {};
        if (clubId) filters.clubId = clubId;
        if (hostId) filters.hostId = hostId;
        if (status) filters.status = status;

        const partnerships = await listPartnerships(filters);
        return NextResponse.json({ partnerships });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const { partnershipId, action } = await req.json();

        if (!partnershipId || !action) {
            return NextResponse.json({ error: "partnershipId and action are required" }, { status: 400 });
        }

        if (action === "approve") {
            await approvePartnership(partnershipId);
        } else if (action === "reject") {
            await rejectPartnership(partnershipId);
        } else {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
