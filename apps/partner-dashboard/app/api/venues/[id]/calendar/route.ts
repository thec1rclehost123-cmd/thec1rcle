import { NextRequest } from "next/server";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

// The gateway route is GET /api/v1/venue/calendar?venueId=...&startDate=...&endDate=...
// (no venueId in path — it's a query param). The id segment from the URL is
// injected as the venueId query param so the gateway can look up the right venue.

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    searchParams.set("venueId", id);
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/venue/calendar?${searchParams.toString()}`, {});
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/venue/calendar?venueId=${id}`, {
        method: "POST",
        body: JSON.stringify({ ...body, venueId: id }),
    });
}
