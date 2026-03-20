import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { deactivateLink, listPromoterLinks } from "@/lib/server/promoterLinkStore";

/**
 * PATCH /api/promoter/links/[id]
 * Deactivate a promoter link. Verifies ownership before acting.
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: linkId } = params;
        const body = await req.json();

        if (body.action !== "deactivate") {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";

        // Ownership check — fetch link and confirm it belongs to this promoter
        const links = await listPromoterLinks({ linkId }, token);
        const link = Array.isArray(links) ? links.find((l: any) => l.id === linkId) : null;

        if (link && link.promoterId && link.promoterId !== decodedToken.uid) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await deactivateLink(linkId, token);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("[Promoter Links PATCH] Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to deactivate link" },
            { status: 500 }
        );
    }
}
