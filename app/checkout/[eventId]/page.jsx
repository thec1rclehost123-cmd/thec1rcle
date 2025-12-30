import { notFound } from "next/navigation";
import { getEvent } from "../../../lib/server/eventStore";
import CheckoutContainer from "../../../components/CheckoutContainer";
import PageShell from "../../../components/PageShell";

export async function generateMetadata({ params }) {
    const identifier = decodeURIComponent(params.eventId);
    const event = await getEvent(identifier);
    if (!event) return { title: "Checkout" };
    return { title: `Checkout | ${event.title}` };
}

export default async function CheckoutPage({ params, searchParams }) {
    const identifier = decodeURIComponent(params.eventId);
    const event = await getEvent(identifier);

    if (!event) {
        notFound();
    }

    // Parse tickets from searchParams
    const initialTickets = [];
    if (event.tickets) {
        event.tickets.forEach(ticket => {
            const qty = Number(searchParams[`t_${ticket.id}`] || 0);
            if (qty > 0) {
                initialTickets.push({
                    ...ticket,
                    quantity: qty
                });
            }
        });
    }

    return (
        <PageShell title="Checkout" showLogo={true}>
            <CheckoutContainer
                event={event}
                initialTickets={initialTickets}
            />
        </PageShell>
    );
}
