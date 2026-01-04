import { NextRequest, NextResponse } from "next/server";
import { requestPartnership } from "@/lib/server/partnershipStore";

export async function POST(req: NextRequest) {
    try {
        const { hostId, clubId, hostName, clubName } = await req.json();

        if (!hostId || !clubId) {
            return NextResponse.json({ error: "hostId and clubId are required" }, { status: 400 });
        }

        const result = await requestPartnership(hostId, clubId, hostName, clubName);
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
