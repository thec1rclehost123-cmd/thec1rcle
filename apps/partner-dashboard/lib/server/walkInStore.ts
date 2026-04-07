/**
 * Walk-in Entry Store
 * Venue Dashboard v2 — Feature 4
 *
 * Collection: walk_in_entries/{eventId}/logs/{logId}
 *
 * Idempotency: each entry carries a client-generated idempotencyKey.
 * On write, we query for existing key first; if found, return the existing doc.
 *
 * PII: phoneFull is stored in a separate field. Server applies masking
 * based on caller role before returning list/search results.
 */

import { randomUUID } from "node:crypto";
import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import type {
    WalkInEntry,
    WalkInCreatePayload,
    WalkInSearchParams,
    WalkInListResponse,
} from "../types/walkIns";

const _entries = new Map<string, WalkInEntry>();

function logsRef(eventId: string) {
    return getAdminDb()
        .collection("walk_in_entries")
        .doc(eventId)
        .collection("logs");
}

function maskEntry(entry: WalkInEntry, showPhone: boolean): WalkInEntry {
    if (showPhone) return entry;
    const { phoneFull, ...rest } = entry;
    return {
        ...rest,
        // Keep last-4 visible as a display stub
        phoneHash: entry.phoneHash ? `****${entry.phoneHash.slice(-4)}` : "",
    };
}

// ── Create ─────────────────────────────────────────────────────────────────────

export async function createWalkIn(
    eventId: string,
    venueId: string,
    payload: WalkInCreatePayload,
    actor: { uid: string; name: string },
    piiShowPhone: boolean
): Promise<WalkInEntry> {
    // Idempotency check
    const existing = await getByIdempotencyKey(eventId, payload.idempotencyKey);
    if (existing) return maskEntry(existing, piiShowPhone);

    const id = randomUUID();
    const now = new Date().toISOString();
    const phone = payload.phone ?? "";
    const phoneHash = phone ? phone.replace(/\s/g, "").slice(-4) : "";

    const entry: WalkInEntry = {
        id,
        eventId,
        venueId,
        guestName: payload.guestName.trim(),
        phoneHash,
        phoneFull: phone || undefined,
        partySize: Math.max(1, payload.partySize),
        category: payload.category,
        paymentMode: payload.paymentMode,
        amountPaise: Math.round((payload.amount ?? 0) * 100),
        status: "active",
        addedBy: actor.uid,
        addedByName: actor.name,
        addedAt: now,
        lastEditedBy: null,
        updatedAt: now,
        note: payload.note ?? "",
        idempotencyKey: payload.idempotencyKey,
        source: "manual",
        ...(payload.gender ? { gender: payload.gender } : {}),
        ...(payload.purpose ? { purpose: payload.purpose } : {}),
    };

    if (!isFirebaseConfigured()) {
        _entries.set(id, entry);
        return maskEntry(entry, piiShowPhone);
    }

    await logsRef(eventId).doc(id).set(entry);
    return maskEntry(entry, piiShowPhone);
}

// ── Read / List ────────────────────────────────────────────────────────────────

export async function listWalkIns(
    params: WalkInSearchParams,
    piiShowPhone: boolean
): Promise<WalkInListResponse> {
    const limit = params.limit ?? 50;

    if (!isFirebaseConfigured()) {
        let entries = Array.from(_entries.values());

        if (params.eventId) {
            entries = entries.filter((e) => e.eventId === params.eventId);
        }
        if (params.q) {
            const q = params.q.toLowerCase();
            entries = entries.filter(
                (e) =>
                    e.guestName.toLowerCase().includes(q) ||
                    e.addedByName.toLowerCase().includes(q) ||
                    e.note.toLowerCase().includes(q)
            );
        }
        if (params.category) {
            entries = entries.filter((e) => e.category === params.category);
        }
        if (params.paymentMode) {
            entries = entries.filter((e) => e.paymentMode === params.paymentMode);
        }
        entries = entries.filter((e) => e.status === "active");

        const page = entries
            .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
            .slice(0, limit);

        const totals = {
            count: page.length,
            totalPaise: page.reduce((s, e) => s + e.amountPaise, 0),
            partySize: page.reduce((s, e) => s + e.partySize, 0),
        };

        return {
            entries: page.map((e) => maskEntry(e, piiShowPhone)),
            hasMore: false,
            nextCursor: null,
            totals,
        };
    }

    const db = getAdminDb();
    let q: FirebaseFirestore.Query = logsRef(params.eventId ?? "_no_event")
        .where("status", "==", "active")
        .orderBy("addedAt", "desc");

    if (!params.eventId) {
        // Cross-event query — need collection group
        // Fall through to collection group below
    }

    if (params.fromDate) {
        q = q.where("addedAt", ">=", params.fromDate);
    }
    if (params.toDate) {
        q = q.where("addedAt", "<=", params.toDate + "T23:59:59Z");
    }
    if (params.category) {
        q = q.where("category", "==", params.category);
    }
    if (params.paymentMode) {
        q = q.where("paymentMode", "==", params.paymentMode);
    }
    if (params.cursor) {
        const cursorDoc = await logsRef(params.eventId ?? "_no_event").doc(params.cursor).get();
        if (cursorDoc.exists) {
            q = q.startAfter(cursorDoc);
        }
    }

    const snap = await q.limit(limit + 1).get();
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as WalkInEntry));

    // Text search (Firestore doesn't support FTS natively — filter client-side for now)
    let filtered = all;
    if (params.q) {
        const ql = params.q.toLowerCase();
        filtered = all.filter(
            (e) =>
                e.guestName.toLowerCase().includes(ql) ||
                e.note.toLowerCase().includes(ql) ||
                e.addedByName.toLowerCase().includes(ql) ||
                (piiShowPhone && e.phoneFull?.includes(ql))
        );
    }

    const hasMore = filtered.length > limit;
    const page = filtered.slice(0, limit);
    const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].id : null;

    const totals = {
        count: page.length,
        totalPaise: page.reduce((s, e) => s + e.amountPaise, 0),
        partySize: page.reduce((s, e) => s + e.partySize, 0),
    };

    return {
        entries: page.map((e) => maskEntry(e, piiShowPhone)),
        hasMore,
        nextCursor,
        totals,
    };
}

// ── Update ─────────────────────────────────────────────────────────────────────

export async function updateWalkIn(
    eventId: string,
    logId: string,
    updates: Partial<Pick<WalkInEntry, "guestName" | "partySize" | "category" | "paymentMode" | "amountPaise" | "note">>,
    actor: { uid: string },
    piiShowPhone: boolean
): Promise<WalkInEntry> {
    const now = new Date().toISOString();

    if (!isFirebaseConfigured()) {
        const e = _entries.get(logId);
        if (!e) throw new Error("Entry not found");
        const merged = { ...e, ...updates, lastEditedBy: actor.uid, updatedAt: now };
        _entries.set(logId, merged);
        return maskEntry(merged, piiShowPhone);
    }

    await logsRef(eventId).doc(logId).update({
        ...updates,
        lastEditedBy: actor.uid,
        updatedAt: now,
    });

    const doc = await logsRef(eventId).doc(logId).get();
    return maskEntry({ id: doc.id, ...doc.data() } as WalkInEntry, piiShowPhone);
}

// ── Void ──────────────────────────────────────────────────────────────────────

export async function voidWalkIn(
    eventId: string,
    logId: string,
    actor: { uid: string }
): Promise<void> {
    const now = new Date().toISOString();

    if (!isFirebaseConfigured()) {
        const e = _entries.get(logId);
        if (e) _entries.set(logId, { ...e, status: "void", lastEditedBy: actor.uid, updatedAt: now });
        return;
    }

    await logsRef(eventId).doc(logId).update({
        status: "void",
        lastEditedBy: actor.uid,
        updatedAt: now,
    });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function getByIdempotencyKey(
    eventId: string,
    key: string
): Promise<WalkInEntry | null> {
    if (!isFirebaseConfigured()) {
        for (const e of Array.from(_entries.values())) {
            if (e.eventId === eventId && e.idempotencyKey === key) return e;
        }
        return null;
    }

    const snap = await logsRef(eventId)
        .where("idempotencyKey", "==", key)
        .limit(1)
        .get();

    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as WalkInEntry;
}

export async function getWalkInEventSummary(eventId: string): Promise<{
    totalEntries: number;
    totalPaise: number;
    totalPartySize: number;
    byPaymentMode: Record<string, number>;
}> {
    if (!isFirebaseConfigured()) {
        return { totalEntries: 0, totalPaise: 0, totalPartySize: 0, byPaymentMode: {} };
    }

    const snap = await logsRef(eventId)
        .where("status", "==", "active")
        .get();

    const entries = snap.docs.map((d) => d.data() as WalkInEntry);

    const byPaymentMode: Record<string, number> = {};
    for (const e of entries) {
        byPaymentMode[e.paymentMode] = (byPaymentMode[e.paymentMode] ?? 0) + e.amountPaise;
    }

    return {
        totalEntries: entries.length,
        totalPaise: entries.reduce((s, e) => s + e.amountPaise, 0),
        totalPartySize: entries.reduce((s, e) => s + e.partySize, 0),
        byPaymentMode,
    };
}
