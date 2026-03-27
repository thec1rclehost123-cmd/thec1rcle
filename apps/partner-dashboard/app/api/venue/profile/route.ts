import { NextRequest } from "next/server";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";
import { getAdminDb } from "@/lib/firebase/admin";

const ALLOWED_FIELDS = [
    "displayName", "name", "bio", "venueType", "city",
    "website", "socialLinks", "photoURL",
];

/**
 * GET /api/venue/profile?venueId=XXX
 * Read venue profile fields directly from Firestore.
 */
export const GET = withAuth(async (req: NextRequest) => {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        if (!venueId) return fail("venueId is required", 400);

        const db = getAdminDb();
        const snap = await db.collection("venues").doc(venueId).get();
        if (!snap.exists) return fail("Venue not found", 404);

        const data = snap.data() ?? {};
        const profile = {
            displayName:  data.displayName || data.name || "",
            bio:          data.bio || data.description || "",
            venueType:    data.venueType || data.category || "",
            city:         data.city || "",
            website:      data.website || "",
            photoURL:     data.photoURL || data.logoImage || data.logo || "",
            socialLinks:  data.socialLinks ?? {},
        };

        return ok({ profile });
    } catch (err: any) {
        return fail("Failed to load profile");
    }
});

/**
 * PATCH /api/venue/profile
 * Write profile fields for a venue directly to Firestore.
 * Body: { venueId: string, updates: { displayName?, bio?, venueType?, city?, website?, socialLinks?, photoURL? } }
 */
export const PATCH = withAuth(async (req: NextRequest) => {
    try {
        const body = await req.json();
        const { venueId, updates } = body;
        if (!venueId || !updates) return fail("venueId and updates are required", 400);

        // Strip any keys not in the allowed list
        const safe: Record<string, any> = {};
        for (const key of ALLOWED_FIELDS) {
            if (key in updates) safe[key] = updates[key];
        }
        if (Object.keys(safe).length === 0) return fail("No valid fields to update", 400);

        safe.updatedAt = new Date().toISOString();

        const db = getAdminDb();
        await db.collection("venues").doc(venueId).set(safe, { merge: true });

        return ok({ success: true }, "Profile saved");
    } catch (err: any) {
        return fail("Failed to save profile");
    }
});
