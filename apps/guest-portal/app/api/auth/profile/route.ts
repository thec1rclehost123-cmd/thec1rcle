import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/lib/server/apiClient";
import { verifyAuth } from "@/lib/server/auth";

export async function POST(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        const client = getApiClient(token);

        const body = await req.json();

        const data = await client.request("/users/profile", {
            method: "POST",
            body: JSON.stringify(body)
        });

        return NextResponse.json(data);
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

        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        const client = getApiClient(token);

        const body = await req.json();

        const data = await client.request("/profiles", {
            method: "PATCH",
            body: JSON.stringify(body)
        });

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("[Auth API] PATCH /profile Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
