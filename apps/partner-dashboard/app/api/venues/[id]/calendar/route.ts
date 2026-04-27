import { NextRequest } from "next/server";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { search } = new URL(req.url);
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/venues/${id}/calendar${search}`, {});
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/venues/${id}/calendar`, {
        method: "POST",
        body: JSON.stringify(body),
    });
}
