import { NextRequest, NextResponse } from "next/server";
import { requestPartnership } from "@/lib/server/partnershipStore";

export async function POST(req: NextRequest) {
    try {
        const { hostId, venueId, hostName, venueName } = await req.json();

        if (!hostId || !venueId) {
            return NextResponse.json({ error: "hostId and venueId are required" }, { status: 400 });
        }

        const result = await requestPartnership(hostId, venueId, hostName, venueName);
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
