import { getFirebaseAuth } from "./client";

const EMPTY_HOST_STATS = {
    totalRevenue: 0,
    revenueChange: 0,
    activeGuests: 0,
    guestsChange: 0,
    ticketSales: 0,
    salesChange: 0,
    barRevenue: 0,
    barRevenueChange: 0,
    revenueHistory: [],
    popularEvents: [],
    demographics: {
        age: [],
        gender: [],
        geo: []
    }
};

async function getAuthHeaders() {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
}

async function fetchJson(url) {
    const headers = await getAuthHeaders();
    const res = await fetch(url, { headers });
    if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
    }
    return res.json();
}

/**
 * Subscribes to the host's real-time statistics.
 * Assumes a 'host_stats' collection where the document ID is the host's user ID.
 */
export function subscribeToHostStats(hostId, callback) {
    if (!hostId) return () => { };
    let active = true;

    const refresh = async () => {
        try {
            const data = await fetchJson(`/api/partners/hosts/overview?hostId=${encodeURIComponent(hostId)}`);
            if (!active) return;
            callback({
                ...EMPTY_HOST_STATS,
                ...(data || {})
            });
        } catch (error) {
            console.error("Error subscribing to host stats:", error);
            if (active) callback(EMPTY_HOST_STATS);
        }
    };

    refresh().catch(() => {});
    const intervalId = globalThis.setInterval(() => {
        refresh().catch(() => {});
    }, 30_000);

    return () => {
        active = false;
        globalThis.clearInterval(intervalId);
    };
}

/**
 * Fetches the host's recent events.
 */
export async function getHostEvents(hostId) {
    if (!hostId) return [];

    try {
        const payload = await fetchJson(`/api/partners/hosts/events?hostId=${encodeURIComponent(hostId)}&limit=5`);
        return Array.isArray(payload?.events) ? payload.events : [];
    } catch (error) {
        console.error("Error fetching host events:", error);
        return [];
    }
}
