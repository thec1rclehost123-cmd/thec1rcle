import { NextRequest } from "next/server";
import { verifyPartnerAccess } from "@/lib/server/auth";
import {
    addFacility,
    updateFacility,
    deleteFacility,
    toggleFacility,
    reorderFacilities,
    initializeDefaultFacilities
} from "@/lib/server/venuePageStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * POST /api/venue/facilities
 * Handle all facility operations
 * Actions: add, update, delete, toggle, reorder, initialize
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
                if (!data.name) return fail("name required", 400);
                result = await addFacility(venueId, data.name, data.icon);
                break;
            case "update":
                if (!data.facilityId) return fail("facilityId required", 400);
                result = await updateFacility(data.facilityId, data.updates);
                break;
            case "delete":
                if (!data.facilityId) return fail("facilityId required", 400);
                result = await deleteFacility(data.facilityId);
                break;
            case "toggle":
                if (!data.facilityId || data.isEnabled === undefined) return fail("facilityId and isEnabled required", 400);
                result = await toggleFacility(data.facilityId, data.isEnabled);
                break;
            case "reorder":
                if (!data.orderedIds) return fail("orderedIds required", 400);
                result = await reorderFacilities(venueId, data.orderedIds);
                break;
            case "initialize":
                result = await initializeDefaultFacilities(venueId);
                break;
            default:
                return fail("Invalid action", 400);
        }

        return ok({ result }, "Facilities updated");
    } catch (error: any) {
        console.error("[API /venue/facilities POST]", error);
        return fail("Failed to update facilities");
    }
});
