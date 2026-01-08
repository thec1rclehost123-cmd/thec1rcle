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
        const type = searchParams.get("type") as "venue" | "host";
        const includeStats = searchParams.get("stats") === "true";

        if (!profileId || !type) {
            return NextResponse.json({ error: "profileId and type are required" }, { status: 400 });
        }

        // Potential security gap: Profile GET is usually public, so no auth check here for reading.
        // However, if we want to restrict certain profiles, we'd add it here.

        const profile = await getProfile(profileId, type);
        if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

        const posts = await getProfilePosts(profileId, type);
        const highlights = await getProfileHighlights(profileId, type);

        let stats = null;
        if (includeStats) {
            stats = await getProfileStats(profileId, type);
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

        const user = {
            uid: decodedToken.uid,
            name: decodedToken.name || decodedToken.email || "User",
            email: decodedToken.email
        };

        let result;
        switch (action) {
            case "updateProfile":
                result = await updateProfile(profileId, type, data, user);
                break;
            case "createPost":
                result = await createPost(profileId, type, data, user);
                break;
            case "createHighlight":
                result = await createHighlight(profileId, type, data, user);
                break;
            case "deletePost":
                // Additional check: Ensure post belongs to this profile
                result = await deletePost(data.postId, user);
                break;
            case "deleteHighlight":
                result = await deleteHighlight(data.highlightId);
                break;
            case "addPhoto":
                result = await updateProfile(profileId, type, { [data.field]: data.url }, user);
                break;
            case "removePhoto":
                result = await updateProfile(profileId, type, { [data.field]: null }, user);
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
