import { buildProfileOverviewView } from '../../../../../lib/bff/profile.js';
import { profileOverviewDataSchema } from '../../../../../lib/bff/contracts.js';
import { guestBffJsonResponse } from '../../../../../lib/bff/server.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await buildProfileOverviewView();
  return guestBffJsonResponse(result, {
    dataSchema: profileOverviewDataSchema,
    status: result.status,
  });
}
