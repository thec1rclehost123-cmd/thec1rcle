import { callGatewayJson } from "./gatewayBridge.js";
import { fetchPublicEvent } from "./publicDiscoveryBridge.js";
export {
    adaptGatewayPaymentConfig,
    adaptGatewayPaymentOrder,
} from "./checkoutGatewayAdapters.js";

export async function fetchCheckoutEvent(eventId, options = {}) {
    const data = await fetchPublicEvent(eventId, options);
    if (!data?.event) return null;

    const event = data.event;
    const tickets = event.ticketCatalog?.tiers ?? event.tickets ?? [];
    return {
        ...event,
        tickets,
    };
}

export async function fetchOrderDetail(orderId, options = {}) {
    const { response, data } = await callGatewayJson(`/orders/${encodeURIComponent(orderId)}`, options);
    if (response.status === 404) return null;
    return { response, data };
}
