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

// Cooldown period: users may only change gender once every 30 days
const GENDER_CHANGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

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

        // If gender is being changed, enforce cooldown and record the change time
        if (updates.gender !== undefined) {
            const existingDoc = await db.collection("users").doc(decodedToken.uid).get();
            const existing = existingDoc.exists ? existingDoc.data() : {};
            const existingGender = existing?.gender;

            // Only apply cooldown if gender was previously set (not first-time setup)
            if (existingGender && existingGender !== updates.gender) {
                const lastChanged = existing?.genderLastChangedAt
                    ? new Date(existing.genderLastChangedAt).getTime()
                    : 0;
                const msSinceChange = Date.now() - lastChanged;

                if (msSinceChange < GENDER_CHANGE_COOLDOWN_MS) {
                    const daysLeft = Math.ceil((GENDER_CHANGE_COOLDOWN_MS - msSinceChange) / (24 * 60 * 60 * 1000));
                    return NextResponse.json(
                        { error: `Gender can only be changed once every 30 days. Please try again in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}.` },
                        { status: 429 }
                    );
                }

                updates.genderLastChangedAt = now;
            } else if (!existingGender) {
                // First time setting gender — record it but no cooldown
                updates.genderLastChangedAt = now;
            }
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
