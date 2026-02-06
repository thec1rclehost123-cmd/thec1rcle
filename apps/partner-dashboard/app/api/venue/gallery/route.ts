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
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { venueId, action, data } = body;

        if (!venueId || !action) {
            return NextResponse.json({ error: "venueId and action are required" }, { status: 400 });
        }

        // Verify access
        const hasAccess = await verifyPartnerAccess(req, venueId);
        if (!hasAccess) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        let result;

        switch (action) {
            case "add":
                if (!data.imageUrl) {
                    return NextResponse.json({ error: "imageUrl required" }, { status: 400 });
                }
                result = await addGalleryPhoto(venueId, data.imageUrl, data.caption);
                break;

            case "remove":
                if (!data.photoId) {
                    return NextResponse.json({ error: "photoId required" }, { status: 400 });
                }
                result = await removeGalleryPhoto(data.photoId);
                break;

            case "reorder":
                if (!data.orderedIds) {
                    return NextResponse.json({ error: "orderedIds required" }, { status: 400 });
                }
                result = await reorderGalleryPhotos(venueId, data.orderedIds);
                break;

            default:
                return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        return NextResponse.json({ success: true, result });
    } catch (error: any) {
        console.error("[API /venue/gallery POST]", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
