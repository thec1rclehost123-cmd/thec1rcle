import { normalizeCheckoutEventDetail } from '../../features/checkout/checkoutEventModel.js';
import {
  GUEST_BFF_CACHE,
  buildGuestBffError,
  buildGuestBffResult,
  buildGuestBffUpstreamTrace,
  guestBffUpstreamJson,
  getGuestBffUpstreamError,
} from './server.js';

export async function buildOrderConfirmationView(orderId) {
  const orderResult = await guestBffUpstreamJson(`/orders/${encodeURIComponent(orderId)}`);

  if (orderResult.response.status === 404 || orderResult.response.status === 403) {
    return buildGuestBffResult({
      status: orderResult.response.status,
      data: {
        event: null,
        order: null,
        status: 'missing',
      },
      error: buildGuestBffError('We could not find that order.', {
        code: orderResult.response.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN',
        requestId: orderResult.requestId,
        status: orderResult.response.status,
      }),
      meta: {
        requestId: orderResult.requestId,
        upstreamCalls: buildGuestBffUpstreamTrace(orderResult),
      },
    });
  }

  if (!orderResult.response.ok) {
    return buildGuestBffResult({
      status: orderResult.response.status || 502,
      data: {
        event: null,
        order: null,
        status: 'missing',
      },
      error: buildGuestBffError(
        getGuestBffUpstreamError(orderResult.data, 'We could not load your confirmation yet.'),
        {
          requestId: orderResult.requestId,
          status: orderResult.response.status || 502,
        },
      ),
      meta: {
        requestId: orderResult.requestId,
        upstreamCalls: buildGuestBffUpstreamTrace(orderResult),
      },
    });
  }

  const order = orderResult.data?.order || null;
  let event = normalizeCheckoutEventDetail(orderResult.data?.event || null);
  let fallbackEventResult = null;

  if (!event && order?.eventId) {
    fallbackEventResult = await guestBffUpstreamJson(
      `/public/events/${encodeURIComponent(order.eventId)}`,
      {
        cacheMode: GUEST_BFF_CACHE.PUBLIC_REVALIDATED,
        forwardCookies: false,
        next: { revalidate: 60 },
      },
    );
    if (fallbackEventResult.response.ok) {
      event = normalizeCheckoutEventDetail(fallbackEventResult.data);
    }
  }

  return buildGuestBffResult({
    status: 200,
    data: {
      event,
      order,
      status: !order ? 'missing' : order.status === 'confirmed' ? 'ready' : 'pending',
    },
    meta: {
      requestId: orderResult.requestId,
      upstreamCalls: buildGuestBffUpstreamTrace(orderResult, fallbackEventResult),
    },
  });
}
