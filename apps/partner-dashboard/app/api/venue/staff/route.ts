import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
    inviteStaff,
    getVenueStaff,
    verifyStaff,
    suspendStaff,
    removeStaff,
    ROLE_PRESETS,
} from "@/lib/server/staffService";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireVenueAccess, applyPIIMask } from "@/lib/rbac/staffProfileEnforcer";
import { ok, fail } from "@/lib/server/apiResponse";
import { Resend } from "resend";

// Guard: only initialize Resend if the API key is configured
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const STAFF_ROLE_LABELS: Record<string, string> = {
    STAFF: "Employee",
    FINANCE_ADMIN: "Finance",
    manager: "Manager",
    security: "Security",
    scanner: "Scanner",
    door_staff: "Door Staff",
    supervisor: "Supervisor",
    owner: "Owner",
};

const StaffQuery = z.object({
    venueId: z.string().min(1, "venueId is required"),
    isActive: z.string().optional(),
});

const InviteStaffBody = z.object({
    venueId: z.string().min(1, "venueId is required"),
    email: z.string().email("Invalid email address"),
    name: z.string().min(1, "name is required"),
    role: z.string().min(1, "role is required"),
});

const UpdateStaffBody = z.object({
    staffId: z.string().min(1, "staffId is required"),
    action: z.enum(["verify", "suspend", "reactivate", "remove"], {
        error: "action must be 'verify', 'suspend', 'reactivate', or 'remove'",
    }),
    reason: z.string().optional(),
});

/**
 * GET /api/venue/staff
 * List all staff members for a venue (direct Firestore read)
 * RBAC: staff:read — OWNER or staff with explicit permission
 */
export async function GET(req: NextRequest) {
    const ctx = await requireVenueAccess(req, "staff:read");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    try {
        const { searchParams } = new URL(req.url);
        const parsed = StaffQuery.safeParse(Object.fromEntries(searchParams));
        if (!parsed.success) return fail(parsed.error.issues[0].message, 400);

        const { isActive } = parsed.data;
        const statusFilter = isActive === "false" ? "removed" : isActive === "all" ? null : "active";
        const staff = await getVenueStaff(ctx.venueId, { status: statusFilter ?? undefined });

        const masked = (staff as any[]).map(s => applyPIIMask(s, ctx.piiPolicy));
        const roleOptions = ["STAFF", "FINANCE_ADMIN", "manager", "supervisor", "security"];

        return ok({ staff: masked, roleOptions });
    } catch (error: any) {
        console.error("[Staff API] GET Error:", error);
        return fail("Failed to fetch staff");
    }
}

/**
 * POST /api/venue/staff
 * Invite a new staff member, sends email via Resend
 * RBAC: staff:invite — OWNER or staff with explicit permission
 */
export async function POST(req: NextRequest) {
    const ctx = await requireVenueAccess(req, "staff:invite");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    try {
        const rawBody = await req.json();
        const parsed = InviteStaffBody.safeParse(rawBody);
        if (!parsed.success) return fail(parsed.error.issues[0].message, 400);

        const { email, name, role } = parsed.data;
        const venueId = ctx.venueId;

        if (!(ROLE_PRESETS as any)[role]) {
            return fail(`Invalid role. Valid roles: ${Object.keys(ROLE_PRESETS).join(", ")}`, 400);
        }

        const result = await inviteStaff(
            venueId,
            { email, name, role },
            { uid: ctx.uid, name: ctx.uid }
        );

        if (!result.success) {
            return fail(result.error || "Staff member already exists", 409);
        }

        // Fetch venue name for the invite email
        let venueName = "The Venue";
        try {
            const db = getAdminDb();
            const venueDoc = await db.collection("venues").doc(venueId).get();
            venueName = venueDoc.data()?.name || venueDoc.data()?.venueName || venueName;
        } catch {}

        // Send invite email via Resend
        const baseUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || "https://dashboard.thec1rcle.com";
        const inviteUrl = `${baseUrl}/auth/staff-invite?code=${result.inviteCode}&venue=${venueId}`;
        const roleLabel = STAFF_ROLE_LABELS[role] || role;

        try {
            await resend?.emails.send({
                from: process.env.EMAIL_FROM || "C1rcle <onboarding@resend.dev>",
                to: email,
                subject: `You've been invited to join ${venueName} on The C1rcle`,
                html: `
                    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0d0d0f; color: #fff; border-radius: 16px;">
                        <h2 style="font-size: 22px; font-weight: 900; margin-bottom: 8px;">You're invited!</h2>
                        <p style="color: #aaa; margin-bottom: 24px;">
                            You've been invited to join <strong style="color: #fff;">${venueName}</strong>
                            as a <strong style="color: #f97316;">${roleLabel}</strong>
                            on The C1rcle Partner Dashboard.
                        </p>
                        <a href="${inviteUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #f97316, #e11d48); color: #fff; font-weight: 700; border-radius: 12px; text-decoration: none; font-size: 14px;">
                            Accept Invitation
                        </a>
                        <p style="color: #666; font-size: 12px; margin-top: 24px;">
                            This invitation expires in 7 days. If you didn't expect this, you can safely ignore it.
                        </p>
                        <p style="color: #444; font-size: 11px; margin-top: 8px;">
                            Or copy this link: ${inviteUrl}
                        </p>
                    </div>
                `,
            });
        } catch (emailErr) {
            console.warn("[Staff API] Failed to send invite email:", emailErr);
        }

        return ok({ staff: result.staffMember, inviteCode: result.inviteCode }, "Staff member invited", 201);
    } catch (error: any) {
        console.error("[Staff API] POST Error:", error);
        return fail("Failed to add staff member");
    }
}

/**
 * PATCH /api/venue/staff
 * Update a staff member (verify, suspend, reactivate, remove)
 * RBAC: staff:revoke — OWNER or staff with explicit permission
 */
export async function PATCH(req: NextRequest) {
    const ctx = await requireVenueAccess(req, "staff:revoke");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    try {
        const rawBody = await req.json();
        const parsed = UpdateStaffBody.safeParse(rawBody);
        if (!parsed.success) return fail(parsed.error.issues[0].message, 400);

        const { staffId, action, reason } = parsed.data;
        const actor = { uid: ctx.uid, name: ctx.uid };

        switch (action) {
            case "verify":
                await verifyStaff(staffId, actor);
                break;

            case "suspend":
                await suspendStaff(staffId, reason || "Suspended by owner", actor);
                break;

            case "reactivate": {
                const db = getAdminDb();
                await db.collection("venue_staff").doc(staffId).update({
                    status: "active",
                    suspendedAt: null,
                    suspendedBy: null,
                    suspensionReason: null,
                    updatedAt: new Date().toISOString(),
                });
                break;
            }

            case "remove":
                await removeStaff(staffId, actor);
                break;
        }

        return ok({ success: true }, "Staff member updated");
    } catch (error: any) {
        console.error("[Staff API] PATCH Error:", error);
        return fail("Failed to update staff member");
    }
}
