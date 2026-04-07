/**
 * Door Sell Store — server-side
 * Handles dine-in entry creation and listing.
 *
 * Collection: dinein_entries/{eventId}/logs/{logId}
 */

import { randomUUID } from "node:crypto";
import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import type { DineinEntry, DineinListResponse } from "../types/doorSell";

const _dineins = new Map<string, DineinEntry>();

function logsRef(eventId: string) {
    return getAdminDb()
        .collection("dinein_entries")
        .doc(eventId)
        .collection("logs");
}

// ── Create ─────────────────────────────────────────────────────────────────────

export async function createDineinEntry(
    eventId: string,
    venueId: string,
    payload: { guestName: string; partySize: number; idempotencyKey: string },
    actor: { uid: string; name: string }
): Promise<DineinEntry> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const entry: DineinEntry = {
        id,
        eventId,
        venueId,
        guestName: payload.guestName.trim(),
        partySize: Math.max(1, payload.partySize),
        addedBy: actor.uid,
        addedByName: actor.name,
        addedAt: now,
    };

    if (!isFirebaseConfigured()) {
        _dineins.set(id, entry);
        return entry;
    }

    await logsRef(eventId).doc(id).set({
        ...entry,
        idempotencyKey: payload.idempotencyKey,
    });

    return entry;
}

// ── List ───────────────────────────────────────────────────────────────────────

export async function listDineinEntries(
    eventId: string,
    params: { cursor?: string; limit?: number }
): Promise<DineinListResponse> {
    const limit = params.limit ?? 50;

    if (!isFirebaseConfigured()) {
        const all = Array.from(_dineins.values())
            .filter((e) => e.eventId === eventId)
            .sort((a, b) => b.addedAt.localeCompare(a.addedAt));

        const page = all.slice(0, limit);
        return {
            entries: page,
            hasMore: false,
            nextCursor: null,
            totals: {
                count: page.length,
                partySize: page.reduce((s, e) => s + e.partySize, 0),
            },
        };
    }

    let q: FirebaseFirestore.Query = logsRef(eventId).orderBy("addedAt", "desc");

    if (params.cursor) {
        const cursorDoc = await logsRef(eventId).doc(params.cursor).get();
        if (cursorDoc.exists) q = q.startAfter(cursorDoc);
    }

    const snap = await q.limit(limit + 1).get();
    const all = snap.docs.map((d) => ({ ...d.data(), id: d.id } as DineinEntry));

    const hasMore = all.length > limit;
    const page = all.slice(0, limit);
    const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].id : null;

    return {
        entries: page,
        hasMore,
        nextCursor,
        totals: {
            count: page.length,
            partySize: page.reduce((s, e) => s + e.partySize, 0),
        },
    };
}
