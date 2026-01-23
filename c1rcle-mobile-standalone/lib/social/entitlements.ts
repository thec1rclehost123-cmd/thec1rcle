// Event Entitlement Service - Access Control for Social Features
import {
    doc,
    collection,
    query,
    where,
    getDocs,
    getDoc,
    onSnapshot,
    setDoc,
    updateDoc,
    serverTimestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { EventEntitlement, EntitlementType } from "./types";

// Check if user has valid entitlement for event
export async function checkEventEntitlement(
    userId: string,
    eventId: string
): Promise<EventEntitlement | null> {
    try {
        const db = getFirebaseDb();

        // Check orders first (ticket purchased)
        const ordersQuery = query(
            collection(db, "orders"),
            where("userId", "==", userId),
            where("eventId", "==", eventId),
            where("status", "in", ["confirmed", "checked_in"])
        );

        const ordersSnap = await getDocs(ordersQuery);

        if (!ordersSnap.empty) {
            const order = ordersSnap.docs[0].data();
            return {
                id: ordersSnap.docs[0].id,
                userId,
                eventId,
                type: "ticket_purchased",
                status: "active",
                ticketTier: order.tickets?.[0]?.tierName,
                orderId: order.id,
                grantedAt: order.createdAt,
            };
        }

        // Check guestlist
        const guestlistQuery = query(
            collection(db, "guestlist"),
            where("userId", "==", userId),
            where("eventId", "==", eventId),
            where("status", "==", "approved")
        );

        const guestlistSnap = await getDocs(guestlistQuery);

        if (!guestlistSnap.empty) {
            const entry = guestlistSnap.docs[0].data();
            return {
                id: guestlistSnap.docs[0].id,
                userId,
                eventId,
                type: "guestlist_approved",
                status: "active",
                grantedAt: entry.approvedAt || entry.createdAt,
            };
        }

        // Check claimed/transferred tickets
        const transfersQuery = query(
            collection(db, "orders"),
            where("userId", "==", userId),
            where("eventId", "==", eventId),
            where("transferredFrom", "!=", null)
        );

        const transfersSnap = await getDocs(transfersQuery);

        if (!transfersSnap.empty) {
            const transfer = transfersSnap.docs[0].data();
            return {
                id: transfersSnap.docs[0].id,
                userId,
                eventId,
                type: "ticket_claimed",
                status: "active",
                orderId: transfer.id,
                grantedAt: transfer.createdAt,
            };
        }

        // Check if user is host/venue
        const eventRef = doc(db, "events", eventId);
        const eventSnap = await getDoc(eventRef);
        if (eventSnap.exists()) {
            const eventData = eventSnap.data();
            // Check if user is organizer or partner
            if (eventData.organizerId === userId || eventData.partnerId === userId) {
                return {
                    id: `host_${userId}_${eventId}`,
                    userId,
                    eventId,
                    type: "host",
                    status: "active",
                    grantedAt: serverTimestamp(),
                };
            }
        }

        return null;
    } catch (error) {
        console.error("Error checking entitlement:", error);
        return null;
    }
}

// Subscribe to entitlement changes (real-time)
export function subscribeToEntitlement(
    userId: string,
    eventId: string,
    onUpdate: (entitlement: EventEntitlement | null) => void
): () => void {
    const db = getFirebaseDb();

    // Watch orders for this user+event
    const ordersQuery = query(
        collection(db, "orders"),
        where("userId", "==", userId),
        where("eventId", "==", eventId)
    );

    return onSnapshot(ordersQuery, (snapshot) => {
        const validOrder = snapshot.docs.find(doc => {
            const status = doc.data().status;
            return status === "confirmed" || status === "checked_in";
        });

        if (validOrder) {
            const order = validOrder.data();
            onUpdate({
                id: validOrder.id,
                userId,
                eventId,
                type: order.transferredFrom ? "ticket_claimed" : "ticket_purchased",
                status: "active",
                ticketTier: order.tickets?.[0]?.tierName,
                orderId: order.id,
                grantedAt: order.createdAt,
            });
        } else {
            onUpdate(null);
        }
    });
}

// Get all attendees for an event (for participant list)
export async function getEventAttendees(
    eventId: string,
    limit: number = 50
): Promise<Array<{ userId: string; name: string; avatar?: string; badge?: string }>> {
    try {
        const db = getFirebaseDb();

        // Get confirmed orders
        const ordersQuery = query(
            collection(db, "orders"),
            where("eventId", "==", eventId),
            where("status", "in", ["confirmed", "checked_in"])
        );

        const ordersSnap = await getDocs(ordersQuery);
        const userIds = ordersSnap.docs.map(doc => doc.data().userId);

        // Get unique user IDs
        const uniqueUserIds = [...new Set(userIds)].slice(0, limit);

        // Fetch user profiles
        const attendees = await Promise.all(
            uniqueUserIds.map(async (userId) => {
                const userRef = doc(db, "users", userId);
                const userDoc = await getDoc(userRef);

                if (userDoc.exists()) {
                    const user = userDoc.data();
                    return {
                        userId,
                        name: user.displayName || "Guest",
                        avatar: user.photoURL,
                        badge: user.role === "host" ? "host" : undefined,
                    };
                }

                return { userId, name: "Guest" };
            })
        );

        return attendees;
    } catch (error) {
        console.error("Error fetching attendees:", error);
        return [];
    }
}

// Get attendee count for event
export async function getAttendeeCount(eventId: string): Promise<number> {
    try {
        const db = getFirebaseDb();

        const ordersQuery = query(
            collection(db, "orders"),
            where("eventId", "==", eventId),
            where("status", "in", ["confirmed", "checked_in"])
        );

        const snapshot = await getDocs(ordersQuery);
        const userIds = snapshot.docs.map(doc => doc.data().userId);

        return new Set(userIds).size;
    } catch (error) {
        console.error("Error counting attendees:", error);
        return 0;
    }
}

// Verify two users can DM (both must have entitlements to the SAME event)
export async function canInitiateDM(
    senderId: string,
    recipientId: string,
    eventId: string
): Promise<{ allowed: boolean; reason?: string }> {
    try {
        const db = getFirebaseDb();

        // 1. Check for blocks using the helper
        const { isUserBlocked } = await import("./moderation");
        const blocked = await isUserBlocked(senderId, recipientId);
        if (blocked) {
            return { allowed: false, reason: "Unable to message this user" };
        }

        // 2. Check both have active entitlements to this specific event
        const [senderEnt, recipientEnt] = await Promise.all([
            checkEventEntitlement(senderId, eventId),
            checkEventEntitlement(recipientId, eventId),
        ]);

        if (!senderEnt) {
            return { allowed: false, reason: "You need a ticket to initiate connections" };
        }

        if (!recipientEnt) {
            return { allowed: false, reason: "This user is not part of this event's community" };
        }

        // 3. Check for specific event chat phase (optional, but good for safety)
        const eventRef = doc(db, "events", eventId);
        const eventDoc = await getDoc(eventRef);
        if (eventDoc.exists()) {
            const eventDate = eventDoc.data().startDate?.toDate?.() || new Date(eventDoc.data().startDate);
            const phase = await import("./types").then(m => m.getEventPhase(eventDate));
            if (phase === "EXPIRED") {
                return { allowed: false, reason: "Community access for this event has ended" };
            }
        }

        return { allowed: true };
    } catch (error) {
        console.error("Error checking DM permissions:", error);
        return { allowed: false, reason: "Unable to verify permissions" };
    }
}
