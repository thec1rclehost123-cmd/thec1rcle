"use client";

import { createContext, useContext } from "react";
import type { GuestOpsOverview } from "@/lib/types/guestOps";

export interface DoorHubContextValue {
    eventId: string;
    venueId: string;
    events: Array<{ id: string; title: string; startDate?: string; status?: string }>;
    summary: GuestOpsOverview | null;
    openExceptions: number;
    isLoading: boolean;
    setEventId: (id: string) => void;
}

export const DoorHubContext = createContext<DoorHubContextValue | null>(null);

export function useDoorHub(): DoorHubContextValue | null {
    return useContext(DoorHubContext);
}
