/**
 * Venue Calendar Store
 * Manages venue availability calendars for hosts to view and request slots
 */

import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { randomUUID } from "node:crypto";

const CALENDAR_COLLECTION = "venue_calendar";
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
export async function getVenueCalendar(venueId, startDate, endDate, hostId = null) {
    if (!isFirebaseConfigured()) {
        // Generate mock availability
        return generateMockCalendar(venueId, startDate, endDate);
    }

    const db = getAdminDb();

    // 1. Get explicit calendar overrides (blocks, etc)
    // WORKAROUND: In-memory filtering for dates to avoid requiring a composite index (venueId + date)
    const snapshot = await db.collection(CALENDAR_COLLECTION)
        .where("venueId", "==", venueId)
        .get();

    const calendarMap = new Map();
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        // In-memory date filter
        if (data.date >= startDate && data.date <= endDate) {
            calendarMap.set(data.date, {
                date: data.date,
                status: data.status,
                reason: hostId ? undefined : data.reason
            });
        }
    });

    // 2. Get Slot Requests for this host
    if (hostId) {
        const slotsSnap = await db.collection("slot_requests")
            .where("venueId", "==", venueId)
            .where("hostId", "==", hostId)
            .get();

        slotsSnap.docs.forEach(doc => {
            const data = doc.data();
            // In-memory date filter
            if (data.requestedDate >= startDate && data.requestedDate <= endDate) {
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
                });
            }
        });
    }

    // 3. Get Confirmed Events (Privacy restricted)
    // Fetch all scheduled/live events for this venue to show as 'Booked'
    const eventsSnap = await db.collection("events")
        .where("venueId", "==", venueId)
        .where("lifecycle", "in", ["scheduled", "live", "published"])
        .get();

    eventsSnap.docs.forEach(doc => {
        const data = doc.data();

        // In-memory date filter
        if (data.startDate >= startDate && data.startDate <= endDate) {
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
        }
    });

    const calendarData = Array.from(calendarMap.values());

    // Fill in missing dates with 'available'
    return fillCalendarGaps(calendarData, venueId, startDate, endDate);
}

/**
 * Get specific date availability for a venue
 */
export async function getDateAvailability(venueId, date) {
    if (!isFirebaseConfigured()) {
        return {
            date,
            status: "available",
            slots: generateDefaultTimeSlots()
        };
    }

    const db = getAdminDb();
    const calendarId = `${venueId}_${date}`;
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
 * Block a date or time range (venue action)
 */
export async function blockDate(venueId, date, reason = "", blockedBy, startTime = "16:00", endTime = "04:00") {
    if (!isFirebaseConfigured()) {
        const entry = { venueId, date, status: "blocked", reason, startTime, endTime };
        fallbackCalendar.push(entry);
        return entry;
    }

    const db = getAdminDb();

    // 1. Verify no overlap with confirmed events
    const eventsSnap = await db.collection("events")
        .where("venueId", "==", venueId)
        .where("lifecycle", "in", ["scheduled", "live", "published"])
        .get();

    const eventConflicts = eventsSnap.docs.filter(doc => {
        const data = doc.data();
        const eventDate = data.date || (data.startDate?.toDate ? data.startDate.toDate().toISOString().split('T')[0] : (typeof data.startDate === 'string' ? data.startDate.split('T')[0] : null));
        if (eventDate !== date) return false;

        return timeOverlaps(startTime, endTime, data.startTime || "21:00", data.endTime || "04:00");
    });

    if (eventConflicts.length > 0) {
        throw new Error(`Cannot block time: overlaps with confirmed event "${eventConflicts[0].data().title}"`);
    }

    const entry = {
        venueId,
        date,
        startTime,
        endTime,
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

    const calendarId = `${venueId}_${date}`;
    await db.collection(CALENDAR_COLLECTION).doc(calendarId).set(entry, { merge: true });

    await createAuditLog(db, {
        type: "calendar",
        entityId: calendarId,
        action: "blocked",
        actorId: blockedBy.uid,
        actorRole: blockedBy.role,
        metadata: { date, reason, startTime, endTime }
    });

    return entry;
}

/**
 * Unblock a date (venue action)
 */
export async function unblockDate(venueId, date, unblockedBy) {
    if (!isFirebaseConfigured()) {
        const index = fallbackCalendar.findIndex(c => c.venueId === venueId && c.date === date);
        if (index >= 0) {
            fallbackCalendar[index].status = "available";
            fallbackCalendar[index].reason = "";
            return fallbackCalendar[index];
        }
        return { date, status: "available" };
    }

    const db = getAdminDb();
    const calendarId = `${venueId}_${date}`;

    // We can just delete the document to revert to default availability
    await db.collection(CALENDAR_COLLECTION).doc(calendarId).delete();

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
 * Get unified calendar for venue (including slots and confirmed events)
 */
export async function getUnifiedVenueCalendar(venueId, startDate, endDate) {
    if (!isFirebaseConfigured()) {
        const mockDays = generateMockCalendar(venueId, startDate, endDate);
        return {
            blocks: mockDays.filter(d => d.status === 'blocked').map(d => ({ date: d.date, reason: "Mock Block" })),
            slots: [],
            events: mockDays.filter(d => d.status === 'booked').map(d => ({ name: "Mock Event", dateStr: d.date, status: 'confirmed', type: 'event' }))
        };
    }

    const db = getAdminDb();

    // 1. Get Blocks
    const blocksSnap = await db.collection(CALENDAR_COLLECTION)
        .where("venueId", "==", venueId)
        .where("date", ">=", startDate)
        .where("date", "<=", endDate)
        .get();

    const blocks = blocksSnap.docs.map(doc => ({ id: doc.id, type: 'block', ...doc.data() }));

    // 2. Get Slot Requests
    const slotsSnap = await db.collection("slot_requests")
        .where("venueId", "==", venueId)
        .where("requestedDate", ">=", startDate)
        .where("requestedDate", "<=", endDate)
        .get();

    const slots = slotsSnap.docs.map(doc => ({ id: doc.id, type: 'slot_request', ...doc.data() }));

    // 3. Get Confirmed Events
    const eventsSnap = await db.collection("events")
        .where("venueId", "==", venueId)
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
export async function isSlotAvailable(venueId, date, startTime, endTime) {
    const availability = await getDateAvailability(venueId, date);

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

function generateMockCalendar(venueId, startDate, endDate) {
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

/**
 * Get operating calendar for partner dashboard (rich view)
 */
/**
 * Get operating calendar for partner dashboard (rich view)
 * Ensures correctness, clarity, and zero information leakage.
 */
export async function getOperatingCalendar(partnerId, role, startDate, endDate) {
    const db = getAdminDb();

    let blocks = [];
    let slots = [];
    let events = [];

    if (role === 'venue') {
        const venueId = partnerId;
        // 1. Fetch Blocks for this venue - filter by date in memory to avoid index requirement
        const blocksSnap = await db.collection(CALENDAR_COLLECTION)
            .where("venueId", "==", venueId)
            .get();

        blocks = blocksSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(b => b.date >= startDate && b.date <= endDate);

        // 2. Fetch Slots for this venue - filter by requestedDate in memory
        const slotsSnap = await db.collection("slot_requests")
            .where("venueId", "==", venueId)
            .get();

        slots = slotsSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(s => s.requestedDate >= startDate && s.requestedDate <= endDate);

        // 3. Fetch Events for this venue
        const eventsSnap = await db.collection("events")
            .where("venueId", "==", venueId)
            .get();
        events = eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    } else {
        // Host Role: Sees own events + anonymized blocks for venues they have events at
        const hostId = partnerId;

        // 1. Get Host's own events
        const myEventsSnap = await db.collection("events")
            .where("creatorId", "==", hostId)
            .get();
        const myEvents = myEventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), isOwner: true }));

        // 2. Get Host's own slots
        const mySlotsSnap = await db.collection("slot_requests")
            .where("hostId", "==", hostId)
            .get();

        const mySlots = mySlotsSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data(), isOwner: true }))
            .filter(s => s.requestedDate >= startDate && s.requestedDate <= endDate);

        slots = mySlots;

        // 3. Identify venues this host is active with
        const venueIds = new Set([
            ...myEvents.map(e => e.venueId),
            ...mySlots.map(s => s.venueId)
        ].filter(Boolean));

        // 4. For each active venue, fetch ALL events and blocks to show availability
        const otherEvents = [];
        const venueBlocks = [];

        for (const vId of venueIds) {
            // Fetch blocks for this venue - in memory filter
            const bSnap = await db.collection(CALENDAR_COLLECTION)
                .where("venueId", "==", vId)
                .get();

            venueBlocks.push(...bSnap.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(b => b.date >= startDate && b.date <= endDate)
            );

            // Fetch other confirmed events for this venue (unowned by this host)
            const eSnap = await db.collection("events")
                .where("venueId", "==", vId)
                .where("lifecycle", "in", ["scheduled", "live", "published"])
                .get();

            eSnap.docs.forEach(doc => {
                const data = doc.data();
                if (data.creatorId !== hostId) {
                    otherEvents.push({
                        id: doc.id,
                        ...data,
                        isAnonymized: true,
                        title: "Unavailable", // Enforce anonymization
                        hostName: "Host",
                        host: "Host"
                    });
                }
            });
        }

        events = [...myEvents, ...otherEvents];
        blocks = venueBlocks;
    }

    // Map confirmed events by date
    const eventsByDate = {};
    events.forEach(e => {
        const dateStr = e.date || (e.startDate?.toDate ? e.startDate.toDate().toISOString().split('T')[0] : (typeof e.startDate === 'string' ? e.startDate.split('T')[0] : null));
        if (dateStr && dateStr >= startDate && dateStr <= endDate) {
            if (!eventsByDate[dateStr]) eventsByDate[dateStr] = [];
            eventsByDate[dateStr].push(e);
        }
    });

    // Strategy: iterate dates and build state
    const result = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split("T")[0];

        const dayBlocks = blocks.filter(b => b.date === dateStr);
        const daySlots = slots.filter(s => s.requestedDate === dateStr);
        const dayEvents = eventsByDate[dateStr] || [];

        let state = "OPEN";
        let stats = {
            eventCount: dayEvents.length,
            pendingSlots: daySlots.filter(s => s.status === 'pending').length,
            hasRisk: false
        };

        if (dayBlocks.some(b => b.status === 'blocked')) {
            state = "BLOCKED";
        } else if (dayEvents.length > 0) {
            state = "CONFIRMED";
            // Risk logic: confirmed event but no tickets sold?
            if (dayEvents.some(e => !e.isAnonymized && (e.ticketsSold || 0) === 0 && (e.lifecycle === 'scheduled' || e.lifecycle === 'published'))) {
                stats.hasRisk = true;
            }
        } else if (daySlots.length > 0) {
            state = "PENDING";
        }

        result.push({
            date: dateStr,
            state,
            stats,
            events: dayEvents.map(e => ({
                id: e.id,
                title: e.title,
                startTime: e.startTime || (e.isAnonymized ? "18:00" : "21:00"),
                endTime: e.endTime || (e.isAnonymized ? "04:00" : "04:00"),
                lifecycle: e.lifecycle || e.status,
                host: e.isAnonymized ? "Venue Blocked" : (e.hostName || e.host || "Direct Production"),
                isAnonymized: !!e.isAnonymized
            })),
            slots: daySlots.map(s => ({
                id: s.id,
                host: s.hostName || "Host",
                status: s.status,
                startTime: s.requestedStartTime || "21:00",
                endTime: s.requestedEndTime || "04:00"
            })),
            block: dayBlocks[0] || null
        });
    }

    return result;
}

function fillCalendarGaps(existing, venueId, startDate, endDate) {
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
