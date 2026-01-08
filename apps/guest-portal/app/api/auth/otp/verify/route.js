
import { NextResponse } from "next/server";
import { verifyEmailOtp, verifySmsOtp } from "@/lib/server/verification";
import { rateLimit } from "@/lib/server/rateLimit";

export async function POST(req) {
    if (!rateLimit(req, 10, 60000)) {
        return NextResponse.json({ error: "Extreme attempts detected. Cooling down." }, { status: 429 });
    }

    try {
        const { type, recipient, code } = await req.json();

        if (!recipient || !code) {
            return NextResponse.json({ error: "Ritual incomplete." }, { status: 400 });
        }

        let success = false;
        if (type === "email") {
            success = await verifyEmailOtp(recipient, code);
        } else if (type === "phone") {
            success = await verifySmsOtp(recipient, code);
        } else {
            return NextResponse.json({ error: "Invalid protocol." }, { status: 400 });
        }

        return NextResponse.json({ success });
    } catch (err) {
        return NextResponse.json({ error: err.message || "Protocol mismatch." }, { status: 400 });
    }
}
