import { NextResponse } from "next/server";
import { flagPaymentFailure } from "../../../../lib/server/queueStore";
import { verifyAuth } from "../../../../lib/server/auth";

export async function POST(request) {
    try {
        const payload = await request.json();
        const { admissionToken } = payload;

        if (!admissionToken) {
            return NextResponse.json({ error: "Token required" }, { status: 400 });
        }

        const parts = admissionToken.split(":");
        if (parts.length === 4) {
            const queueId = parts[2];
            await flagPaymentFailure(queueId);
            return NextResponse.json({ success: true, message: "Retry window activated" });
        }

        return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    } catch (error) {
        console.error("POST /api/checkout/failure error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
