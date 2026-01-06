import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { discoverPartners, getConnectionStatus } from "@/lib/server/promoterConnectionStore";
import { createRequest, approveRequest, rejectRequest, blockRequest, listConnections } from "@/lib/server/connectionService";
import { getAdminDb } from "@/lib/firebase/admin";

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

                const partners = await discoverPartners({
                    type: type === "all" ? undefined : type,
                    city: city || undefined,
                    search: search || undefined,
                    limit
                });

                // Filter out self
                const otherPartners = partners.filter(p => p.id !== partnerId);

                // Get connection status for each partner
                const partnersWithStatus = await Promise.all(
                    otherPartners.map(async (partner) => {
                        // Check status in both collections
                        const db = getAdminDb();
                        let status = null;
                        let connectionId = null;

                        // 1. Check partnerships (Host <-> Club)
                        if ((role === "host" && partner.type === "club") || (role === "club" && partner.type === "host")) {
                            const hostId = role === "host" ? partnerId : partner.id;
                            const clubId = role === "club" ? partnerId : partner.id;
                            const pSnap = await db.collection("partnerships")
                                .where("hostId", "==", hostId)
                                .where("clubId", "==", clubId)
                                .limit(1).get();
                            if (!pSnap.empty) {
                                const data = pSnap.docs[0].data();
                                status = data.status === "active" ? "approved" : data.status; // Normalize active to approved
                                connectionId = pSnap.docs[0].id;
                            }
                        }

                        // 2. Check promoter_connections
                        if (!status) {
                            const cSnap1 = await db.collection("promoter_connections")
                                .where("promoterId", "==", partnerId)
                                .where("targetId", "==", partner.id)
                                .limit(1).get();

                            if (!cSnap1.empty) {
                                status = cSnap1.docs[0].data().status;
                                connectionId = cSnap1.docs[0].id;
                            } else {
                                const cSnap2 = await db.collection("promoter_connections")
                                    .where("promoterId", "==", partner.id)
                                    .where("targetId", "==", partnerId)
                                    .limit(1).get();
                                if (!cSnap2.empty) {
                                    status = cSnap2.docs[0].data().status;
                                    connectionId = cSnap2.docs[0].id;
                                }
                            }
                        }

                        return {
                            ...partner,
                            connectionStatus: status || null,
                            connectionId: connectionId || null
                        };
                    })
                );

                return NextResponse.json({ partners: partnersWithStatus });
            }

            case "list": {
                const status = searchParams.get("status");
                const connections = await listConnections(partnerId, role, status);
                return NextResponse.json({ connections });
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
        });

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

        const body = await req.json();
        const { connectionId, action, role, partnerId, partnerName, reason } = body;

        if (!connectionId || !action) {
            return NextResponse.json({ error: "connectionId and action are required" }, { status: 400 });
        }

        if (action === "approve") {
            await approveRequest(connectionId, role, partnerId, partnerName);
        } else if (action === "reject") {
            await rejectRequest(connectionId, role, partnerId, partnerName, reason);
        } else if (action === "block") {
            await blockRequest(connectionId, role, partnerId, partnerName, reason);
        } else {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("[Discovery API] PATCH Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
