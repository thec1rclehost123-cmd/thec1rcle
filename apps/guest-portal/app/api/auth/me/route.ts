import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { getAdminDb } from "@/lib/firebase/admin";

export async function GET(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const db = getAdminDb();
        const doc = await db.collection("users").doc(decodedToken.uid).get();
        const user = doc.exists ? { uid: doc.id, ...doc.data() } : null;

        return NextResponse.json({ user });
    } catch (error: any) {
        console.error("[Auth API] GET /me Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
