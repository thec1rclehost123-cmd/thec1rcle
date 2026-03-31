import { NextRequest } from "next/server";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { ok, fail } from "@/lib/server/apiResponse";
import { getAdminDb } from "@/lib/firebase/admin";
import { NextResponse } from "next/server";

const ALLOWED_FIELDS = [
    "displayName", "name", "bio", "hostType", "city",
    "website", "socialLinks", "photoURL", "backdropURL", "coverURL",
    "eventsCount", "venuesConnected", "promotersConnected", "ticketsSold",
];

/**
 * GET /api/host/profile?hostId=XXX
 */
export async function GET(req: NextRequest) {
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    try {
        const db = getAdminDb();
        const snap = await db.collection("hosts").doc(ctx.hostId).get();

        const data = snap.exists ? (snap.data() ?? {}) : {};
        const profile = {
            displayName: data.displayName || data.name || "",
            bio:         data.bio || data.description || "",
            hostType:    data.hostType || data.category || "",
            city:        data.city || "",
            website:     data.website || "",
            photoURL:    data.photoURL || data.logoImage || data.logo || "",
            backdropURL: data.backdropURL || "",
            coverURL:    data.coverURL || data.backdropURL || "",
            socialLinks: data.socialLinks ?? {},
        };

        return ok({ profile });
    } catch {
        return fail("Failed to load profile");
    }
}

/**
 * PATCH /api/host/profile
 * Body: { hostId: string, updates: {...} }
 */
export async function PATCH(req: NextRequest) {
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    try {
        const body = await req.json();
        const { updates } = body;
        if (!updates) return fail("updates are required", 400);

        const safe: Record<string, any> = {};
        for (const key of ALLOWED_FIELDS) {
            if (key in updates) safe[key] = updates[key];
        }
        if (Object.keys(safe).length === 0) return fail("No valid fields to update", 400);

        safe.updatedAt = new Date().toISOString();

        const db = getAdminDb();
        await db.collection("hosts").doc(ctx.hostId).set(safe, { merge: true });

        return ok({ success: true }, "Profile saved");
    } catch {
        return fail("Failed to save profile");
    }
}
