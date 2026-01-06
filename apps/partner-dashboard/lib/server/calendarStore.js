/**
 * Club Calendar Store
 * Manages venue availability calendars for hosts to view and request slots
 */

import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { randomUUID } from "node:crypto";

const CALENDAR_COLLECTION = "club_calendar";
const AUDIT_LOGS_COLLECTION = "audit_logs";

async function createAuditLog(db, { type, entityId, action, actorId, actorRole, metadata = {} }) {
    await db.collection(AUDIT_LOGS_COLLECTION).add({
        type,
        entityId,
        action,
        actorId,
        actorRole,
        metadata,
        timestamp: new Date().toISOString()
    });
}

/**
 * Get club calendar for a date range
 * Returns only availability info (no event details) for privacy
 */
export async function getClubCalendar(clubId, startDate, endDate, hostId = null) {
    if (!isFirebaseConfigured()) {
        // Generate mock availability
        return generateMockCalendar(clubId, startDate, endDate);
    }

    const db = getAdminDb();

    // 1. Get explicit calendar overrides (blocks, etc)
    const snapshot = await db.collection(CALENDAR_COLLECTION)
        .where("clubId", "==", clubId)
        .where("date", ">=", startDate)
        .where("date", "<=", endDate)
        .get();

    const calendarMap = new Map();
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        calendarMap.set(data.date, {
            date: data.date,
            status: data.status,
            reason: hostId ? undefined : data.reason // Hide block reasons from hosts unless desired
        });
    });

    // 2. Get Slot Requests for this host
    if (hostId) {
        const slotsSnap = await db.collection("slot_requests")
            .where("clubId", "==", clubId)
            .where("hostId", "==", hostId)
            .where("requestedDate", ">=", startDate)
            .where("requestedDate", "<=", endDate)
            .get();

        slotsSnap.docs.forEach(doc => {
            const data = doc.data();
            const existing = calendarMap.get(data.requestedDate);
            // My requests take precedence in visibility for me
            calendarMap.set(data.requestedDate, {
                ...existing,
                date: data.requestedDate,
                myRequest: {
                    id: doc.id,
                    status: data.status,
                    startTime: data.requestedStartTime,
                    endTime: data.requestedEndTime
                },
                // status: data.status === 'pending' ? 'tentative' : (data.status === 'approved' ? 'approved_hold' : existing?.status || 'available')
            });
        });
    }

    // 3. Get Confirmed Events (Privacy restricted)
    // Fetch all scheduled/live events for this venue to show as 'Booked'
    const eventsSnap = await db.collection("events")
        .where("venueId", "==", clubId)
        .where("startDate", ">=", startDate)
        .where("startDate", "<=", endDate)
        .where("lifecycle", "in", ["scheduled", "live", "published"])
        .get();

    eventsSnap.docs.forEach(doc => {
        const data = doc.data();
        const existing = calendarMap.get(data.startDate);

        // If it's my event, I already have it from the slot request or I see it anyway
        // If it's NOT my event, show as Generic 'Booked'
        if (data.creatorId !== hostId) {
            calendarMap.set(data.startDate, {
                ...existing,
                date: data.startDate,
                status: "booked",
                reason: "Booked" // Generic label
            });
        }
    });

    const calendarData = Array.from(calendarMap.values());

    // Fill in missing dates with 'available'
    return fillCalendarGaps(calendarData, clubId, startDate, endDate);
}

/**
 * Get specific date availability for a club
 */
export async function getDateAvailability(clubId, date) {
    if (!isFirebaseConfigured()) {
        return {
            date,
            status: "available",
            slots: generateDefaultTimeSlots()
        };
    }

    const db = getAdminDb();
    const calendarId = `${clubId}_${date}`;
    const doc = await db.collection(CALENDAR_COLLECTION).doc(calendarId).get();

    if (!doc.exists) {
        return {
            date,
            status: "available",
            slots: generateDefaultTimeSlots()
        };
    }

    const data = doc.data();
    return {
        date: data.date,
        status: determineOverallStatus(data.slots),
        slots: data.slots || generateDefaultTimeSlots()
    };
}

/**
 * Block a date (club action)
 */
export async function blockDate(clubId, date, reason = "", blockedBy) {
    const entry = {
        clubId,
        date,
        status: "blocked",
        reason,
        slots: [],
        blockedBy: {
            uid: blockedBy.uid,
            role: blockedBy.role,
            name: blockedBy.name || ""
        },
        updatedAt: new Date().toISOString()
    };

    if (!isFirebaseConfigured()) {
        const index = fallbackCalendar.findIndex(c => c.clubId === clubId && c.date === date);
        if (index >= 0) {
            fallbackCalendar[index] = entry;
        } else {
            fallbackCalendar.push(entry);
        }
        return entry;
    }

    const db = getAdminDb();
    const calendarId = `${clubId}_${date}`;
    await db.collection(CALENDAR_COLLECTION).doc(calendarId).set(entry, { merge: true });

    await createAuditLog(db, {
        type: "calendar",
        entityId: calendarId,
        action: "blocked",
        actorId: blockedBy.uid,
        actorRole: blockedBy.role,
        metadata: { date, reason }
    });

    return entry;
}

/**
 * Unblock a date (club action)
 */
export async function unblockDate(clubId, date, unblockedBy) {
    if (!isFirebaseConfigured()) {
        const index = fallbackCalendar.findIndex(c => c.clubId === clubId && c.date === date);
        if (index >= 0) {
            fallbackCalendar[index].status = "available";
            fallbackCalendar[index].reason = "";
            return fallbackCalendar[index];
        }
        return { date, status: "available" };
    }

    const db = getAdminDb();
    const calendarId = `${clubId}_${date}`;
    await db.collection(CALENDAR_COLLECTION).doc(calendarId).update({
        status: "available",
        reason: "",
        unblockedBy: {
            uid: unblockedBy.uid,
            role: unblockedBy.role
        },
        updatedAt: new Date().toISOString()
    });

    await createAuditLog(db, {
        type: "calendar",
        entityId: calendarId,
        action: "unblocked",
        actorId: unblockedBy.uid,
        actorRole: unblockedBy.role,
        metadata: { date }
    });

    return { date, status: "available" };
}

/**
 * Get unified calendar for club (including slots and confirmed events)
 */
export async function getUnifiedClubCalendar(clubId, startDate, endDate) {
    if (!isFirebaseConfigured()) {
        const mockDays = generateMockCalendar(clubId, startDate, endDate);
        return {
            blocks: mockDays.filter(d => d.status === 'blocked').map(d => ({ date: d.date, reason: "Mock Block" })),
            slots: [],
            events: mockDays.filter(d => d.status === 'booked').map(d => ({ name: "Mock Event", dateStr: d.date, status: 'confirmed', type: 'event' }))
        };
    }

    const db = getAdminDb();

    // 1. Get Blocks
    const blocksSnap = await db.collection(CALENDAR_COLLECTION)
        .where("clubId", "==", clubId)
        .where("date", ">=", startDate)
        .where("date", "<=", endDate)
        .get();

    const blocks = blocksSnap.docs.map(doc => ({ id: doc.id, type: 'block', ...doc.data() }));

    // 2. Get Slot Requests
    const slotsSnap = await db.collection("slot_requests")
        .where("clubId", "==", clubId)
        .where("requestedDate", ">=", startDate)
        .where("requestedDate", "<=", endDate)
        .get();

    const slots = slotsSnap.docs.map(doc => ({ id: doc.id, type: 'slot_request', ...doc.data() }));

    // 3. Get Confirmed Events
    const eventsSnap = await db.collection("events")
        .where("venueId", "==", clubId)
        .get(); // Note: confirmed events might not have a simple 'date' field we can filter easily if it's formatted differently
    // But let's assume 'date' exists or we filter by startDate/endDate strings/Timestamps

    const events = eventsSnap.docs
        .map(doc => {
            const data = doc.data();
            const dateStr = data.date?.toDate ? data.date.toDate().toISOString().split('T')[0] : (typeof data.date === 'string' ? data.date : null);
            return { id: doc.id, type: 'event', ...data, dateStr };
        })
        .filter(e => e.dateStr && e.dateStr >= startDate && e.dateStr <= endDate);

    // Merge and return
    return {
        blocks,
        slots,
        events
    };
}

/**
 * Check if a specific time slot is available
 */
export async function isSlotAvailable(clubId, date, startTime, endTime) {
    const availability = await getDateAvailability(clubId, date);

    if (availability.status === "blocked") {
        return { available: false, reason: "This date is blocked by the venue" };
    }

    // Check for overlapping slots
    const hasConflict = (availability.slots || []).some(slot => {
        if (slot.status === "available") return false;
        return timeOverlaps(startTime, endTime, slot.startTime, slot.endTime);
    });

    if (hasConflict) {
        return { available: false, reason: "This time slot is already booked or tentative" };
    }

    return { available: true };
}

// ============ Helper Functions ============

function generateDefaultTimeSlots() {
    return [
        { startTime: "17:00", endTime: "20:00", status: "available" },
        { startTime: "20:00", endTime: "23:00", status: "available" },
        { startTime: "23:00", endTime: "03:00", status: "available" }
    ];
}

function determineOverallStatus(slots) {
    if (!slots || slots.length === 0) return "available";
    if (slots.every(s => s.status === "blocked")) return "blocked";
    if (slots.every(s => s.status === "booked")) return "booked";
    if (slots.some(s => s.status === "booked" || s.status === "tentative")) return "partial";
    return "available";
}

function timeOverlaps(start1, end1, start2, end2) {
    // Convert to minutes for comparison
    const toMinutes = (time) => {
        const [h, m] = time.split(":").map(Number);
        return h * 60 + m;
    };

    let s1 = toMinutes(start1);
    let e1 = toMinutes(end1);
    let s2 = toMinutes(start2);
    let e2 = toMinutes(end2);

    // Handle overnight events
    if (e1 < s1) e1 += 24 * 60;
    if (e2 < s2) e2 += 24 * 60;

    return !(e1 <= s2 || s1 >= e2);
}

function generateMockCalendar(clubId, startDate, endDate) {
    const result = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split("T")[0];
        const dayOfWeek = d.getDay();

        // Friday and Saturday more likely to be partially booked
        let status = "available";
        if (dayOfWeek === 5 || dayOfWeek === 6) {
            const rand = Math.random();
            if (rand > 0.7) status = "booked";
            else if (rand > 0.4) status = "partial";
        }

        result.push({
            date: dateStr,
            status,
            slots: generateDefaultTimeSlots().map(slot => ({
                ...slot,
                status: status === "booked" ? "booked" :
                    status === "partial" && Math.random() > 0.5 ? "booked" : "available"
            }))
        });
    }

    return result;
}

function fillCalendarGaps(existing, clubId, startDate, endDate) {
    const existingDates = new Set(existing.map(e => e.date));
    const result = [...existing];

    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split("T")[0];
        if (!existingDates.has(dateStr)) {
            result.push({
                date: dateStr,
                status: "available",
                slots: generateDefaultTimeSlots()
            });
        }
    }

    return result.sort((a, b) => a.date.localeCompare(b.date));
}
