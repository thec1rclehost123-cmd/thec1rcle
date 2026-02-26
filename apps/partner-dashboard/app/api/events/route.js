import { NextResponse } from "next/server";
import { createEvent, listEvents } from "../../../lib/server/eventStore";
import { verifyAuth, verifyHostRole } from "../../../lib/server/auth";

const getQueryParams = (request) => {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city") || undefined;
  const limit = searchParams.get("limit");
  const sort = searchParams.get("sort") || "heat";
  const search = searchParams.get("search") || undefined;
  const host = searchParams.get("host") || undefined;
  const venueId = searchParams.get("venueId") || undefined;
  const lifecycle = searchParams.get("lifecycle") || undefined;
  const creatorRole = searchParams.get("creatorRole") || undefined;
  const parsedLimit = limit ? Number(limit) : undefined;
  return { city, limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined, sort, search, host, venueId, lifecycle, creatorRole };
};

export async function GET(request) {
  const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL;

  if (gatewayUrl) {
    try {
      const { searchParams } = new URL(request.url);
      const hostId = searchParams.get("host") || searchParams.get("creatorId");
      const authHeader = request.headers.get("Authorization");

      // Use the host-specific events endpoint if host filter is present
      const endpoint = hostId ? `/api/v1/host/events?hostId=${hostId}` : "/api/v1/events";
      const response = await fetch(`${gatewayUrl}${endpoint}`, {
        headers: {
          'Authorization': authHeader || '',
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return NextResponse.json({ error: errorData.error || "Gateway error" }, { status: response.status });
      }

      const data = await response.json();
      return NextResponse.json(data);
    } catch (error) {
      console.error("[Events Redirect] Error:", error);
      return NextResponse.json({ error: "Failed to fetch from Gateway" }, { status: 502 });
    }
  }

  try {
    const { city, limit, sort, search, host, venueId, lifecycle, creatorRole } = getQueryParams(request);
    const events = await listEvents({ city, limit, sort, search, host, venueId, lifecycle, creatorRole });
    return NextResponse.json(events);
  } catch (error) {
    console.error("GET /api/events error", error);
    return NextResponse.json({ error: "Failed to load events." }, { status: 500 });
  }
}

export async function POST(request) {
  // Keeping POST local for now as it involves complex event building, 
  // but in Phase 3 we can move event creation to Gateway as well.
  try {
    const isHost = await verifyHostRole(request);
    if (!isHost) {
      return NextResponse.json({ error: "Unauthorized. Host role required." }, { status: 403 });
    }

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
