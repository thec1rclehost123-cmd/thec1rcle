import { NextRequest, NextResponse } from "next/server";
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

/**
 * GET /api/club/registers
 * Get register for a date or range
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const clubId = searchParams.get("clubId");
        const date = searchParams.get("date");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const report = searchParams.get("report");

        if (!clubId) {
            return NextResponse.json(
                { error: "clubId is required" },
                { status: 400 }
            );
        }

        // Get incident summary report
        if (report === "incidents" && startDate && endDate) {
            const summary = await getIncidentSummary(clubId, startDate, endDate);
            return NextResponse.json({ summary });
        }

        // Get range of registers
        if (startDate && endDate) {
            const registers = await getRegistersForRange(clubId, startDate, endDate);
            return NextResponse.json({ registers });
        }

        // Get single date register
        if (date) {
            const register = await getDateRegister(clubId, date);
            return NextResponse.json({ register });
        }

        return NextResponse.json(
            { error: "date or startDate/endDate range required" },
            { status: 400 }
        );
    } catch (error: any) {
        console.error("[Registers API] GET Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch register" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/club/registers
 * Add items to register (incidents, inspections, reminders, assignments)
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { clubId, date, action, data, user } = body;

        if (!clubId || !date || !action) {
            return NextResponse.json(
                { error: "clubId, date, and action are required" },
                { status: 400 }
            );
        }

        let result;

        switch (action) {
            case "addStaffAssignment":
                result = await addStaffAssignment(clubId, date, data);
                break;

            case "logIncident":
                result = await logIncident(clubId, date, data, user);
                break;

            case "addInspection":
                result = await addInspection(clubId, date, data, user);
                break;

            case "addReminder":
                result = await addReminder(clubId, date, data, user);
                break;

            default:
                return NextResponse.json(
                    { error: `Invalid action: ${action}` },
                    { status: 400 }
                );
        }

        return NextResponse.json({ success: true, ...result }, { status: 201 });
    } catch (error: any) {
        console.error("[Registers API] POST Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to add to register" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/club/registers
 * Update register data
 */
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { clubId, date, action, data, user } = body;

        if (!clubId || !date || !action) {
            return NextResponse.json(
                { error: "clubId, date, and action are required" },
                { status: 400 }
            );
        }

        let result;

        switch (action) {
            case "updateNotes":
                if (!data.noteType || data.content === undefined) {
                    return NextResponse.json(
                        { error: "noteType and content required" },
                        { status: 400 }
                    );
                }
                result = await updateRegisterNotes(clubId, date, data.noteType, data.content, user);
                break;

            case "updateFootfall":
                result = await updateExpectedFootfall(clubId, date, data.count, user);
                break;

            case "removeStaffAssignment":
                result = await removeStaffAssignment(clubId, date, data.assignmentId);
                break;

            case "resolveIncident":
                result = await resolveIncident(clubId, date, data.incidentId, data.resolution, user);
                break;

            case "completeReminder":
                result = await completeReminder(clubId, date, data.reminderId, user);
                break;

            case "dayClose":
                result = await updateDayClose(clubId, date, data, user);
                break;

            default:
                return NextResponse.json(
                    { error: `Invalid action: ${action}` },
                    { status: 400 }
                );
        }

        return NextResponse.json({ success: true, register: result });
    } catch (error: any) {
        console.error("[Registers API] PATCH Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to update register" },
            { status: 500 }
        );
    }
}
