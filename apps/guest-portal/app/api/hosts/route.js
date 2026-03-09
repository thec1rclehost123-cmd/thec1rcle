import { NextResponse } from "next/server";
import { listHosts } from "../../../lib/server/hostStore";

export const revalidate = 300;

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);

        const filters = {
            search: searchParams.get("search"),
            role: searchParams.get("role"),
            vibe: searchParams.get("vibe"),
            status: searchParams.get("status"),
            time: searchParams.get("time"),
            sort: searchParams.get("sort") || "Popular"
        };

        const hosts = await listHosts(filters);
        return NextResponse.json(
            { hosts, hasMore: false, nextCursor: null },
            { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" } }
        );
    } catch (error) {
        console.error("GET /api/hosts error", error);
        return NextResponse.json({ error: "Failed to load hosts" }, { status: 500 });
    }
}
