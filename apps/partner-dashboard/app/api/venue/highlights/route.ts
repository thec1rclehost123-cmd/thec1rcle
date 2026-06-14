import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, verifyPartnerAccess } from "@/lib/server/auth";
import {
  createHighlight,
  updateHighlight,
  deleteHighlight,
  addImageToHighlight,
  removeImageFromHighlight,
  reorderHighlightImages,
  reorderHighlights,
} from "@/lib/server/venuePageStore";

/**
 * POST /api/venue/highlights
 *
 * Handle all highlight operations
 * Actions: create, update, delete, addImage, removeImage, reorderImages, reorder
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

    const user = {
      uid: decodedToken.uid,
      name: decodedToken.name || decodedToken.email || "User",
    };

    let result;

    switch (action) {
      case "create":
        result = await createHighlight(venueId, data, user);
        break;

      case "update":
        if (!data.highlightId) {
          return NextResponse.json({ error: "highlightId required" }, { status: 400 });
        }
        result = await updateHighlight(data.highlightId, data.updates, user);
        break;

      case "delete":
        if (!data.highlightId) {
          return NextResponse.json({ error: "highlightId required" }, { status: 400 });
        }
        result = await deleteHighlight(data.highlightId);
        break;

      case "addImage":
        if (!data.highlightId || !data.imageUrl) {
          return NextResponse.json({ error: "highlightId and imageUrl required" }, { status: 400 });
        }
        result = await addImageToHighlight(data.highlightId, data.imageUrl);
        break;

      case "removeImage":
        if (!data.highlightId || !data.imageUrl) {
          return NextResponse.json({ error: "highlightId and imageUrl required" }, { status: 400 });
        }
        result = await removeImageFromHighlight(data.highlightId, data.imageUrl);
        break;

      case "reorderImages":
        if (!data.highlightId || !data.images) {
          return NextResponse.json({ error: "highlightId and images required" }, { status: 400 });
        }
        result = await reorderHighlightImages(data.highlightId, data.images);
        break;

      case "reorder":
        if (!data.orderedIds) {
          return NextResponse.json({ error: "orderedIds required" }, { status: 400 });
        }
        result = await reorderHighlights(venueId, data.orderedIds);
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("[API /venue/highlights POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
