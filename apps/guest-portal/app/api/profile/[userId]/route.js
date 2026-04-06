import { NextResponse } from "next/server";
import { getUserProfile, getUserEvents } from "../../../../lib/server/profileStore";

/**
 * GET /api/profile/[userId]?viewerId=<uid>
 *
 * Returns the public profile + event history for a user.
 * Replaces the "fetchProfile" and "getUserEvents" Server Actions — these are
 * pure reads, GET is semantically correct and avoids the POST overhead.
 *
 * This route is intentionally unauthenticated for public profiles.
 * PII masking is handled inside getUserProfile/getUserEvents based on viewerId.
 */
export async function GET(request, { params }) {
    const { userId } = await params;
    if (!userId) {
        return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const viewerId = searchParams.get("viewerId") || null;

    try {
        const [profile, events] = await Promise.all([
            getUserProfile(userId),
            getUserEvents(userId, viewerId),
        ]);

        if (!profile) {
            return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        }

        return NextResponse.json({ profile, events });
    } catch (error) {
        console.error("[GET /api/profile/[userId]]", error);
        return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
    }
}
