import { NextRequest, NextResponse } from "next/server";
import { verifyEmailOtp, verifySmsOtp } from "@/lib/server/verification";
import { rateLimit } from "@/lib/server/rateLimit";

export async function POST(req: NextRequest) {
    const allowed = await rateLimit(req, 10, 60);
    if (!allowed) {
        return NextResponse.json({ error: "Too many attempts. Please slow down." }, { status: 429 });
    }

    try {
        const { type, recipient, code } = await req.json();

        if (!type || !recipient || !code) {
            return NextResponse.json({ error: "type, recipient, and code are required." }, { status: 400 });
        }

        if (type === "email") {
            await verifyEmailOtp(recipient, code);
        } else if (type === "phone") {
            await verifySmsOtp(recipient, code);
        } else {
            return NextResponse.json({ error: "Invalid type. Must be 'email' or 'phone'." }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Verification failed." }, { status: 400 });
    }
}
