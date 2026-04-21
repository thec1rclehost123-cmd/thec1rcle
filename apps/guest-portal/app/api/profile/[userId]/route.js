import { proxyGatewayJson } from "../../../../lib/server/gatewayBridge.js";

export async function GET(request, { params }) {
    const { userId } = await params;
    if (!userId) {
        return Response.json({ error: "Missing userId" }, { status: 400 });
    }

    return proxyGatewayJson(request, `/guest-profiles/${encodeURIComponent(userId)}`, {
        requireAuth: false,
    });
}
