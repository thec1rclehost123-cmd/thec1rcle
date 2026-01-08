/**
 * THE C1RCLE - Table Store
 * Manages club floor plans, table definitions, and event assignments.
 */

import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { randomUUID } from "node:crypto";

const TABLES_COLLECTION = "venue_tables";
const TABLE_BOOKINGS_COLLECTION = "table_bookings";

/**
 * Get all defined tables (floor plan) for a club
 */
export async function getVenueMasterTables(venueId) {
    if (!isFirebaseConfigured()) return [];

    const db = getAdminDb();
    const snapshot = await db.collection(TABLES_COLLECTION)
        .where("venueId", "==", venueId)
        .orderBy("name", "asc")
        .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Create or update a master table in the club's floor plan
 */
export async function saveMasterTable(venueId, tableData) {
    const db = getAdminDb();
    const id = tableData.id || randomUUID();
    const now = new Date().toISOString();

    const table = {
        ...tableData,
        id,
        venueId,
        updatedAt: now,
        createdAt: tableData.createdAt || now
    };

    await db.collection(TABLES_COLLECTION).doc(id).set(table, { merge: true });
    return table;
}

/**
 * Delete a table from the floor plan
 */
export async function deleteMasterTable(tableId) {
    const db = getAdminDb();
    await db.collection(TABLES_COLLECTION).doc(tableId).delete();
    return { success: true };
}

/**
 * Get table assignments and status for a specific event
 */
export async function getEventTableStatus(eventId) {
    const db = getAdminDb();

    // 1. Get the event to see defined packages
    const eventDoc = await db.collection("events").doc(eventId).get();
    if (!eventDoc.exists) return null;
    const event = eventDoc.data();

    // 2. Get all bookings for this event's tables
    const bookingsSnapshot = await db.collection(TABLE_BOOKINGS_COLLECTION)
        .where("eventId", "==", eventId)
        .get();

    const bookings = bookingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return {
        eventTables: event.tables || [],
        bookings
    };
}

/**
 * Manually block or reserve a table for an event (Internal Note)
 */
export async function updateTableStatus(eventId, tableId, status, notes = "", metadata = {}) {
    const db = getAdminDb();
    const now = new Date().toISOString();

    const update = {
        eventId,
        tableId,
        status, // 'reserved', 'blocked', 'available', 'paid'
        notes,
        updatedAt: now,
        ...metadata
    };

    // This would typically update a 'table_assignments' or similar collection
    // to track exactly which physical table is assigned to which guest/booking
    await db.collection("table_assignments").doc(`${eventId}_${tableId}`).set(update, { merge: true });

    return update;
}
