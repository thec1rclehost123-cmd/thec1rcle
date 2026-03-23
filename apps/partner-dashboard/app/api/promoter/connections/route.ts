import { NextRequest } from "next/server";
import { z } from "zod";
import {
    createConnectionRequest,
    cancelConnectionRequest,
    revokeConnection,
    pauseConnection,
    resumeConnection,
    listPromoterConnections,
    discoverPartners,
    getConnectionStatus,
    getPromoterConnectionStats,
} from "@/lib/server/promoterConnectionStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

const isDev = process.env.NODE_ENV === "development";

const ConnectionsQuery = z.object({
    promoterId: z.string().min(1, "promoterId is required"),
    action: z.enum(["list", "discover", "stats", "status"]).default("list"),
    status: z.string().optional(),
    // discover params
    type: z.enum(["host", "venue", "promoter"]).optional(),
    city: z.string().optional(),
    search: z.string().optional(),
    limit: z.coerce.number().int().positive().max(100).default(20),
    // status params
    targetId: z.string().optional(),
    targetType: z.enum(["host", "venue"]).optional(),
});

const CreateConnectionBody = z.object({
    promoterId: z.string().min(1, "promoterId is required"),
    targetId: z.string().min(1, "targetId is required"),
    targetType: z.enum(["host", "venue"], { errorMap: () => ({ message: "targetType must be 'host' or 'venue'" }) }),
    promoterName: z.string().optional(),
    promoterEmail: z.string().email().optional(),
    targetName: z.string().optional(),
    message: z.string().optional(),
});

const UpdateConnectionBody = z.object({
    connectionId: z.string().min(1, "connectionId is required"),
    action: z.enum(["cancel", "revoke", "pause", "resume"], {
        errorMap: () => ({ message: "action must be 'cancel', 'revoke', 'pause', or 'resume'" }),
    }),
    promoterId: z.string().optional(),
});

/**
 * GET /api/promoter/connections
 */
export const GET = withAuth(async (req: NextRequest) => {
    try {
        const { searchParams } = new URL(req.url);
        const parsed = ConnectionsQuery.safeParse(Object.fromEntries(searchParams));
        if (!parsed.success) return fail(parsed.error.errors[0].message, 400);

        const { promoterId, action, status, type, city, search, limit, targetId, targetType } = parsed.data;

        switch (action) {
            case "discover": {
                const partners = await discoverPartners({ type, city, search, limit });
                const partnersWithStatus = await Promise.all(
                    partners.map(async (partner: any) => {
                        const connStatus = await getConnectionStatus(promoterId, partner.id, partner.type);
                        return { ...partner, connectionStatus: connStatus?.status || null, connectionId: connStatus?.id || null };
                    })
                );
                return ok({ partners: partnersWithStatus });
            }

            case "stats": {
                const stats = await getPromoterConnectionStats(promoterId);
                return ok({ stats });
            }

            case "status": {
                if (!targetId || !targetType) return fail("targetId and targetType are required", 400);
                const connStatus = await getConnectionStatus(promoterId, targetId, targetType);
                return ok({ status: connStatus });
            }

            default: {
                const connections = await listPromoterConnections(promoterId, status);
                return ok({ connections });
            }
        }
    } catch (error: any) {
        console.error("[GET /api/promoter/connections]", error);
        return fail("Failed to fetch connections");
    }
});

/**
 * POST /api/promoter/connections
 */
export const POST = withAuth(async (req: NextRequest) => {
    try {
        const rawBody = await req.json();
        const parsed = CreateConnectionBody.safeParse(rawBody);
        if (!parsed.success) return fail(parsed.error.errors[0].message, 400);

        const result = await createConnectionRequest(parsed.data);
        return ok({ ...result }, "Connection request sent", 201);
    } catch (error: any) {
        console.error("[POST /api/promoter/connections]", error);
        return fail("Failed to create connection request", 400);
    }
});

/**
 * PATCH /api/promoter/connections
 */
export const PATCH = withAuth(async (req: NextRequest, auth) => {
    try {
        const rawBody = await req.json();
        const parsed = UpdateConnectionBody.safeParse(rawBody);
        if (!parsed.success) return fail(parsed.error.errors[0].message, 400);

        const { connectionId, action, promoterId } = parsed.data;

        if (!isDev && promoterId && auth.uid !== promoterId) {
            return fail("Forbidden", 403);
        }

        switch (action) {
            case "cancel":
                if (!promoterId) return fail("promoterId required to cancel", 400);
                await cancelConnectionRequest(connectionId, promoterId);
                break;
            case "revoke":
                if (!promoterId) return fail("promoterId required to revoke", 400);
                await revokeConnection(connectionId, { uid: promoterId, name: "" });
                break;
            case "pause":
                await pauseConnection(connectionId, "");
                break;
            case "resume":
                await resumeConnection(connectionId, "");
                break;
        }

        return ok({ success: true }, "Connection updated");
    } catch (error: any) {
        console.error("[PATCH /api/promoter/connections]", error);
        return fail("Failed to update connection", 400);
    }
});
