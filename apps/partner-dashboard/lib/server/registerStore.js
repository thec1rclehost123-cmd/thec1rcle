/**
 * Club Registers Store
 * Manages operational registers, notes, staff assignments, and incidents for clubs
 */

import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { randomUUID } from "node:crypto";

const REGISTERS_COLLECTION = "club_registers";

// Fallback storage for development
let fallbackRegisters = [];

/**
 * Get or create a register entry for a specific date
 */
export async function getDateRegister(clubId, date) {
    const registerId = `${clubId}_${date}`;

    if (!isFirebaseConfigured()) {
        const existing = fallbackRegisters.find(r => r.id === registerId);
        if (existing) return existing;

        const newRegister = createEmptyRegister(clubId, date, registerId);
        fallbackRegisters.push(newRegister);
        return newRegister;
    }

    const db = getAdminDb();
    const doc = await db.collection(REGISTERS_COLLECTION).doc(registerId).get();

    if (!doc.exists) {
        const newRegister = createEmptyRegister(clubId, date, registerId);
        await db.collection(REGISTERS_COLLECTION).doc(registerId).set(newRegister);
        return newRegister;
    }

    return { id: doc.id, ...doc.data() };
}

/**
 * Create an empty register structure
 */
function createEmptyRegister(clubId, date, id) {
    return {
        id,
        clubId,
        date,
        notes: {
            internal: "", // Private notes for management
            operational: "", // Day-of operations notes
            promotional: "" // Marketing notes
        },
        expectedFootfall: 0,
        actualFootfall: 0,
        staffAssignments: [], // { staffId, name, role, shift, confirmed }
        incidents: [], // { id, type, description, severity, timestamp, reportedBy, resolved }
        inspections: [], // { id, type, passed, notes, inspector, timestamp }
        reminders: [], // { id, text, dueTime, completed, completedBy }
        expenses: [], // { id, category, amount, description, receiptUrl, approvedBy }
        revenue: {
            cover: 0,
            drinks: 0,
            food: 0,
            vip: 0,
            other: 0
        },
        weather: null, // { condition, temperature, impact }
        status: "scheduled", // scheduled, in-progress, completed, cancelled
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

/**
 * Update register notes
 */
export async function updateRegisterNotes(clubId, date, noteType, content, updatedBy) {
    const registerId = `${clubId}_${date}`;
    const now = new Date().toISOString();

    if (!isFirebaseConfigured()) {
        const register = await getDateRegister(clubId, date);
        register.notes[noteType] = content;
        register.updatedAt = now;
        register.lastUpdatedBy = updatedBy;
        return register;
    }

    const db = getAdminDb();
    await db.collection(REGISTERS_COLLECTION).doc(registerId).set({
        [`notes.${noteType}`]: content,
        updatedAt: now,
        lastUpdatedBy: updatedBy
    }, { merge: true });

    return await getDateRegister(clubId, date);
}

/**
 * Update expected footfall
 */
export async function updateExpectedFootfall(clubId, date, count, updatedBy) {
    const registerId = `${clubId}_${date}`;
    const now = new Date().toISOString();

    if (!isFirebaseConfigured()) {
        const register = await getDateRegister(clubId, date);
        register.expectedFootfall = count;
        register.updatedAt = now;
        return register;
    }

    const db = getAdminDb();
    await db.collection(REGISTERS_COLLECTION).doc(registerId).set({
        expectedFootfall: count,
        updatedAt: now,
        lastUpdatedBy: updatedBy
    }, { merge: true });

    return await getDateRegister(clubId, date);
}

/**
 * Add staff assignment
 */
export async function addStaffAssignment(clubId, date, assignment) {
    const registerId = `${clubId}_${date}`;
    const now = new Date().toISOString();

    const staffAssignment = {
        id: randomUUID(),
        staffId: assignment.staffId,
        name: assignment.name,
        role: assignment.role,
        shift: assignment.shift || "evening", // morning, afternoon, evening, night, full
        startTime: assignment.startTime || "20:00",
        endTime: assignment.endTime || "03:00",
        confirmed: false,
        createdAt: now
    };

    if (!isFirebaseConfigured()) {
        const register = await getDateRegister(clubId, date);
        register.staffAssignments.push(staffAssignment);
        register.updatedAt = now;
        return register;
    }

    const db = getAdminDb();
    const { FieldValue } = require("firebase-admin/firestore");

    await db.collection(REGISTERS_COLLECTION).doc(registerId).set({
        staffAssignments: FieldValue.arrayUnion(staffAssignment),
        updatedAt: now
    }, { merge: true });

    return await getDateRegister(clubId, date);
}

/**
 * Remove staff assignment
 */
export async function removeStaffAssignment(clubId, date, assignmentId) {
    const register = await getDateRegister(clubId, date);
    const now = new Date().toISOString();

    const updatedAssignments = register.staffAssignments.filter(a => a.id !== assignmentId);

    if (!isFirebaseConfigured()) {
        register.staffAssignments = updatedAssignments;
        register.updatedAt = now;
        return register;
    }

    const db = getAdminDb();
    const registerId = `${clubId}_${date}`;

    await db.collection(REGISTERS_COLLECTION).doc(registerId).update({
        staffAssignments: updatedAssignments,
        updatedAt: now
    });

    return await getDateRegister(clubId, date);
}

/**
 * Log an incident
 */
export async function logIncident(clubId, date, incident, reportedBy) {
    const registerId = `${clubId}_${date}`;
    const now = new Date().toISOString();

    const incidentRecord = {
        id: randomUUID(),
        type: incident.type, // security, medical, property, complaint, other
        description: incident.description,
        severity: incident.severity || "low", // low, medium, high, critical
        location: incident.location || "",
        involvedParties: incident.involvedParties || [],
        reportedBy: {
            uid: reportedBy.uid,
            name: reportedBy.name || ""
        },
        resolved: false,
        resolution: null,
        timestamp: now
    };

    if (!isFirebaseConfigured()) {
        const register = await getDateRegister(clubId, date);
        register.incidents.push(incidentRecord);
        register.updatedAt = now;
        return { register, incident: incidentRecord };
    }

    const db = getAdminDb();
    const { FieldValue } = require("firebase-admin/firestore");

    await db.collection(REGISTERS_COLLECTION).doc(registerId).set({
        incidents: FieldValue.arrayUnion(incidentRecord),
        updatedAt: now
    }, { merge: true });

    return { register: await getDateRegister(clubId, date), incident: incidentRecord };
}

/**
 * Resolve an incident
 */
export async function resolveIncident(clubId, date, incidentId, resolution, resolvedBy) {
    const register = await getDateRegister(clubId, date);
    const now = new Date().toISOString();

    const updatedIncidents = register.incidents.map(inc => {
        if (inc.id === incidentId) {
            return {
                ...inc,
                resolved: true,
                resolution: resolution,
                resolvedAt: now,
                resolvedBy: {
                    uid: resolvedBy.uid,
                    name: resolvedBy.name || ""
                }
            };
        }
        return inc;
    });

    if (!isFirebaseConfigured()) {
        register.incidents = updatedIncidents;
        register.updatedAt = now;
        return register;
    }

    const db = getAdminDb();
    const registerId = `${clubId}_${date}`;

    await db.collection(REGISTERS_COLLECTION).doc(registerId).update({
        incidents: updatedIncidents,
        updatedAt: now
    });

    return await getDateRegister(clubId, date);
}

/**
 * Add inspection record
 */
export async function addInspection(clubId, date, inspection, inspector) {
    const registerId = `${clubId}_${date}`;
    const now = new Date().toISOString();

    const inspectionRecord = {
        id: randomUUID(),
        type: inspection.type, // fire, safety, health, license, police
        passed: inspection.passed,
        notes: inspection.notes || "",
        deficiencies: inspection.deficiencies || [],
        followUpRequired: inspection.followUpRequired || false,
        inspector: {
            uid: inspector.uid,
            name: inspector.name || "",
            external: inspector.external || false, // external inspector like fire dept
            organization: inspector.organization || ""
        },
        timestamp: now
    };

    if (!isFirebaseConfigured()) {
        const register = await getDateRegister(clubId, date);
        register.inspections.push(inspectionRecord);
        register.updatedAt = now;
        return { register, inspection: inspectionRecord };
    }

    const db = getAdminDb();
    const { FieldValue } = require("firebase-admin/firestore");

    await db.collection(REGISTERS_COLLECTION).doc(registerId).set({
        inspections: FieldValue.arrayUnion(inspectionRecord),
        updatedAt: now
    }, { merge: true });

    return { register: await getDateRegister(clubId, date), inspection: inspectionRecord };
}

/**
 * Add reminder
 */
export async function addReminder(clubId, date, reminder, createdBy) {
    const registerId = `${clubId}_${date}`;
    const now = new Date().toISOString();

    const reminderRecord = {
        id: randomUUID(),
        text: reminder.text,
        dueTime: reminder.dueTime || "18:00",
        priority: reminder.priority || "normal", // low, normal, high, urgent
        category: reminder.category || "general", // general, supplies, staff, vendor, safety
        completed: false,
        createdBy: {
            uid: createdBy.uid,
            name: createdBy.name || ""
        },
        createdAt: now
    };

    if (!isFirebaseConfigured()) {
        const register = await getDateRegister(clubId, date);
        register.reminders.push(reminderRecord);
        register.updatedAt = now;
        return { register, reminder: reminderRecord };
    }

    const db = getAdminDb();
    const { FieldValue } = require("firebase-admin/firestore");

    await db.collection(REGISTERS_COLLECTION).doc(registerId).set({
        reminders: FieldValue.arrayUnion(reminderRecord),
        updatedAt: now
    }, { merge: true });

    return { register: await getDateRegister(clubId, date), reminder: reminderRecord };
}

/**
 * Complete a reminder
 */
export async function completeReminder(clubId, date, reminderId, completedBy) {
    const register = await getDateRegister(clubId, date);
    const now = new Date().toISOString();

    const updatedReminders = register.reminders.map(rem => {
        if (rem.id === reminderId) {
            return {
                ...rem,
                completed: true,
                completedAt: now,
                completedBy: {
                    uid: completedBy.uid,
                    name: completedBy.name || ""
                }
            };
        }
        return rem;
    });

    if (!isFirebaseConfigured()) {
        register.reminders = updatedReminders;
        register.updatedAt = now;
        return register;
    }

    const db = getAdminDb();
    const registerId = `${clubId}_${date}`;

    await db.collection(REGISTERS_COLLECTION).doc(registerId).update({
        reminders: updatedReminders,
        updatedAt: now
    });

    return await getDateRegister(clubId, date);
}

/**
 * Update actual footfall and revenue (end of day)
 */
export async function updateDayClose(clubId, date, closeData, closedBy) {
    const registerId = `${clubId}_${date}`;
    const now = new Date().toISOString();

    const updateData = {
        actualFootfall: closeData.actualFootfall || 0,
        revenue: {
            cover: closeData.revenue?.cover || 0,
            drinks: closeData.revenue?.drinks || 0,
            food: closeData.revenue?.food || 0,
            vip: closeData.revenue?.vip || 0,
            other: closeData.revenue?.other || 0
        },
        status: "completed",
        closedAt: now,
        closedBy: {
            uid: closedBy.uid,
            name: closedBy.name || ""
        },
        updatedAt: now
    };

    if (!isFirebaseConfigured()) {
        const register = await getDateRegister(clubId, date);
        Object.assign(register, updateData);
        return register;
    }

    const db = getAdminDb();
    await db.collection(REGISTERS_COLLECTION).doc(registerId).set(updateData, { merge: true });

    return await getDateRegister(clubId, date);
}

/**
 * Get registers for a date range (for reports)
 */
export async function getRegistersForRange(clubId, startDate, endDate) {
    if (!isFirebaseConfigured()) {
        return fallbackRegisters.filter(r =>
            r.clubId === clubId &&
            r.date >= startDate &&
            r.date <= endDate
        );
    }

    const db = getAdminDb();
    const snapshot = await db.collection(REGISTERS_COLLECTION)
        .where("clubId", "==", clubId)
        .where("date", ">=", startDate)
        .where("date", "<=", endDate)
        .orderBy("date", "asc")
        .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get incident summary for reporting
 */
export async function getIncidentSummary(clubId, startDate, endDate) {
    const registers = await getRegistersForRange(clubId, startDate, endDate);

    const summary = {
        total: 0,
        resolved: 0,
        unresolved: 0,
        bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
        byType: {}
    };

    registers.forEach(register => {
        (register.incidents || []).forEach(incident => {
            summary.total++;
            if (incident.resolved) summary.resolved++;
            else summary.unresolved++;

            summary.bySeverity[incident.severity] = (summary.bySeverity[incident.severity] || 0) + 1;
            summary.byType[incident.type] = (summary.byType[incident.type] || 0) + 1;
        });
    });

    return summary;
}
