
import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { getEvent } from "./eventStore";
import { getUserOrders } from "./orderStore";

// In-memory fallback for development
let fallbackWaitlist = [];

const WAITLIST_COLLECTION = "waitlist";

/**
 * Add a user to the waitlist for a specific event and ticket tier
 */
export async function joinWaitlist({ eventId, ticketId, userId, email, phone }) {
    if (!eventId || !email) {
        throw new Error("Event ID and Email are required");
    }

    const entry = {
        id: `wl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        eventId,
        ticketId: ticketId || "any",
        userId: userId || null,
        email,
        phone: phone || null,
        status: "waiting", // waiting, notified, purchased, expired
        createdAt: new Date().toISOString(),
        notifiedAt: null
    };

    if (!isFirebaseConfigured()) {
        // Check if already in waitlist
        const existing = fallbackWaitlist.find(
            w => w.eventId === eventId && w.email === email && w.status === "waiting"
        );
        if (existing) return existing;

        fallbackWaitlist.push(entry);
        return entry;
    }

    const db = getAdminDb();

    // Check for existing active waitlist entry
    const existingSnapshot = await db.collection(WAITLIST_COLLECTION)
        .where("eventId", "==", eventId)
        .where("email", "==", email)
        .where("status", "==", "waiting")
        .get();

    if (!existingSnapshot.empty) {
        return { id: existingSnapshot.docs[0].id, ...existingSnapshot.docs[0].data() };
    }

    await db.collection(WAITLIST_COLLECTION).doc(entry.id).set(entry);
    return entry;
}

/**
 * Get the waitlist for an event
 */
export async function getEventWaitlist(eventId) {
    if (!isFirebaseConfigured()) {
        return fallbackWaitlist
            .filter(w => w.eventId === eventId && w.status === "waiting")
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }

    const db = getAdminDb();
    const snapshot = await db.collection(WAITLIST_COLLECTION)
        .where("eventId", "==", eventId)
        .where("status", "==", "waiting")
        .orderBy("createdAt", "asc")
        .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Process the waitlist: Find the next person and "notify" them (reserve a spot)
 * In a real system, this would generate a unique link and send an email.
 */
export async function processWaitlist(eventId, ticketId) {
    // 1. Get next person in line
    const waitlist = await getEventWaitlist(eventId);
    const nextUser = waitlist.find(w => w.ticketId === ticketId || w.ticketId === "any");

    if (!nextUser) return null;

    const now = new Date().toISOString();
    const updates = {
        status: "notified",
        notifiedAt: now,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 min window
    };

    if (!isFirebaseConfigured()) {
        const index = fallbackWaitlist.findIndex(w => w.id === nextUser.id);
        if (index >= 0) {
            fallbackWaitlist[index] = { ...fallbackWaitlist[index], ...updates };
            return fallbackWaitlist[index];
        }
    } else {
        const db = getAdminDb();
        await db.collection(WAITLIST_COLLECTION).doc(nextUser.id).update(updates);
    }

    // TODO: Trigger email notification here
    console.log(`[Waitlist] Notified user ${nextUser.email} for event ${eventId}`);

    return { ...nextUser, ...updates };
}

/**
 * Check if a user is allowed to purchase (if they were notified)
 */
export async function verifyWaitlistAccess(eventId, email) {
    if (!isFirebaseConfigured()) {
        return fallbackWaitlist.find(
            w => w.eventId === eventId &&
                w.email === email &&
                w.status === "notified" &&
                new Date(w.expiresAt) > new Date()
        );
    }

    const db = getAdminDb();
    const snapshot = await db.collection(WAITLIST_COLLECTION)
        .where("eventId", "==", eventId)
        .where("email", "==", email)
        .where("status", "==", "notified")
        .get();

    if (snapshot.empty) return null;

    const entry = snapshot.docs[0].data();
    if (new Date(entry.expiresAt) < new Date()) return null; // Expired

    return { id: snapshot.docs[0].id, ...entry };
}
