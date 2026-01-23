// Event Group Chat Service
import {
    doc,
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    getDoc,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp,
    Timestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { GroupMessage, EventPhase, getEventPhase } from "./types";
import { checkEventEntitlement } from "./entitlements";

// Get or create event group chat
export async function getEventGroupChat(eventId: string): Promise<{
    enabled: boolean;
    phase: EventPhase;
    participantCount: number;
}> {
    try {
        const db = getFirebaseDb();
        const eventRef = doc(db, "events", eventId);
        const eventDoc = await getDoc(eventRef);

        if (!eventDoc.exists()) {
            return { enabled: false, phase: "EXPIRED", participantCount: 0 };
        }

        const eventData = eventDoc.data();
        const eventDate = eventData.startDate?.toDate?.() || new Date(eventData.startDate);
        const phase = getEventPhase(eventDate);

        // Count participants
        const ordersQuery = query(
            collection(db, "orders"),
            where("eventId", "==", eventId),
            where("status", "in", ["confirmed", "checked_in"])
        );
        const ordersSnap = await getDocs(ordersQuery);
        const userIds = new Set(ordersSnap.docs.map(d => d.data().userId));

        return {
            enabled: phase !== "EXPIRED",
            phase,
            participantCount: userIds.size,
        };
    } catch (error) {
        console.error("Error getting group chat:", error);
        return { enabled: false, phase: "EXPIRED", participantCount: 0 };
    }
}

// Send message to event group chat
export async function sendGroupMessage(
    eventId: string,
    userId: string,
    userName: string,
    content: string,
    userAvatar?: string,
    userBadge?: string,
    isAnonymous?: boolean
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        // Verify entitlement
        const entitlement = await checkEventEntitlement(userId, eventId);
        if (!entitlement) {
            return { success: false, error: "You need a ticket to send messages" };
        }

        const db = getFirebaseDb();

        const message: Omit<GroupMessage, "id"> = {
            eventId,
            senderId: userId,
            senderName: userName,
            senderAvatar: userAvatar || undefined,
            senderBadge: userBadge || undefined,
            content,
            type: "text",
            isAnonymous,
            createdAt: serverTimestamp(),
        };

        const docRef = await addDoc(collection(db, "eventGroupMessages"), message);

        return { success: true, messageId: docRef.id };
    } catch (error: any) {
        console.error("Error sending group message:", error);
        return { success: false, error: error.message };
    }
}

// Send announcement (hosts/venues only)
export async function sendAnnouncement(
    eventId: string,
    userId: string,
    userName: string,
    content: string,
    badge: "host" | "venue"
): Promise<{ success: boolean; error?: string }> {
    try {
        const db = getFirebaseDb();

        const message: Omit<GroupMessage, "id"> = {
            eventId,
            senderId: userId,
            senderName: userName,
            senderBadge: badge,
            content,
            type: "announcement",
            createdAt: serverTimestamp(),
        };

        await addDoc(collection(db, "eventGroupMessages"), message);

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Subscribe to group chat messages
export function subscribeToGroupChat(
    eventId: string,
    onMessages: (messages: GroupMessage[]) => void,
    messageLimit: number = 100
): () => void {
    const db = getFirebaseDb();

    const messagesQuery = query(
        collection(db, "eventGroupMessages"),
        where("eventId", "==", eventId),
        where("isDeleted", "!=", true),
        orderBy("isDeleted"),
        orderBy("createdAt", "desc"),
        limit(messageLimit)
    );

    return onSnapshot(messagesQuery, (snapshot) => {
        const messages: GroupMessage[] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as GroupMessage[];

        // Reverse to show oldest first
        onMessages(messages.reverse());
    }, (error) => {
        console.error("Error subscribing to group chat:", error);
        // Fallback query without isDeleted filter
        const fallbackQuery = query(
            collection(db, "eventGroupMessages"),
            where("eventId", "==", eventId),
            orderBy("createdAt", "desc"),
            limit(messageLimit)
        );

        onSnapshot(fallbackQuery, (snapshot) => {
            const messages: GroupMessage[] = snapshot.docs
                .filter(doc => !doc.data().isDeleted)
                .map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                })) as GroupMessage[];

            onMessages(messages.reverse());
        });
    });
}

// Delete message (moderators only)
export async function deleteGroupMessage(
    messageId: string,
    deletedByUserId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const db = getFirebaseDb();
        const messageRef = doc(db, "eventGroupMessages", messageId);

        await updateDoc(messageRef, {
            isDeleted: true,
            deletedBy: deletedByUserId,
            deletedAt: serverTimestamp(),
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Get recent messages (for initial load)
export async function getRecentGroupMessages(
    eventId: string,
    messageLimit: number = 50
): Promise<GroupMessage[]> {
    try {
        const db = getFirebaseDb();

        const messagesQuery = query(
            collection(db, "eventGroupMessages"),
            where("eventId", "==", eventId),
            orderBy("createdAt", "desc"),
            limit(messageLimit)
        );

        const snapshot = await getDocs(messagesQuery);

        const messages: GroupMessage[] = snapshot.docs
            .filter(doc => !doc.data().isDeleted)
            .map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as GroupMessage[];

        return messages.reverse();
    } catch (error) {
        console.error("Error fetching group messages:", error);
        return [];
    }
}

// Toggle reaction on a group message
export async function toggleGroupReaction(
    eventId: string,
    messageId: string,
    userId: string,
    emoji: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const db = getFirebaseDb();
        const messageRef = doc(db, "eventGroupMessages", messageId);
        const messageDoc = await getDoc(messageRef);

        if (!messageDoc.exists()) return { success: false, error: "Message not found" };

        const data = messageDoc.data();
        const reactions = data.reactions || {};
        const userList = reactions[emoji] || [];

        const { arrayUnion, arrayRemove } = await import("firebase/firestore");

        if (userList.includes(userId)) {
            await updateDoc(messageRef, {
                [`reactions.${emoji}`]: arrayRemove(userId)
            });
        } else {
            await updateDoc(messageRef, {
                [`reactions.${emoji}`]: arrayUnion(userId)
            });
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Mark event group chat as read for a user
export async function markGroupChatAsRead(eventId: string, userId: string): Promise<void> {
    try {
        const db = getFirebaseDb();
        const readRef = doc(db, `eventGroupChats/${eventId}/lastRead`, userId);
        await setDoc(readRef, {
            lastReadAt: serverTimestamp(),
        }, { merge: true });
    } catch (error) {
        console.error("Error marking group chat as read:", error);
    }
}

// Get unread counts for event group chats
export async function getGroupChatUnreadCounts(userId: string, eventIds: string[]): Promise<Record<string, number>> {
    try {
        const db = getFirebaseDb();
        const counts: Record<string, number> = {};

        for (const eventId of eventIds) {
            // Get last read timestamp
            const readRef = doc(db, `eventGroupChats/${eventId}/lastRead`, userId);
            const readDoc = await getDoc(readRef);
            const lastReadAt = readDoc.exists() ? readDoc.data().lastReadAt : new Timestamp(0, 0);

            // Count messages since last read
            const messagesQuery = query(
                collection(db, "eventGroupMessages"),
                where("eventId", "==", eventId),
                where("createdAt", ">", lastReadAt),
                limit(10) // We only care if there are some new messages, don't need exact 1000+
            );

            const snapshot = await getDocs(messagesQuery);
            counts[eventId] = snapshot.size;
        }

        return counts;
    } catch (error) {
        console.error("Error fetching group chat unread counts:", error);
        return {};
    }
}
