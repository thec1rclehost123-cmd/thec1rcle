import { NextRequest, NextResponse } from "next/server";
import { recordLinkClick, getPromoterLinkByCode } from "@/lib/server/promoterLinkStore";

/**
 * POST /api/promoter/links/click
 * Record a click on a promoter link with optional source tracking
 * 
 * Sources: wa (WhatsApp), ig (Instagram), tw (Twitter/X), fb (Facebook), em (Email), ot (Other)
 */
export async function POST(req: NextRequest) {
    try {
        const { code, source } = await req.json();

        if (!code) {
            return NextResponse.json(
                { error: "code is required" },
                { status: 400 }
            );
        }

        // Validate source if provided
        const validSources = ["wa", "ig", "tw", "fb", "em", "ot"];
        const cleanSource = source && validSources.includes(source) ? source : null;

        // Get the link by code
        const link = await getPromoterLinkByCode(code);

        if (!link) {
            return NextResponse.json(
                { error: "Link not found or inactive" },
                { status: 404 }
            );
        }

        // Record the click with source attribution
        await recordLinkClick(link.id, cleanSource);

        return NextResponse.json({
            success: true,
            eventId: link.eventId,
            source: cleanSource
        });
    } catch (error: any) {
        console.error("[Promoter Links Click API] POST Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to record click" },
            { status: 500 }
        );
    }
}
