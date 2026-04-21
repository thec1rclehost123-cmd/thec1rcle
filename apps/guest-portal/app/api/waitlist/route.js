import { NextResponse } from "next/server";
import { proxyGatewayJson } from "../../../lib/server/gatewayBridge.js";

export async function POST(request) {
    const body = await request.json().catch(() => ({}));
    const eventId = body?.eventId;
    if (!eventId) {
        return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
    }

    return proxyGatewayJson(request, `/events/${encodeURIComponent(eventId)}/waitlist`, {
        method: "POST",
        requireAuth: false,
        body,
    });
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");
    const email = searchParams.get("email");

    if (!eventId || !email) {
        return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    return proxyGatewayJson(
        request,
        `/events/${encodeURIComponent(eventId)}/waitlist?email=${encodeURIComponent(email)}`,
        {
            method: "GET",
            requireAuth: false,
        }
    );
}
