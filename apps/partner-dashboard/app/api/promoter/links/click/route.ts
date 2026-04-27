import { NextRequest } from "next/server";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

/**
 * POST /api/promoter/links/click
 * Record a click on a promoter link with optional source tracking.
 * Public endpoint — no auth required (guests click links without being logged in).
 *
 * Sources: wa (WhatsApp), ig (Instagram), tw (Twitter/X), fb (Facebook), em (Email), ot (Other)
 */
export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/promoter/links/click`, {
        method: "POST",
        body: JSON.stringify(body),
    });
}
