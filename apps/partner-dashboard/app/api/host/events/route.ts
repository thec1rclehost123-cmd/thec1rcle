import { NextRequest, NextResponse } from "next/server";
import { listEvents } from "@/lib/server/eventStore";
import { verifyAuth } from "@/lib/server/auth";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const hostId = searchParams.get("hostId");
        const limit = searchParams.get("limit") || "20";
        const lastId = searchParams.get("lastId");

        if (!hostId) {
            return NextResponse.json({ error: "hostId is required" }, { status: 400 });
        }

        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        const params: any = { creatorId: hostId, limit };
        if (lastId) params.lastId = lastId;

        const result = await listEvents(params, token);
        const events = result.events || result || [];

        return NextResponse.json({ events });
    } catch (error: any) {
        console.error("Error fetching host events:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
