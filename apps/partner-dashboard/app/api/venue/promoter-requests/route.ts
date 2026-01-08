import { NextRequest, NextResponse } from "next/server";
import {
    listIncomingRequests,
    approveConnectionRequest,
    rejectConnectionRequest,
    revokeConnection
} from "@/lib/server/promoterConnectionStore";

/**
 * GET /api/venue/promoter-requests
 * List incoming promoter connection requests for a club
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        const status = searchParams.get("status");

        if (!venueId) {
            return NextResponse.json(
                { error: "venueId is required" },
                { status: 400 }
            );
        }

        const requests = await listIncomingRequests(
            venueId,
            "venue",
            status || undefined
        );

        return NextResponse.json({ requests });
    } catch (error: any) {
        console.error("[Venue Promoter Requests API] GET Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch requests" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/venue/promoter-requests
 * Approve, reject, or revoke a promoter connection
 */
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { connectionId, action, venueId, venueName, reason } = body;

        if (!connectionId || !action) {
            return NextResponse.json(
                { error: "connectionId and action are required" },
                { status: 400 }
            );
        }

        switch (action) {
            case "approve": {
                await approveConnectionRequest(connectionId, {
                    uid: venueId,
                    name: venueName || ""
                });
                break;
            }

            case "reject": {
                await rejectConnectionRequest(
                    connectionId,
                    { uid: venueId, name: venueName || "" },
                    reason || ""
                );
                break;
            }

            case "revoke": {
                await revokeConnection(connectionId, {
                    uid: venueId,
                    name: venueName || ""
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
        console.error("[Venue Promoter Requests API] PATCH Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to update request" },
            { status: 400 }
        );
    }
}
