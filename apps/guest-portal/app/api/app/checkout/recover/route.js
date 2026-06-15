import { recoverCheckoutOrder } from '../../../../../lib/bff/checkout.js';
import {
  checkoutRecoverDataSchema,
  checkoutRecoverQuerySchema,
  parseGuestBffInput,
} from '../../../../../lib/bff/contracts.js';
import {
  buildGuestBffError,
  buildGuestBffResult,
  guestBffJsonResponse,
} from '../../../../../lib/bff/server.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const parsed = parseGuestBffInput(
    checkoutRecoverQuerySchema,
    Object.fromEntries(request.nextUrl.searchParams.entries()),
    'query params',
  );
  if (!parsed.ok) {
    return guestBffJsonResponse(
      buildGuestBffResult({
        status: 400,
        error: buildGuestBffError(parsed.error.message, parsed.error),
      }),
      { dataSchema: checkoutRecoverDataSchema, status: 400 },
    );
  }

  const result = await recoverCheckoutOrder(parsed.data.orderId);
  return guestBffJsonResponse(result, {
    dataSchema: checkoutRecoverDataSchema,
    status: result.status,
  });
}
