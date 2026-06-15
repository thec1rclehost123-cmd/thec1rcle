import {
  homeOverviewDataSchema,
  homeOverviewQuerySchema,
  parseGuestBffInput,
} from '../../../../../lib/bff/contracts.js';
import { buildHomeOverviewView } from '../../../../../lib/bff/home.js';
import {
  GUEST_BFF_CACHE,
  buildGuestBffError,
  buildGuestBffResult,
  guestBffJsonResponse,
} from '../../../../../lib/bff/server.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const parsed = parseGuestBffInput(
    homeOverviewQuerySchema,
    Object.fromEntries(request.nextUrl.searchParams.entries()),
    'query params',
  );
  if (!parsed.ok) {
    return guestBffJsonResponse(
      buildGuestBffResult({
        status: 400,
        error: buildGuestBffError(parsed.error.message, parsed.error),
      }),
      {
        dataSchema: homeOverviewDataSchema,
        status: 400,
      },
    );
  }

  const result = await buildHomeOverviewView({
    city: parsed.data.city || '',
  });

  return guestBffJsonResponse(result, {
    cacheMode: GUEST_BFF_CACHE.PUBLIC_REVALIDATED,
    dataSchema: homeOverviewDataSchema,
    status: result.status,
  });
}
