/**
 * GET  /api/host/promoters?hostId=  — List all promoters in host network
 * POST /api/host/promoters          — Invite a new promoter
 */
import { NextRequest, NextResponse } from "next/server";
import { requireHostAccess, writeAuditLog } from "@/lib/server/hostAuthMiddleware";
import { getAdminDb } from "@/lib/firebase/admin";
import { ok, fail } from "@/lib/server/apiResponse";
import { logger } from "@/lib/server/logger";

export async function GET(req: NextRequest) {
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const { hostId } = ctx;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "all";
    const db = getAdminDb();

    try {
        // Fetch all promoter_connections for this host
        let query: any = db.collection("promoter_connections").where("hostId", "==", hostId);
        if (status !== "all") {
            query = query.where("status", "==", status);
        }
        const connectionsSnap = await query.get();

        const promoterIds = connectionsSnap.docs.map((d: any) => d.data().promoterId);

        if (!promoterIds.length) {
            return ok({ promoters: [] });
        }

        // Aggregate assignment stats per promoter
        const assignmentsSnap = await db.collection("promoter_assignments")
            .where("hostId", "==", hostId)
            .get();

        const statsMap: Record<string, { eventsCount: number; totalSales: number; totalRevenue: number; lastActive: string | null }> = {};
        for (const doc of assignmentsSnap.docs) {
            const a = doc.data();
            const pid = a.promoterId;
            if (!statsMap[pid]) {
                statsMap[pid] = { eventsCount: 0, totalSales: 0, totalRevenue: 0, lastActive: null };
            }
            statsMap[pid].eventsCount++;
            statsMap[pid].totalSales += a.totalSales || 0;
            statsMap[pid].totalRevenue += a.totalRevenue || 0;
            const at = a.assignedAt || "";
            if (!statsMap[pid].lastActive || at > statsMap[pid].lastActive!) {
                statsMap[pid].lastActive = at;
            }
        }

        const promoters = connectionsSnap.docs.map((doc: any) => {
            const conn = doc.data();
            const pid = conn.promoterId;
            const stats = statsMap[pid] || { eventsCount: 0, totalSales: 0, totalRevenue: 0, lastActive: null };
            return {
                connectionId: doc.id,
                promoterId: pid,
                promoterName: conn.promoterName || "Promoter",
                promoterEmail: conn.promoterEmail || null,
                status: conn.status || "active",
                defaultCommissionRate: conn.defaultCommissionRate ?? 10,
                eventsWorked: stats.eventsCount,
                totalSales: stats.totalSales,
                totalRevenue: stats.totalRevenue,
                lastActive: stats.lastActive,
                joinedAt: conn.createdAt || null,
            };
        });

        return ok({ promoters });
    } catch (err: any) {
        logger.error("host/promoters", "GET failed", { error: err.message });
        return fail("Failed to process promoter request");
    }
}

export async function POST(req: NextRequest) {
    const ctx = await requireHostAccess(req, "MANAGE_PROMOTERS");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const { hostId, uid } = ctx;
    const db = getAdminDb();

    try {
        const body = await req.json();
        const { promoterEmail, promoterId, defaultCommissionRate } = body;

        if (!promoterEmail && !promoterId) {
            return fail("promoterEmail or promoterId required", 422);
        }

        let resolvedId = promoterId;
        let resolvedName = body.promoterName || "Promoter";
        let resolvedEmail = promoterEmail;

        // Look up by email if no ID
        if (!resolvedId && promoterEmail) {
            const usersSnap = await db.collection("users")
                .where("email", "==", promoterEmail)
                .limit(1)
                .get();
            if (!usersSnap.empty) {
                const u = usersSnap.docs[0];
                resolvedId = u.id;
                resolvedName = u.data().displayName || promoterEmail;
            } else {
                // Store as pending invitation
                const inviteRef = await db.collection("invitations").add({
                    hostId,
                    invitedBy: uid,
                    email: promoterEmail,
                    role: "PROMOTER",
                    partnerType: "promoter",
                    status: "pending",
                    defaultCommissionRate: defaultCommissionRate ?? 10,
                    createdAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                });
                await writeAuditLog(hostId, uid, "promoter.invite", { email: promoterEmail, inviteId: inviteRef.id });
                return ok({ status: "invited", inviteId: inviteRef.id });
            }
        }

        if (!resolvedId) {
            return fail("Could not resolve promoter", 422);
        }

        // Check if already connected
        const existingSnap = await db.collection("promoter_connections")
            .where("hostId", "==", hostId)
            .where("promoterId", "==", resolvedId)
            .limit(1)
            .get();

        if (!existingSnap.empty) {
            const existing = existingSnap.docs[0];
            if (existing.data().status !== "deactivated") {
                return fail("Promoter already in your network", 409);
            }
            // Reactivate
            await existing.ref.update({ status: "active", reactivatedAt: new Date().toISOString() });
            return ok({ connectionId: existing.id, status: "reactivated" });
        }

        const connRef = await db.collection("promoter_connections").add({
            hostId,
            promoterId: resolvedId,
            promoterName: resolvedName,
            promoterEmail: resolvedEmail || null,
            status: "active",
            defaultCommissionRate: defaultCommissionRate ?? 10,
            addedBy: uid,
            createdAt: new Date().toISOString(),
        });

        await writeAuditLog(hostId, uid, "promoter.invite", { promoterId: resolvedId, promoterName: resolvedName });

        return ok({ connectionId: connRef.id, status: "connected" });
    } catch (err: any) {
        logger.error("host/promoters", "POST failed", { error: err.message });
        return fail("Failed to process promoter request");
    }
}
