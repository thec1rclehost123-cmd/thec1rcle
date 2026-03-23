import { NextRequest } from "next/server";
import { patchPreferences } from "@/lib/server/promoterSettingsStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

export const PATCH = withAuth(async (req: NextRequest) => {
    try {
        const body = await req.json();
        const { promoterId, notifications, operationalDefaults, security } = body;

        if (!promoterId) return fail("promoterId is required", 400);

        const preferences = await patchPreferences(promoterId, {
            notifications,
            operationalDefaults,
            security,
        });

        return ok({ preferences });
    } catch (error: any) {
        console.error("[PATCH /api/promoter/settings/notifications]", error);
        return fail("Failed to update preferences");
    }
});
