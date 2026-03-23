import { NextRequest } from "next/server";
import { requestPartnership } from "@/lib/server/partnershipStore";
import { verifyPartnerAccess } from "@/lib/server/auth";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

export const POST = withAuth(async (req: NextRequest) => {
    try {
        const { hostId, venueId, hostName, venueName } = await req.json();

        if (!hostId || !venueId) return fail("hostId and venueId are required", 400);

        const hasAccess = await verifyPartnerAccess(req, hostId);
        if (!hasAccess) return fail("Forbidden", 403);

        const result = await requestPartnership(hostId, venueId, hostName, venueName);
        return ok({ result });
    } catch (error: any) {
        return fail("Failed to request partnership");
    }
});
