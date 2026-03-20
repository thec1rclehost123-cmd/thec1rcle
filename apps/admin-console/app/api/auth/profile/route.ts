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
        const { uid, email, displayName, age, gender, phone, photoURL, city, instagram, isVerified, createdAt, updatedAt } = body;

        if (!uid || !email) {
            return NextResponse.json({ error: "uid and email are required" }, { status: 400 });
        }

        const now = new Date().toISOString();
        const profileDoc = {
            uid, email, displayName: displayName || "", age: age || null, gender: gender || null,
            phone: phone || null, photoURL: photoURL || "", attendedEvents: [],
            city: city || "", instagram: instagram || "",
            isVerified: isVerified ?? true,
            createdAt: createdAt || now, updatedAt: updatedAt || now,
        };

        const db = getAdminDb();
        await db.collection("users").doc(uid).set(profileDoc, { merge: true });

        return NextResponse.json({ success: true, uid });
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

        const userId = decodedToken.uid;
        const body = await req.json();
        const { type = "user", updates, id: targetId } = body;

        if (!updates || Object.keys(updates).length === 0) {
            return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
        }

        const collectionMap: Record<string, string> = { user: "users", venue: "venues", host: "hosts" };
        const collection = collectionMap[type] || "users";
        const docId = type === "user" ? userId : targetId;

        if (!docId) {
            return NextResponse.json({ error: "ID required for this update type" }, { status: 400 });
        }

        const db = getAdminDb();
        await db.collection(collection).doc(docId).update({
            ...updates,
            updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({ success: true, message: "Profile updated successfully" });
    } catch (error: any) {
        console.error("[Auth API] PATCH /profile Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
