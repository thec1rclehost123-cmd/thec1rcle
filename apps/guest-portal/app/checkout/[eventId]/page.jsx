import PageClient from "./PageClient";
import { guestServerJson } from "../../../lib/api/server";

function normalizeCheckoutEvent(detail) {
    const event = detail?.event || detail;
    if (!event) return null;
    return {
        ...event,
        tickets: event.ticketCatalog?.tiers ?? event.tickets ?? [],
    };
}

async function resolveParams(params) {
    return await params;
}

async function loadCheckoutEvent(eventId) {
    if (!eventId) return { event: null, status: "missing" };
    const { response, data } = await guestServerJson(`/public/events/${encodeURIComponent(eventId)}`, {
        cache: "no-store",
        forwardCookies: false,
    });

    if (!response.ok) {
        return {
            event: null,
            status: response.status === 404 ? "missing" : "error",
        };
    }

    const event = normalizeCheckoutEvent(data);
    return {
        event,
        status: event ? "ready" : "missing",
    };
}

export default async function CheckoutPage({ params }) {
    const resolved = await resolveParams(params);
    const eventId = decodeURIComponent(String(resolved?.eventId || ""));
    const { event, status } = await loadCheckoutEvent(eventId);
    return <PageClient initialEvent={event} initialStatus={status} initialEventId={eventId} />;
}
