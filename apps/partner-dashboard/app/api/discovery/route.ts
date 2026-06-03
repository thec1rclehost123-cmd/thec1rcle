import { NextRequest, NextResponse } from "next/server";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

export async function GET(req: NextRequest) {
    const { search } = new URL(req.url);
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/discovery${search}`, {
        headers: {
            "Authorization": req.headers.get("authorization") || "",
        }
    });
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/discovery`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
            "Authorization": req.headers.get("authorization") || "",
        }
    });
}

export async function PATCH(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/discovery`, {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: {
            "Authorization": req.headers.get("authorization") || "",
        }
    });
}
