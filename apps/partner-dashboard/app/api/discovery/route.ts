import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { discoverPartners } from "@/lib/server/promoterConnectionStore";
import { createRequest, approveRequest, rejectRequest, blockRequest, listConnections } from "@/lib/server/connectionService";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";

/**
 * GET /api/discovery
 * Discover partners and check connection status
 */
export async function GET(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const action = searchParams.get("action") || "discover";
        const partnerId = searchParams.get("partnerId"); // The ID of the requester
        const role = searchParams.get("role"); // The role of the requester

        if (!partnerId || !role) {
            return NextResponse.json({ error: "partnerId and role are required" }, { status: 400 });
        }

        switch (action) {
            case "discover": {
                const type = searchParams.get("type") as any;
                const city = searchParams.get("city");
                const search = searchParams.get("search");
                const limit = parseInt(searchParams.get("limit") || "20");

                const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";

                // Fetch discovered partners + existing connections in parallel (single list call,
                // avoids N individual /status calls against a missing API Gateway endpoint)
                const [partners, existingConnections] = await Promise.all([
                    discoverPartners({
                        type: type === "all" ? undefined : type,
                        city: city || undefined,
                        search: search || undefined,
                        limit
                    }, token),
                    listConnections(partnerId, role as string, null, token)
                ]);

                const partnersArr = (partners || []) as any[];
                const connectionsArr = (existingConnections || []) as any[];

                // Build a status lookup map keyed by the other party's ID
                const statusMap = new Map<string, { status: string; id: string }>();
                for (const conn of connectionsArr) {
                    if (conn && conn.otherId) {
                        statusMap.set(conn.otherId, { status: conn.status, id: conn.id });
                    }
                }

                const partnersWithStatus = partnersArr
                    .filter((p: any) => p && p.id !== partnerId)
                    .map((partner: any) => {
                        const existing = statusMap.get(partner.id);
                        return {
                            ...partner,
                            connectionStatus: existing?.status || null,
                            connectionId: existing?.id || null
                        };
                    });

                return NextResponse.json({ partners: partnersWithStatus });
            }

            case "list": {
                const status = searchParams.get("status");
                const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
                const connections = await listConnections(partnerId, role, status, token);
                return NextResponse.json({ connections });
            }

            case "auditlog": {
                if (!isFirebaseConfigured()) return NextResponse.json({ entries: [] });
                const db = getAdminDb();
                const auditSnap = await db.collection("partnership_audit_log")
                    .where("actorId", "==", partnerId)
                    .orderBy("timestamp", "desc")
                    .limit(100)
                    .get();
                const entries = auditSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                return NextResponse.json({ entries });
            }

            default:
                return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }
    } catch (error: any) {
        console.error("[Discovery API] GET Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/discovery
 * Create a connection request
 */
export async function POST(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        const body = await req.json();
        const {
            requesterId,
            requesterType,
            requesterName,
            requesterEmail,
            targetId,
            targetType,
            targetName,
            message
        } = body;

        if (!requesterId || !targetId || !targetType) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const result = await createRequest({
            requesterId,
            requesterType,
            requesterName,
            requesterEmail,
            targetId,
            targetType,
            targetName,
            message
        }, token);

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("[Discovery API] POST Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * PATCH /api/discovery
 * Approve or Reject a request
 */
export async function PATCH(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        const body = await req.json();
        const { connectionId, action, role, partnerId, partnerName, reason, tier } = body;

        const type = body.type || "promoter_connection"; // default

        if (!connectionId || !action) {
            return NextResponse.json({ error: "connectionId and action are required" }, { status: 400 });
        }

        if (action === "approve") {
            await approveRequest(connectionId, type, role, partnerId, partnerName, token, tier);
        } else if (action === "reject") {
            await rejectRequest(connectionId, type, role, partnerId, partnerName, reason, token);
        } else if (action === "block") {
            await blockRequest(connectionId, type, role, partnerId, partnerName, reason, token);
        } else {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("[Discovery API] PATCH Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
