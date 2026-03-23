import { NextRequest } from "next/server";
import { getApiClient } from "@/lib/server/apiClient";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

export const POST = withAuth(async (req: NextRequest) => {
    try {
        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        const client = getApiClient(token);

        const body = await req.json();

        const data = await client.request("/users/profile", {
            method: "POST",
            body: JSON.stringify(body)
        });

        return ok(data);
    } catch (error: any) {
        console.error("[Auth API] POST /profile Error:", error);
        return fail("Failed to update profile");
    }
});

export const PATCH = withAuth(async (req: NextRequest) => {
    try {
        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        const client = getApiClient(token);

        const body = await req.json();

        const data = await client.request("/profiles", {
            method: "PATCH",
            body: JSON.stringify(body)
        });

        return ok(data);
    } catch (error: any) {
        console.error("[Auth API] PATCH /profile Error:", error);
        return fail("Failed to update profile");
    }
});
