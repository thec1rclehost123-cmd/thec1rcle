import { NextResponse } from "next/server";
import { createEvent, listEvents } from "../../../lib/server/eventStore";

const getQueryParams = (request) => {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city") || undefined;
  const limit = searchParams.get("limit");
  const sort = searchParams.get("sort") || "heat";
  const parsedLimit = limit ? Number(limit) : undefined;
  return { city, limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined, sort };
};

export async function GET(request) {
  try {
    const { city, limit, sort } = getQueryParams(request);
    const events = await listEvents({ city, limit, sort });
    return NextResponse.json(events);
  } catch (error) {
    console.error("GET /api/events error", error);
    return NextResponse.json({ error: "Failed to load events." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const event = await createEvent(payload);
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error("POST /api/events error", error);
    const message = error?.message || "Unable to create event.";
    const status = error?.statusCode || 500;
    return NextResponse.json({ error: message }, { status });
  }
}
