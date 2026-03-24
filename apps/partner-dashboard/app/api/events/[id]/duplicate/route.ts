/**
 * POST /api/events/[id]/duplicate?venueId=
 *
 * Duplicates an event into a new DRAFT.
 *
 * Fields that COPY: title, description, venueId, hostId, coverImage,
 *   ticketTiers (structure only), capacity, agePolicy, dressCode, category,
 *   tags, rules, facilities.
 *
 * Fields that RESET: status → DRAFT, dates → null, analytics,
 *   scanLogs, guestList, revenue, checkInCount, publishedAt.
 *
 * Fields NOT copied: id, createdAt, updatedAt, publishedAt, checkInCount,
 *   totalRevenue, status, startDate, endDate, startTime, soldTickets.
 *
 * Idempotency: caller provides idempotencyKey. Duplicate checks
 *   events collection for existing doc with same key.
 */

import { NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";
import { randomUUID } from "node:crypto";

// Fields safe to copy verbatim
const COPY_FIELDS = [
    "title",
    "description",
    "venueId",
    "hostId",
    "category",
    "tags",
    "coverImage",
    "posterImage",
    "gallery",
    "agePolicy",
    "dressCode",
    "rules",
    "maxCapacity",
    "facilities",
    "musicGenre",
    "artistLineup",
    "ticketTiers",       // structure only — soldCount, revenue reset below
    "promoCodeEnabled",
    "guestlistEnabled",
    "tableBookingEnabled",
    "customFields",
] as const;

// Fields within ticketTiers that must be reset
const RESET_TIER_FIELDS = ["soldCount", "revenue", "isSoldOut"];

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const ctx = await requireVenueAccess(request, "events:duplicate");
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const body = await request.json().catch(() => ({}));

        const idempotencyKey: string = body.idempotencyKey ?? randomUUID();
        const sourceId = id;

        if (!isFirebaseConfigured()) {
            return NextResponse.json({
                draft: {
                    id: `draft-${randomUUID()}`,
                    status: "DRAFT",
                    title: "Duplicated Event (Demo)",
                    sourceEventId: sourceId,
                    createdAt: new Date().toISOString(),
                },
            }, { status: 201 });
        }

        const db = getAdminDb();

        // Idempotency check
        const existingSnap = await db
            .collection("events")
            .where("duplicateIdempotencyKey", "==", idempotencyKey)
            .limit(1)
            .get();

        if (!existingSnap.empty) {
            const existing = { id: existingSnap.docs[0].id, ...existingSnap.docs[0].data() };
            return NextResponse.json({ draft: existing, idempotent: true });
        }

        // Load source event
        const sourceDoc = await db.collection("events").doc(sourceId).get();
        if (!sourceDoc.exists) {
            return NextResponse.json({ error: "Source event not found" }, { status: 404 });
        }

        const source = sourceDoc.data()!;

        // Verify caller has access to this event's venue
        if (source.venueId !== ctx.venueId) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        // Build new draft
        const newId = randomUUID();
        const now = new Date().toISOString();

        const draft: Record<string, unknown> = {
            id: newId,
            status: "DRAFT",
            sourceEventId: sourceId,
            duplicateIdempotencyKey: idempotencyKey,
            createdBy: ctx.uid,
            createdAt: now,
            updatedAt: now,
            // Reset fields
            startDate: null,
            endDate: null,
            startTime: null,
            endTime: null,
            publishedAt: null,
            checkInCount: 0,
            totalRevenue: 0,
            soldTickets: 0,
        };

        // Copy safe fields
        for (const field of COPY_FIELDS) {
            if (field in source) {
                draft[field] = source[field];
            }
        }

        // Override title with "(Copy)" suffix
        draft.title = `${String(source.title ?? "Event")} (Copy)`;

        // Reset ticket tier counters
        if (Array.isArray(draft.ticketTiers)) {
            draft.ticketTiers = (draft.ticketTiers as Record<string, unknown>[]).map((tier) => {
                const cleaned = { ...tier };
                for (const rf of RESET_TIER_FIELDS) {
                    delete cleaned[rf];
                    cleaned[rf] = 0;
                }
                cleaned["isSoldOut"] = false;
                return cleaned;
            });
        }

        await db.collection("events").doc(newId).set(draft);

        // Audit log
        await db.collection("audit_logs").add({
            action: "event_duplicated",
            actorUid: ctx.uid,
            sourceEventId: sourceId,
            newEventId: newId,
            venueId: ctx.venueId,
            createdAt: now,
        });

        return NextResponse.json({ draft }, { status: 201 });
    } catch (err: any) {
        console.error("[duplicate POST]", err.message);
        return NextResponse.json({ error: "Failed to duplicate event" }, { status: 500 });
    }
}
