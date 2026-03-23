import { NextRequest, NextResponse } from "next/server";
import { getProfile, updateProfile, createPost, createHighlight, getProfilePosts, getProfileHighlights, deletePost, deleteHighlight, getProfileStats } from "@/lib/server/profileStore";
import { verifyPartnerAccess } from "@/lib/server/auth";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * Common API for Venue and Host Profile Management
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const profileId = searchParams.get("profileId");
        const type = searchParams.get("type") as "venue" | "host" | "promoter";
        const includeStats = searchParams.get("stats") === "true";

        if (!profileId || !type) {
            return NextResponse.json({ error: "profileId and type are required" }, { status: 400 });
        }

        const authHeader = req.headers.get("Authorization") || "";
        const token = authHeader.replace("Bearer ", "").trim();

        const profile = await getProfile(profileId, type, token);
        if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

        const posts = await getProfilePosts(profileId, type, 20, token);
        const highlights = await getProfileHighlights(profileId, type, token);

        let stats = null;
        if (includeStats) {
            stats = await getProfileStats(profileId, type, token);
        }

        return NextResponse.json({
            profile,
            posts,
            highlights,
            stats
        });
    } catch (error: any) {
        return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }
}

export const POST = withAuth(async (req: NextRequest) => {
    try {
        const body = await req.json();
        const { profileId, type, action, data } = body;

        if (!profileId || !type || !action) {
            return fail("profileId, type, and action are required", 400);
        }

        // VERIFY PERMISSION
        const hasAccess = await verifyPartnerAccess(req, profileId);
        if (!hasAccess) {
            return fail("Forbidden: No management access to this partner", 403);
        }

        const authHeader = req.headers.get("Authorization") || "";
        const token = authHeader.replace("Bearer ", "").trim();

        let result;
        switch (action) {
            case "updateProfile":
                result = await updateProfile(profileId, type, data, token);
                break;
            case "createPost":
                result = await createPost(profileId, type, data, token);
                break;
            case "createHighlight":
                result = await createHighlight(profileId, type, data, token);
                break;
            case "deletePost":
                result = await deletePost(data.postId, token);
                break;
            case "deleteHighlight":
                result = await deleteHighlight(data.highlightId, token);
                break;
            case "addPhoto":
                result = await updateProfile(profileId, type, { [data.field]: data.url }, token);
                break;
            case "removePhoto":
                result = await updateProfile(profileId, type, { [data.field]: null }, token);
                break;
            default:
                return fail("Invalid action", 400);
        }

        return ok({ result });
    } catch (error: any) {
        console.error("Profile API Error:", error);
        return fail("Failed to process profile request");
    }
});
