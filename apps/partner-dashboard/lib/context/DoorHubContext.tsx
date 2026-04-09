"use client";

import { createContext, useContext } from "react";
import type { GuestOpsOverview } from "@/lib/types/guestOps";

// ── Local entry record (created on submit, stored in React state) ──────────────

export interface DoorEntry {
    id: string;
    guestName: string;
    contact: string;
    email?: string;
    gender: "male" | "female";
    age: number;
    type: "walkins" | "dinein";
    totalGuests?: number;   // only for dinein
    eventId?: string;
    eventTitle?: string;
    submittedAt: string;    // ISO timestamp
}

// ── Context ───────────────────────────────────────────────────────────────────

export interface DoorHubContextValue {
    eventId: string;
    venueId: string;
    events: Array<{ id: string; title: string; startDate?: string; status?: string }>;
    summary: GuestOpsOverview | null;
    openExceptions: number;
    isLoading: boolean;
    setEventId: (id: string) => void;
    // Local entry state — populated on submit without waiting for a re-fetch
    walkInEntries: DoorEntry[];
    dineInEntries: DoorEntry[];
    addEntry: (entry: DoorEntry) => void;
}

export const DoorHubContext = createContext<DoorHubContextValue | null>(null);

export function useDoorHub(): DoorHubContextValue | null {
    return useContext(DoorHubContext);
}
