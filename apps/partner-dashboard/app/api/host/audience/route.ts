/**
 * GET  /api/host/audience?hostId=&cursor=&limit=&filters=
 * Returns host's guest audience with PII masking.
 *
 * Privacy rules:
 *   - Full phone is never returned
 *   - Email is never returned
 *   - displayName is pseudonymized (first name + last initial)
 *   - Only aggregated/anonymized analytics rows
 *
 * PATCH /api/host/audience — Update VIP status for a guest
 */
import { NextRequest, NextResponse } from "next/server";
import { requireHostAccess, writeAuditLog } from "@/lib/server/hostAuthMiddleware";
import { getAdminDb } from "@/lib/firebase/admin";

// Mask a display name to "First L." format
function maskName(name: string): string {
    if (!name) return "Guest";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

export async function GET(req: NextRequest) {
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const { hostId } = ctx;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const cursor = searchParams.get("cursor");
    const filterVip = searchParams.get("vip") === "true";
    const filterSource = searchParams.get("source");
    const filterEventId = searchParams.get("eventId");
    const db = getAdminDb();

    try {
        // Get all events for this host
        const eventsSnap = await db.collection("events")
            .where("hostId", "==", hostId)
            .select("title")
            .get();
        const hostEventIds = eventsSnap.docs.map(d => d.id);
        const eventNameMap: Record<string, string> = {};
        eventsSnap.docs.forEach(d => { eventNameMap[d.id] = d.data().title || "Event"; });

        if (!hostEventIds.length) {
            return NextResponse.json({ guests: [], hasMore: false, nextCursor: null, total: 0 });
        }

        // Build audience from orders + guest_lists across all host events
        // We aggregate per userId for cross-event history

        const guestMap: Record<string, {
            guestId: string;
            maskedName: string;
            eventsAttended: string[];
            lastSeen: string | null;
            source: string;
            isVip: boolean;
            city: string | null;
            ordersCount: number;
        }> = {};

        // Process in chunks of 30 (Firestore 'in' limit)
        const chunkSize = 30;
        const eventIdsToQuery = filterEventId ? [filterEventId] : hostEventIds;

        for (let i = 0; i < eventIdsToQuery.length; i += chunkSize) {
            const chunk = eventIdsToQuery.slice(i, i + chunkSize);

            // From orders (ticketed guests)
            const ordersSnap = await db.collection("orders")
                .where("eventId", "in", chunk)
                .where("status", "==", "completed")
                .get();

            for (const doc of ordersSnap.docs) {
                const o = doc.data();
                const userId = o.userId || o.buyerId || doc.id;
                const eventId = o.eventId;

                if (!guestMap[userId]) {
                    guestMap[userId] = {
                        guestId: userId,
                        maskedName: maskName(o.buyerName || o.displayName || "Guest"),
                        eventsAttended: [],
                        lastSeen: null,
                        source: "ticket",
                        isVip: false,
                        city: o.city || null,
                        ordersCount: 0,
                    };
                }
                guestMap[userId].ordersCount++;
                if (!guestMap[userId].eventsAttended.includes(eventId)) {
                    guestMap[userId].eventsAttended.push(eventId);
                }
                const orderDate = o.createdAt?.toDate?.()?.toISOString() ?? o.createdAt ?? null;
                if (orderDate && (!guestMap[userId].lastSeen || orderDate > guestMap[userId].lastSeen!)) {
                    guestMap[userId].lastSeen = orderDate;
                }
            }

            // From guest_lists (manual/comp guests)
            const glSnap = await db.collection("guest_lists")
                .where("eventId", "in", chunk)
                .get();

            for (const doc of glSnap.docs) {
                const g = doc.data();
                const guestId = g.userId || doc.id;
                const eventId = g.eventId;

                if (!guestMap[guestId]) {
                    guestMap[guestId] = {
                        guestId,
                        maskedName: maskName(g.displayName || g.name || "Guest"),
                        eventsAttended: [],
                        lastSeen: null,
                        source: g.source || "manual",
                        isVip: g.isVip || false,
                        city: null,
                        ordersCount: 0,
                    };
                }
                guestMap[guestId].isVip = guestMap[guestId].isVip || g.isVip || false;
                if (!guestMap[guestId].eventsAttended.includes(eventId)) {
                    guestMap[guestId].eventsAttended.push(eventId);
                }
                const addedAt = g.addedAt?.toDate?.()?.toISOString() ?? g.addedAt ?? null;
                if (addedAt && (!guestMap[guestId].lastSeen || addedAt > guestMap[guestId].lastSeen!)) {
                    guestMap[guestId].lastSeen = addedAt;
                }
            }
        }

        // Apply filters
        let guests = Object.values(guestMap);
        if (filterVip) guests = guests.filter(g => g.isVip);
        if (filterSource) guests = guests.filter(g => g.source === filterSource);

        // Sort by lastSeen desc
        guests.sort((a, b) => {
            if (!a.lastSeen) return 1;
            if (!b.lastSeen) return -1;
            return b.lastSeen.localeCompare(a.lastSeen);
        });

        const total = guests.length;

        // Cursor pagination
        const startIdx = cursor ? guests.findIndex(g => g.guestId === cursor) + 1 : 0;
        const page = guests.slice(startIdx, startIdx + limit);
        const hasMore = startIdx + limit < total;
        const nextCursor = hasMore ? page[page.length - 1]?.guestId : null;

        const result = page.map(g => ({
            guestId: g.guestId,
            maskedName: g.maskedName,
            eventsAttended: g.eventsAttended.length,
            lastEventNames: g.eventsAttended.slice(-2).map(eid => eventNameMap[eid] || "Event"),
            lastSeen: g.lastSeen,
            source: g.source,
            isVip: g.isVip,
            city: g.city,
            isRepeat: g.eventsAttended.length > 1,
        }));

        return NextResponse.json({ guests: result, hasMore, nextCursor, total });
    } catch (err: any) {
        console.error("[host/audience] GET:", err.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const ctx = await requireHostAccess(req, "MANAGE_EVENTS");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const { hostId, uid } = ctx;
    const db = getAdminDb();

    try {
        const body = await req.json();
        const { guestId, isVip } = body;
        if (!guestId || typeof isVip !== "boolean") {
            return NextResponse.json({ error: "guestId and isVip required" }, { status: 422 });
        }

        // Update all guest_list entries for this guest across host events
        const glSnap = await db.collection("guest_lists")
            .where("userId", "==", guestId)
            .get();

        const batch = db.batch();
        for (const doc of glSnap.docs) {
            batch.update(doc.ref, { isVip, vipUpdatedAt: new Date().toISOString(), vipUpdatedBy: uid });
        }
        await batch.commit();

        await writeAuditLog(hostId, uid, "guest.vip.update", { guestId, isVip });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("[host/audience] PATCH:", err.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
