import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { updateVerification } from "@/lib/server/promoterSettingsStore";

export async function POST(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { promoterId, govDocUrl, selfieUrl } = body;

        if (!promoterId) {
            return NextResponse.json({ error: "promoterId is required" }, { status: 400 });
        }
        if (!govDocUrl && !selfieUrl) {
            return NextResponse.json({ error: "At least one document URL is required" }, { status: 400 });
        }

        const verification = await updateVerification(promoterId, { govDocUrl, selfieUrl });
        return NextResponse.json({ success: true, verification });
    } catch (error: any) {
        console.error("[POST /api/promoter/settings/verification]", error);
        return NextResponse.json({ error: "Failed to update verification" }, { status: 500 });
    }
}
