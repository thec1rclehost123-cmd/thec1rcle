import { NextRequest, NextResponse } from "next/server";
import {
    listIncomingRequests,
    approveConnectionRequest,
    rejectConnectionRequest,
    revokeConnection
} from "@/lib/server/promoterConnectionStore";

/**
 * GET /api/host/promoter-requests
 * List incoming promoter connection requests for a host
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const hostId = searchParams.get("hostId");
        const status = searchParams.get("status");

        if (!hostId) {
            return NextResponse.json(
                { error: "hostId is required" },
                { status: 400 }
            );
        }

        const requests = await listIncomingRequests(
            hostId,
            "host",
            status || undefined
        );

        return NextResponse.json({ requests });
    } catch (error: any) {
        console.error("[Host Promoter Requests API] GET Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch requests" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/host/promoter-requests
 * Approve, reject, or revoke a promoter connection
 */
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { connectionId, action, hostId, hostName, reason } = body;

        if (!connectionId || !action) {
            return NextResponse.json(
                { error: "connectionId and action are required" },
                { status: 400 }
            );
        }

        switch (action) {
            case "approve": {
                await approveConnectionRequest(connectionId, {
                    uid: hostId,
                    name: hostName || ""
                });
                break;
            }

            case "reject": {
                await rejectConnectionRequest(
                    connectionId,
                    { uid: hostId, name: hostName || "" },
                    reason || ""
                );
                break;
            }

            case "revoke": {
                await revokeConnection(connectionId, {
                    uid: hostId,
                    name: hostName || ""
                });
                break;
            }

            default:
                return NextResponse.json(
                    { error: "Invalid action. Use 'approve', 'reject', or 'revoke'" },
                    { status: 400 }
                );
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("[Host Promoter Requests API] PATCH Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to update request" },
            { status: 400 }
        );
    }
}
