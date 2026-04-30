import { runProfileUpdate } from "../../../../../lib/bff/profile.js";
import {
  parseGuestBffInput,
  profileUpdateDataSchema,
  profileUpdateBodySchema,
} from "../../../../../lib/bff/contracts.js";
import {
  buildGuestBffError,
  buildGuestBffResult,
  guestBffJsonResponse,
} from "../../../../../lib/bff/server.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const parsed = parseGuestBffInput(profileUpdateBodySchema, body, "request body");
  if (!parsed.ok) {
    return guestBffJsonResponse(
      buildGuestBffResult({
        status: 400,
        error: buildGuestBffError(parsed.error.message, parsed.error),
      }),
      { dataSchema: profileUpdateDataSchema, status: 400 },
    );
  }

  const result = await runProfileUpdate(parsed.data, request.headers);
  return guestBffJsonResponse(result, {
    dataSchema: profileUpdateDataSchema,
    status: result.status,
  });
}
