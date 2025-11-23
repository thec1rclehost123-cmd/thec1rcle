import { notFound } from "next/navigation";
import { getEvent } from "../../../lib/server/eventStore";
import CheckoutForm from "../../../components/CheckoutForm";

export default async function CheckoutPage({ params, searchParams }) {
    const identifier = decodeURIComponent(params.eventId);
    const event = await getEvent(identifier);

    if (!event) {
        notFound();
    }

    // Parse tickets from searchParams
    const selectedTickets = [];
    let totalAmount = 0;

    if (event.tickets) {
        event.tickets.forEach(ticket => {
            const qty = Number(searchParams[`t_${ticket.id}`] || 0);
            if (qty > 0) {
                selectedTickets.push({
                    ...ticket,
                    quantity: qty,
                    total: qty * ticket.price
                });
                totalAmount += qty * ticket.price;
            }
        });
    }

    return (
        <div className="min-h-screen text-white">
            <CheckoutForm event={event} selectedTickets={selectedTickets} totalAmount={totalAmount} />
        </div>
    );
}
