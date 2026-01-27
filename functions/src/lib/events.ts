import { db } from './firebase';

const EVENT_COLLECTION = "events";

export interface Event {
    id: string;
    title: string;
    tickets?: any[];
    [key: string]: any;
}

export async function getEvent(identifier: string): Promise<Event | null> {
    if (!identifier) return null;

    const directDoc = await db.collection(EVENT_COLLECTION).doc(identifier).get();
    if (directDoc.exists) {
        return { id: directDoc.id, ...directDoc.data() } as Event;
    }

    const slugSnapshot = await db
        .collection(EVENT_COLLECTION)
        .where("slug", "==", identifier)
        .limit(1)
        .get();

    if (!slugSnapshot.empty) {
        const event = { id: slugSnapshot.docs[0].id, ...slugSnapshot.docs[0].data() } as Event;
        return await aggregateLiveInventory(event);
    }

    return null;
}

/**
 * Aggregates sharded inventory stats into the event object's tickets array
 * for read-efficiency and accurate client-side displays.
 */
async function aggregateLiveInventory(event: Event): Promise<Event> {
    if (!event.tickets || !Array.isArray(event.tickets)) return event;

    const tickets = [...event.tickets];
    const shardsRef = db.collection(EVENT_COLLECTION).doc(event.id).collection('ticket_shards');
    const shardsSnap = await shardsRef.get();

    // Sum all stats from shards
    const statsMap: Record<string, { locked: number, sold: number }> = {};
    shardsSnap.forEach(doc => {
        const data = doc.data();
        const tid = data.tierId;
        if (!statsMap[tid]) statsMap[tid] = { locked: 0, sold: 0 };
        statsMap[tid].locked += data.lockedQuantity || 0;
        statsMap[tid].sold += data.soldQuantity || 0;
    });

    // Update tickets array with live math
    event.tickets = tickets.map(t => {
        const stats = statsMap[t.id] || { locked: 0, sold: 0 };
        const totalCapacity = Number(t.quantity || 0);
        return {
            ...t,
            lockedQuantity: stats.locked,
            soldQuantity: stats.sold,
            remaining: Math.max(0, totalCapacity - stats.sold) // 'remaining' for display is capacity - sold
        };
    });

    return event;
}
