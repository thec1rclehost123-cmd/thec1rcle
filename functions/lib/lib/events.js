"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEvent = void 0;
const firebase_1 = require("./firebase");
const EVENT_COLLECTION = "events";
async function getEvent(identifier) {
    if (!identifier)
        return null;
    const directDoc = await firebase_1.db.collection(EVENT_COLLECTION).doc(identifier).get();
    if (directDoc.exists) {
        return Object.assign({ id: directDoc.id }, directDoc.data());
    }
    const slugSnapshot = await firebase_1.db
        .collection(EVENT_COLLECTION)
        .where("slug", "==", identifier)
        .limit(1)
        .get();
    if (!slugSnapshot.empty) {
        const event = Object.assign({ id: slugSnapshot.docs[0].id }, slugSnapshot.docs[0].data());
        return await aggregateLiveInventory(event);
    }
    return null;
}
exports.getEvent = getEvent;
/**
 * Aggregates sharded inventory stats into the event object's tickets array
 * for read-efficiency and accurate client-side displays.
 */
async function aggregateLiveInventory(event) {
    if (!event.tickets || !Array.isArray(event.tickets))
        return event;
    const tickets = [...event.tickets];
    const shardsRef = firebase_1.db.collection(EVENT_COLLECTION).doc(event.id).collection('ticket_shards');
    const shardsSnap = await shardsRef.get();
    // Sum all stats from shards
    const statsMap = {};
    shardsSnap.forEach(doc => {
        const data = doc.data();
        const tid = data.tierId;
        if (!statsMap[tid])
            statsMap[tid] = { locked: 0, sold: 0 };
        statsMap[tid].locked += data.lockedQuantity || 0;
        statsMap[tid].sold += data.soldQuantity || 0;
    });
    // Update tickets array with live math
    event.tickets = tickets.map(t => {
        const stats = statsMap[t.id] || { locked: 0, sold: 0 };
        const totalCapacity = Number(t.quantity || 0);
        return Object.assign(Object.assign({}, t), { lockedQuantity: stats.locked, soldQuantity: stats.sold, remaining: Math.max(0, totalCapacity - stats.sold) // 'remaining' for display is capacity - sold
         });
    });
    return event;
}
//# sourceMappingURL=events.js.map