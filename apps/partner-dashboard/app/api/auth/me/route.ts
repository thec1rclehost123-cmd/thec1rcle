import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/lib/server/apiClient";
import { verifyAuth } from "@/lib/server/auth";

export async function GET(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        const client = getApiClient(token);

        const data = await client.request("/auth/me");

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("[Auth API] GET /me Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
