import { NextRequest } from "next/server";
import { deactivateLink, listPromoterLinks, reactivateLink, updatePromoterLinkAlias } from "@/lib/server/promoterLinkStore";
import { requirePromoterAccess } from "@/lib/server/promoterAuthMiddleware";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * PATCH /api/promoter/links/[id]
 * Deactivate a promoter link. Verifies ownership before acting.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await requirePromoterAccess(req);
    if ("error" in ctx) return fail(ctx.error, ctx.status);

    try {
        const { id: linkId } = await params;
        const body = await req.json();

        if (!["deactivate", "reactivate", "update_alias"].includes(body.action)) return fail("Invalid action", 400);

        // Ownership check — fetch link and confirm it belongs to this promoter
        const [link] = await listPromoterLinks({ linkId, promoterId: ctx.promoterId, limit: 1 });

        if (!link) return fail("Link not found", 404);

        if (body.action === "deactivate") {
            await deactivateLink(linkId);
            return ok({});
        }

        if (body.action === "reactivate") {
            await reactivateLink(linkId);
            return ok({});
        }

        const updatedLink = await updatePromoterLinkAlias(linkId, ctx.promoterId, body.editableSlug);
        return ok({ link: updatedLink });
    } catch (error: any) {
        console.error("[Promoter Links PATCH] Error:", error);
        if (error?.status) return fail(error.message || "Failed to update link", error.status);
        return fail("Failed to update link");
    }
}
