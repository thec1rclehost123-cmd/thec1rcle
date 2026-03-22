const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001/api";

export interface WalkInRequest {
    eventCode: string;
    eventId: string;
    venueId: string;
    guestName: string;
    guestAge?: number;
    guestPhone?: string;
    gate?: string;
}

export interface WalkInEntry {
    id: string;
    guestName: string;
    guestAge?: number | null;
    phoneHash?: string;
    gate?: string | null;
    addedAt: string;
}

export interface WalkInResponse {
    success: boolean;
    walkInId?: string;
    error?: string;
}

/**
 * Log a walk-in guest (no ticket, tracked entry only).
 */
export async function createWalkIn(request: WalkInRequest): Promise<WalkInResponse> {
    try {
        const response = await fetch(`${API_BASE}/scan/walk-in`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request),
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error || "Failed to log walk-in" };
        }

        return { success: true, walkInId: data.walkInId };
    } catch (error: any) {
        console.error("[createWalkIn] Error:", error);

        if (__DEV__) {
            return { success: true, walkInId: `wi_dev_${Date.now()}` };
        }

        throw new Error("Unable to connect to server");
    }
}

/**
 * Fetch recent walk-ins for the event (for pull-to-refresh list).
 */
export async function fetchWalkIns(
    eventId: string,
    eventCode: string
): Promise<WalkInEntry[]> {
    try {
        const response = await fetch(
            `${API_BASE}/scan/walk-in?eventId=${eventId}&eventCode=${eventCode}&limit=50`
        );
        if (!response.ok) return [];
        const data = await response.json();
        return data.walkIns || [];
    } catch (error) {
        console.error("[fetchWalkIns] Error:", error);

        if (__DEV__) {
            return getMockWalkIns();
        }

        return [];
    }
}

function getMockWalkIns(): WalkInEntry[] {
    return [
        { id: "wi_1", guestName: "Rahul Sharma", guestAge: 24, phoneHash: "8901", addedAt: new Date(Date.now() - 300000).toISOString() },
        { id: "wi_2", guestName: "Priya Mehta", guestAge: 22, phoneHash: "4532", addedAt: new Date(Date.now() - 600000).toISOString() },
        { id: "wi_3", guestName: "Arjun Kapoor", guestAge: 27, addedAt: new Date(Date.now() - 900000).toISOString() },
    ];
}
