import { buildNotificationsSummaryView } from "../../../../../lib/bff/notifications.js";
import {
  notificationsSummaryDataSchema,
  notificationsSummaryQuerySchema,
  parseGuestBffInput,
} from "../../../../../lib/bff/contracts.js";
import {
  buildGuestBffError,
  buildGuestBffResult,
  guestBffJsonResponse,
} from "../../../../../lib/bff/server.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const parsed = parseGuestBffInput(
    notificationsSummaryQuerySchema,
    Object.fromEntries(request.nextUrl.searchParams.entries()),
    "query params",
  );
  if (!parsed.ok) {
    return guestBffJsonResponse(buildGuestBffResult({
      status: 400,
      error: buildGuestBffError(parsed.error.message, parsed.error),
    }), {
      dataSchema: notificationsSummaryDataSchema,
      status: 400,
    });
  }
  const result = await buildNotificationsSummaryView({
    countOnly: ["1", "true", "yes", "on"].includes(String(parsed.data.countOnly || "")),
    limit: parsed.data.limit || 50,
    unreadOnly: ["1", "true", "yes", "on"].includes(String(parsed.data.unreadOnly || "")),
  });

  return guestBffJsonResponse(result, {
    dataSchema: notificationsSummaryDataSchema,
    status: result.status,
  });
}
