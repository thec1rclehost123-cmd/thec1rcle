/**
 * THE C1RCLE - Table Engine
 * Manages physical venue floor plans and table assignments.
 */

import { randomUUID } from 'node:crypto';
import { getAdminDb } from './admin.js';

const TABLES_COLLECTION = 'venue_tables';
const ASSIGNMENTS_COLLECTION = 'table_assignments';

/**
 * Gets the master floor plan for a venue
 */
export async function getFloorPlan(venueId) {
  const db = getAdminDb();
  const snapshot = await db
    .collection(TABLES_COLLECTION)
    .where('venueId', '==', venueId)
    .orderBy('name', 'asc')
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Updates a table in the floor plan
 */
export async function updateMasterTable(venueId, tableData) {
  const db = getAdminDb();
  const id = tableData.id || randomUUID();
  const now = new Date().toISOString();

  const table = {
    ...tableData,
    id,
    venueId,
    updatedAt: now,
    createdAt: tableData.createdAt || now,
  };

  await db.collection(TABLES_COLLECTION).doc(id).set(table, { merge: true });
  return table;
}

/**
 * Assigns a specific physical table to a booking/order for an event
 */
export async function assignTable(eventId, tableId, bookingId, status = 'assigned') {
  const db = getAdminDb();
  const now = new Date().toISOString();

  const assignment = {
    eventId,
    tableId,
    bookingId,
    status, // 'assigned', 'occupied', 'released'
    updatedAt: now,
  };

  const docId = `${eventId}_${tableId}`;
  await db.collection(ASSIGNMENTS_COLLECTION).doc(docId).set(assignment, { merge: true });

  return assignment;
}

/**
 * Gets currently assigned tables for an event
 */
export async function getEventAssignments(eventId) {
  const db = getAdminDb();
  const snapshot = await db
    .collection(ASSIGNMENTS_COLLECTION)
    .where('eventId', '==', eventId)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
