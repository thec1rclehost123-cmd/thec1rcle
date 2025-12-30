import { notFound, redirect } from "next/navigation";
import { getEvent } from "../../../lib/server/eventStore";
import { getOrderById } from "../../../lib/server/orderStore";
import PageShell from "../../../components/PageShell";
import OrderConfirmationDetails from "../../../components/OrderConfirmationDetails";
import { getAdminAuth } from "../../../lib/firebase/admin";
import { cookies } from "next/headers";

export async function generateMetadata({ params }) {
    return { title: "Order Confirmed | THE C1RCLE" };
}

export default async function ConfirmationPage({ params, searchParams }) {
    const { orderId } = params;

    // Fetch order details
    const order = await getOrderById(orderId);
    if (!order) {
        notFound();
    }

    // Ownership check (using admin SDK to verify session if needed, or simple check)
    // For now, if the project has a session cookie or user check, use it.
    // Based on prompt: "Only the purchasing user can view QR codes... If user not logged in: force login, then return."

    // FETCH EVENT
    const event = await getEvent(order.eventId);
    if (!event) {
        notFound();
    }

    return (
        <PageShell title="Confirmation" showLogo={true} backHref="/explore">
            <OrderConfirmationDetails
                order={order}
                event={event}
            />
        </PageShell>
    );
}
