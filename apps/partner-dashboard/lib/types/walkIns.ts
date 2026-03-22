/**
 * Walk-in operations types
 * Venue Dashboard v2 — Feature 4
 */

export type PaymentMode = "cash" | "card" | "upi" | "complimentary" | "other";
export type WalkInStatus = "active" | "void" | "edited";
export type WalkInCategory = "general" | "vip" | "couple" | "group" | "media" | "other";

export interface WalkInEntry {
    id: string;
    eventId: string;
    venueId: string;
    guestName: string;
    /** Guest age — collected by scanner app */
    guestAge?: number | null;
    /** E.164 partial — last 4 digits visible to staff, full to manager/owner */
    phoneHash: string;
    /** Full phone — only returned to OWNER/MANAGER */
    phoneFull?: string;
    partySize: number;
    category: WalkInCategory;
    paymentMode: PaymentMode;
    /** In INR paise (integer) */
    amountPaise: number;
    status: WalkInStatus;
    addedBy: string; // uid
    addedByName: string;
    addedAt: string; // ISO
    lastEditedBy: string | null;
    updatedAt: string; // ISO
    note: string;
    /** Client-generated idempotency key */
    idempotencyKey: string;
    source: "manual" | "import";
}

export interface WalkInCreatePayload {
    guestName: string;
    phone?: string;
    partySize: number;
    category: WalkInCategory;
    paymentMode: PaymentMode;
    /** INR rupees (converted to paise server-side) */
    amount: number;
    note?: string;
    idempotencyKey: string;
}

export interface WalkInSearchParams {
    eventId?: string;
    q?: string;
    fromDate?: string;
    toDate?: string;
    category?: WalkInCategory;
    paymentMode?: PaymentMode;
    cursor?: string;
    limit?: number;
}

export interface WalkInListResponse {
    entries: WalkInEntry[];
    hasMore: boolean;
    nextCursor: string | null;
    totals: {
        count: number;
        totalPaise: number;
        partySize: number;
    };
}

export interface WalkInPrintRow {
    "#": number;
    "Guest": string;
    "Party": number;
    "Category": string;
    "Payment": string;
    "Amount": string;
    "Time": string;
    "Operator": string;
    "Note": string;
}
