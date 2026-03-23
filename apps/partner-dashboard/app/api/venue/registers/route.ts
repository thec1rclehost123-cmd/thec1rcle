import { NextRequest } from "next/server";
import {
    getDateRegister,
    updateRegisterNotes,
    updateExpectedFootfall,
    addStaffAssignment,
    removeStaffAssignment,
    logIncident,
    resolveIncident,
    addInspection,
    addReminder,
    completeReminder,
    updateDayClose,
    getRegistersForRange,
    getIncidentSummary
} from "@/lib/server/registerStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * GET /api/venue/registers
 * Get register for a date or range
 */
export const GET = withAuth(async (req: NextRequest) => {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        const date = searchParams.get("date");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const report = searchParams.get("report");

        if (!venueId) return fail("venueId is required", 400);

        if (report === "incidents" && startDate && endDate) {
            const summary = await getIncidentSummary(venueId, startDate, endDate);
            return ok({ summary });
        }

        if (startDate && endDate) {
            const registers = await getRegistersForRange(venueId, startDate, endDate);
            return ok({ registers });
        }

        if (date) {
            const register = await getDateRegister(venueId, date);
            return ok({ register });
        }

        return fail("date or startDate/endDate range required", 400);
    } catch (error: any) {
        console.error("[Registers API] GET Error:", error);
        return fail("Failed to fetch register");
    }
});

/**
 * POST /api/venue/registers
 * Add items to register (incidents, inspections, reminders, assignments)
 */
export const POST = withAuth(async (req: NextRequest) => {
    try {
        const body = await req.json();
        const { venueId, date, action, data, user } = body;

        if (!venueId || !date || !action) return fail("venueId, date, and action are required", 400);

        let result;

        switch (action) {
            case "addStaffAssignment":
                result = await addStaffAssignment(venueId, date, data);
                break;
            case "logIncident":
                result = await logIncident(venueId, date, data, user);
                break;
            case "addInspection":
                result = await addInspection(venueId, date, data, user);
                break;
            case "addReminder":
                result = await addReminder(venueId, date, data, user);
                break;
            default:
                return fail(`Invalid action: ${action}`, 400);
        }

        return ok({ ...result }, "Register updated", 201);
    } catch (error: any) {
        console.error("[Registers API] POST Error:", error);
        return fail("Failed to add to register");
    }
});

/**
 * PATCH /api/venue/registers
 * Update register data
 */
export const PATCH = withAuth(async (req: NextRequest) => {
    try {
        const body = await req.json();
        const { venueId, date, action, data, user } = body;

        if (!venueId || !date || !action) return fail("venueId, date, and action are required", 400);

        let result;

        switch (action) {
            case "updateNotes":
                if (!data.noteType || data.content === undefined) return fail("noteType and content required", 400);
                result = await updateRegisterNotes(venueId, date, data.noteType, data.content, user);
                break;
            case "updateFootfall":
                result = await updateExpectedFootfall(venueId, date, data.count, user);
                break;
            case "removeStaffAssignment":
                result = await removeStaffAssignment(venueId, date, data.assignmentId);
                break;
            case "resolveIncident":
                result = await resolveIncident(venueId, date, data.incidentId, data.resolution, user);
                break;
            case "completeReminder":
                result = await completeReminder(venueId, date, data.reminderId, user);
                break;
            case "dayClose":
                result = await updateDayClose(venueId, date, data, user);
                break;
            default:
                return fail(`Invalid action: ${action}`, 400);
        }

        return ok({ register: result }, "Register updated");
    } catch (error: any) {
        console.error("[Registers API] PATCH Error:", error);
        return fail("Failed to update register");
    }
});
