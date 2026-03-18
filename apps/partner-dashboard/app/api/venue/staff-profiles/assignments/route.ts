/**
 * GET /api/venue/staff-profiles/assignments?venueId=
 *   → returns all { uid, staffProfileId } pairs for active memberships in this venue
 *   Used by the Access Profiles page to build profile → staff maps in one request
 */

import { NextResponse } from "next/server";
import { requireManagementRole } from "@/lib/rbac/staffProfileEnforcer";
import { getAdminDb } from "@/lib/firebase/admin";

export async function GET(request: Request) {
    try {
        const ctx = await requireManagementRole(request);
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const db = getAdminDb();
        const snap = await db
            .collection("partner_memberships")
            .where("partnerId", "==", ctx.venueId)
            .where("isActive", "==", true)
            .get();

        const assignments = snap.docs.map((doc) => ({
            uid: doc.data().uid as string,
            staffProfileId: (doc.data().staffProfileId as string | null) ?? null,
        }));

        return NextResponse.json({ assignments });
    } catch (err: any) {
        console.error("[staff-profiles/assignments GET]", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
