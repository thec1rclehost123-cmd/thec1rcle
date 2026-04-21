import { notFound } from "next/navigation";
import { fetchCheckoutEvent } from "../../../lib/server/checkoutGatewayBridge.js";
import CheckoutContainer from "../../../components/CheckoutContainer";
import FunnelShell from "../../../components/FunnelShell";

export async function generateMetadata({ params }) {
    const { eventId } = await params;
    const identifier = decodeURIComponent(eventId);
    const event = await fetchCheckoutEvent(identifier);
    if (!event) return { title: "Checkout" };
    return { title: `Checkout | ${event.title}` };
}

export default async function CheckoutPage({ params, searchParams }) {
    const { eventId } = await params;
    const resolvedSearchParams = await searchParams;
    const identifier = decodeURIComponent(eventId);
    const event = await fetchCheckoutEvent(identifier, {
        cache: "no-store",
    });

    if (!event) {
        notFound();
    }

    // Parse tickets from searchParams
    const initialTickets = [];
    if (event.tickets) {
        event.tickets.forEach(ticket => {
            const qty = Number(resolvedSearchParams?.[`t_${ticket.id}`] || 0);
            if (qty > 0) {
                initialTickets.push({
                    ...ticket,
                    quantity: qty
                });
            }
        });
    }

    return (
        <FunnelShell title="Checkout" showLogo={true} backHref={`/event/${event.id}`}>
            <CheckoutContainer
                event={event}
                initialTickets={initialTickets}
            />
        </FunnelShell>
    );
}
