import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { getUserProfile } from "@/lib/server/profileStore";

export async function GET(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await getUserProfile(decodedToken.uid);

        return NextResponse.json({ user });
    } catch (error: any) {
        console.error("[Auth API] GET /me Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
