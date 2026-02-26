import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getApiClient } from "@/lib/server/apiClient";
import { verifyAuth } from "@/lib/server/auth";

/**
 * POST /api/host/invite
 *
 * Creates a promoter invite record by proxying to the API Gateway.
 * No direct Firestore access in this server route.
 */
export async function POST(req: NextRequest) {
    try {
        const decodedToken: any = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { hostId, promoterEmail, promoterName } = await req.json();

        if (!hostId || !promoterEmail) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        const client = getApiClient(token);

        const inviteId = randomBytes(16).toString("hex");
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        // Delegate invite record creation to the API Gateway
        await client.request("/promoter-connections/invites", {
            method: "POST",
            body: JSON.stringify({
                id: inviteId,
                hostId,
                email: promoterEmail,
                name: promoterName || "",
                type: "promoter",
                status: "pending",
                expiresAt
            })
        });

        const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || "https://posh-india.vercel.app"}/onboard?type=promoter&inviteId=${inviteId}&hostId=${hostId}&email=${encodeURIComponent(promoterEmail)}`;

        return NextResponse.json({ success: true, inviteLink });
    } catch (error: any) {
        console.error("Error creating invite:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
