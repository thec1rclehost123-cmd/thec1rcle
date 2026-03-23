import { NextRequest } from "next/server";
import { recordLinkClick, getPromoterLinkByCode } from "@/lib/server/promoterLinkStore";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * POST /api/promoter/links/click
 * Record a click on a promoter link with optional source tracking.
 * Public endpoint — no auth required (guests click links without being logged in).
 *
 * Sources: wa (WhatsApp), ig (Instagram), tw (Twitter/X), fb (Facebook), em (Email), ot (Other)
 */
export async function POST(req: NextRequest) {
    try {
        const { code, source } = await req.json();

        if (!code) return fail("code is required", 400);

        // Validate source if provided
        const validSources = ["wa", "ig", "tw", "fb", "em", "ot"];
        const cleanSource = source && validSources.includes(source) ? source : null;

        // Get the link by code
        const link = await getPromoterLinkByCode(code);

        if (!link) return fail("Link not found or inactive", 404);

        // Record the click with source attribution
        await recordLinkClick(link.id, cleanSource);

        return ok({ eventId: link.eventId, source: cleanSource });
    } catch (error: any) {
        console.error("[Promoter Links Click API] POST Error:", error);
        return fail("Failed to record click");
    }
}
