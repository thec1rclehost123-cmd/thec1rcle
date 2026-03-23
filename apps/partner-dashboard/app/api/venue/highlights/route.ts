import { NextRequest } from "next/server";
import { verifyPartnerAccess } from "@/lib/server/auth";
import {
    createHighlight,
    updateHighlight,
    deleteHighlight,
    addImageToHighlight,
    removeImageFromHighlight,
    reorderHighlightImages,
    reorderHighlights
} from "@/lib/server/venuePageStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * POST /api/venue/highlights
 * Handle all highlight operations
 * Actions: create, update, delete, addImage, removeImage, reorderImages, reorder
 */
export const POST = withAuth(async (req: NextRequest, auth) => {
    try {
        const body = await req.json();
        const { venueId, action, data } = body;

        if (!venueId || !action) return fail("venueId and action are required", 400);

        const hasAccess = await verifyPartnerAccess(req, venueId);
        if (!hasAccess) return fail("Forbidden", 403);

        let result;

        switch (action) {
            case "create":
                result = await createHighlight(venueId, data);
                break;
            case "update":
                if (!data.highlightId) return fail("highlightId required", 400);
                result = await updateHighlight(data.highlightId, venueId, data.updates);
                break;
            case "delete":
                if (!data.highlightId) return fail("highlightId required", 400);
                result = await deleteHighlight(data.highlightId);
                break;
            case "addImage":
                if (!data.highlightId || !data.imageUrl) return fail("highlightId and imageUrl required", 400);
                result = await addImageToHighlight(data.highlightId, data.imageUrl);
                break;
            case "removeImage":
                if (!data.highlightId || !data.imageUrl) return fail("highlightId and imageUrl required", 400);
                result = await removeImageFromHighlight(data.highlightId, data.imageUrl);
                break;
            case "reorderImages":
                if (!data.highlightId || !data.images) return fail("highlightId and images required", 400);
                result = await reorderHighlightImages(data.highlightId, data.images);
                break;
            case "reorder":
                if (!data.orderedIds) return fail("orderedIds required", 400);
                result = await reorderHighlights(venueId, data.orderedIds);
                break;
            default:
                return fail("Invalid action", 400);
        }

        return ok({ result }, "Highlights updated");
    } catch (error: any) {
        console.error("[API /venue/highlights POST]", error);
        return fail("Failed to update highlights");
    }
});
