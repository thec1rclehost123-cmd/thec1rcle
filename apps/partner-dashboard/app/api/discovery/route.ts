import { NextRequest } from "next/server";
import { z } from "zod";
import { discoverPartners } from "@/lib/server/promoterConnectionStore";
import { createRequest, approveRequest, rejectRequest, blockRequest, listConnections } from "@/lib/server/connectionService";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";
import { logger } from "@/lib/server/logger";

const CreateRequestSchema = z.object({
    requesterId: z.string().min(1).max(128),
    requesterType: z.string().max(50).optional(),
    requesterName: z.string().max(200).optional(),
    requesterEmail: z.string().email().max(200).optional(),
    targetId: z.string().min(1).max(128),
    targetType: z.string().min(1).max(50),
    targetName: z.string().max(200).optional(),
    message: z.string().max(1000).optional(),
});

/**
 * GET /api/discovery
 * Discover partners and check connection status
 */
export const GET = withAuth(async (req: NextRequest) => {
    try {
        const { searchParams } = new URL(req.url);
        const action = searchParams.get("action") || "discover";
        const partnerId = searchParams.get("partnerId"); // The ID of the requester
        const role = searchParams.get("role"); // The role of the requester

        if (!partnerId || !role) return fail("partnerId and role are required", 400);

        switch (action) {
            case "discover": {
                const type = searchParams.get("type") as any;
                const city = searchParams.get("city");
                const search = searchParams.get("search");
                const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

                const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";

                // Fetch discovered partners + existing connections in parallel
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

                return ok({ partners: partnersWithStatus });
            }

            case "list": {
                const status = searchParams.get("status");
                const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
                const connections = await listConnections(partnerId, role, status, token);
                return ok({ connections });
            }

            case "auditlog": {
                if (!isFirebaseConfigured()) return ok({ entries: [] });
                const db = getAdminDb();
                const auditSnap = await db.collection("partnership_audit_log")
                    .where("actorId", "==", partnerId)
                    .orderBy("timestamp", "desc")
                    .limit(100)
                    .get();
                const entries = auditSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
                return ok({ entries });
            }

            default:
                return fail("Invalid action", 400);
        }
    } catch (error: any) {
        logger.error("discovery", "GET failed", { error: error.message });
        return fail("Failed to fetch discovery data");
    }
});

/**
 * POST /api/discovery
 * Create a connection request
 */
export const POST = withAuth(async (req: NextRequest) => {
    try {
        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        const body = await req.json();
        const parsed = CreateRequestSchema.safeParse(body);
        if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Invalid request body", 400);

        const result = await createRequest(parsed.data as any, token);

        return ok(result);
    } catch (error: any) {
        logger.error("discovery", "POST failed", { error: error.message });
        return fail("Failed to create connection request");
    }
});

/**
 * PATCH /api/discovery
 * Approve or Reject a request
 */
export const PATCH = withAuth(async (req: NextRequest) => {
    try {
        const token = req.headers.get("authorization")?.split("Bearer ")[1] || "";
        const body = await req.json();
        const { connectionId, action, role, partnerId, partnerName, reason, tier } = body;

        const type = body.type || "promoter_connection"; // default

        if (!connectionId || !action) return fail("connectionId and action are required", 400);

        if (action === "approve") {
            await approveRequest(connectionId, type, role, partnerId, partnerName, token, tier);
        } else if (action === "reject") {
            await rejectRequest(connectionId, type, role, partnerId, partnerName, reason, token);
        } else if (action === "block") {
            await blockRequest(connectionId, type, role, partnerId, partnerName, reason, token);
        } else {
            return fail("Invalid action", 400);
        }

        return ok({});
    } catch (error: any) {
        logger.error("discovery", "PATCH failed", { error: error.message });
        return fail("Failed to process connection request");
    }
});
