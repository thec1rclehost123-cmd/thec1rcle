import { NextResponse } from "next/server";
import { getHostBySlug } from "@/lib/server/hostStore";

export async function GET(request, { params }) {
    try {
        const { slug } = params;
        const host = await getHostBySlug(slug);

        if (!host) {
            return NextResponse.json({ error: "Host not found" }, { status: 404 });
        }

        return NextResponse.json(host);
    } catch (error) {
        console.error("GET /api/hosts/[slug] error", error);
        return NextResponse.json({ error: "Failed to load host" }, { status: 500 });
    }
}
