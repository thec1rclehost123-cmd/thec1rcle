import {
  parseGuestBffInput,
  profileDetailDataSchema,
  profileDetailParamsSchema,
} from '../../../../../../lib/bff/contracts.js';
import { buildProfileDetailView } from '../../../../../../lib/bff/profile.js';
import {
  buildGuestBffError,
  buildGuestBffResult,
  guestBffJsonResponse,
} from '../../../../../../lib/bff/server.js';

export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  const parsed = parseGuestBffInput(
    profileDetailParamsSchema,
    { userId: decodeURIComponent(String((await params)?.userId || '')) },
    'route params',
  );
  if (!parsed.ok) {
    return guestBffJsonResponse(
      buildGuestBffResult({
        status: 400,
        error: buildGuestBffError(parsed.error.message, parsed.error),
      }),
      {
        dataSchema: profileDetailDataSchema,
        status: 400,
      },
    );
  }

  const result = await buildProfileDetailView(parsed.data.userId);
  return guestBffJsonResponse(result, {
    dataSchema: profileDetailDataSchema,
    status: result.status,
  });
}
