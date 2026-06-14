import { NextRequest, NextResponse } from "next/server";
import { listEvents } from "@/lib/server/eventStore";

/**
 * GET /api/venue/availability?venueId=xxx
 *
 * Returns blocked date/time slots based on approved/scheduled/live events.
 * Data fetched via eventStore (API Gateway) — no direct Firestore access.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get("venueId");

    if (!venueId) {
      return NextResponse.json({ error: "venueId is required" }, { status: 400 });
    }

    const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch events for this venue with relevant lifecycle statuses
    // Gateway now supports comma-separated status values via the venueId+status filter
    const events = await listEvents({ venueId, status: "approved,scheduled,live" }, token);

    const blockedSlots = events.map((event: any) => ({
      // Gateway returns startDate as ISO string (Firestore Timestamps are serialized)
      date: event.startDate || event.date || null,
      startTime: event.startTime || null,
      endTime: event.endTime || null,
      eventId: event.id,
      isBlocked: true,
    }));

    return NextResponse.json({ blockedSlots });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
