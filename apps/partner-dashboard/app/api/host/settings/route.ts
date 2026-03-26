/**
 * THE C1RCLE - Host Settings API (BFF)
 * Primary: delegates to API Gateway when available.
 * Fallback: direct Firestore via hostSettingsStore when gateway is unavailable.
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/server/withAuth";
import { fail } from "@/lib/server/apiResponse";
import { PAGE_SIZE_MAX_LIST } from "@/lib/constants";
import { tryProxyToGateway, GATEWAY_URL } from "@/lib/server/apiGateway";
import {
    getHostSettings,
    updateHostSettings,
    getAuditLog,
    getLoginSessions,
    writeLoginSession,
    revokeLoginSession,
    type HostSettingsAction,
    type HostSettingsSection,
} from "@/lib/server/hostSettingsStore";

/**
 * GET /api/host/settings?hostId=XXX
 */
export const GET = withAuth(async (req: NextRequest, auth) => {
    const { searchParams } = new URL(req.url);
    const hostId = searchParams.get("hostId");
    const include = searchParams.get("include");

    if (!hostId) return fail("hostId required", 400);

    if (include === "sessions") {
        const sessions = await getLoginSessions(hostId, auth.uid);
        return NextResponse.json({ sessions }, { headers: { "Cache-Control": "private, no-store" } });
    }

    if (include === "auditlog") {
        const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), PAGE_SIZE_MAX_LIST);
        const cursor = searchParams.get("cursor") ?? undefined;
        const result = await getAuditLog(hostId, limit, cursor);
        return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
    }

    if (include === "payouts") {
        const data = await tryProxyToGateway(req, `${GATEWAY_URL}/api/v1/host/payouts?${searchParams.toString()}`, {});
        return NextResponse.json(data || { payouts: [] });
    }

    const data = await tryProxyToGateway(req, `${GATEWAY_URL}/api/v1/venue-settings/host?${searchParams.toString()}`, {});
    if (data) return NextResponse.json(data);

    const settings = await getHostSettings(hostId);
    return NextResponse.json(settings, { headers: { "Cache-Control": "private, no-store" } });
});

/**
 * PATCH /api/host/settings
 */
export const PATCH = withAuth(async (req: NextRequest, auth) => {
    const body = await req.json().catch(() => null);
    if (!body?.hostId || !body?.patch) return fail("hostId and patch required", 400);

    const { hostId, patch, action = "GENERAL_UPDATED", section = "general" } = body;
    const actor = { uid: auth.uid, displayName: (auth as any).name ?? auth.uid };

    const data = await tryProxyToGateway(req, `${GATEWAY_URL}/api/v1/venue-settings/host`, {
        method: "PATCH",
        body: JSON.stringify(body),
    });
    if (data) return NextResponse.json(data);

    try {
        const updated = await updateHostSettings(hostId, patch, actor, action as HostSettingsAction, section as HostSettingsSection);
        return NextResponse.json({ settings: updated });
    } catch (error: any) {
        console.error("[PATCH /api/host/settings]", error);
        return fail("Failed to update settings");
    }
});

/**
 * POST /api/host/settings
 */
export const POST = withAuth(async (req: NextRequest, auth) => {
    const body = await req.json().catch(() => null);
    if (!body?.hostId) return fail("hostId required", 400);

    const { hostId } = body;

    if (body.action === "WRITE_SESSION" && body.sessionData) {
        try {
            const session = await writeLoginSession(hostId, auth.uid, body.sessionData);
            return NextResponse.json({ session }, { status: 201 });
        } catch (error: any) {
            console.error("[POST /api/host/settings] WRITE_SESSION", error);
            return fail("Failed to write session");
        }
    }

    if (body.action === "REVOKE_SESSION" && body.sessionId) {
        try {
            await revokeLoginSession(hostId, body.sessionId);
            return NextResponse.json({ success: true });
        } catch (error: any) {
            console.error("[POST /api/host/settings] REVOKE_SESSION", error);
            return fail("Failed to revoke session");
        }
    }

    const patch = body.settings ?? {};
    const actor = { uid: auth.uid, displayName: (auth as any).name ?? auth.uid };

    const data = await tryProxyToGateway(req, `${GATEWAY_URL}/api/v1/venue-settings/host`, {
        method: "PATCH", // Save settings via patch on Gateway
        body: JSON.stringify({ hostId, patch }),
    });
    if (data) return NextResponse.json(data);

    try {
        const updated = await updateHostSettings(hostId, patch, actor, "GENERAL_UPDATED", "general");
        return NextResponse.json({ settings: updated });
    } catch (error: any) {
        console.error("[POST /api/host/settings]", error);
        return fail("Failed to save settings");
    }
});

