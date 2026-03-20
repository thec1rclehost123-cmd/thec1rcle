import { NextRequest, NextResponse } from "next/server";
import { requestPartnership } from "@/lib/server/partnershipStore";
import { verifyAuth, verifyPartnerAccess } from "@/lib/server/auth";

export async function POST(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { hostId, venueId, hostName, venueName } = await req.json();

        if (!hostId || !venueId) {
            return NextResponse.json({ error: "hostId and venueId are required" }, { status: 400 });
        }

        // Verify the caller has access to the hostId they're requesting on behalf of
        const hasAccess = await verifyPartnerAccess(req, hostId);
        if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const result = await requestPartnership(hostId, venueId, hostName, venueName);
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
