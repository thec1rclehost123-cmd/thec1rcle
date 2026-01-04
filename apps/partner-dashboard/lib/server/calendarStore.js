/**
 * Club Calendar Store
 * Manages venue availability calendars for hosts to view and request slots
 */

import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { randomUUID } from "node:crypto";

const CALENDAR_COLLECTION = "club_calendar";

// Fallback storage for development
let fallbackCalendar = [];

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
    const snapshot = await db.collection(CALENDAR_COLLECTION)
        .where("clubId", "==", clubId)
        .where("date", ">=", startDate)
        .where("date", "<=", endDate)
        .get();

    const calendarData = snapshot.docs.map(doc => {
        const data = doc.data();
        // Privacy: Don't expose event details to hosts
        return {
            date: data.date,
            status: data.status || determineOverallStatus(data.slots),
            slots: (data.slots || []).map(slot => ({
                startTime: slot.startTime,
                endTime: slot.endTime,
                status: slot.status,
                // Only show eventId if it belongs to this host
                ...(hostId && slot.hostId === hostId ? { eventId: slot.eventId } : {})
            }))
        };
    });

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

    return { date, status: "available" };
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
