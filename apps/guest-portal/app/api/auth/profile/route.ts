import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { getAdminDb } from "@/lib/firebase/admin";

export async function POST(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const now = new Date().toISOString();

        const db = getAdminDb();
        if (!db) {
            return NextResponse.json({ error: "Database not configured (Toy Mode)" }, { status: 503 });
        }

        await db.collection("users").doc(decodedToken.uid).set(
            { ...body, updatedAt: now },
            { merge: true }
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("[Auth API] POST /profile Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const updates = body.updates || body;
        const now = new Date().toISOString();

        const db = getAdminDb();
        if (!db) {
            return NextResponse.json({ error: "Database not configured (Toy Mode)" }, { status: 503 });
        }

        await db.collection("users").doc(decodedToken.uid).set({
            ...updates,
            updatedAt: now
        }, { merge: true });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("[Auth API] PATCH /profile Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
