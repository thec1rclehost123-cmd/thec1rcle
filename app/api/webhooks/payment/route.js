
import { NextResponse } from "next/server";
import { updateOrderStatus, getOrderById } from "../../../../lib/server/orderStore";
import { getEvent } from "../../../../lib/server/eventStore";
import { sendTicketEmail } from "../../../../lib/email";

// This endpoint simulates a webhook from a payment provider (Razorpay/Stripe)
export async function POST(request) {
    try {
        const payload = await request.json();

        // In a real scenario, we would verify the webhook signature here
        // const signature = request.headers.get("x-razorpay-signature");
        // verifySignature(payload, signature);

        const { event, payload: data } = payload;

        // Handle "payment.captured" event
        if (event === "payment.captured" || payload.type === "payment_success") {
            const orderId = data.payment.entity.notes.orderId || payload.orderId;
            const paymentId = data.payment.entity.id || payload.paymentId;

            console.log(`[Webhook] Processing payment success for Order: ${orderId}`);

            // 1. Update Order Status to Confirmed
            const order = await updateOrderStatus(orderId, "confirmed", {
                paymentId,
                provider: "razorpay_simulated",
                paidAt: new Date().toISOString()
            });

            // 2. Trigger Confirmation Email (since we didn't send it on creation)
            // Fetch event details for the email
            const eventDetails = await getEvent(order.eventId);

            if (eventDetails) {
                const origin = new URL(request.url).origin;
                const posterUrl = eventDetails.image.startsWith('http') ? eventDetails.image : `${origin}${eventDetails.image}`;

                await sendTicketEmail({
                    to: order.userEmail,
                    userName: order.userName || "Guest",
                    eventName: eventDetails.title,
                    eventDate: new Date(eventDetails.startDate).toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric'
                    }),
                    eventLocation: eventDetails.location,
                    eventPosterUrl: posterUrl,
                    orderId: order.id,
                    tickets: order.tickets,
                    totalAmount: order.totalAmount
                });
                console.log(`[Webhook] Email sent for Order: ${orderId}`);
            }

            return NextResponse.json({ status: "success", message: "Order confirmed" });
        }

        return NextResponse.json({ status: "ignored", message: "Event type not handled" });

    } catch (error) {
        console.error("[Webhook] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
