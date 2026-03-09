import { NextResponse } from "next/server";

export async function POST(request, { params }) {
    try {
        const { eventId } = params;
        if (!eventId) return NextResponse.json({ ok: false }, { status: 400 });

        const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
        const userAgent = request.headers.get("user-agent") || "unknown";
        const viewerId = Buffer.from(`${ip}-${userAgent}`).toString("base64");

        const { trackEventView } = await import("@c1rcle/core/analytics-service");
        await trackEventView(eventId, viewerId);

        return NextResponse.json({ ok: true });
    } catch (err) {
        // Non-critical — never surface analytics errors to the client
        console.error("[/api/events/view] Failed to track view:", err);
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}
