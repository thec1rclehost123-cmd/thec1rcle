import { NextRequest } from "next/server";
import { verifyPartnerAccess } from "@/lib/server/auth";
import {
    addMenuImage,
    removeMenuImage,
    reorderMenuImages
} from "@/lib/server/venuePageStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * POST /api/venue/menu
 * Handle all menu operations
 * Actions: add, remove, reorder
 */
export const POST = withAuth(async (req: NextRequest) => {
    try {
        const body = await req.json();
        const { venueId, action, data } = body;

        if (!venueId || !action) return fail("venueId and action are required", 400);

        const hasAccess = await verifyPartnerAccess(req, venueId);
        if (!hasAccess) return fail("Forbidden", 403);

        let result;

        switch (action) {
            case "add":
                if (!data.imageUrl) return fail("imageUrl required", 400);
                result = await addMenuImage(venueId, data.imageUrl, data.title);
                break;
            case "remove":
                if (!data.menuId) return fail("menuId required", 400);
                result = await removeMenuImage(data.menuId);
                break;
            case "reorder":
                if (!data.orderedIds) return fail("orderedIds required", 400);
                result = await reorderMenuImages(venueId, data.orderedIds);
                break;
            default:
                return fail("Invalid action", 400);
        }

        return ok({ result }, "Menu updated");
    } catch (error: any) {
        console.error("[API /venue/menu POST]", error);
        return fail("Failed to update menu");
    }
});
