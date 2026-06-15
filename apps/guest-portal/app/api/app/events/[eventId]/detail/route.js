import { buildEventDetailView } from '../../../../../../lib/bff/events.js';
import {
  eventDetailDataSchema,
  eventDetailParamsSchema,
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
    eventDetailParamsSchema,
    { eventId: decodeURIComponent(String((await params)?.eventId || '')) },
    'route params',
  );
  if (!parsed.ok) {
    return guestBffJsonResponse(
      buildGuestBffResult({
        status: 400,
        error: buildGuestBffError(parsed.error.message, parsed.error),
      }),
      {
        dataSchema: eventDetailDataSchema,
        status: 400,
      },
    );
  }
  const result = await buildEventDetailView(parsed.data.eventId);
  return guestBffJsonResponse(result, {
    dataSchema: eventDetailDataSchema,
    status: result.status,
  });
}
