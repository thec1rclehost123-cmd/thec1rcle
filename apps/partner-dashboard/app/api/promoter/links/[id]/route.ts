import { NextRequest } from "next/server";
import { deactivateLink, listPromoterLinks } from "@/lib/server/promoterLinkStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * PATCH /api/promoter/links/[id]
 * Deactivate a promoter link. Verifies ownership before acting.
 */
export const PATCH = withAuth(async (req: NextRequest, auth, ctx) => {
    try {
        const linkId = ctx?.params?.id as string;
        const body = await req.json();

        if (body.action !== "deactivate") return fail("Invalid action", 400);

        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";

        // Ownership check — fetch link and confirm it belongs to this promoter
        const links = await listPromoterLinks({ linkId }, token);
        const link = Array.isArray(links) ? links.find((l: any) => l.id === linkId) : null;

        if (link && link.promoterId && link.promoterId !== auth.uid) {
            return fail("Forbidden", 403);
        }

        await deactivateLink(linkId, token);

        return ok({});
    } catch (error: any) {
        console.error("[Promoter Links PATCH] Error:", error);
        return fail("Failed to deactivate link");
    }
});
