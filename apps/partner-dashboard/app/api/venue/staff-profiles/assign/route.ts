/**
 * GET    /api/venue/staff-profiles/assign?venueId=&staffUserId=
 *   → returns the currently assigned staffProfileId for the staff member's membership
 * POST   /api/venue/staff-profiles/assign?venueId=  body{ staffUserId, profileId }
 *   → looks up partner_memberships by staffUserId + venueId, then assigns the profile
 * DELETE /api/venue/staff-profiles/assign?venueId=  body{ staffUserId }
 *   → revokes any assigned profile from the staff member's membership
 */

import { NextResponse } from "next/server";
import { requireManagementRole } from "@/lib/rbac/staffProfileEnforcer";
import {
    assignProfileToMember,
    revokeProfileFromMember,
} from "@/lib/server/staffProfileStore";
import { getAdminDb } from "@/lib/firebase/admin";

async function getMembershipId(venueId: string, staffUserId: string): Promise<string | null> {
    const db = getAdminDb();
    const snap = await db
        .collection("partner_memberships")
        .where("uid", "==", staffUserId)
        .where("partnerId", "==", venueId)
        .where("isActive", "==", true)
        .limit(1)
        .get();
    return snap.empty ? null : snap.docs[0].id;
}

export async function GET(request: Request) {
    try {
        const ctx = await requireManagementRole(request);
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const { searchParams } = new URL(request.url);
        const staffUserId = searchParams.get("staffUserId");
        if (!staffUserId) {
            return NextResponse.json({ error: "staffUserId is required" }, { status: 400 });
        }

        const db = getAdminDb();
        const snap = await db
            .collection("partner_memberships")
            .where("uid", "==", staffUserId)
            .where("partnerId", "==", ctx.venueId)
            .where("isActive", "==", true)
            .limit(1)
            .get();

        if (snap.empty) {
            return NextResponse.json({ staffProfileId: null });
        }

        const staffProfileId = snap.docs[0].data().staffProfileId ?? null;
        return NextResponse.json({ staffProfileId });
    } catch (err: any) {
        console.error("[staff-profiles/assign GET]", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const ctx = await requireManagementRole(request);
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const { staffUserId, profileId } = await request.json();

        if (!staffUserId || !profileId) {
            return NextResponse.json({ error: "staffUserId and profileId are required" }, { status: 400 });
        }

        const membershipId = await getMembershipId(ctx.venueId, staffUserId);
        if (!membershipId) {
            return NextResponse.json({ error: "No active membership found for this staff member" }, { status: 404 });
        }

        const actor = { uid: ctx.uid, name: "" };
        await assignProfileToMember(ctx.venueId, membershipId, profileId, actor);

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error("[staff-profiles/assign POST]", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const ctx = await requireManagementRole(request);
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const { staffUserId } = await request.json();

        if (!staffUserId) {
            return NextResponse.json({ error: "staffUserId is required" }, { status: 400 });
        }

        const membershipId = await getMembershipId(ctx.venueId, staffUserId);
        if (!membershipId) {
            return NextResponse.json({ error: "No active membership found for this staff member" }, { status: 404 });
        }

        const actor = { uid: ctx.uid, name: "" };
        await revokeProfileFromMember(ctx.venueId, membershipId, actor);

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error("[staff-profiles/assign DELETE]", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
