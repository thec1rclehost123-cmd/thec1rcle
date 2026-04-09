/**
 * GET /api/venue/door/all-entries?eventId=
 *
 * Returns all walk-in and dine-in entries for a venue across all events.
 * Used by the Marketing / Attendees page to build a unified attendee list.
 *
 * - walk_in_entries/{eventId}/logs  (source: "walkins")
 * - dinein_entries/{eventId}/logs   (source: "dinein")
 * - dinein_entries/venue_{venueId}/logs (venue-scoped dine-ins)
 *
 * Optional ?eventId= to filter to a single event.
 */

import { NextRequest } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { ok, fail } from "@/lib/server/apiResponse";
import { logger } from "@/lib/server/logger";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";

export type DoorEntryRecord = {
    id: string;
    guestName: string;
    contact: string;
    gender: string | null;
    eventId: string;
    eventTitle: string | null;
    source: "walkins" | "dinein";
    addedAt: string;
    partySize: number;
};

export async function GET(request: NextRequest) {
    try {
        const ctx = await requireVenueAccess(request, "walkins:read");
        if ("error" in ctx) return fail(ctx.error, ctx.status);

        const { searchParams } = new URL(request.url);
        const venueId = ctx.venueId;
        const filterEventId = searchParams.get("eventId") ?? undefined;
        const limit = Math.min(Number(searchParams.get("limit") ?? "300"), 500);

        if (!isFirebaseConfigured()) {
            return ok({ entries: [] as DoorEntryRecord[], total: 0 });
        }

        const db = getAdminDb();

        // ── Resolve event IDs ────────────────────────────────────────────────
        let eventIds: string[] = [];
        const eventTitleMap = new Map<string, string>();

        if (filterEventId) {
            eventIds = [filterEventId];
        } else {
            // Fetch up to 20 events for this venue (all-time)
            const eventsSnap = await db.collection("events")
                .where("venueId", "==", venueId)
                .limit(20)
                .get();
            for (const doc of eventsSnap.docs) {
                const data = doc.data();
                eventTitleMap.set(doc.id, data.title ?? data.name ?? "");
                eventIds.push(doc.id);
            }
        }

        // ── Parallel fetch walk-ins + dine-ins + venue-level dine-ins ────────
        const [wiSnaps, diSnaps, venueDiSnap] = await Promise.all([
            Promise.all(
                eventIds.map((eid) =>
                    db.collection("walk_in_entries").doc(eid).collection("logs")
                        .where("status", "==", "active")
                        .orderBy("addedAt", "desc")
                        .limit(limit)
                        .get()
                )
            ),
            Promise.all(
                eventIds.map((eid) =>
                    db.collection("dinein_entries").doc(eid).collection("logs")
                        .orderBy("addedAt", "desc")
                        .limit(limit)
                        .get()
                )
            ),
            // Venue-scoped dine-ins (no specific event) — skip when filtered by event
            filterEventId
                ? Promise.resolve(null)
                : db.collection("dinein_entries")
                    .doc(`venue_${venueId}`)
                    .collection("logs")
                    .orderBy("addedAt", "desc")
                    .limit(limit)
                    .get(),
        ]);

        const piiShowPhone = ctx.piiPolicy.showPhone;

        // ── Map walk-ins ──────────────────────────────────────────────────────
        const walkIns: DoorEntryRecord[] = wiSnaps.flatMap((snap, idx) =>
            snap.docs.map((d) => {
                const data = d.data() as any;
                const contact = piiShowPhone
                    ? (data.phoneFull ?? data.phoneHash ?? "")
                    : data.phoneHash
                        ? `****${String(data.phoneHash).slice(-4)}`
                        : "";
                return {
                    id: d.id,
                    guestName: data.guestName ?? "",
                    contact,
                    gender: data.gender ?? null,
                    eventId: eventIds[idx],
                    eventTitle: eventTitleMap.get(eventIds[idx]) ?? null,
                    source: "walkins" as const,
                    addedAt: data.addedAt ?? "",
                    partySize: data.partySize ?? 1,
                };
            })
        );

        // ── Map event dine-ins ────────────────────────────────────────────────
        const eventDineIns: DoorEntryRecord[] = diSnaps.flatMap((snap, idx) =>
            snap.docs.map((d) => {
                const data = d.data() as any;
                return {
                    id: d.id,
                    guestName: data.guestName ?? "",
                    contact: "",
                    gender: null,
                    eventId: eventIds[idx],
                    eventTitle: eventTitleMap.get(eventIds[idx]) ?? null,
                    source: "dinein" as const,
                    addedAt: data.addedAt ?? "",
                    partySize: data.partySize ?? 1,
                };
            })
        );

        // ── Map venue-level dine-ins ──────────────────────────────────────────
        const venueDineIns: DoorEntryRecord[] = venueDiSnap
            ? venueDiSnap.docs.map((d) => {
                const data = d.data() as any;
                return {
                    id: d.id,
                    guestName: data.guestName ?? "",
                    contact: "",
                    gender: null,
                    eventId: `venue_${venueId}`,
                    eventTitle: null,
                    source: "dinein" as const,
                    addedAt: data.addedAt ?? "",
                    partySize: data.partySize ?? 1,
                };
            })
            : [];

        const entries = [...walkIns, ...eventDineIns, ...venueDineIns]
            .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
            .slice(0, limit);

        return ok({ entries, total: entries.length });
    } catch (err: any) {
        logger.error("venue/door/all-entries", "Failed to fetch door entries", { error: err.message });
        return fail("Failed to fetch door entries");
    }
}
