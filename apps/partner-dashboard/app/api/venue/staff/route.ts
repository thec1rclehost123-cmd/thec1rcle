import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import {
    inviteStaff,
    getVenueStaff,
    verifyStaff,
    suspendStaff,
    removeStaff,
    ROLE_PRESETS,
} from "@/lib/server/staffService";
import { getAdminDb } from "@/lib/firebase/admin";
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

/**
 * GET /api/venue/staff
 * List all staff members for a venue (direct Firestore read)
 */
export async function GET(req: NextRequest) {
    try {
        const user = await verifyAuth(req);
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        const isActiveParam = searchParams.get("isActive");

        if (!venueId) {
            return NextResponse.json({ error: "venueId is required" }, { status: 400 });
        }

        const statusFilter = isActiveParam === "false" ? "removed" : isActiveParam === "all" ? null : "active";
        const staff = await getVenueStaff(venueId, { status: statusFilter ?? undefined });

        const roleOptions = ["STAFF", "FINANCE_ADMIN", "manager", "supervisor", "security"];

        return NextResponse.json({ staff, roleOptions });
    } catch (error: any) {
        console.error("[Staff API] GET Error:", error);
        return NextResponse.json({ error: error.message || "Failed to fetch staff" }, { status: 500 });
    }
}

/**
 * POST /api/venue/staff
 * Invite a new staff member, sends email via Resend
 */
export async function POST(req: NextRequest) {
    try {
        const user = await verifyAuth(req);
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { venueId, email, name, role } = body;

        if (!venueId || !email || !name || !role) {
            return NextResponse.json(
                { error: "venueId, email, name, and role are required" },
                { status: 400 }
            );
        }

        if (!(ROLE_PRESETS as any)[role]) {
            return NextResponse.json(
                { error: `Invalid role. Valid roles: ${Object.keys(ROLE_PRESETS).join(", ")}` },
                { status: 400 }
            );
        }

        const result = await inviteStaff(
            venueId,
            { email, name, role },
            { uid: user.uid, name: (user as any).name || (user as any).email || "Owner" }
        );

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 409 });
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

        return NextResponse.json({ staff: result.staffMember, inviteCode: result.inviteCode }, { status: 201 });
    } catch (error: any) {
        console.error("[Staff API] POST Error:", error);
        if (error.message?.includes("already exists")) {
            return NextResponse.json({ error: error.message }, { status: 409 });
        }
        return NextResponse.json({ error: error.message || "Failed to add staff member" }, { status: 500 });
    }
}

/**
 * PATCH /api/venue/staff
 * Update a staff member (verify, suspend, reactivate, remove)
 */
export async function PATCH(req: NextRequest) {
    try {
        const user = await verifyAuth(req);
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { staffId, action } = body;

        if (!staffId || !action) {
            return NextResponse.json({ error: "staffId and action are required" }, { status: 400 });
        }

        const actor = { uid: user.uid, name: (user as any).name || (user as any).email || "Owner" };
        let result;

        switch (action) {
            case "verify":
                result = await verifyStaff(staffId, actor);
                break;

            case "suspend":
                result = await suspendStaff(staffId, body.reason || "Suspended by owner", actor);
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
                result = { success: true };
                break;
            }

            case "remove":
                result = await removeStaff(staffId, actor);
                break;

            default:
                return NextResponse.json(
                    { error: "Invalid action. Valid: verify, suspend, reactivate, remove" },
                    { status: 400 }
                );
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("[Staff API] PATCH Error:", error);
        return NextResponse.json({ error: error.message || "Failed to update staff member" }, { status: 500 });
    }
}
