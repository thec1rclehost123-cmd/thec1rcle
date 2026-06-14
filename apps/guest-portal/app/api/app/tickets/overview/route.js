import { buildTicketsOverviewView } from "../../../../../lib/bff/tickets.js";
import { ticketsOverviewDataSchema } from "../../../../../lib/bff/contracts.js";
import { guestBffJsonResponse } from "../../../../../lib/bff/server.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await buildTicketsOverviewView();
  return guestBffJsonResponse(result, {
    dataSchema: ticketsOverviewDataSchema,
    status: result.status,
  });
}
