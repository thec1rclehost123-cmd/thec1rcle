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

// Verify two users can DM (both must have entitlements)
export async function canInitiateDM(
    senderId: string,
    recipientId: string,
    eventId: string
): Promise<{ allowed: boolean; reason?: string }> {
    try {
        // Check if recipient has blocked sender
        const db = getFirebaseDb();
        const blocksQuery = query(
            collection(db, "userBlocks"),
            where("blockerId", "==", recipientId),
            where("blockedId", "==", senderId)
        );

        const blocksSnap = await getDocs(blocksQuery);
        if (!blocksSnap.empty) {
            return { allowed: false, reason: "Unable to message this user" };
        }

        // Check both have entitlements
        const [senderEntitlement, recipientEntitlement] = await Promise.all([
            checkEventEntitlement(senderId, eventId),
            checkEventEntitlement(recipientId, eventId),
        ]);

        if (!senderEntitlement) {
            return { allowed: false, reason: "You need a ticket to send messages" };
        }

        if (!recipientEntitlement) {
            return { allowed: false, reason: "This user is not attending this event" };
        }

        return { allowed: true };
    } catch (error) {
        console.error("Error checking DM permissions:", error);
        return { allowed: false, reason: "Unable to verify permissions" };
    }
}
