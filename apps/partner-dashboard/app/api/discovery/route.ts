import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";
import { logger } from "@/lib/server/logger";
import { getPartnerCardSnapshot } from "@/lib/server/partnerProfiles";

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

function normalizeDiscoveryDoc(d: any, type: string) {
    const r = d.data();
    return {
        id: d.id,
        type,
        name: r.displayName || r.name || "Unknown",
        avatar: r.photoURL || r.profileImage || r.avatar || null,
        photoURL: r.photoURL || r.profileImage || r.avatar || null,
        coverURL: r.coverURL || r.backdropURL || r.coverImage || null,
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
        hostsConnected: r.hostsConnected ?? 0,
        promotersConnected: r.promotersConnected ?? 0,
        ticketsSold: r.ticketsSold ?? 0,
    };
}

function getDiscoverTypes(type: string | null, role: string) {
    if (type && type !== "all") return [type];
    if (role === "promoter") return ["venue", "host"];
    if (role === "venue") return ["host", "promoter"];
    if (role === "host") return ["venue", "promoter"];
    return Object.keys(COLLECTION_MAP);
}

/**
 * GET /api/discovery
 * Discover partners and check connection status.
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
                const type = searchParams.get("type");
                const city = searchParams.get("city");
                const search = searchParams.get("search");
                const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
                const discoverTypes = getDiscoverTypes(type, role);

                const partnerSnapshots = await Promise.all(
                    discoverTypes.map(async (discoverType) => {
                        const col = COLLECTION_MAP[discoverType] || discoverType;
                        let snapshot = await db.collection(col).where("status", "==", "active").limit(250).get();
                        if (snapshot.empty) snapshot = await db.collection(col).limit(250).get();
                        return { discoverType, snapshot };
                    })
                );

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

                let results: any[] = partnerSnapshots.flatMap(({ discoverType, snapshot }) =>
                    snapshot.docs.map((d: any) => normalizeDiscoveryDoc(d, discoverType))
                );

                results = results.filter((r: any) => r.id !== partnerId);
                results = Array.from(new Map(results.map((result: any) => [result.id, result])).values());
                if (city) results = results.filter((r: any) => r.city.toLowerCase().includes(city.toLowerCase()));
                if (search) {
                    const s = search.toLowerCase();
                    results = results.filter((r: any) =>
                        r.name.toLowerCase().includes(s) ||
                        r.bio.toLowerCase().includes(s) ||
                        r.city.toLowerCase().includes(s)
                    );
                }
                results.sort((a: any, b: any) => {
                    if (search) {
                        const s = search.toLowerCase();
                        const aExact = a.name.toLowerCase() === s ? 1 : 0;
                        const bExact = b.name.toLowerCase() === s ? 1 : 0;
                        if (aExact !== bExact) return bExact - aExact;
                    }
                    return String(a.name || "").localeCompare(String(b.name || ""));
                });
                results = results.slice(0, limit);

                const partnersWithStatus = await Promise.all(
                    results.map(async (partner: any) => {
                        const existing = statusMap.get(partner.id);
                        const snapshot = await getPartnerCardSnapshot(partner.id);
                        return {
                            ...partner,
                            avatar: snapshot?.avatar || partner.avatar,
                            city: snapshot?.city || partner.city,
                            eventsCount: snapshot?.eventsCount ?? partner.eventsCount ?? 0,
                            followersCount: snapshot?.followersCount ?? partner.followersCount ?? 0,
                            isVerified: snapshot?.isVerified ?? partner.isVerified,
                            connectionStatus: existing?.status || null,
                            connectionId: existing?.id || null,
                        };
                    })
                );

                return ok({ partners: partnersWithStatus });
            }

            case "list": {
                const status = searchParams.get("status");
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
                connections.sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());

                const connectionsEnriched = await Promise.all(
                    connections.map(async (connection) => {
                        const snapshot = await getPartnerCardSnapshot(connection.otherId);
                        return {
                            ...connection,
                            otherAvatar: snapshot?.avatar || null,
                            photoURL: snapshot?.avatar || null,
                            otherIsVerified: snapshot?.isVerified || false,
                            otherEventsCount: snapshot?.eventsCount || 0,
                            otherFollowersCount: snapshot?.followersCount || 0,
                            otherCity: snapshot?.city || "",
                            city: snapshot?.city || "",
                        };
                    })
                );

                return ok({ connections: connectionsEnriched });
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

export const POST = withAuth(async (req: NextRequest) => {
    try {
        const body = await req.json();
        const parsed = CreateRequestSchema.safeParse(body);
        if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Invalid request body", 400);
        if (!isFirebaseConfigured()) return fail("Firebase is not configured", 503);

        const db = getAdminDb();
        const { requesterId, requesterType, requesterName, targetId, targetType, targetName, message } = parsed.data as any;
        const now = new Date().toISOString();

        if ((requesterType === "host" && targetType === "venue") || (requesterType === "venue" && targetType === "host")) {
            const hostId = requesterType === "host" ? requesterId : targetId;
            const venueId = requesterType === "venue" ? requesterId : targetId;
            const hostName = requesterType === "host" ? requesterName : targetName;
            const venueName = requesterType === "venue" ? requesterName : targetName;

            const existing = await db.collection("partnerships").where("hostId", "==", hostId).where("venueId", "==", venueId).where("status", "in", ["pending", "active"]).limit(1).get();
            if (!existing.empty) return fail("Partnership already requested or active", 409);

            const id = randomUUID();
            await db.collection("partnerships").doc(id).set({ id, hostId, venueId, hostName, venueName, status: "pending", initiatedBy: requesterType, createdAt: now, updatedAt: now });
            
            const notifTargetId = requesterType === "host" ? venueId : hostId;
            const notifTargetType = requesterType === "host" ? "venue" : "host";
            const nid = randomUUID();
            await db.collection("notifications").doc(nid).set({
                id: nid, targetId: notifTargetId, targetType: notifTargetType, type: "host_request",
                title: `${requesterName || "A " + requesterType} wants to partner`,
                description: `New ${requesterType} partnership request${message ? `: "${message}"` : "."}`,
                createdAt: now, isRead: false, actionable: true,
                data: { connectionId: id, requesterId, requesterType, requesterName: requesterName || "" },
            });
            return ok({ id });
        }

        const promoterId = requesterType === "promoter" ? requesterId : targetId;
        const promoterName = requesterType === "promoter" ? requesterName : (targetName || "");
        const connTargetId = requesterType === "promoter" ? targetId : requesterId;
        const connTargetType = requesterType === "promoter" ? targetType : requesterType;
        const connTargetName = requesterType === "promoter" ? (targetName || "") : (requesterName || "");

        const existing = await db.collection("promoter_connections").where("promoterId", "==", promoterId).where("targetId", "==", connTargetId).where("status", "==", "pending").limit(1).get();
        if (!existing.empty) return fail("Request already pending", 409);

        const id = randomUUID();
        await db.collection("promoter_connections").doc(id).set({
            id, promoterId, promoterName, targetId: connTargetId, targetType: connTargetType, targetName: connTargetName,
            message: message || "", status: "pending", initiatedBy: requesterType, createdAt: now, updatedAt: now,
        });

        const notifId = randomUUID();
        await db.collection("notifications").doc(notifId).set({
            id: notifId, targetId: connTargetId, targetType: connTargetType, type: "promoter_request",
            title: `${promoterName || "A promoter"} wants to connect`,
            description: `New promoter connection request${message ? `: "${message}"` : "."}`,
            createdAt: now, isRead: false, actionable: true,
            data: { connectionId: id, requesterId: promoterId, requesterType: "promoter", requesterName: promoterName || "" },
        });
        return ok({ id });
    } catch (error: any) {
        logger.error("discovery", "POST failed", { error: error.message });
        return fail("Failed to create connection request");
    }
});

const ACTION_STATUS: Record<string, string> = { approve: "active", reject: "rejected", block: "blocked", remove: "removed" };

export const PATCH = withAuth(async (req: NextRequest) => {
    try {
        const body = await req.json();
        const { connectionId, action, reason } = body;
        const declaredType: string | undefined = body.type;

        if (!connectionId || !action) return fail("connectionId and action are required", 400);

        const newStatus = ACTION_STATUS[action];
        if (!newStatus) return fail(`Invalid action: ${action}`, 400);

        const db = getAdminDb();
        const now = new Date().toISOString();
        const update: Record<string, any> = { status: newStatus, updatedAt: now };
        if (reason) update.rejectReason = reason;

        let collection: string;
        if (declaredType === "partnership") {
            collection = "partnerships";
        } else if (declaredType === "promoter_connection") {
            collection = "promoter_connections";
        } else {
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
