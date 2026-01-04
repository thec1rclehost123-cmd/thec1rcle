import { NextRequest, NextResponse } from "next/server";
import { recordLinkClick, getPromoterLinkByCode } from "@/lib/server/promoterLinkStore";

/**
 * POST /api/promoter/links/click
 * Record a click on a promoter link
 */
export async function POST(req: NextRequest) {
    try {
        const { code } = await req.json();

        if (!code) {
            return NextResponse.json(
                { error: "code is required" },
                { status: 400 }
            );
        }

        // Get the link by code
        const link = await getPromoterLinkByCode(code);

        if (!link) {
            return NextResponse.json(
                { error: "Link not found or inactive" },
                { status: 404 }
            );
        }

        // Record the click
        await recordLinkClick(link.id);

        return NextResponse.json({
            success: true,
            eventId: link.eventId
        });
    } catch (error: any) {
        console.error("[Promoter Links Click API] POST Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to record click" },
            { status: 500 }
        );
    }
}
