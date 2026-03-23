import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/lib/server/apiClient";
import { verifyAuth } from "@/lib/server/auth";

export async function GET(req) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        const client = getApiClient(token);

        const data = await client.request("/admin/logs");

        return NextResponse.json(data);
    } catch (error) {
        console.error("[Logs API] GET /admin/logs Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
