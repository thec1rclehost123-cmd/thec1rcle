import { NextResponse } from "next/server";
import { getEventFinanceBreakdown } from "../../../../lib/server/financeStore";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const eventId = searchParams.get("eventId");

        if (!eventId) {
            return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
        }

        const finance = await getEventFinanceBreakdown(eventId);
        return NextResponse.json({ data: finance });
    } catch (err) {
        console.error("[FinanceAPI] Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
