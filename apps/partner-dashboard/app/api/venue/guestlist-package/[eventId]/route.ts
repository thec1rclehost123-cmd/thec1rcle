/**
 * GET /api/venue/guestlist-package/[eventId]?venueId=
 *
 * Returns a full offline-capable guestlist bundle for IndexedDB caching.
 * Includes all active guests with fields needed for offline scan/search.
 * PII is masked per the caller's staff profile policy.
 *
 * Response includes ETag for conditional requests.
 * Max 2000 guests per package (scanner use case).
 */

import { NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";
import { applyPIIMask } from "@/lib/rbac/staffProfileEnforcer";
import { createHash } from "node:crypto";

export async function GET(
    request: Request,
    { params }: { params: { eventId: string } }
) {
    try {
        const ctx = await requireVenueAccess(request, "guestlist:read");
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const { eventId } = params;

        if (!isFirebaseConfigured()) {
            return NextResponse.json({
                guests: [],
                totalCount: 0,
                packagedAt: new Date().toISOString(),
            }, { headers: { "Cache-Control": "private, max-age=120", ETag: '"dev-empty"' } });
        }

        const db = getAdminDb();
        const snap = await db
            .collection("guest_lists")
            .doc(eventId)
            .collection("guests")
            .limit(2000)
            .get();

        const guests = snap.docs.map((d) => {
            const raw = { id: d.id, ...d.data() };
            return applyPIIMask(raw as any, ctx.piiPolicy);
        });

        // Compute ETag from count + last-updated
        const etag = `"${createHash("sha1")
            .update(`${guests.length}-${new Date().toISOString().slice(0, 16)}`)
            .digest("hex")
            .slice(0, 12)}"`;

        // Honour conditional GET
        const ifNoneMatch = request.headers.get("if-none-match");
        if (ifNoneMatch === etag) {
            return new Response(null, { status: 304, headers: { ETag: etag } });
        }

        return NextResponse.json(
            {
                guests,
                totalCount: guests.length,
                packagedAt: new Date().toISOString(),
            },
            {
                headers: {
                    "Cache-Control": "private, max-age=120, stale-while-revalidate=300",
                    ETag: etag,
                },
            }
        );
    } catch (err: any) {
        console.error("[guestlist-package GET]", err.message);
        return NextResponse.json({ error: "Failed to load guestlist package" }, { status: 500 });
    }
}
