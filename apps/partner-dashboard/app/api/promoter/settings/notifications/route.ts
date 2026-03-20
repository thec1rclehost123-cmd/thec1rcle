import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { patchPreferences } from "@/lib/server/promoterSettingsStore";

export async function PATCH(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { promoterId, notifications, operationalDefaults, security } = body;

        if (!promoterId) {
            return NextResponse.json({ error: "promoterId is required" }, { status: 400 });
        }

        const preferences = await patchPreferences(promoterId, {
            notifications,
            operationalDefaults,
            security,
        });

        return NextResponse.json({ success: true, preferences });
    } catch (error: any) {
        console.error("[PATCH /api/promoter/settings/notifications]", error);
        return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
    }
}
