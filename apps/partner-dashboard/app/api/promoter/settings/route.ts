import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { getPromoterSettings } from "@/lib/server/promoterSettingsStore";

export async function GET(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const promoterId = new URL(req.url).searchParams.get("promoterId");
        if (!promoterId) {
            return NextResponse.json({ error: "promoterId is required" }, { status: 400 });
        }

        const settings = await getPromoterSettings(promoterId);
        return NextResponse.json(settings);
    } catch (error: any) {
        console.error("[GET /api/promoter/settings]", error);
        return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
    }
}
