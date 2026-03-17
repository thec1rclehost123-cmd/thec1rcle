import { NextRequest, NextResponse } from "next/server";
import { getProfile, updateProfile, createPost, createHighlight, getProfilePosts, getProfileHighlights, deletePost, deleteHighlight, getProfileStats } from "@/lib/server/profileStore";
import { verifyAuth, verifyPartnerAccess } from "@/lib/server/auth";

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
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { profileId, type, action, data } = body;

        if (!profileId || !type || !action) {
            return NextResponse.json({ error: "profileId, type, and action are required" }, { status: 400 });
        }

        // VERIFY PERMISSION
        const hasAccess = await verifyPartnerAccess(req, profileId);
        if (!hasAccess) {
            return NextResponse.json({ error: "Forbidden: No management access to this partner" }, { status: 403 });
        }

        const authHeader = req.headers.get("Authorization") || "";
        const token = authHeader.replace("Bearer ", "").trim();

        let result;
        switch (action) {
            case "updateProfile":
<<<<<<< HEAD
                result = await updateProfile(profileId, type, data);
                break;
            case "createPost":
                result = await createPost(profileId, type, data);
                break;
            case "createHighlight":
                result = await createHighlight(profileId, type, data);
                break;
            case "deletePost":
                // Additional check: Ensure post belongs to this profile
                result = await deletePost(data.postId);
=======
                result = await updateProfile(profileId, type, data, token);
                break;
            case "createPost":
                result = await createPost(profileId, type, data, token);
                break;
            case "createHighlight":
                result = await createHighlight(profileId, type, data, token);
                break;
            case "deletePost":
                // Additional check: Ensure post belongs to this profile
                result = await deletePost(data.postId, token);
>>>>>>> 6ccfad5 (feat: UI improvements and bug fixes)
                break;
            case "deleteHighlight":
                result = await deleteHighlight(data.highlightId, token);
                break;
            case "addPhoto":
<<<<<<< HEAD
                result = await updateProfile(profileId, type, { [data.field]: data.url });
                break;
            case "removePhoto":
                result = await updateProfile(profileId, type, { [data.field]: null });
=======
                result = await updateProfile(profileId, type, { [data.field]: data.url }, token);
                break;
            case "removePhoto":
                result = await updateProfile(profileId, type, { [data.field]: null }, token);
>>>>>>> 6ccfad5 (feat: UI improvements and bug fixes)
                break;
            default:
                return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        return NextResponse.json({ success: true, result });
    } catch (error: any) {
        console.error("Profile API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
