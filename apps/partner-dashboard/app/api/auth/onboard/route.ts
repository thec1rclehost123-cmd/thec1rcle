import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = decodedToken.uid;
        const body = await req.json();
        const { type, email, name } = body;

        if (!type || !email || !name) {
            return NextResponse.json(
                { error: "Missing required fields: type, email, name" },
                { status: 400 }
            );
        }

        const db = getAdminDb();

        // Upsert user doc with onboarding role
        await db.collection("users").doc(userId).set(
            {
                uid: userId,
                email,
                displayName: name,
                role: "onboarding",
                isApproved: false,
                updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

        // Create onboarding request
        const requestId = `req_${Date.now()}_${userId.substring(0, 5)}`;
        await db.collection("onboarding_requests").doc(requestId).set({
            id: requestId,
            uid: userId,
            type,
            status: "pending",
            data: { ...body },
            submittedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        return NextResponse.json({ success: true, requestId });
    } catch (error: any) {
        console.error("[Auth API] POST /onboard Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
