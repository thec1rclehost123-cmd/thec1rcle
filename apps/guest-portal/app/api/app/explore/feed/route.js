import { buildExploreFeedView } from "../../../../../lib/bff/explore.js";
import {
  exploreFeedDataSchema,
  exploreFeedQuerySchema,
  parseGuestBffInput,
} from "../../../../../lib/bff/contracts.js";
import {
  GUEST_BFF_CACHE,
  buildGuestBffError,
  buildGuestBffResult,
  guestBffJsonResponse,
} from "../../../../../lib/bff/server.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = parseGuestBffInput(exploreFeedQuerySchema, searchParams, "query params");
  if (!parsed.ok) {
    return guestBffJsonResponse(buildGuestBffResult({
      status: 400,
      error: buildGuestBffError(parsed.error.message, parsed.error),
    }), {
      dataSchema: exploreFeedDataSchema,
      status: 400,
    });
  }
  const result = await buildExploreFeedView({
    city: parsed.data.city || "",
    curatedCategory: parsed.data.curatedCategory || "",
    datePreset: parsed.data.datePreset || "",
    endDate: parsed.data.endDate || "",
    eventType: parsed.data.eventType || "",
    includeFeatured: parsed.data.includeFeatured
      ? ["1", "true", "yes", "on"].includes(String(parsed.data.includeFeatured))
      : !parsed.data.lastId,
    lastId: parsed.data.lastId || "",
    limit: parsed.data.limit || 24,
    priceType: parsed.data.priceType || "",
    search: parsed.data.search || "",
    sort: parsed.data.sort || "heat",
    startDate: parsed.data.startDate || "",
  });

  return guestBffJsonResponse(result, {
    cacheMode: GUEST_BFF_CACHE.PUBLIC_REVALIDATED,
    dataSchema: exploreFeedDataSchema,
    status: result.status,
  });
}
