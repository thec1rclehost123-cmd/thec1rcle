import { NextRequest, NextResponse } from "next/server";
import {
    listIncomingRequests,
    approveConnectionRequest,
    rejectConnectionRequest,
    revokeConnection
} from "@/lib/server/promoterConnectionStore";

/**
 * GET /api/club/promoter-requests
 * List incoming promoter connection requests for a club
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const clubId = searchParams.get("clubId");
        const status = searchParams.get("status");

        if (!clubId) {
            return NextResponse.json(
                { error: "clubId is required" },
                { status: 400 }
            );
        }

        const requests = await listIncomingRequests(
            clubId,
            "club",
            status || undefined
        );

        return NextResponse.json({ requests });
    } catch (error: any) {
        console.error("[Club Promoter Requests API] GET Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch requests" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/club/promoter-requests
 * Approve, reject, or revoke a promoter connection
 */
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { connectionId, action, clubId, clubName, reason } = body;

        if (!connectionId || !action) {
            return NextResponse.json(
                { error: "connectionId and action are required" },
                { status: 400 }
            );
        }

        switch (action) {
            case "approve": {
                await approveConnectionRequest(connectionId, {
                    uid: clubId,
                    name: clubName || ""
                });
                break;
            }

            case "reject": {
                await rejectConnectionRequest(
                    connectionId,
                    { uid: clubId, name: clubName || "" },
                    reason || ""
                );
                break;
            }

            case "revoke": {
                await revokeConnection(connectionId, {
                    uid: clubId,
                    name: clubName || ""
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
        console.error("[Club Promoter Requests API] PATCH Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to update request" },
            { status: 400 }
        );
    }
}
