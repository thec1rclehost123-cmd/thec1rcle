import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";

/**
 * GET /api/host/settings
 * Fetches host-specific settings
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const hostId = searchParams.get("hostId");

        if (!hostId) {
            return NextResponse.json({ error: "hostId is required" }, { status: 400 });
        }

        const db = getAdminDb();
        const doc = await db.collection("hosts").doc(hostId).get();
        if (!doc.exists) return NextResponse.json({ error: "Host not found" }, { status: 404 });

        return NextResponse.json(doc.data());
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/host/settings
 * Updates host settings
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { hostId, settings } = body;

        if (!hostId) {
            return NextResponse.json({ error: "hostId is required" }, { status: 400 });
        }

        const db = getAdminDb();
        const allowedSettings = ["phone", "email", "socialLinks", "bankAccount", "payoutMode"];
        const updates: any = {};

        for (const key of allowedSettings) {
            if (settings[key] !== undefined) {
                updates[key] = settings[key];
            }
        }

        updates.updatedAt = new Date().toISOString();

        await db.collection("hosts").doc(hostId).update(updates);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
