import { NextResponse } from "next/server";
import { createOrder, getOrderById, getUserOrders } from "../../../lib/server/orderStore";
import { getEvent } from "../../../lib/server/eventStore";
import { sendTicketEmail } from "../../../lib/email";
import { verifyAuth } from "../../../lib/server/auth";

import { createOrderSchema, validateBody } from "../../../lib/server/validators";
import { withRateLimit } from "../../../lib/server/rateLimit";

async function handler(request) {
    try {
        // Validate Body
        const { data: payload, error } = await validateBody(request, createOrderSchema);
        if (error) {
            return NextResponse.json({ error }, { status: 400 });
        }

        // Verify authentication
        const decodedToken = await verifyAuth(request);
        if (!decodedToken) {
            return NextResponse.json({ error: "Authentication required to book tickets." }, { status: 401 });
        }

        // Enforce the correct userId from the auth token
        payload.userId = decodedToken.uid;
        payload.userEmail = decodedToken.email || payload.userEmail;



        if (payload.tickets.length === 0) {
            return NextResponse.json(
                { error: "No tickets selected" },
                { status: 400 }
            );
        }

        // Create the order
        const order = await createOrder(payload);

        // Send confirmation email
        try {
            const event = await getEvent(payload.eventId);
            if (event && payload.userEmail) {
                const origin = new URL(request.url).origin;
                const posterUrl = event.image.startsWith('http') ? event.image : `${origin}${event.image}`;

                await sendTicketEmail({
                    to: payload.userEmail,
                    userName: payload.userName || "Guest",
                    eventName: event.title,
                    eventDate: new Date(event.startDate).toLocaleDateString('en-IN', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                        timeZone: 'Asia/Kolkata'
                    }),
                    eventLocation: event.location,
                    eventPosterUrl: posterUrl,
                    orderId: order.id,
                    tickets: order.tickets,
                    totalAmount: order.totalAmount
                });
            }
        } catch (emailError) {
            console.error("Failed to send confirmation email:", emailError);
            // Don't fail the order creation if email fails
        }

        return NextResponse.json(order, { status: 201 });
    } catch (error) {
        console.error("POST /api/orders error", error);

        // Handle specific error types
        if (error.message?.includes("not available") || error.message?.includes("sold out")) {
            return NextResponse.json({ error: error.message }, { status: 409 }); // Conflict
        }

        if (error.statusCode === 400) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json(
            { error: error.message || "Failed to create order" },
            { status: 500 }
        );
    }
}


// Apply Rate Limit: 5 orders per minute per IP
export const POST = withRateLimit(handler, 5);

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const orderId = searchParams.get("orderId");
        const userId = searchParams.get("userId");

        if (orderId) {
            const order = await getOrderById(orderId);
            if (!order) {
                return NextResponse.json({ error: "Order not found" }, { status: 404 });
            }
            return NextResponse.json(order);
        }

        if (userId) {
            const orders = await getUserOrders(userId);
            return NextResponse.json(orders);
        }

        return NextResponse.json(
            { error: "Missing orderId or userId parameter" },
            { status: 400 }
        );
    } catch (error) {
        console.error("GET /api/orders error", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch order(s)" },
            { status: 500 }
        );
    }
}
