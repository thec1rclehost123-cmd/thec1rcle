import { runCheckoutVerify } from "../../../../../lib/bff/checkout.js";
import {
  checkoutVerifyBodySchema,
  guestBffLooseObjectSchema,
  parseGuestBffInput,
} from "../../../../../lib/bff/contracts.js";
import {
  buildGuestBffError,
  buildGuestBffResult,
  guestBffJsonResponse,
} from "../../../../../lib/bff/server.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const parsed = parseGuestBffInput(checkoutVerifyBodySchema, body, "request body");
  if (!parsed.ok) {
    return guestBffJsonResponse(
      buildGuestBffResult({
        status: 400,
        error: buildGuestBffError(parsed.error.message, parsed.error),
      }),
      { dataSchema: guestBffLooseObjectSchema, status: 400 },
    );
  }

  const result = await runCheckoutVerify(parsed.data, request.headers);
  return guestBffJsonResponse(result, {
    dataSchema: guestBffLooseObjectSchema,
    status: result.status,
  });
}
