import { NextRequest } from "next/server";
import { verifyPartnerAccess } from "@/lib/server/auth";
import {
    addGalleryPhoto,
    removeGalleryPhoto,
    reorderGalleryPhotos
} from "@/lib/server/venuePageStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * POST /api/venue/gallery
 * Handle all gallery operations
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
                result = await addGalleryPhoto(venueId, data.imageUrl, data.caption);
                break;
            case "remove":
                if (!data.photoId) return fail("photoId required", 400);
                result = await removeGalleryPhoto(data.photoId);
                break;
            case "reorder":
                if (!data.orderedIds) return fail("orderedIds required", 400);
                result = await reorderGalleryPhotos(venueId, data.orderedIds);
                break;
            default:
                return fail("Invalid action", 400);
        }

        return ok({ result }, "Gallery updated");
    } catch (error: any) {
        console.error("[API /venue/gallery POST] Error:", error.message);
        return fail("Failed to update gallery");
    }
});
