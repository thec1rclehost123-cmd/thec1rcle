/**
 * POST /api/events/create
 * Thin proxy — delegates partner event creation to the API Gateway at
 * POST /api/v1/partner/events/create.
 *
 * All business logic (slot checks, partnership enforcement, lifecycle
 * transitions, slot request creation) lives in the gateway.
 */
import { NextRequest } from "next/server";
import { withAuth } from "@/lib/server/withAuth";
import { fail } from "@/lib/server/apiResponse";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

export const POST = withAuth(async (req: NextRequest) => {
    const body = await req.json().catch(() => null);
    if (!body?.title) return fail("title is required", 400);
    if (!body?.creatorRole) return fail("creatorRole is required", 400);

    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/partner/events/create`, {
        method: "POST",
        body: JSON.stringify(body),
    });
});
