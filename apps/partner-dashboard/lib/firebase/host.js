import { doc, onSnapshot, collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { getFirebaseDb } from "./client";

/**
 * Subscribes to the host's real-time statistics.
 * Assumes a 'host_stats' collection where the document ID is the host's user ID.
 */
export function subscribeToHostStats(hostId, callback) {
    const db = getFirebaseDb();
    if (!hostId) return () => { };

    // We listen to a specific document for the host's aggregated stats
    const unsub = onSnapshot(doc(db, "host_stats", hostId), (docSnapshot) => {
        if (docSnapshot.exists()) {
            callback(docSnapshot.data());
        } else {
            // Return default/empty stats if no document exists yet
            callback({
                totalRevenue: 0,
                revenueChange: 0,
                activeGuests: 0,
                guestsChange: 0,
                ticketSales: 0,
                salesChange: 0,
                barRevenue: 0,
                barRevenueChange: 0,
                revenueHistory: [], // Empty history
                popularEvents: [],
                demographics: {
                    age: [],
                    gender: [],
                    geo: []
                }
            });
        }
    }, (error) => {
        console.error("Error subscribing to host stats:", error);
    });

    return unsub;
}

/**
 * Fetches the host's recent events.
 */
export async function getHostEvents(hostId) {
    const db = getFirebaseDb();
    if (!hostId) return [];

    try {
        const q = query(
            collection(db, "events"),
            where("hostId", "==", hostId),
            orderBy("date", "desc"),
            limit(5)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error("Error fetching host events:", error);
        return [];
    }
}
