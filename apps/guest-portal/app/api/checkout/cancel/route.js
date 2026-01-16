import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { cancelOrder, getOrderById } from "@/lib/server/orderStore";

export async function POST(request) {
    try {
        const decodedToken = await verifyAuth(request);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { orderId } = await request.json();

        if (!orderId) {
            return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
        }

        const order = await getOrderById(orderId);
        if (!order) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        if (order.userId !== decodedToken.uid) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        // Only cancel if it's still pending
        if (order.status === "pending_payment") {
            await cancelOrder(orderId);
            return NextResponse.json({ success: true, message: "Order cancelled and inventory restored" });
        }

        return NextResponse.json({ success: false, message: "Order cannot be cancelled in current state" });

    } catch (error) {
        console.error("POST /api/checkout/cancel error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
