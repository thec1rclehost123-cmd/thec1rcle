/**
 * GET    /api/host/team?hostId=     — List team members for this host org
 * POST   /api/host/team/invite      — Invite a new co-host or staff member
 * PATCH  /api/host/team/[membershipId] — Change role
 * DELETE /api/host/team/[membershipId] — Revoke access
 *
 * All team mutations require MANAGE_STAFF permission (OWNER only).
 */
import { NextRequest } from "next/server";
import { requireHostAccess, writeAuditLog } from "@/lib/server/hostAuthMiddleware";
import { getAdminDb } from "@/lib/firebase/admin";
import { ok, fail } from "@/lib/server/apiResponse";
import { logger } from "@/lib/server/logger";
import type { HostRole } from "@/lib/rbac/types";

const VALID_HOST_ROLES: HostRole[] = ["OWNER", "COHOST", "STAFF"];

export async function GET(req: NextRequest) {
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return fail(ctx.error, ctx.status);
    const { uid, hostId } = ctx as any;

    const db = getAdminDb();

    try {
        const membershipsSnap = await db.collection("partner_memberships")
            .where("partnerId", "==", hostId)
            .where("partnerType", "==", "host")
            .get();

        const members = membershipsSnap.docs.map(doc => {
            const m = doc.data();
            return {
                membershipId: doc.id,
                uid: m.uid,
                displayName: m.displayName || m.email || "Member",
                email: m.email || null,
                role: m.role as HostRole,
                isActive: m.isActive === true || m.status === "active",
                joinedAt: m.joinedAt ? new Date(m.joinedAt).toISOString() : null,
                lastActive: m.lastActive || null,
            };
        });

        return ok({ members });
    } catch (err: any) {
        logger.error("host/team", "GET failed", { error: err.message });
        return fail("Failed to process team request");
    }
}

export async function POST(req: NextRequest) {
    const ctx = await requireHostAccess(req, "MANAGE_STAFF");
    if ("error" in ctx) return fail(ctx.error, ctx.status);

    const { uid, hostId } = ctx as any;
    const db = getAdminDb();

    try {
        const body = await req.json();
        const { email, role } = body;
        if (!email) return fail("email required", 422);
        const targetRole = (role as HostRole) || "STAFF";
        if (!VALID_HOST_ROLES.includes(targetRole)) {
            return fail("Invalid role", 422);
        }
        // Prevent assigning OWNER through this endpoint (must be done manually)
        if (targetRole === "OWNER") {
            return fail("Cannot assign OWNER role through invite", 403);
        }

        // Look up user by email
        let targetUid: string | null = null;
        let targetName = email;
        const userSnap = await db.collection("users").where("email", "==", email).limit(1).get();
        if (!userSnap.empty) {
            targetUid = userSnap.docs[0].id;
            targetName = userSnap.docs[0].data().displayName || email;
        }

        if (targetUid) {
            // Check for existing membership
            const existingSnap = await db.collection("partner_memberships")
                .where("partnerId", "==", hostId)
                .where("uid", "==", targetUid)
                .limit(1)
                .get();

            if (!existingSnap.empty && existingSnap.docs[0].data().isActive) {
                return fail("User already has an active membership", 409);
            }

            // Create or update membership
            const membershipData = {
                uid: targetUid,
                partnerId: hostId,
                partnerType: "host",
                partnerName: body.partnerName || "",
                role: targetRole,
                displayName: targetName,
                email,
                isActive: true,
                status: "active",
                joinedAt: Date.now(),
                invitedBy: uid,
            };

            if (!existingSnap.empty) {
                await existingSnap.docs[0].ref.update({ ...membershipData, reactivatedAt: Date.now() });
            } else {
                await db.collection("partner_memberships").add(membershipData);
            }
        }

        // Create invitation record
        const inviteRef = await db.collection("invitations").add({
            hostId,
            invitedBy: uid,
            email,
            targetUid: targetUid || null,
            role: targetRole,
            partnerType: "host",
            status: targetUid ? "accepted" : "pending",
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

        await writeAuditLog(hostId, uid, "team.invite", { email, role: targetRole, inviteId: inviteRef.id });

        return ok({ inviteId: inviteRef.id, status: targetUid ? "activated" : "pending_signup" });
    } catch (err: any) {
        logger.error("host/team", "POST failed", { error: err.message });
        return fail("Failed to process team request");
    }
}

export async function PATCH(req: NextRequest) {
    const ctx = await requireHostAccess(req, "MANAGE_STAFF");
    if ("error" in ctx) return fail(ctx.error, ctx.status);

    const { uid, hostId } = ctx as any;
    const { searchParams } = new URL(req.url);
    const membershipId = searchParams.get("membershipId");
    if (!membershipId) return fail("membershipId required", 400);

    const db = getAdminDb();

    try {
        const body = await req.json();
        const { role } = body;
        if (!role || !VALID_HOST_ROLES.includes(role)) {
            return fail("Valid role required", 422);
        }
        if (role === "OWNER") {
            return fail("Cannot assign OWNER role", 403);
        }

        const memberDoc = await db.collection("partner_memberships").doc(membershipId).get();
        if (!memberDoc.exists || memberDoc.data()?.partnerId !== hostId) {
            return fail("Membership not found", 404);
        }

        await memberDoc.ref.update({ role, updatedAt: Date.now(), updatedBy: uid });

        await writeAuditLog(hostId, uid, "team.role.change", {
            membershipId,
            oldRole: memberDoc.data()?.role,
            newRole: role,
            targetUid: memberDoc.data()?.uid,
        });

        return ok(null);
    } catch (err: any) {
        logger.error("host/team", "PATCH failed", { error: err.message });
        return fail("Failed to process team request");
    }
}

export async function DELETE(req: NextRequest) {
    const ctx = await requireHostAccess(req, "MANAGE_STAFF");
    if ("error" in ctx) return fail(ctx.error, ctx.status);

    const { uid, hostId } = ctx as any;
    const { searchParams } = new URL(req.url);
    const membershipId = searchParams.get("membershipId");
    if (!membershipId) return fail("membershipId required", 400);

    const db = getAdminDb();

    try {
        const memberDoc = await db.collection("partner_memberships").doc(membershipId).get();
        if (!memberDoc.exists || memberDoc.data()?.partnerId !== hostId) {
            return fail("Membership not found", 404);
        }

        // Prevent revoking own access
        if (memberDoc.data()?.uid === uid) {
            return fail("Cannot revoke your own access", 409);
        }

        // Deactivate (soft delete — audit trail)
        await memberDoc.ref.update({
            isActive: false,
            status: "revoked",
            revokedAt: Date.now(),
            revokedBy: uid,
        });

        await writeAuditLog(hostId, uid, "team.revoke", {
            membershipId,
            targetUid: memberDoc.data()?.uid,
        });

        return ok(null);
    } catch (err: any) {
        logger.error("host/team", "DELETE failed", { error: err.message });
        return fail("Failed to process team request");
    }
}
