import { NextRequest, NextResponse } from "next/server";
import { getVenueMasterTables, saveMasterTable, deleteMasterTable, getEventTableStatus, updateTableStatus } from "@/lib/server/tableStore";

/**
 * GET /api/venue/tables
 * List club master tables OR get event-specific status
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        const eventId = searchParams.get("eventId");

        if (eventId) {
            const status = await getEventTableStatus(eventId);
            return NextResponse.json(status);
        }

        if (!venueId) {
            return NextResponse.json({ error: "venueId is required" }, { status: 400 });
        }

        const tables = await getVenueMasterTables(venueId);
        return NextResponse.json(tables);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/venue/tables
 * Create/Update master table OR update event table status
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { venueId, eventId, action, tableId, status, notes, table } = body;

        if (action === "updateStatus") {
            if (!eventId || !tableId || !status) {
                return NextResponse.json({ error: "eventId, tableId, and status are required" }, { status: 400 });
            }
            const result = await updateTableStatus(eventId, tableId, status, notes);
            return NextResponse.json(result);
        }

        if (!venueId || !table) {
            return NextResponse.json({ error: "venueId and table are required" }, { status: 400 });
        }

        const savedTable = await saveMasterTable(venueId, table);
        return NextResponse.json(savedTable);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * DELETE /api/venue/tables
 * Delete a table
 */
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const tableId = searchParams.get("tableId");

        if (!tableId) {
            return NextResponse.json({ error: "tableId is required" }, { status: 400 });
        }

        await deleteMasterTable(tableId);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
