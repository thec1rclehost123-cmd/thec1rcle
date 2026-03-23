import { NextRequest } from "next/server";
import { getPromoterSettings } from "@/lib/server/promoterSettingsStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

export const GET = withAuth(async (req: NextRequest) => {
    try {
        const promoterId = new URL(req.url).searchParams.get("promoterId");
        if (!promoterId) return fail("promoterId is required", 400);

        const settings = await getPromoterSettings(promoterId);
        return ok(settings as unknown as Record<string, unknown>);
    } catch (error: any) {
        console.error("[GET /api/promoter/settings]", error);
        return fail("Failed to load settings");
    }
});
