import { NextRequest } from "next/server";
import { updateIdentity } from "@/lib/server/promoterSettingsStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

export const POST = withAuth(async (req: NextRequest, auth) => {
    try {
        const body = await req.json();
        const { promoterId, ...fields } = body;
        if (!promoterId) return fail("promoterId is required", 400);

        const identity = await updateIdentity(promoterId, fields, { uid: auth.uid });
        return ok({ identity });
    } catch (error: any) {
        if (error.message === "BRAND_NAME_TAKEN") {
            return fail("Brand name is already taken", 409);
        }
        console.error("[POST /api/promoter/settings/identity]", error);
        return fail("Failed to update identity");
    }
});
