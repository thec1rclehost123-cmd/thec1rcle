import {
  buildCheckoutSummaryView,
  readSelectedTicketsFromSearchParams,
} from '../../../../../lib/bff/checkout.js';
import {
  checkoutSummaryBodySchema,
  checkoutSummaryDataSchema,
  checkoutSummaryQuerySchema,
  parseGuestBffInput,
} from '../../../../../lib/bff/contracts.js';
import {
  buildGuestBffError,
  buildGuestBffResult,
  guestBffJsonResponse,
} from '../../../../../lib/bff/server.js';

export const dynamic = 'force-dynamic';

function parseCheckoutGetRequest(request) {
  const searchParams = request.nextUrl.searchParams;
  const parsed = parseGuestBffInput(
    checkoutSummaryQuerySchema,
    Object.fromEntries(searchParams.entries()),
    'query params',
  );
  if (!parsed.ok) return parsed;

  return {
    ok: true,
    data: {
      appliedPromoCode: parsed.data.promoCode || null,
      eventId: parsed.data.eventId,
      linkId: parsed.data.linkId || null,
      promoterCode: parsed.data.ref || null,
      selectedTickets: readSelectedTicketsFromSearchParams(searchParams),
    },
  };
}

export async function GET(request) {
  const parsed = parseCheckoutGetRequest(request);
  if (!parsed.ok) {
    return guestBffJsonResponse(
      buildGuestBffResult({
        status: 400,
        error: buildGuestBffError(parsed.error.message, parsed.error),
      }),
      {
        dataSchema: checkoutSummaryDataSchema,
        status: 400,
      },
    );
  }
  const result = await buildCheckoutSummaryView(parsed.data);
  return guestBffJsonResponse(result, {
    dataSchema: checkoutSummaryDataSchema,
    status: result.status,
  });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const parsed = parseGuestBffInput(checkoutSummaryBodySchema, body, 'request body');
  if (!parsed.ok) {
    return guestBffJsonResponse(
      buildGuestBffResult({
        status: 400,
        error: buildGuestBffError(parsed.error.message, parsed.error),
      }),
      {
        dataSchema: checkoutSummaryDataSchema,
        status: 400,
      },
    );
  }
  const result = await buildCheckoutSummaryView({
    appliedPromoCode: parsed.data?.appliedPromoCode || parsed.data?.quoteInput?.promoCode || null,
    cartReservation: parsed.data?.cartReservation || null,
    eventId: parsed.data?.eventId || parsed.data?.quoteInput?.eventId || null,
    promoterCode: parsed.data?.promoterCode || parsed.data?.quoteInput?.promoterCode || null,
    quoteInput: parsed.data?.quoteInput || null,
    requestHeaders: request.headers,
    selectedTickets: parsed.data?.selectedTickets || [],
  });

  return guestBffJsonResponse(result, {
    dataSchema: checkoutSummaryDataSchema,
    status: result.status,
  });
}
