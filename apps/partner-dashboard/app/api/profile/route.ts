import { NextRequest, NextResponse } from "next/server";
import {
    getProfile,
    updateProfile,
    updateCoverImage,
    addPhoto,
    removePhoto,
    createPost,
    getProfilePosts,
    deletePost,
    createHighlight,
    getProfileHighlights,
    deleteHighlight,
    getProfileStats
} from "@/lib/server/profileStore";

/**
 * GET /api/profile
 * Get profile, posts, highlights, or stats
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const profileId = searchParams.get("profileId");
        const type = searchParams.get("type") || "club";
        const include = searchParams.get("include"); // posts, highlights, stats

        if (!profileId) {
            return NextResponse.json(
                { error: "profileId is required" },
                { status: 400 }
            );
        }

        const profile = await getProfile(profileId, type);
        if (!profile) {
            return NextResponse.json(
                { error: "Profile not found" },
                { status: 404 }
            );
        }

        const response: any = { profile };

        if (include?.includes("posts")) {
            response.posts = await getProfilePosts(profileId, type);
        }

        if (include?.includes("highlights")) {
            response.highlights = await getProfileHighlights(profileId, type);
        }

        if (include?.includes("stats")) {
            response.stats = await getProfileStats(profileId, type);
        }

        return NextResponse.json(response);
    } catch (error: any) {
        console.error("[Profile API] GET Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch profile" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/profile
 * Update profile details
 */
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { profileId, type, action, data, user } = body;

        if (!profileId || !type) {
            return NextResponse.json(
                { error: "profileId and type are required" },
                { status: 400 }
            );
        }

        let result;

        switch (action) {
            case "updateDetails":
                result = await updateProfile(profileId, type, data, user);
                break;

            case "updateCover":
                if (!data.imageUrl) {
                    return NextResponse.json(
                        { error: "imageUrl is required" },
                        { status: 400 }
                    );
                }
                result = await updateCoverImage(profileId, type, data.imageUrl, user);
                break;

            case "addPhoto":
                if (!data.photoUrl) {
                    return NextResponse.json(
                        { error: "photoUrl is required" },
                        { status: 400 }
                    );
                }
                result = await addPhoto(profileId, type, data.photoUrl, user);
                break;

            case "removePhoto":
                if (!data.photoUrl) {
                    return NextResponse.json(
                        { error: "photoUrl is required" },
                        { status: 400 }
                    );
                }
                result = await removePhoto(profileId, type, data.photoUrl, user);
                break;

            default:
                // Default: update profile
                result = await updateProfile(profileId, type, data || {}, user);
        }

        return NextResponse.json({ success: true, profile: result });
    } catch (error: any) {
        console.error("[Profile API] PATCH Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to update profile" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/profile
 * Create posts or highlights
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { profileId, type, action, data, user } = body;

        if (!profileId || !type || !action) {
            return NextResponse.json(
                { error: "profileId, type, and action are required" },
                { status: 400 }
            );
        }

        let result;

        switch (action) {
            case "createPost":
                result = await createPost(profileId, type, data, user);
                return NextResponse.json({ success: true, post: result }, { status: 201 });

            case "createHighlight":
                if (!data.imageUrl) {
                    return NextResponse.json(
                        { error: "imageUrl is required for highlight" },
                        { status: 400 }
                    );
                }
                result = await createHighlight(profileId, type, data, user);
                return NextResponse.json({ success: true, highlight: result }, { status: 201 });

            default:
                return NextResponse.json(
                    { error: `Invalid action: ${action}` },
                    { status: 400 }
                );
        }
    } catch (error: any) {
        console.error("[Profile API] POST Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to create content" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/profile
 * Delete posts or highlights
 */
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const action = searchParams.get("action");
        const id = searchParams.get("id");

        if (!action || !id) {
            return NextResponse.json(
                { error: "action and id are required" },
                { status: 400 }
            );
        }

        let result;

        switch (action) {
            case "deletePost":
                result = await deletePost(id, {});
                break;

            case "deleteHighlight":
                result = await deleteHighlight(id);
                break;

            default:
                return NextResponse.json(
                    { error: `Invalid action: ${action}` },
                    { status: 400 }
                );
        }

        return NextResponse.json({ success: true, ...result });
    } catch (error: any) {
        console.error("[Profile API] DELETE Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to delete content" },
            { status: 500 }
        );
    }
}
