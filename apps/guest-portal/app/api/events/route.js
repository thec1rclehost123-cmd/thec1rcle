import { NextResponse } from "next/server";
import { adaptPublicList, fetchPublicEvents } from "../../../lib/server/publicDiscoveryBridge.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await fetchPublicEvents(Object.fromEntries(searchParams.entries()), {
      requestId: request.headers.get("x-request-id") || undefined,
    });

    return NextResponse.json(adaptPublicList(data, "events"), {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("GET /api/events bridge error", error);
    return NextResponse.json({ error: "Failed to load events." }, { status: 500 });
  }
}
