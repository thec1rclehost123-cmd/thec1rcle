/**
 * THE C1RCLE - Host Settings API (BFF)
 * Primary: delegates to API Gateway when available.
 * Fallback: direct Firestore via hostSettingsStore when gateway is unavailable.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
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

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL;

async function tryGateway(url: string, init: RequestInit): Promise<Response | null> {
    if (!GATEWAY_URL) return null;
    try {
        const res = await fetch(url, { ...init, signal: AbortSignal.timeout(4000) });
        return res;
    } catch {
        return null;
    }
}

/**
 * GET /api/host/settings?hostId=XXX
 * GET /api/host/settings?hostId=XXX&include=payouts
 * GET /api/host/settings?hostId=XXX&include=sessions
 * GET /api/host/settings?hostId=XXX&include=auditlog&limit=50&cursor=...
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const hostId = searchParams.get("hostId");
    const include = searchParams.get("include");

    if (!hostId) return NextResponse.json({ error: "hostId required" }, { status: 400 });

    // Sessions — always use direct Firestore (no gateway equivalent)
    if (include === "sessions") {
        const sessions = await getLoginSessions(hostId, auth.uid);
        return NextResponse.json({ sessions }, { headers: { "Cache-Control": "private, no-store" } });
    }

    // Audit log — always use direct Firestore
    if (include === "auditlog") {
        const limit = parseInt(searchParams.get("limit") ?? "50", 10);
        const cursor = searchParams.get("cursor") ?? undefined;
        const result = await getAuditLog(hostId, limit, cursor);
        return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
    }

    // Payouts — try gateway first
    if (include === "payouts") {
        const gwRes = await tryGateway(
            `${GATEWAY_URL}/api/v1/host/payouts?${searchParams.toString()}`,
            { headers: { Authorization: req.headers.get("Authorization") || "" } }
        );
        if (gwRes?.ok) {
            const data = await gwRes.json();
            return NextResponse.json(data);
        }
        // Fallback: no gateway, no payouts available
        return NextResponse.json({ payouts: [] });
    }

    // Main settings — try gateway first, fall back to Firestore
    const gwRes = await tryGateway(
        `${GATEWAY_URL}/api/v1/venue-settings/host?${searchParams.toString()}`,
        { headers: { Authorization: req.headers.get("Authorization") || "" } }
    );
    if (gwRes?.ok) {
        const data = await gwRes.json();
        return NextResponse.json(data);
    }

    const settings = await getHostSettings(hostId);
    return NextResponse.json(settings, { headers: { "Cache-Control": "private, no-store" } });
}

/**
 * PATCH /api/host/settings
 * Body: { hostId, patch, action, section }
 * Atomically writes audit log entry THEN updates settings.
 */
export async function PATCH(req: NextRequest) {
    const auth = await verifyAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body?.hostId || !body?.patch) {
        return NextResponse.json({ error: "hostId and patch required" }, { status: 400 });
    }

    const { hostId, patch, action = "GENERAL_UPDATED", section = "general" } = body;
    const actor = { uid: auth.uid, displayName: (auth as any).name ?? auth.uid };

    // Try gateway first
    const gwRes = await tryGateway(`${GATEWAY_URL}/api/v1/venue-settings/host`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: req.headers.get("Authorization") || "",
        },
        body: JSON.stringify(body),
    });
    if (gwRes?.ok) {
        const data = await gwRes.json();
        return NextResponse.json(data);
    }

    // Fallback: direct Firestore with audit log
    try {
        const updated = await updateHostSettings(hostId, patch, actor, action as HostSettingsAction, section as HostSettingsSection);
        return NextResponse.json({ settings: updated });
    } catch (error: any) {
        console.error("[PATCH /api/host/settings]", error);
        return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
    }
}

/**
 * POST /api/host/settings
 * Preserved for backward compat. Supports:
 *   - { hostId, settings } — general update
 *   - { hostId, action: "WRITE_SESSION", sessionData } — write login session
 *   - { hostId, action: "REVOKE_SESSION", sessionId } — revoke a session
 */
export async function POST(req: NextRequest) {
    const auth = await verifyAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body?.hostId) return NextResponse.json({ error: "hostId required" }, { status: 400 });

    const { hostId } = body;

    // Session write
    if (body.action === "WRITE_SESSION" && body.sessionData) {
        try {
            const session = await writeLoginSession(hostId, auth.uid, body.sessionData);
            return NextResponse.json({ session }, { status: 201 });
        } catch (error: any) {
            console.error("[POST /api/host/settings] WRITE_SESSION", error);
            return NextResponse.json({ error: "Failed to write session" }, { status: 500 });
        }
    }

    // Session revoke
    if (body.action === "REVOKE_SESSION" && body.sessionId) {
        try {
            await revokeLoginSession(hostId, body.sessionId);
            return NextResponse.json({ success: true });
        } catch (error: any) {
            console.error("[POST /api/host/settings] REVOKE_SESSION", error);
            return NextResponse.json({ error: "Failed to revoke session" }, { status: 500 });
        }
    }

    // General settings update (legacy format: { hostId, settings })
    const patch = body.settings ?? {};
    const actor = { uid: auth.uid, displayName: (auth as any).name ?? auth.uid };

    const gwRes = await tryGateway(`${GATEWAY_URL}/api/v1/venue-settings/host`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: req.headers.get("Authorization") || "",
        },
        body: JSON.stringify({ hostId, patch }),
    });
    if (gwRes?.ok) {
        const data = await gwRes.json();
        return NextResponse.json(data);
    }

    try {
        const updated = await updateHostSettings(hostId, patch, actor, "GENERAL_UPDATED", "general");
        return NextResponse.json({ settings: updated });
    } catch (error: any) {
        console.error("[POST /api/host/settings]", error);
        return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
    }
}
