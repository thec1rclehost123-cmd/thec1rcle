import { NextRequest } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { getApiClient } from "@/lib/server/apiClient";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * POST /api/host/invite
 * Creates a promoter invite record via the API Gateway.
 */

const InviteBody = z.object({
    hostId: z.string().min(1, "hostId is required"),
    promoterEmail: z.string().email("Invalid email address"),
    promoterName: z.string().optional(),
});

export const POST = withAuth(async (req: NextRequest, auth) => {
    try {
        const rawBody = await req.json();
        const parsed = InviteBody.safeParse(rawBody);
        if (!parsed.success) {
            return fail(parsed.error.errors[0].message, 400);
        }
        const { hostId, promoterEmail, promoterName } = parsed.data;

        const appUrl = process.env.NEXT_PUBLIC_APP_URL;
        if (!appUrl) {
            console.error("[POST /api/host/invite] NEXT_PUBLIC_APP_URL is not set");
            return fail("Server misconfiguration");
        }

        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        const client = getApiClient(token);

        const inviteId = randomBytes(16).toString("hex");
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        await client.request("/promoter-connections/invites", {
            method: "POST",
            body: JSON.stringify({
                id: inviteId,
                hostId,
                email: promoterEmail,
                name: promoterName || "",
                type: "promoter",
                status: "pending",
                expiresAt,
            }),
        });

        const inviteLink = `${appUrl}/onboard?type=promoter&inviteId=${inviteId}&hostId=${hostId}&email=${encodeURIComponent(promoterEmail)}`;
        return ok({ inviteLink }, "Invite created");
    } catch (error: any) {
        console.error("[POST /api/host/invite]", error);
        return fail("Failed to create invite");
    }
});
