import { buildOrderConfirmationView } from '../../../../../../lib/bff/orders.js';
import {
  confirmationDataSchema,
  confirmationParamsSchema,
  parseGuestBffInput,
} from '../../../../../../lib/bff/contracts.js';
import {
  buildGuestBffError,
  buildGuestBffResult,
  guestBffJsonResponse,
} from '../../../../../../lib/bff/server.js';

export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  const parsed = parseGuestBffInput(
    confirmationParamsSchema,
    { orderId: decodeURIComponent(String((await params)?.orderId || '')) },
    'route params',
  );
  if (!parsed.ok) {
    return guestBffJsonResponse(
      buildGuestBffResult({
        status: 400,
        error: buildGuestBffError(parsed.error.message, parsed.error),
      }),
      {
        dataSchema: confirmationDataSchema,
        status: 400,
      },
    );
  }

  const result = await buildOrderConfirmationView(parsed.data.orderId);
  return guestBffJsonResponse(result, {
    dataSchema: confirmationDataSchema,
    status: result.status,
  });
}
