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
  const creatorId = searchParams.get("creatorId") || undefined;
  const parsedLimit = limit ? Number(limit) : undefined;
  return { city, limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined, sort, search, host, venueId, lifecycle, creatorRole, creatorId };
};

export async function GET(request) {
  const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL;

  if (gatewayUrl) {
    try {
      const { searchParams } = new URL(request.url);
      const authHeader = request.headers.get("Authorization");

      // Build the query string dynamically
      let endpoint = "/api/v1/events?";
      searchParams.forEach((value, key) => {
        endpoint += `${key}=${encodeURIComponent(value)}&`;
      });

      const response = await fetch(`${gatewayUrl}${endpoint.slice(0, -1)}`, {
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
      console.error("[Events Redirect] Gateway unavailable, falling back to Firestore:", error.message);
      // Fall through to direct Firestore below
    }
  }

  try {
    const { city, limit, sort, search, host, venueId, lifecycle, creatorRole, creatorId } = getQueryParams(request);
    const events = await listEvents({ city, limit, sort, search, host, venueId, lifecycle, creatorRole, creatorId });
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
