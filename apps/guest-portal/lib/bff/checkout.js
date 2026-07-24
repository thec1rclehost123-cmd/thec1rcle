import { normalizeBootstrapPayload } from '../../features/auth/utils/authSessionModel.js';
import { normalizeCheckoutEventDetail } from '../../features/checkout/checkoutEventModel.js';
import { revalidateTag } from 'next/cache';
import {
  buildCheckoutQuotePayload,
  buildCheckoutRequestIdempotencyKey,
} from '../../features/checkout/utils/checkoutSessionModel.js';
import { normalizeReservationItems } from '../../features/checkout/utils/checkoutViewModel.js';
import {
  GUEST_BFF_CACHE,
  buildGuestBffError,
  buildGuestBffResult,
  buildGuestBffUpstreamTrace,
  getGuestBffUpstreamError,
  guestBffUpstreamJson,
  readIntegerParam,
} from './server.js';

function normalizeQuoteInput({
  appliedPromoCode,
  cartReservation,
  eventId,
  promoterCode,
  quoteInput,
  selectedTickets,
}) {
  if (quoteInput) return quoteInput;
  return buildCheckoutQuotePayload({
    appliedPromoCode: appliedPromoCode || null,
    cartReservation: cartReservation || null,
    eventId,
    promoterCode: promoterCode || null,
    selectedTickets: normalizeReservationItems(selectedTickets || []),
  });
}

export function readSelectedTicketsFromSearchParams(searchParams) {
  const items = [];

  for (const [key, value] of searchParams.entries()) {
    if (!key.startsWith('t_')) continue;
    const quantity = readIntegerParam(value, 0);
    if (quantity <= 0) continue;
    items.push({
      id: key.slice(2),
      quantity,
    });
  }

  return items;
}

export async function buildCheckoutSummaryView({
  appliedPromoCode = null,
  cartReservation = null,
  eventId,
  linkId = null,
  promoterCode = null,
  quoteInput = null,
  requestHeaders = {},
  selectedTickets = [],
} = {}) {
  const fallbackRequestId = new Headers(requestHeaders || {}).get('x-request-id') || undefined;
  if (!eventId) {
    return buildGuestBffResult({
      status: 400,
      data: {
        success: false,
        event: null,
        viewer: null,
        viewerProfile: null,
        pricing: null,
        quote: null,
        reservation: null,
        constraints: null,
        payment: null,
      },
      error: buildGuestBffError('Missing eventId.', {
        code: 'BAD_REQUEST',
        requestId: fallbackRequestId,
        status: 400,
      }),
      meta: {
        requestId: fallbackRequestId,
      },
    });
  }

  const [eventResult, authResult, paymentResult] = await Promise.all([
    guestBffUpstreamJson(`/public/events/${encodeURIComponent(eventId)}`, {
      cacheMode: GUEST_BFF_CACHE.PRIVATE_NO_STORE,
      forwardCookies: false,
      cache: 'no-store',
    }),
    guestBffUpstreamJson('/auth/me'),
    guestBffUpstreamJson('/payments/config'),
  ]);

  if (!eventResult.response.ok) {
    return buildGuestBffResult({
      status: eventResult.response.status || 404,
      data: {
        success: false,
        event: null,
        viewer: null,
        viewerProfile: null,
        pricing: null,
        quote: null,
        reservation: null,
        constraints: null,
        payment: paymentResult.response.ok ? paymentResult.data : null,
      },
      error: buildGuestBffError(
        getGuestBffUpstreamError(eventResult.data, 'Unable to load checkout event.'),
        {
          requestId: eventResult.requestId,
          status: eventResult.response.status || 404,
        },
      ),
      meta: {
        requestId: eventResult.requestId,
        upstreamCalls: buildGuestBffUpstreamTrace(eventResult, authResult, paymentResult),
      },
    });
  }

  const auth = authResult.response.ok
    ? normalizeBootstrapPayload(authResult.data)
    : { user: null, profile: null, unreadNotificationCount: 0 };
  const event = normalizeCheckoutEventDetail(eventResult.data);
  const nextQuoteInput = normalizeQuoteInput({
    appliedPromoCode,
    cartReservation,
    eventId,
    promoterCode,
    quoteInput,
    selectedTickets,
  });

  const nextHeaders = new Headers(requestHeaders || {});
  if (!nextHeaders.has('x-idempotency-key')) {
    nextHeaders.set(
      'x-idempotency-key',
      buildCheckoutRequestIdempotencyKey({
        code: nextQuoteInput?.promoCode,
        eventId,
        prefix: 'quote',
        promoterCode: nextQuoteInput?.promoterCode,
        reservationId: nextQuoteInput?.reservationId || null,
        selectedTickets: nextQuoteInput?.items || [],
      }),
    );
  }

  const quoteResult = await guestBffUpstreamJson('/checkout/calculate', {
    method: 'POST',
    headers: nextHeaders,
    body: nextQuoteInput,
  });

  return buildGuestBffResult({
    status: quoteResult.response.ok ? 200 : quoteResult.response.status || 422,
    data: {
      success: Boolean(quoteResult.response.ok && quoteResult.data?.success),
      event,
      linkId: linkId || null,
      viewer: auth.user,
      viewerProfile: auth.profile,
      pricing: quoteResult.response.ok ? quoteResult.data?.pricing || null : null,
      quote: quoteResult.response.ok ? quoteResult.data?.quote || null : null,
      reservation: quoteResult.response.ok ? quoteResult.data?.reservation || null : null,
      constraints: quoteResult.response.ok ? quoteResult.data?.quote?.constraints || null : null,
      payment: paymentResult.response.ok ? paymentResult.data : null,
      meta: {
        quoteRequestKey: JSON.stringify(nextQuoteInput || null),
      },
    },
    error: quoteResult.response.ok
      ? null
      : buildGuestBffError(
          getGuestBffUpstreamError(quoteResult.data, 'We could not refresh live pricing.'),
          {
            requestId: quoteResult.requestId,
            status: quoteResult.response.status || 422,
          },
        ),
    meta: {
      quoteRequestKey: JSON.stringify(nextQuoteInput || null),
      requestId: eventResult.requestId,
      upstreamCalls: buildGuestBffUpstreamTrace(
        eventResult,
        authResult,
        paymentResult,
        quoteResult,
      ),
    },
  });
}

export async function runCheckoutQuote(body = {}, requestHeaders = {}) {
  const { linkId = null, ...restBody } = body;
  const nextHeaders = new Headers(requestHeaders || {});
  if (!nextHeaders.has('x-idempotency-key')) {
    nextHeaders.set(
      'x-idempotency-key',
      buildCheckoutRequestIdempotencyKey({
        code: restBody?.promoCode,
        eventId: restBody?.eventId || 'unknown-event',
        prefix: 'quote',
        promoterCode: restBody?.promoterCode || null,
        reservationId: restBody?.reservationId || null,
        selectedTickets: restBody?.items || [],
      }),
    );
  }

  const quoteResult = await guestBffUpstreamJson('/checkout/calculate', {
    body: { ...restBody, ...(linkId ? { linkId } : {}) },
    headers: nextHeaders,
    method: 'POST',
  });

  return buildGuestBffResult({
    status: quoteResult.response.ok ? 200 : quoteResult.response.status || 422,
    data: {
      success: Boolean(quoteResult.response.ok && quoteResult.data?.success),
      pricing: quoteResult.response.ok ? quoteResult.data?.pricing || null : null,
      quote: quoteResult.response.ok ? quoteResult.data?.quote || null : null,
      reservation: quoteResult.response.ok ? quoteResult.data?.reservation || null : null,
      constraints: quoteResult.response.ok ? quoteResult.data?.quote?.constraints || null : null,
    },
    error: quoteResult.response.ok
      ? null
      : buildGuestBffError(
          getGuestBffUpstreamError(quoteResult.data, 'We could not refresh live pricing.'),
          {
            requestId: quoteResult.requestId,
            status: quoteResult.response.status || 422,
          },
        ),
    meta: {
      requestId: quoteResult.requestId,
      upstreamCalls: buildGuestBffUpstreamTrace(quoteResult),
    },
  });
}

async function runCheckoutMutation(path, body, requestHeaders = {}, fallbackMessage) {
  const result = await guestBffUpstreamJson(path, {
    body,
    headers: requestHeaders,
    method: 'POST',
  });

  return buildGuestBffResult({
    status: result.response.ok ? 200 : result.response.status || 422,
    data: result.response.ok ? result.data : null,
    error: result.response.ok
      ? null
      : buildGuestBffError(getGuestBffUpstreamError(result.data, fallbackMessage), {
          requestId: result.requestId,
          status: result.response.status || 422,
        }),
    meta: {
      requestId: result.requestId,
      upstreamCalls: buildGuestBffUpstreamTrace(result),
    },
  });
}

export function runCheckoutReserve(body = {}, requestHeaders = {}) {
  return runCheckoutMutation(
    '/checkout/reserve',
    body,
    requestHeaders,
    'Failed to reserve tickets.',
  );
}

export function runCheckoutInitiate(body = {}, requestHeaders = {}) {
  return runCheckoutMutation(
    '/checkout/initiate',
    body,
    requestHeaders,
    'Failed to initiate checkout.',
  );
}

export async function runCheckoutVerify(body = {}, requestHeaders = {}) {
  const result = await guestBffUpstreamJson('/payments/verify', {
    body,
    headers: requestHeaders,
    method: 'PATCH',
  });
  if (result.response.ok) {
    const eventId = result.data?.order?.eventId;
    revalidateTag('guest-events', 'max');
    revalidateTag('guest-explore', 'max');
    if (eventId) revalidateTag(`guest-event:${eventId}`, 'max');
  }

  return buildGuestBffResult({
    status: result.response.ok ? 200 : result.response.status || 422,
    data: result.response.ok ? result.data : null,
    error: result.response.ok
      ? null
      : buildGuestBffError(getGuestBffUpstreamError(result.data, 'Verification failed.'), {
          requestId: result.requestId,
          status: result.response.status || 422,
        }),
    meta: {
      requestId: result.requestId,
      upstreamCalls: buildGuestBffUpstreamTrace(result),
    },
  });
}

export async function recoverCheckoutOrder(orderId) {
  const result = await guestBffUpstreamJson(
    `/orders/${encodeURIComponent(orderId)}?includeEvent=false`,
  );
  if (result.response.status === 404) {
    return buildGuestBffResult({
      status: 404,
      data: null,
      error: buildGuestBffError('Order not found.', {
        code: 'NOT_FOUND',
        requestId: result.requestId,
        status: 404,
      }),
      meta: {
        requestId: result.requestId,
        upstreamCalls: buildGuestBffUpstreamTrace(result),
      },
    });
  }

  return buildGuestBffResult({
    status: result.response.ok ? 200 : result.response.status || 422,
    data: result.response.ok
      ? { order: result.data?.order || null, event: result.data?.event || null }
      : null,
    error: result.response.ok
      ? null
      : buildGuestBffError(getGuestBffUpstreamError(result.data, 'Failed to load order status.'), {
          requestId: result.requestId,
          status: result.response.status || 422,
        }),
    meta: {
      requestId: result.requestId,
      upstreamCalls: buildGuestBffUpstreamTrace(result),
    },
  });
}
