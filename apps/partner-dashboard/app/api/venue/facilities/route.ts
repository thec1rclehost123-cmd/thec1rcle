import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, verifyPartnerAccess } from "@/lib/server/auth";
import {
  addFacility,
  updateFacility,
  deleteFacility,
  toggleFacility,
  reorderFacilities,
  initializeDefaultFacilities,
} from "@/lib/server/venuePageStore";

/**
 * POST /api/venue/facilities
 *
 * Handle all facility operations
 * Actions: add, update, delete, toggle, reorder, initialize
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
        if (!data.name) {
          return NextResponse.json({ error: "name required" }, { status: 400 });
        }
        result = await addFacility(venueId, data.name, data.icon);
        break;

      case "update":
        if (!data.facilityId) {
          return NextResponse.json({ error: "facilityId required" }, { status: 400 });
        }
        result = await updateFacility(data.facilityId, data.updates);
        break;

      case "delete":
        if (!data.facilityId) {
          return NextResponse.json({ error: "facilityId required" }, { status: 400 });
        }
        result = await deleteFacility(data.facilityId);
        break;

      case "toggle":
        if (!data.facilityId || data.isEnabled === undefined) {
          return NextResponse.json({ error: "facilityId and isEnabled required" }, { status: 400 });
        }
        result = await toggleFacility(data.facilityId, data.isEnabled);
        break;

      case "reorder":
        if (!data.orderedIds) {
          return NextResponse.json({ error: "orderedIds required" }, { status: 400 });
        }
        result = await reorderFacilities(venueId, data.orderedIds);
        break;

      case "initialize":
        result = await initializeDefaultFacilities(venueId);
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("[API /venue/facilities POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
