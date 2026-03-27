import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";
import { logger } from "@/lib/server/logger";

const CreateRequestSchema = z.object({
    requesterId: z.string().min(1).max(128),
    requesterType: z.string().max(50).optional(),
    requesterName: z.string().max(200).optional(),
    requesterEmail: z.string().email().max(200).optional(),
    targetId: z.string().min(1).max(128),
    targetType: z.string().min(1).max(50),
    targetName: z.string().max(200).optional(),
    message: z.string().max(1000).optional(),
});

const COLLECTION_MAP: Record<string, string> = { host: "hosts", venue: "venues", promoter: "promoters" };

/**
 * GET /api/discovery
 * Discover partners and check connection status — queries Firestore directly via Admin SDK.
 */
export const GET = withAuth(async (req: NextRequest) => {
    try {
        const { searchParams } = new URL(req.url);
        const action = searchParams.get("action") || "discover";
        const partnerId = searchParams.get("partnerId");
        const role = searchParams.get("role");

        if (!partnerId || !role) return fail("partnerId and role are required", 400);

        if (!isFirebaseConfigured()) {
            if (action === "discover") return ok({ partners: [] });
            if (action === "list") return ok({ connections: [] });
            return ok({ entries: [] });
        }

        const db = getAdminDb();

        switch (action) {
            case "discover": {
                const type = searchParams.get("type") || "host";
                const city = searchParams.get("city");
                const search = searchParams.get("search");
                const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

                const col = COLLECTION_MAP[type] || type;

                // Fetch partner docs + existing connections in parallel via Firestore Admin SDK
                let snapshot = await db.collection(col).where("status", "==", "active").limit(limit * 5).get();
                if (snapshot.empty) snapshot = await db.collection(col).limit(limit * 5).get();

                const [partnershipSnap, promoterConnSnap] = await Promise.all([
                    role === "promoter"
                        ? Promise.resolve({ docs: [] as any[] })
                        : db.collection("partnerships")
                            .where(role === "venue" ? "venueId" : "hostId", "==", partnerId)
                            .get(),
                    role === "promoter"
                        ? db.collection("promoter_connections").where("promoterId", "==", partnerId).get()
                        : db.collection("promoter_connections").where("targetId", "==", partnerId).get(),
                ]);

                // Build connection status lookup keyed by the other party's ID
                const statusMap = new Map<string, { status: string; id: string }>();
                (partnershipSnap as any).docs.forEach((d: any) => {
                    const data = d.data();
                    const otherId = role === "venue" ? data.hostId : data.venueId;
                    if (otherId) statusMap.set(otherId, { status: data.status, id: d.id });
                });
                (promoterConnSnap as any).docs.forEach((d: any) => {
                    const data = d.data();
                    const otherId = role === "promoter" ? data.targetId : data.promoterId;
                    if (otherId) statusMap.set(otherId, { status: data.status, id: d.id });
                });

                let results: any[] = snapshot.docs.map((d: any) => {
                    const r = d.data();
                    return {
                        id: d.id,
                        type,
                        name: r.displayName || r.name || "Unknown",
                        avatar: r.profileImage || r.avatar || null,
                        city: r.city || r.location?.split?.(",")[0]?.trim?.() || "",
                        bio: r.bio || r.summary || r.description || "",
                        tags: r.tags || r.genres || [],
                        eventsCount: r.eventsCount || 0,
                        followersCount: parseInt(r.followers) || r.followersCount || 0,
                        isVerified: !!(r.isVerified || r.isApproved || r.status === "active"),
                        capacity: r.capacity,
                        operatingHours: r.operatingHours,
                        soundSystem: r.soundSystem,
                        musicPolicy: r.musicPolicy,
                        avgCrowdSize: r.avgCrowdSize,
                        audienceDemographic: r.audienceDemographic,
                        noShowRate: r.noShowRate,
                        instagram: r.instagram || r.instagramHandle,
                        phone: r.phone || r.contactPhone,
                    };
                });

                // Exclude self, apply filters, cap at limit
                results = results.filter((r: any) => r.id !== partnerId);
                if (city) results = results.filter((r: any) => r.city.toLowerCase().includes(city.toLowerCase()));
                if (search) {
                    const s = search.toLowerCase();
                    results = results.filter((r: any) =>
                        r.name.toLowerCase().includes(s) || r.bio.toLowerCase().includes(s)
                    );
                }
                results = results.slice(0, limit);

                const partnersWithStatus = results.map((p: any) => {
                    const existing = statusMap.get(p.id);
                    return { ...p, connectionStatus: existing?.status || null, connectionId: existing?.id || null };
                });

                return ok({ partners: partnersWithStatus });
            }

            case "list": {
                const status = searchParams.get("status");

                // Query partnerships and promoter_connections directly via Firestore Admin SDK
                const [partnershipSnap, promoterConnSnap] = await Promise.all([
                    role === "promoter"
                        ? Promise.resolve({ docs: [] as any[] })
                        : db.collection("partnerships")
                            .where(role === "venue" ? "venueId" : "hostId", "==", partnerId)
                            .get(),
                    role === "promoter"
                        ? db.collection("promoter_connections").where("promoterId", "==", partnerId).get()
                        : db.collection("promoter_connections").where("targetId", "==", partnerId).get(),
                ]);

                const normalizedPartnerships = (partnershipSnap as any).docs.map((d: any) => {
                    const p = { id: d.id, ...d.data() };
                    return {
                        ...p,
                        type: "partnership",
                        otherId: role === "venue" ? p.hostId : p.venueId,
                        otherName: role === "venue" ? p.hostName : p.venueName,
                        otherType: role === "venue" ? "host" : "venue",
                    };
                });

                const normalizedPromoterConns = (promoterConnSnap as any).docs.map((d: any) => {
                    const c = { id: d.id, ...d.data() };
                    return {
                        ...c,
                        type: "promoter_connection",
                        otherId: role === "promoter" ? c.targetId : c.promoterId,
                        otherName: role === "promoter" ? c.targetName : c.promoterName,
                        otherType: role === "promoter" ? c.targetType : "promoter",
                    };
                });

                let connections: any[] = [...normalizedPartnerships, ...normalizedPromoterConns];
                if (status) connections = connections.filter((c: any) => c.status === status);
                connections.sort(
                    (a: any, b: any) =>
                        new Date(b.updatedAt || b.createdAt).getTime() -
                        new Date(a.updatedAt || a.createdAt).getTime()
                );

                return ok({ connections });
            }

            case "auditlog": {
                const auditSnap = await db.collection("partnership_audit_log")
                    .where("actorId", "==", partnerId)
                    .orderBy("timestamp", "desc")
                    .limit(100)
                    .get();
                const entries = auditSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
                return ok({ entries });
            }

            default:
                return fail("Invalid action", 400);
        }
    } catch (error: any) {
        logger.error("discovery", "GET failed", { error: error.message });
        return fail("Failed to fetch discovery data");
    }
});

/**
 * POST /api/discovery
 * Create a connection request — writes directly to Firestore via Admin SDK.
 */
export const POST = withAuth(async (req: NextRequest) => {
    try {
        const body = await req.json();
        const parsed = CreateRequestSchema.safeParse(body);
        if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Invalid request body", 400);

        if (!isFirebaseConfigured()) return fail("Firebase is not configured", 503);

        const db = getAdminDb();
        const { requesterId, requesterType, requesterName, requesterEmail, targetId, targetType, targetName, message } = parsed.data as any;
        const now = new Date().toISOString();

        // Host ↔ Venue partnership
        if (
            (requesterType === "host" && targetType === "venue") ||
            (requesterType === "venue" && targetType === "host")
        ) {
            const hostId   = requesterType === "host"  ? requesterId : targetId;
            const venueId  = requesterType === "venue" ? requesterId : targetId;
            const hostName  = requesterType === "host"  ? requesterName : targetName;
            const venueName = requesterType === "venue" ? requesterName : targetName;

            const existing = await db.collection("partnerships")
                .where("hostId", "==", hostId)
                .where("venueId", "==", venueId)
                .where("status", "in", ["pending", "active"])
                .limit(1).get();
            if (!existing.empty) return fail("Partnership already requested or active", 409);

            const id = randomUUID();
            await db.collection("partnerships").doc(id).set({
                id, hostId, venueId, hostName, venueName,
                status: "pending", initiatedBy: requesterType, createdAt: now, updatedAt: now,
            });
            // Notify the TARGET party
            const notifTargetId   = requesterType === "host"  ? venueId  : hostId;
            const notifTargetType = requesterType === "host"  ? "venue"  : "host";
            const notifTitle      = requesterType === "host"
                ? `${requesterName || "A host"} wants to partner`
                : `${requesterName || "A venue"} wants to partner`;
            const notifDesc = `New ${requesterType} partnership request${message ? `: "${message}"` : "."}`;
            const nid = randomUUID();
            await db.collection("notifications").doc(nid).set({
                id: nid,
                targetId: notifTargetId,
                targetType: notifTargetType,
                type: "host_request",
                title: notifTitle,
                description: notifDesc,
                createdAt: now,
                isRead: false,
                actionable: true,
                data: { connectionId: id, requesterId, requesterType, requesterName: requesterName || "" },
            });
            return ok({ id });
        }

        // Promoter connection (either side can initiate)
        const promoterId    = requesterType === "promoter" ? requesterId : targetId;
        const promoterName  = requesterType === "promoter" ? requesterName : (targetName || "");
        const promoterEmail = requesterType === "promoter" ? (requesterEmail || "") : "";
        const connTargetId   = requesterType === "promoter" ? targetId   : requesterId;
        const connTargetType = requesterType === "promoter" ? targetType  : requesterType;
        const connTargetName = requesterType === "promoter" ? (targetName || "") : (requesterName || "");

        const existing = await db.collection("promoter_connections")
            .where("promoterId", "==", promoterId)
            .where("targetId", "==", connTargetId)
            .where("status", "==", "pending")
            .limit(1).get();
        if (!existing.empty) return fail("Request already pending", 409);

        const id = randomUUID();
        await db.collection("promoter_connections").doc(id).set({
            id, promoterId, promoterName, promoterEmail,
            targetId: connTargetId, targetType: connTargetType, targetName: connTargetName,
            message: message || "",
            status: "pending", initiatedBy: requesterType, createdAt: now, updatedAt: now,
        });
        const notifId = randomUUID();
        await db.collection("notifications").doc(notifId).set({
            id: notifId,
            targetId: connTargetId,
            targetType: connTargetType,
            type: "promoter_request",
            title: `${promoterName || "A promoter"} wants to connect`,
            description: `New promoter connection request${message ? `: "${message}"` : "."}`,
            createdAt: now,
            isRead: false,
            actionable: true,
            data: { connectionId: id, requesterId: promoterId, requesterType: "promoter", requesterName: promoterName || "" },
        });
        return ok({ id });
    } catch (error: any) {
        logger.error("discovery", "POST failed", { error: error.message });
        return fail("Failed to create connection request");
    }
});

const ACTION_STATUS: Record<string, string> = {
    approve: "active",
    reject:  "rejected",
    block:   "blocked",
};

/**
 * PATCH /api/discovery
 * Approve / reject / block a connection — writes directly to Firestore via Admin SDK.
 * Expects body: { connectionId, action, type?: "partnership"|"promoter_connection", tier?, reason? }
 */
export const PATCH = withAuth(async (req: NextRequest) => {
    try {
        const body = await req.json();
        const { connectionId, action, tier, reason } = body;
        // type is "partnership" or "promoter_connection" — sent by client, else auto-detected
        const declaredType: string | undefined = body.type;

        if (!connectionId || !action) return fail("connectionId and action are required", 400);

        const newStatus = ACTION_STATUS[action];
        if (!newStatus) return fail(`Invalid action: ${action}`, 400);

        if (!isFirebaseConfigured()) return fail("Firebase is not configured", 503);

        const db = getAdminDb();
        const now = new Date().toISOString();
        const update: Record<string, any> = { status: newStatus, updatedAt: now };
        if (tier)   update.tier = tier;
        if (reason) update.rejectReason = reason;

        // Determine collection — prefer explicit type, else probe Firestore
        let collection: string;
        if (declaredType === "partnership") {
            collection = "partnerships";
        } else if (declaredType === "promoter_connection") {
            collection = "promoter_connections";
        } else {
            // Auto-detect: check partnerships first, fall back to promoter_connections
            const partnershipDoc = await db.collection("partnerships").doc(connectionId).get();
            collection = partnershipDoc.exists ? "partnerships" : "promoter_connections";
        }

        await db.collection(collection).doc(connectionId).update(update);

        return ok({ success: true });
    } catch (error: any) {
        logger.error("discovery", "PATCH failed", { error: error.message });
        return fail("Failed to process connection request");
    }
});
