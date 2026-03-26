import { NextResponse } from "next/server";
import { getApiClient } from "@/lib/server/apiClient";
import { withAdminAuth } from "@/lib/server/adminMiddleware";

export const dynamic = 'force-dynamic';

async function handler(req) {
    try {
        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        const client = getApiClient(token);

        const data = await client.request("/admin/logs");

        return NextResponse.json(data);
    } catch (error) {
        console.error("[Logs API] GET /admin/logs Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export const GET = withAdminAuth(handler);
