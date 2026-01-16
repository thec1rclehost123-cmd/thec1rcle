import React, { createContext, useContext, useState, ReactNode } from "react";

// Types
export interface EventTier {
    id: string;
    name: string;
    price: number;
    entryType: string;
    available: boolean;
}

export interface EventData {
    valid: boolean;
    code: string;
    event: {
        id: string;
        title: string;
        venue: string;
        venueId: string;
        date: string;
        startTime: string;
        endTime: string;
        capacity: number;
        imageUrl?: string;
    };
    permissions: {
        canScan: boolean;
        canDoorEntry: boolean;
    };
    tiers: EventTier[];
    gate?: string;
    stats?: {
        totalEntered: number;
        prebooked: number;
        doorEntries: number;
        doorRevenue: number;
    };
}

interface EventContextType {
    eventData: EventData | null;
    setEventData: (data: EventData | null) => void;
    clearEvent: () => void;
    isAuthenticated: boolean;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

export function EventProvider({ children }: { children: ReactNode }) {
    const [eventData, setEventData] = useState<EventData | null>(null);

    const clearEvent = () => {
        setEventData(null);
    };

    return (
        <EventContext.Provider
            value={{
                eventData,
                setEventData,
                clearEvent,
                isAuthenticated: !!eventData?.valid,
            }}
        >
            {children}
        </EventContext.Provider>
    );
}

export function useEvent() {
    const context = useContext(EventContext);
    if (context === undefined) {
        throw new Error("useEvent must be used within an EventProvider");
    }
    return context;
}

export default EventContext;
