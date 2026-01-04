import { NextResponse } from "next/server";
import {
    followEntity,
    unfollowEntity,
    isFollowing
} from "../../../lib/server/notificationStore";
import { verifyAuth } from "../../../lib/server/auth";

/**
 * GET /api/follow
 * Check if user follows an entity
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");
        const targetId = searchParams.get("targetId");

        if (!userId || !targetId) {
            return NextResponse.json(
                { error: "userId and targetId are required" },
                { status: 400 }
            );
        }

        const following = await isFollowing(userId, targetId);
        return NextResponse.json({ following });
    } catch (error) {
        console.error("[Follow API] GET Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to check follow status" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/follow
 * Follow an entity (club or host)
 */
export async function POST(request) {
    try {
        const decodedToken = await verifyAuth(request);
        if (!decodedToken) {
            return NextResponse.json(
                { error: "Authentication required" },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { targetId, targetType } = body;

        if (!targetId || !targetType) {
            return NextResponse.json(
                { error: "targetId and targetType are required" },
                { status: 400 }
            );
        }

        if (!["club", "host"].includes(targetType)) {
            return NextResponse.json(
                { error: "targetType must be 'club' or 'host'" },
                { status: 400 }
            );
        }

        const result = await followEntity(decodedToken.uid, targetId, targetType);
        return NextResponse.json({ success: true, follow: result }, { status: 201 });
    } catch (error) {
        console.error("[Follow API] POST Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to follow" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/follow
 * Unfollow an entity
 */
export async function DELETE(request) {
    try {
        const decodedToken = await verifyAuth(request);
        if (!decodedToken) {
            return NextResponse.json(
                { error: "Authentication required" },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const targetId = searchParams.get("targetId");
        const targetType = searchParams.get("targetType") || "club";

        if (!targetId) {
            return NextResponse.json(
                { error: "targetId is required" },
                { status: 400 }
            );
        }

        const result = await unfollowEntity(decodedToken.uid, targetId, targetType);
        return NextResponse.json(result);
    } catch (error) {
        console.error("[Follow API] DELETE Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to unfollow" },
            { status: 500 }
        );
    }
}
