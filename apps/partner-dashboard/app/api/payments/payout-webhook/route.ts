import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { logger } from "@/lib/server/logger";

function verifySignature(rawBody: string, signature: string): boolean {
    const secret = process.env.RAZORPAYX_WEBHOOK_SECRET;
    if (!secret) return false;

    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    try {
        return timingSafeEqual(
            Buffer.from(expected, "hex"),
            Buffer.from(signature, "hex")
        );
    } catch {
        return false;
    }
}

export async function POST(req: NextRequest) {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") ?? "";

    if (!signature || !verifySignature(rawBody, signature)) {
        logger.warn("payments/payout-webhook", "Invalid payout webhook signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const payload = JSON.parse(rawBody);

    await getAdminDb().collection("payment_provider_webhooks").add({
        provider: "razorpayx",
        event: payload?.event || "unknown",
        payload,
        receivedAt: Date.now(),
    });

    logger.info("payments/payout-webhook", "Webhook recorded", {
        event: payload?.event || "unknown",
    });

    return NextResponse.json({ received: true });
}
