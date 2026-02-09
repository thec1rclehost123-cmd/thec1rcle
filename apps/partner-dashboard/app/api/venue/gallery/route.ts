import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, verifyPartnerAccess } from "@/lib/server/auth";
import {
    addGalleryPhoto,
    removeGalleryPhoto,
    reorderGalleryPhotos
} from "@/lib/server/venuePageStore";

/**
 * POST /api/venue/gallery
 * 
 * Handle all gallery operations
 * Actions: add, remove, reorder
 */
export async function POST(req: NextRequest) {
    console.log("[API /venue/gallery] POST request received");

    try {
        console.log("[API /venue/gallery] Verifying authentication...");
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            console.error("[API /venue/gallery] Authentication failed");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.log("[API /venue/gallery] Authenticated as:", decodedToken.uid);

        const body = await req.json();
        const { venueId, action, data } = body;
        console.log("[API /venue/gallery] Request:", { venueId, action, data });

        if (!venueId || !action) {
            console.error("[API /venue/gallery] Missing venueId or action");
            return NextResponse.json({ error: "venueId and action are required" }, { status: 400 });
        }

        // Verify access
        console.log("[API /venue/gallery] Verifying partner access...");
        const hasAccess = await verifyPartnerAccess(req, venueId);
        if (!hasAccess) {
            console.error("[API /venue/gallery] Access denied for venueId:", venueId);
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        console.log("[API /venue/gallery] Access granted");

        let result;

        switch (action) {
            case "add":
                if (!data.imageUrl) {
                    return NextResponse.json({ error: "imageUrl required" }, { status: 400 });
                }
                console.log("[API /venue/gallery] Adding photo:", data.imageUrl);
                result = await addGalleryPhoto(venueId, data.imageUrl, data.caption);
                console.log("[API /venue/gallery] Photo added:", result);
                break;

            case "remove":
                if (!data.photoId) {
                    return NextResponse.json({ error: "photoId required" }, { status: 400 });
                }
                console.log("[API /venue/gallery] Removing photo:", data.photoId);
                result = await removeGalleryPhoto(data.photoId);
                console.log("[API /venue/gallery] Photo removed:", result);
                break;

            case "reorder":
                if (!data.orderedIds) {
                    return NextResponse.json({ error: "orderedIds required" }, { status: 400 });
                }
                console.log("[API /venue/gallery] Reordering photos:", data.orderedIds);
                result = await reorderGalleryPhotos(venueId, data.orderedIds);
                console.log("[API /venue/gallery] Photos reordered:", result);
                break;

            default:
                console.error("[API /venue/gallery] Invalid action:", action);
                return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        return NextResponse.json({ success: true, result });
    } catch (error: any) {
        console.error("[API /venue/gallery POST] Error:", error.message);
        console.error("[API /venue/gallery POST] Stack:", error.stack);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
