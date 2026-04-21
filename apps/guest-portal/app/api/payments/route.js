import { NextResponse } from "next/server";
import { adaptGatewayPaymentConfig, adaptGatewayPaymentOrder } from "../../../lib/server/checkoutGatewayBridge";
import { callGatewayJson, getBearerTokenFromRequest, proxyGatewayJson } from "../../../lib/server/gatewayBridge";

export async function GET(request) {
    try {
        const { response, data } = await callGatewayJson("/payments/config", {
            requestId: request.headers.get("x-request-id") || undefined,
        });

        return NextResponse.json(adaptGatewayPaymentConfig(data), { status: response.status });
    } catch (error) {
        console.error("[Payments API] GET bridge error:", error);
        return NextResponse.json({ error: "Failed to get payment config" }, { status: 500 });
    }
}

export async function POST(request) {
    const token = await getBearerTokenFromRequest(request);
    if (!token) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const payload = await request.json();
        const [paymentOrder, paymentConfig] = await Promise.all([
            callGatewayJson("/payments/order", {
                method: "POST",
                token,
                body: payload,
                requestId: request.headers.get("x-request-id") || undefined,
            }),
            callGatewayJson("/payments/config", {
                token,
                requestId: request.headers.get("x-request-id") || undefined,
            }),
        ]);

        if (!paymentOrder.response.ok) {
            return NextResponse.json(paymentOrder.data, { status: paymentOrder.response.status });
        }

        return NextResponse.json(
            adaptGatewayPaymentOrder(paymentOrder.data, paymentConfig.data),
            { status: paymentOrder.response.status }
        );
    } catch (error) {
        console.error("[Payments API] POST bridge error:", error);
        return NextResponse.json({ error: "Failed to create payment" }, { status: 500 });
    }
}

export async function PATCH(request) {
    return proxyGatewayJson(request, "/payments/verify", {
        method: "PATCH",
        requireAuth: true,
    });
}
