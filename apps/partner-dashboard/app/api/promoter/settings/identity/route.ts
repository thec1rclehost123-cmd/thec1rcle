import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { updateIdentity } from "@/lib/server/promoterSettingsStore";

export async function POST(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { promoterId, ...fields } = body;
        if (!promoterId) {
            return NextResponse.json({ error: "promoterId is required" }, { status: 400 });
        }

        const identity = await updateIdentity(promoterId, fields, { uid: decodedToken.uid });
        return NextResponse.json({ success: true, identity });
    } catch (error: any) {
        if (error.message === "BRAND_NAME_TAKEN") {
            return NextResponse.json({ error: "Brand name is already taken" }, { status: 409 });
        }
        console.error("[POST /api/promoter/settings/identity]", error);
        return NextResponse.json({ error: "Failed to update identity" }, { status: 500 });
    }
}
