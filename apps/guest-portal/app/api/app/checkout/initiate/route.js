import { runCheckoutInitiate } from '../../../../../lib/bff/checkout.js';
import {
  checkoutInitiateBodySchema,
  guestBffLooseObjectSchema,
  parseGuestBffInput,
} from '../../../../../lib/bff/contracts.js';
import {
  buildGuestBffError,
  buildGuestBffResult,
  guestBffJsonResponse,
} from '../../../../../lib/bff/server.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const parsed = parseGuestBffInput(checkoutInitiateBodySchema, body, 'request body');
  if (!parsed.ok) {
    return guestBffJsonResponse(
      buildGuestBffResult({
        status: 400,
        error: buildGuestBffError(parsed.error.message, parsed.error),
      }),
      { dataSchema: guestBffLooseObjectSchema, status: 400 },
    );
  }

  const result = await runCheckoutInitiate(parsed.data, request.headers);
  return guestBffJsonResponse(result, {
    dataSchema: guestBffLooseObjectSchema,
    status: result.status,
  });
}
