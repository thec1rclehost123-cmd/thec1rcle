import { NextRequest } from "next/server";
import { getApiClient } from "@/lib/server/apiClient";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";
import { logger } from "@/lib/server/logger";

export const POST = withAuth(async (req: NextRequest) => {
    try {
        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        const client = getApiClient(token);

        const body = await req.json();

        const data = await client.request("/auth/host-verification", {
            method: "POST",
            body: JSON.stringify(body)
        });

        return ok(data);
    } catch (error: any) {
        logger.error("auth/host-verification", "Failed to submit host verification", { error: error.message });
        return fail("Failed to submit host verification");
    }
});
