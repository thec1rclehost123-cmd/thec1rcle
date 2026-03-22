/**
 * THE C1RCLE - Real-time Inventory Service
 * Reads from the same Firestore 'events' collection as the guest-portal
 * and partner-dashboard.
 *
 * IMPORTANT: Actual inventory reservation happens SERVER-SIDE via the
 * /api/checkout/reserve endpoint (see lib/api.ts). These client-side
 * functions are for real-time UI updates only (showing remaining count).
 */

import {
    doc,
    getDoc,
    onSnapshot,
} from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import { TicketTier } from "@/store/eventsStore";

/**
 * Subscribe to real-time ticket availability for an event.
 * Updates the UI as inventory changes (other users purchase, etc.)
 */
export function subscribeToEventInventory(
    eventId: string,
    onUpdate: (tickets: TicketTier[]) => void
): () => void {
    console.log("[debug] subscribeToEventInventory eventId:", eventId);
    if (!eventId || typeof eventId !== "string") {
        console.error("[Firestore] Invalid eventId in subscribeToEventInventory:", eventId);
        return () => {};
    }
    const db = getFirebaseDb();
    const eventRef = doc(db, "events", eventId);

    const unsubscribe = onSnapshot(eventRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data();
            onUpdate(data.tickets || []);
        }
    }, (error) => {
        console.error("Error subscribing to inventory:", error);
    });

    return unsubscribe;
}

/**
 * Check if tickets are still available (one-time read).
 * Uses doc.get() with the document ID — NOT a query with where("id", ...).
 */
export async function checkAvailability(
    eventId: string,
    tierId: string,
    quantity: number
): Promise<{ available: boolean; remaining: number }> {
    console.log("[debug] checkAvailability eventId:", eventId);
    if (!eventId || typeof eventId !== "string") {
        console.error("[Firestore] Invalid eventId in checkAvailability:", eventId);
        return { available: false, remaining: 0 };
    }
    const db = getFirebaseDb();

    try {
        // Use getDoc with document reference — correct Firestore pattern
        const eventRef = doc(db, "events", eventId);
        const eventSnap = await getDoc(eventRef);

        if (!eventSnap.exists()) {
            return { available: false, remaining: 0 };
        }

        const data = eventSnap.data();
        const tickets: TicketTier[] = data.tickets || [];
        const tier = tickets.find((t) => t.id === tierId);

        if (!tier) {
            return { available: false, remaining: 0 };
        }

        return {
            available: tier.remaining >= quantity,
            remaining: tier.remaining,
        };
    } catch (error) {
        console.error("Error checking availability:", error);
        return { available: false, remaining: 0 };
    }
}

/**
 * Get all ticket tiers for an event (one-time read).
 */
export async function getEventTickets(eventId: string): Promise<TicketTier[]> {
    console.log("[debug] getEventTickets eventId:", eventId);
    if (!eventId || typeof eventId !== "string") {
        console.error("[Firestore] Invalid eventId in getEventTickets:", eventId);
        return [];
    }
    const db = getFirebaseDb();

    try {
        const eventRef = doc(db, "events", eventId);
        const eventSnap = await getDoc(eventRef);

        if (!eventSnap.exists()) {
            return [];
        }

        return eventSnap.data().tickets || [];
    } catch (error) {
        console.error("Error fetching event tickets:", error);
        return [];
    }
}
