import { EventData } from "@/store/eventContext";

// API base URL - update for production
const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001/api";

/**
 * Validate an event code and get event data
 */
export async function validateEventCode(code: string): Promise<EventData> {
    try {
        const response = await fetch(`${API_BASE}/scan/auth`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ code }),
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                valid: false,
                code,
                event: {} as any,
                permissions: { canScan: false, canDoorEntry: false },
                tiers: [],
                error: data.error || "Invalid code",
            } as any;
        }

        return {
            valid: true,
            code,
            ...data,
        };
    } catch (error: any) {
        console.error("[validateEventCode] Error:", error);

        // For development/demo, return mock data
        if (__DEV__) {
            return getMockEventData(code);
        }

        throw new Error("Unable to connect to server");
    }
}

/**
 * Mock data for development/demo
 */
function getMockEventData(code: string): EventData {
    return {
        valid: true,
        code,
        event: {
            id: "evt_demo_123",
            title: "Saturday Night Live",
            venue: "Club Paradiso",
            venueId: "venue_demo_456",
            date: new Date().toISOString().split("T")[0],
            startTime: "22:00",
            endTime: "04:00",
            capacity: 500,
        },
        permissions: {
            canScan: true,
            canDoorEntry: true,
        },
        tiers: [
            { id: "tier_stag", name: "Stag Entry", price: 500, entryType: "stag", available: true },
            { id: "tier_couple", name: "Couple Entry", price: 800, entryType: "couple", available: true },
            { id: "tier_vip", name: "VIP Entry", price: 2000, entryType: "vip", available: true },
        ],
        gate: "Main Gate",
        stats: {
            totalEntered: 127,
            prebooked: 89,
            doorEntries: 38,
            doorRevenue: 24500,
        },
    };
}

/**
 * Refresh event stats
 */
export async function refreshEventStats(code: string): Promise<any> {
    try {
        const response = await fetch(`${API_BASE}/scan/stats?code=${code}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("[refreshEventStats] Error:", error);
        return null;
    }
}
