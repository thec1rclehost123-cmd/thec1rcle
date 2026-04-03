import { NextRequest } from "next/server";
import { withAuth } from "@/lib/server/withAuth";
import { fail, ok } from "@/lib/server/apiResponse";
import { getConnectionForViewer, getPartnerProfileSummary } from "@/lib/server/partnerProfiles";

export const GET = withAuth(async (req: NextRequest, auth, ctx) => {
    const { id } = await ctx.params;

    if (!id) return fail("Partner id is required", 400);

    const { searchParams } = new URL(req.url);
    const viewerRole = searchParams.get("viewerRole") || auth.partnerType || "";
    const viewerId = searchParams.get("viewerId") || auth.partnerId || "";

    const profile = await getPartnerProfileSummary(id);
    if (!profile) return fail("Partner not found", 404);

    const connection = await getConnectionForViewer({
        viewerRole,
        viewerId,
        partnerId: profile.id,
        partnerType: profile.type,
    });

    return ok({
        profile,
        connection: connection
            ? {
                id: connection.id,
                status: connection.status || null,
                type: connection.type || null,
                initiatedBy: connection.initiatedBy || null,
            }
            : null,
    });
});
