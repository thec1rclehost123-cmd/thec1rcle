import { NextRequest } from "next/server";
import { updateVerification } from "@/lib/server/promoterSettingsStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

export const POST = withAuth(async (req: NextRequest) => {
    try {
        const body = await req.json();
        const { promoterId, govDocUrl, selfieUrl } = body;

        if (!promoterId) return fail("promoterId is required", 400);
        if (!govDocUrl && !selfieUrl) return fail("At least one document URL is required", 400);

        const verification = await updateVerification(promoterId, { govDocUrl, selfieUrl });
        return ok({ verification });
    } catch (error: any) {
        console.error("[POST /api/promoter/settings/verification]", error);
        return fail("Failed to update verification");
    }
});
