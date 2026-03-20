import { NextRequest, NextResponse } from "next/server";
import {
    createConnectionRequest,
    cancelConnectionRequest,
    revokeConnection,
    pauseConnection,
    resumeConnection,
    listPromoterConnections,
    discoverPartners,
    getConnectionStatus,
    getPromoterConnectionStats
} from "@/lib/server/promoterConnectionStore";
import { verifyAuth } from "@/lib/server/auth";

const isDev = process.env.NODE_ENV === "development";

/**
 * GET /api/promoter/connections
 * List promoter's connections or discover partners
 */
export async function GET(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const promoterId = searchParams.get("promoterId");
        const action = searchParams.get("action") || "list"; // list, discover, stats, status

        if (!promoterId) {
            return NextResponse.json(
                { error: "promoterId is required" },
                { status: 400 }
            );
        }

        switch (action) {
            case "discover": {
                // Discover hosts and venues
                const type = searchParams.get("type") as "host" | "venue" | "promoter" | null;
                const city = searchParams.get("city");
                const search = searchParams.get("search");
                const limit = parseInt(searchParams.get("limit") || "20");

                const partners = await discoverPartners({
                    type: type || undefined,
                    city: city || undefined,
                    search: search || undefined,
                    limit
                });

                // Get connection status for each partner
                const partnersWithStatus = await Promise.all(
                    partners.map(async (partner) => {
                        const status = await getConnectionStatus(
                            promoterId,
                            partner.id,
                            partner.type
                        );
                        return {
                            ...partner,
                            connectionStatus: status?.status || null,
                            connectionId: status?.id || null
                        };
                    })
                );

                return NextResponse.json({ partners: partnersWithStatus });
            }

            case "stats": {
                const stats = await getPromoterConnectionStats(promoterId);
                return NextResponse.json({ stats });
            }

            case "status": {
                const targetId = searchParams.get("targetId");
                const targetType = searchParams.get("targetType") as "host" | "venue";

                if (!targetId || !targetType) {
                    return NextResponse.json(
                        { error: "targetId and targetType are required" },
                        { status: 400 }
                    );
                }

                const status = await getConnectionStatus(promoterId, targetId, targetType);
                return NextResponse.json({ status });
            }

            case "list":
            default: {
                const status = searchParams.get("status");
                const connections = await listPromoterConnections(
                    promoterId,
                    status || undefined
                );
                return NextResponse.json({ connections });
            }
        }
    } catch (error: any) {
        console.error("[Promoter Connections API] GET Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch connections" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/promoter/connections
 * Create a new connection request
 */
export async function POST(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const {
            promoterId,
            promoterName,
            promoterEmail,
            targetId,
            targetType,
            targetName,
            message
        } = body;

        if (!promoterId || !targetId || !targetType) {
            return NextResponse.json(
                { error: "promoterId, targetId, and targetType are required" },
                { status: 400 }
            );
        }

        const result = await createConnectionRequest({
            promoterId,
            promoterName,
            promoterEmail,
            targetId,
            targetType,
            targetName,
            message
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("[Promoter Connections API] POST Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to create connection request" },
            { status: 400 }
        );
    }
}

/**
 * PATCH /api/promoter/connections
 * Update connection (cancel, revoke)
 */
export async function PATCH(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { connectionId, action, promoterId } = body;

        // Verify the caller is the promoter making the mutation
        if (!isDev && promoterId && decodedToken.uid !== promoterId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (!connectionId || !action) {
            return NextResponse.json(
                { error: "connectionId and action are required" },
                { status: 400 }
            );
        }

        switch (action) {
            case "cancel": {
                if (!promoterId) {
                    return NextResponse.json(
                        { error: "promoterId required to cancel" },
                        { status: 400 }
                    );
                }
                await cancelConnectionRequest(connectionId, promoterId);
                break;
            }

            case "revoke": {
                if (!promoterId) {
                    return NextResponse.json(
                        { error: "promoterId required to revoke" },
                        { status: 400 }
                    );
                }
                await revokeConnection(connectionId, { uid: promoterId, name: "" });
                break;
            }

            case "pause": {
                await pauseConnection(connectionId, "");
                break;
            }

            case "resume": {
                await resumeConnection(connectionId, "");
                break;
            }

            default:
                return NextResponse.json(
                    { error: "Invalid action. Use 'cancel', 'revoke', 'pause', or 'resume'" },
                    { status: 400 }
                );
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("[Promoter Connections API] PATCH Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to update connection" },
            { status: 400 }
        );
    }
}
