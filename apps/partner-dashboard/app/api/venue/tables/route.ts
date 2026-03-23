import { NextRequest } from "next/server";
import { getVenueMasterTables, saveMasterTable, deleteMasterTable, getEventTableStatus, updateTableStatus } from "@/lib/server/tableStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * GET /api/venue/tables
 * List club master tables OR get event-specific status
 */
export const GET = withAuth(async (req: NextRequest) => {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        const eventId = searchParams.get("eventId");

        if (eventId) {
            const status = await getEventTableStatus(eventId);
            return ok({ status });
        }

        if (!venueId) return fail("venueId is required", 400);

        const tables = await getVenueMasterTables(venueId);
        return ok({ tables });
    } catch (error: any) {
        return fail("Failed to fetch tables");
    }
});

/**
 * POST /api/venue/tables
 * Create/Update master table OR update event table status
 */
export const POST = withAuth(async (req: NextRequest) => {
    try {
        const body = await req.json();
        const { venueId, eventId, action, tableId, status, notes, table } = body;

        if (action === "updateStatus") {
            if (!eventId || !tableId || !status) return fail("eventId, tableId, and status are required", 400);
            const result = await updateTableStatus(eventId, tableId, status, notes);
            return ok({ result });
        }

        if (!venueId || !table) return fail("venueId and table are required", 400);

        const savedTable = await saveMasterTable(venueId, table);
        return ok({ table: savedTable });
    } catch (error: any) {
        return fail("Failed to save table");
    }
});

/**
 * DELETE /api/venue/tables
 * Delete a table
 */
export const DELETE = withAuth(async (req: NextRequest) => {
    try {
        const { searchParams } = new URL(req.url);
        const tableId = searchParams.get("tableId");
        if (!tableId) return fail("tableId is required", 400);

        await deleteMasterTable(tableId);
        return ok({ success: true }, "Table deleted");
    } catch (error: any) {
        return fail("Failed to delete table");
    }
});
