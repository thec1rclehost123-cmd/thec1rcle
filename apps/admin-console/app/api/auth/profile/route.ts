import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { getAdminDb } from "@/lib/firebase/admin";

// Fields a normal user is allowed to set on their own profile at creation time
const POST_ALLOWED_FIELDS = new Set([
    "uid", "email", "displayName", "age", "gender", "phone",
    "photoURL", "city", "instagram", "createdAt"
]);

// Fields a normal user is allowed to update on their own profile
const PATCH_ALLOWED_USER_FIELDS = new Set([
    "displayName", "age", "gender", "phone", "photoURL", "city", "instagram"
]);

// Fields that must never be set by a non-admin, regardless of route
const PROTECTED_FIELDS = new Set([
    "role", "admin", "admin_role", "status", "isVerified", "kycStatus",
    "kycStepStatus", "onboardingStatus", "payoutStatus", "banned",
    "suspendedAt", "suspensionReason", "warningCount", "attendedEvents",
    "createdAt", "updatedAt", "uid", "email"
]);

export async function POST(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { uid, email, displayName, age, gender, phone, photoURL, city, instagram, createdAt } = body;

        if (!uid || !email) {
            return NextResponse.json({ error: "uid and email are required" }, { status: 400 });
        }

        // Reject unknown fields from the body
        const unknownFields = Object.keys(body).filter(k => !POST_ALLOWED_FIELDS.has(k));
        if (unknownFields.length > 0) {
            return NextResponse.json({ error: "Unknown fields in request" }, { status: 400 });
        }

        // Ownership check: caller may only create/overwrite their own profile
        if (uid !== decodedToken.uid) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const now = new Date().toISOString();
        // Build profile from explicit allowlist only — never spread body directly
        const profileDoc = {
            uid,
            email,
            displayName: displayName || "",
            age: age || null,
            gender: gender || null,
            phone: phone || null,
            photoURL: photoURL || "",
            attendedEvents: [],
            city: city || "",
            instagram: instagram || "",
            isVerified: false,       // server-controlled; never from client
            createdAt: createdAt || now,
            updatedAt: now,
        };

        const db = getAdminDb();
        await db.collection("users").doc(uid).set(profileDoc, { merge: true });

        return NextResponse.json({ success: true, uid });
    } catch (error: any) {
        console.error("[Auth API] POST /profile Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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

        if (!updates || typeof updates !== "object" || Object.keys(updates).length === 0) {
            return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
        }

        const collectionMap: Record<string, string> = { user: "users", venue: "venues", host: "hosts" };
        const collection = collectionMap[type] || "users";
        const docId = type === "user" ? userId : targetId;

        if (!docId) {
            return NextResponse.json({ error: "ID required for this update type" }, { status: 400 });
        }

        // Non-user collections require admin claim
        if (type !== "user" && !(decodedToken as any).admin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // For user collection updates by non-admins: enforce field allowlist
        if (type === "user" && !(decodedToken as any).admin) {
            const forbiddenKeys = Object.keys(updates).filter(
                k => PROTECTED_FIELDS.has(k) || !PATCH_ALLOWED_USER_FIELDS.has(k)
            );
            if (forbiddenKeys.length > 0) {
                console.error(`[SECURITY] Mass-assignment attempt by UID ${userId}: ${forbiddenKeys.join(", ")}`);
                return NextResponse.json({ error: "Forbidden field in update" }, { status: 403 });
            }
        }

        const db = getAdminDb();
        await db.collection(collection).doc(docId).update({
            ...updates,
            updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({ success: true, message: "Profile updated successfully" });
    } catch (error: any) {
        console.error("[Auth API] PATCH /profile Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
