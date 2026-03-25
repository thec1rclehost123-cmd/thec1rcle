/**
 * THE C1RCLE - Core Scan API (BFF Proxy)
 * Delegates QR ticket scanning to the API Gateway
 */
import { NextRequest } from "next/server";
import { proxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";

/**
 * POST /api/scan
 * Process a QR ticket scan
 */
export async function POST(req: NextRequest) {
    const body = await req.json();
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/scan/`, {
        method: "POST",
        body: JSON.stringify(body)
    });
}

/**
 * GET /api/scan?eventId=XXX
 * Scan history for an event
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    return proxyToGateway(req, `${GATEWAY_URL}/api/v1/scan/history?${searchParams.toString()}`, {});
}

