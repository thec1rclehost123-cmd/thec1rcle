import { NextResponse } from "next/server";
import {
    followEntity,
    unfollowEntity
} from "../../../../../lib/server/notificationStore";
import { verifyAuth } from "../../../../../lib/server/auth";

/**
 * POST /api/venues/[venueId]/follow
 * Follow a venue
 */
export async function POST(request, { params }) {
    try {
        const { venueId } = await params;

        const decodedToken = await verifyAuth(request);
        if (!decodedToken) {
            return NextResponse.json(
                { error: "Authentication required" },
                { status: 401 }
            );
        }

        const result = await followEntity(decodedToken.uid, venueId, "venue");
        return NextResponse.json({ success: true, follow: result }, { status: 201 });
    } catch (error) {
        console.error("[Venue Follow API] POST Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to follow venue" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/venues/[venueId]/follow
 * Unfollow a venue
 */
export async function DELETE(request, { params }) {
    try {
        const { venueId } = await params;

        const decodedToken = await verifyAuth(request);
        if (!decodedToken) {
            return NextResponse.json(
                { error: "Authentication required" },
                { status: 401 }
            );
        }

        const result = await unfollowEntity(decodedToken.uid, venueId, "venue");
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error("[Venue Follow API] DELETE Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to unfollow venue" },
            { status: 500 }
        );
    }
}
