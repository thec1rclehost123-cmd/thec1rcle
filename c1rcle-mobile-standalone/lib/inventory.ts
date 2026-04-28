// Real-time inventory service for live ticket availability
import {
    doc,
    onSnapshot,
    runTransaction,
    increment,
    collection,
    query,
    where,
    getDocs,
} from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import { TicketTier } from "@/store/eventsStore";

// Subscribe to real-time ticket availability
export function subscribeToEventInventory(
    eventId: string,
    onUpdate: (tickets: TicketTier[]) => void
): () => void {
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

// Atomic ticket reservation (prevents overselling)
export async function reserveTickets(
    eventId: string,
    tierId: string,
    quantity: number
): Promise<{ success: boolean; error?: string }> {
    const db = getFirebaseDb();
    const eventRef = doc(db, "events", eventId);

    try {
        await runTransaction(db, async (transaction) => {
            const eventDoc = await transaction.get(eventRef);

            if (!eventDoc.exists()) {
                throw new Error("Event not found");
            }

            const tickets: TicketTier[] = eventDoc.data().tickets || [];
            const tierIndex = tickets.findIndex((t) => t.id === tierId);

            if (tierIndex === -1) {
                throw new Error("Ticket tier not found");
            }

            const tier = tickets[tierIndex];

            if (tier.remaining < quantity) {
                throw new Error(`Only ${tier.remaining} tickets available`);
            }

            // Update remaining count
            tickets[tierIndex] = {
                ...tier,
                remaining: tier.remaining - quantity,
            };

            transaction.update(eventRef, { tickets });
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Release reserved tickets (on payment failure or timeout)
export async function releaseTickets(
    eventId: string,
    tierId: string,
    quantity: number
): Promise<{ success: boolean; error?: string }> {
    const db = getFirebaseDb();
    const eventRef = doc(db, "events", eventId);

    try {
        await runTransaction(db, async (transaction) => {
            const eventDoc = await transaction.get(eventRef);

            if (!eventDoc.exists()) {
                throw new Error("Event not found");
            }

            const tickets: TicketTier[] = eventDoc.data().tickets || [];
            const tierIndex = tickets.findIndex((t) => t.id === tierId);

            if (tierIndex === -1) {
                throw new Error("Ticket tier not found");
            }

            const tier = tickets[tierIndex];

            // Return tickets to inventory
            tickets[tierIndex] = {
                ...tier,
                remaining: Math.min(tier.quantity, tier.remaining + quantity),
            };

            transaction.update(eventRef, { tickets });
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Check if tickets are still available
export async function checkAvailability(
    eventId: string,
    tierId: string,
    quantity: number
): Promise<{ available: boolean; remaining: number }> {
    const db = getFirebaseDb();
    const eventRef = doc(db, "events", eventId);

    try {
        const eventDoc = await getDocs(query(collection(db, "events"), where("id", "==", eventId)));

        if (eventDoc.empty) {
            return { available: false, remaining: 0 };
        }

        const data = eventDoc.docs[0].data();
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
