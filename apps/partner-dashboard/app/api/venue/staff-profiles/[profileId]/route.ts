/**
 * GET    /api/venue/staff-profiles/[profileId]?venueId=
 * PATCH  /api/venue/staff-profiles/[profileId]?venueId=
 * DELETE /api/venue/staff-profiles/[profileId]?venueId=
 */

import { NextResponse } from "next/server";
import { requireManagementRole } from "@/lib/rbac/staffProfileEnforcer";
import {
    getStaffProfile,
    updateStaffProfile,
    deleteStaffProfile,
    listProfileAudit,
} from "@/lib/server/staffProfileStore";
import { verifyAuth } from "@/lib/server/auth";

export async function GET(
    request: Request,
    { params }: { params: { profileId: string } }
) {
    try {
        const ctx = await requireManagementRole(request);
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const profile = await getStaffProfile(ctx.venueId, params.profileId);
        if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const { searchParams } = new URL(request.url);
        const includeAudit = searchParams.get("audit") === "1";
        const audit = includeAudit
            ? await listProfileAudit(ctx.venueId, params.profileId, 20)
            : undefined;

        return NextResponse.json(
            { profile, audit },
            { headers: { "Cache-Control": "private, no-store" } }
        );
    } catch (err: any) {
        console.error("[staff-profiles/:id GET]", err.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: { profileId: string } }
) {
    try {
        const ctx = await requireManagementRole(request);
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const user = await verifyAuth(request);
        const body = await request.json();

        const allowed = [
            "profileName",
            "tabVisibility",
            "actionPermissions",
            "piiPolicy",
            "eventScope",
            "guestlistScope",
            "isActive",
        ] as const;

        const updates: Record<string, unknown> = {};
        for (const key of allowed) {
            if (key in body) updates[key] = body[key];
        }

        const profile = await updateStaffProfile(
            ctx.venueId,
            params.profileId,
            updates as any,
            { uid: user!.uid, name: user!.name ?? "" }
        );

        return NextResponse.json({ profile });
    } catch (err: any) {
        if (err.message === "Staff profile not found") {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        console.error("[staff-profiles/:id PATCH]", err.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: { profileId: string } }
) {
    try {
        const ctx = await requireManagementRole(request);
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const user = await verifyAuth(request);
        await deleteStaffProfile(ctx.venueId, params.profileId, {
            uid: user!.uid,
            name: user!.name ?? "",
        });

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error("[staff-profiles/:id DELETE]", err.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
