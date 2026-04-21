import { getBearerTokenFromRequest, getGatewayBaseUrl } from "@/lib/server/gatewayBridge.js";

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
        return Response.json({ error: "Missing orderId" }, { status: 400 });
    }

    const token = await getBearerTokenFromRequest(request, { allowSessionCookie: true });
    if (!token) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await fetch(
        `${getGatewayBaseUrl()}/tickets/download?orderId=${encodeURIComponent(orderId)}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
                "x-request-id": request.headers.get("x-request-id") || "",
            },
            cache: "no-store",
        }
    );

    if (!response.ok) {
        const text = await response.text();
        try {
            return Response.json(JSON.parse(text), { status: response.status });
        } catch {
            return Response.json({ error: text || "Failed to generate ticket" }, { status: response.status });
        }
    }

    const buffer = await response.arrayBuffer();
    return new Response(buffer, {
        status: response.status,
        headers: {
            "Content-Type": response.headers.get("content-type") || "application/pdf",
            "Content-Disposition": response.headers.get("content-disposition") || "attachment",
            "Cache-Control": response.headers.get("cache-control") || "private, max-age=3600",
            ...(response.headers.get("x-request-id") ? { "x-request-id": response.headers.get("x-request-id") } : {}),
        },
    });
}
