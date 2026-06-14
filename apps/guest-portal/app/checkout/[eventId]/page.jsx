import PageClient from "./PageClient";
import { guestServerJson } from "../../../lib/api/server";
import { normalizeCheckoutEventDetail } from "../../../features/checkout/checkoutEventModel.js";
import {
    buildCheckoutSummaryView,
    readSelectedTicketsFromSearchParams,
} from "../../../lib/bff/checkout.js";
import { isGuestBffEnabled } from "../../../lib/bff/flags.js";

async function resolveParams(params) {
    return await params;
}

async function resolveSearchParams(searchParams) {
    return await searchParams;
}

function toUrlSearchParams(input) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(input || {})) {
        if (Array.isArray(value)) {
            value.forEach((entry) => {
                if (entry !== undefined && entry !== null && entry !== "") {
                    params.append(key, String(entry));
                }
            });
            continue;
        }

        if (value !== undefined && value !== null && value !== "") {
            params.set(key, String(value));
        }
    }

    return params;
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

    const event = normalizeCheckoutEventDetail(data);
    return {
        event,
        status: event ? "ready" : "missing",
    };
}

export default async function CheckoutPage({ params, searchParams }) {
    const resolved = await resolveParams(params);
    const resolvedSearchParams = await resolveSearchParams(searchParams);
    const eventId = decodeURIComponent(String(resolved?.eventId || ""));

    if (isGuestBffEnabled("checkout")) {
        const nextSearchParams = toUrlSearchParams(resolvedSearchParams);
        const selectedTickets = readSelectedTicketsFromSearchParams(nextSearchParams);
        const result = await buildCheckoutSummaryView({
            eventId,
            promoterCode: nextSearchParams.get("ref") || null,
            selectedTickets,
        });
        const event = result.data?.event || null;
        const status = event
            ? "ready"
            : result.status === 404
                ? "missing"
                : "error";

        return (
            <PageClient
                initialEvent={event}
                initialSummary={result.data}
                initialStatus={status}
                initialEventId={eventId}
            />
        );
    }

    const { event, status } = await loadCheckoutEvent(eventId);
    return <PageClient initialEvent={event} initialStatus={status} initialEventId={eventId} />;
}
