/**
 * Door Sell — type definitions
 * Used by the Ticket Purchase tab inside the Door Hub.
 */

export type DoorGender = "male" | "female";
export type DoorPurpose = "party" | "dinein";

// ── Capacity ───────────────────────────────────────────────────────────────────

export interface EventCapacity {
    total: number;
    soldCount: number;
    doorWalkInCount: number;
    available: number;
    isSoldOut: boolean;
}

// ── Door Sell ──────────────────────────────────────────────────────────────────

export interface DoorSellPayload {
    eventId: string;
    venueId: string;
    guestName: string;
    partySize: number;
    gender: DoorGender;
    purpose: DoorPurpose;
    idempotencyKey: string;
}

export interface DoorSellResult {
    entryId: string;
    purpose: DoorPurpose;
    remainingCapacity: number | null;
}

// ── Dine-in ────────────────────────────────────────────────────────────────────

export interface DineinEntry {
    id: string;
    eventId: string;
    venueId: string;
    guestName: string;
    partySize: number;
    gender?: DoorGender;
    age?: number;
    addedBy: string;
    addedByName: string;
    addedAt: string; // ISO
}

export interface DineinListResponse {
    entries: DineinEntry[];
    hasMore: boolean;
    nextCursor: string | null;
    totals: {
        count: number;
        partySize: number;
    };
}
