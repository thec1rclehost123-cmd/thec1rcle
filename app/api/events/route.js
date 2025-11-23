import { NextResponse } from "next/server";
import { createEvent, listEvents } from "../../../lib/server/eventStore";

import { verifyAuth } from "../../../lib/server/auth";

const getQueryParams = (request) => {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city") || undefined;
  const limit = searchParams.get("limit");
  const sort = searchParams.get("sort") || "heat";
  const search = searchParams.get("search") || undefined;
  const parsedLimit = limit ? Number(limit) : undefined;
  return { city, limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined, sort, search };
};

export async function GET(request) {
  try {
    const { city, limit, sort, search } = getQueryParams(request);
    const events = await listEvents({ city, limit, sort, search });
    return NextResponse.json(events);
  } catch (error) {
    console.error("GET /api/events error", error);
    return NextResponse.json({ error: "Failed to load events." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();

    // Verify authentication
    const decodedToken = await verifyAuth(request);
    if (decodedToken) {
      // If authenticated, we could enforce host handle here
      // For now, we just ensure the request is authenticated if we wanted to lock it down
      // payload.host = `@${decodedToken.email.split("@")[0]}`; // Example enforcement
    }

    const event = await createEvent(payload);
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error("POST /api/events error", error);
    const message = error?.message || "Unable to create event.";
    const status = error?.statusCode || 500;
    return NextResponse.json({ error: message }, { status });
  }
}
