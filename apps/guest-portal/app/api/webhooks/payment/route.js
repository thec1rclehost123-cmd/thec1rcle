import { NextResponse } from "next/server";
import { getGatewayBaseUrl } from "@/lib/server/gatewayBridge";

export async function POST(request) {
    try {
        const rawBody = await request.text();
        const response = await fetch(`${getGatewayBaseUrl()}/payments/webhook`, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain",
                ...(request.headers.get("x-request-id") ? { "x-request-id": request.headers.get("x-request-id") } : {}),
                ...(request.headers.get("x-razorpay-signature")
                    ? { "x-razorpay-signature": request.headers.get("x-razorpay-signature") }
                    : {}),
            },
            body: rawBody,
            cache: "no-store",
        });

        const text = await response.text();
        let data = {};
        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            data = { error: text || "Gateway returned a non-JSON response" };
        }

        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error("[Webhook Proxy] Error:", error);
        return NextResponse.json({ error: "Failed to proxy payment webhook" }, { status: 500 });
    }
}
