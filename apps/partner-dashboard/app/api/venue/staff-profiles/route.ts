/**
 * GET  /api/venue/staff-profiles?venueId=
 * POST /api/venue/staff-profiles
 */

import { NextResponse } from "next/server";
import { requireManagementRole } from "@/lib/rbac/staffProfileEnforcer";
import {
    listStaffProfiles,
    createStaffProfile,
} from "@/lib/server/staffProfileStore";

export async function GET(request: Request) {
    try {
        const ctx = await requireManagementRole(request);
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const profiles = await listStaffProfiles(ctx.venueId);
        return NextResponse.json(
            { profiles },
            { headers: { "Cache-Control": "private, no-store" } }
        );
    } catch (err: any) {
        console.error("[staff-profiles GET]", err.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const ctx = await requireManagementRole(request);
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const body = await request.json();

        if (!body.profileName || !body.baseRole) {
            return NextResponse.json({ error: "profileName and baseRole are required" }, { status: 422 });
        }

        const { verifyAuth } = await import("@/lib/server/auth");
        const user = await verifyAuth(request);

        const profile = await createStaffProfile(
            ctx.venueId,
            {
                profileName: body.profileName,
                baseRole: body.baseRole,
                tabVisibility: body.tabVisibility,
                actionPermissions: body.actionPermissions,
                piiPolicy: body.piiPolicy,
                eventScope: body.eventScope ?? null,
                guestlistScope: body.guestlistScope ?? "read_only",
            },
            { uid: user!.uid, name: user!.displayName ?? "" }
        );

        return NextResponse.json({ profile }, { status: 201 });
    } catch (err: any) {
        console.error("[staff-profiles POST]", err.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
