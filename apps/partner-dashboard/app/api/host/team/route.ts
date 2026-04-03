/**
 * GET    /api/host/team?hostId=     — List team members for this host org
 * POST   /api/host/team/invite      — Invite a new co-host or staff member
 * PATCH  /api/host/team/[membershipId] — Change role
 * DELETE /api/host/team/[membershipId] — Revoke access
 *
 * All team mutations require MANAGE_STAFF permission (OWNER only).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireHostAccess, writeAuditLog } from "@/lib/server/hostAuthMiddleware";
import { getAdminDb } from "@/lib/firebase/admin";
import { ok, fail } from "@/lib/server/apiResponse";
import { logger } from "@/lib/server/logger";
import type { HostRole } from "@/lib/rbac/types";

const VALID_HOST_ROLES: HostRole[] = ["OWNER", "COHOST", "MANAGER", "STAFF"];

function pickString(...values: unknown[]): string | null {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    return null;
}

function pickDateString(...values: unknown[]): string | null {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) return value;
        if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
        if (value && typeof value === "object" && "toDate" in (value as any)) {
            try {
                return (value as any).toDate().toISOString();
            } catch {}
        }
    }
    return null;
}

const InviteTeamBody = z.object({
    email: z.string().email().optional(),
    phone: z.string().trim().min(1).optional(),
    role: z.string().min(1, "role is required"),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    partnerName: z.string().optional(),
    granularPermissions: z.unknown().optional(),
}).refine((data) => Boolean(data.email || data.phone), {
    message: "email or phone is required",
});

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

        const uidSet = new Set<string>();
        membershipsSnap.docs.forEach(doc => {
            const uid = doc.data()?.uid;
            if (typeof uid === "string" && uid.trim()) uidSet.add(uid);
        });

        const userDocs = await Promise.all(
            Array.from(uidSet).map(async uid => {
                const userDoc = await db.collection("users").doc(uid).get();
                return [uid, userDoc.exists ? userDoc.data() : null] as const;
            })
        );
        const userMap = new Map(userDocs);

        const members = membershipsSnap.docs.map(doc => {
            const m = doc.data();
            const isActive = m.isActive === true || m.status === "active";
            const userRecord = typeof m.uid === "string" ? userMap.get(m.uid) : null;
            return {
                membershipId: doc.id,
                uid: m.uid,
                displayName: m.displayName || m.email || "Member",
                email: m.email || null,
                phone: m.phone || null,
                role: m.role as HostRole,
                status: m.status || (isActive ? "active" : "suspended"),
                isActive,
                joinedAt: m.joinedAt ? new Date(m.joinedAt).toISOString() : null,
                lastActive: pickDateString(
                    m.lastActive,
                    userRecord?.lastActive,
                    userRecord?.lastActiveAt,
                    userRecord?.lastSeen,
                    userRecord?.lastLoginAt,
                    userRecord?.updatedAt
                ),
                photoUrl: pickString(
                    m.photoUrl,
                    m.photoURL,
                    userRecord?.photoURL,
                    userRecord?.photoUrl,
                    userRecord?.profileImage,
                    userRecord?.avatarUrl,
                    userRecord?.avatar,
                ),
                granularPermissions: m.granularPermissions ?? null,
                verified: m.verified === true,
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
        const parsed = InviteTeamBody.safeParse(body);
        if (!parsed.success) return fail(parsed.error.issues[0].message, 422);

        const { email, phone, role, firstName, lastName, partnerName } = parsed.data;
        const targetRole = (role as HostRole) || "STAFF";
        if (!VALID_HOST_ROLES.includes(targetRole)) {
            return fail("Invalid role", 422);
        }
        // Prevent assigning OWNER through this endpoint (must be done manually)
        if (targetRole === "OWNER") {
            return fail("Cannot assign OWNER role through invite", 403);
        }

        const contactEmail = email?.trim().toLowerCase() || null;
        const contactPhone = phone?.trim() || null;
        const displayName = [firstName, lastName].filter(Boolean).join(" ").trim() || contactEmail || contactPhone || "Member";

        // Look up user by email
        let targetUid: string | null = null;
        let targetName = displayName;
        if (contactEmail) {
            const userSnap = await db.collection("users").where("email", "==", contactEmail).limit(1).get();
            if (!userSnap.empty) {
                targetUid = userSnap.docs[0].id;
                targetName = userSnap.docs[0].data().displayName || contactEmail;
            }
        }
        if (!targetUid && contactPhone) {
            const phoneSnap = await db.collection("users").where("phone", "==", contactPhone).limit(1).get();
            if (!phoneSnap.empty) {
                targetUid = phoneSnap.docs[0].id;
                targetName = phoneSnap.docs[0].data().displayName || contactPhone;
            }
        }

        const existingByUidSnap = targetUid
            ? await db.collection("partner_memberships")
                .where("partnerId", "==", hostId)
                .where("partnerType", "==", "host")
                .where("uid", "==", targetUid)
                .limit(1)
                .get()
            : null;

        const existingByContactSnap = !existingByUidSnap || existingByUidSnap.empty
            ? contactEmail
                ? await db.collection("partner_memberships")
                    .where("partnerId", "==", hostId)
                    .where("partnerType", "==", "host")
                    .where("email", "==", contactEmail)
                    .limit(1)
                    .get()
                : contactPhone
                    ? await db.collection("partner_memberships")
                        .where("partnerId", "==", hostId)
                        .where("partnerType", "==", "host")
                        .where("phone", "==", contactPhone)
                        .limit(1)
                        .get()
                    : null
            : null;

        const existingSnap = existingByUidSnap && !existingByUidSnap.empty
            ? existingByUidSnap
            : existingByContactSnap && !existingByContactSnap.empty
                ? existingByContactSnap
                : null;

        if (existingSnap && (existingSnap.docs[0].data().isActive === true || existingSnap.docs[0].data().status === "active")) {
            return fail("User already has an active membership", 409);
        }

        const membershipData = {
            uid: targetUid,
            partnerId: hostId,
            partnerType: "host",
            partnerName: partnerName || "",
            role: targetRole,
            displayName: targetName,
            email: contactEmail || contactPhone || "",
            phone: contactPhone || null,
            isActive: Boolean(targetUid),
            status: targetUid ? "active" : "invited",
            joinedAt: Date.now(),
            invitedBy: uid,
            granularPermissions: parsed.data.granularPermissions ?? null,
            inviteCode: targetUid ? null : cryptoRandomCode(),
            inviteExpires: targetUid ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        };

        if (existingSnap && !existingSnap.empty) {
            await existingSnap.docs[0].ref.update({
                ...membershipData,
                reactivatedAt: Date.now(),
                updatedAt: Date.now(),
            });
        } else {
            await db.collection("partner_memberships").add(membershipData);
        }

        const inviteRef = await db.collection("invitations").add({
            hostId,
            invitedBy: uid,
            email: contactEmail || contactPhone || "",
            phone: contactPhone || null,
            targetUid: targetUid || null,
            role: targetRole,
            partnerType: "host",
            status: targetUid ? "accepted" : "pending",
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

        await writeAuditLog(hostId, uid, "team.invite", {
            email: contactEmail || null,
            phone: contactPhone || null,
            role: targetRole,
            inviteId: inviteRef.id,
        });

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
        const { role, granularPermissions } = body;
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

        await memberDoc.ref.update({
            role,
            granularPermissions: granularPermissions ?? null,
            updatedAt: Date.now(),
            updatedBy: uid,
        });

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

function cryptoRandomCode(): string {
    return Math.random().toString(36).slice(2, 10).toUpperCase();
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
