import { NextResponse } from "next/server";
import { callGatewayJson, getBearerTokenFromRequest } from "../../../lib/server/gatewayBridge";

export async function GET(request) {
    const token = await getBearerTokenFromRequest(request);
    if (!token) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const orderId = searchParams.get("orderId");
        const path = orderId ? `/orders/${encodeURIComponent(orderId)}` : "/orders";

        const { response, data } = await callGatewayJson(path, {
            token,
            requestId: request.headers.get("x-request-id") || undefined,
        });

        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error("GET /api/orders bridge error", error);
        return NextResponse.json({ error: "Failed to fetch order(s)" }, { status: 500 });
    }
}

export async function POST() {
    return NextResponse.json(
        { error: "Direct order creation is no longer supported. Use the checkout endpoints." },
        { status: 405 }
    );
}
