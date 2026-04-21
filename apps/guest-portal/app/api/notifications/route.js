import { proxyGatewayJson } from "../../../lib/server/gatewayBridge.js";

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const params = new URLSearchParams();
    if (searchParams.get("unreadOnly") === "true") params.set("unreadOnly", "true");
    if (searchParams.get("countOnly") === "true") params.set("countOnly", "true");
    if (searchParams.get("limit")) params.set("limit", searchParams.get("limit"));
    const suffix = params.toString() ? `?${params.toString()}` : "";

    return proxyGatewayJson(request, `/guest-notifications${suffix}`, {
        requireAuth: true,
    });
}

export async function PATCH(request) {
    const body = await request.json();

    if (body?.markAll) {
        return proxyGatewayJson(request, "/guest-notifications", {
            method: "PATCH",
            requireAuth: true,
            body: { markAll: true },
        });
    }

    if (!body?.notificationId) {
        return Response.json({ error: "notificationId or markAll required" }, { status: 400 });
    }

    return proxyGatewayJson(request, `/guest-notifications/${encodeURIComponent(body.notificationId)}`, {
        method: "PATCH",
        requireAuth: true,
        body: {},
    });
}
