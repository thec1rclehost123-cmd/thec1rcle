// Private DM Service - 1:1 conversations between attendees
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
    onSnapshot,
    serverTimestamp,
    or,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { PrivateConversation, DirectMessage, DirectMessageUnreadCount } from "./types";
import { canInitiateDM } from "./entitlements";
import { isUserBlocked } from "./moderation";

// Get or check existing conversation between two users
export async function getExistingConversation(
    userId1: string,
    userId2: string,
    eventId: string
): Promise<PrivateConversation | null> {
    try {
        const db = getFirebaseDb();

        // Query for conversation involving both users for this event
        const convoQuery = query(
            collection(db, "privateConversations"),
            where("eventId", "==", eventId),
            where("participants", "array-contains", userId1)
        );

        const snapshot = await getDocs(convoQuery);

        // Find one that also includes userId2
        const existing = snapshot.docs.find(doc => {
            const data = doc.data();
            return data.participants.includes(userId2);
        });

        if (existing) {
            return { id: existing.id, ...existing.data() } as PrivateConversation;
        }

        return null;
    } catch (error) {
        console.error("Error getting existing conversation:", error);
        return null;
    }
}

// ============================================
// DM RATE LIMITING - Anti-Creep Protection
// ============================================

const DM_DAILY_LIMIT_GLOBAL = 10; // Max new DM requests per user per day across all events

// Get how many DM requests user has sent today across all events
export async function getDMRequestsToday(
    userId: string
): Promise<number> {
    try {
        const db = getFirebaseDb();

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const requestsQuery = query(
            collection(db, "privateConversations"),
            where("initiatedBy", "==", userId)
        );

        const snapshot = await getDocs(requestsQuery);

        const todayCount = snapshot.docs.filter(doc => {
            const createdAt = doc.data().createdAt?.toDate?.();
            return createdAt && createdAt >= todayStart;
        }).length;

        return todayCount;
    } catch (error) {
        console.error("Error getting DM requests today:", error);
        return 0;
    }
}

// Get remaining DM requests for today
export async function getDMRequestsRemaining(
    userId: string
): Promise<{ remaining: number; limit: number; isLimited: boolean }> {
    const sentToday = await getDMRequestsToday(userId);
    const remaining = Math.max(0, DM_DAILY_LIMIT_GLOBAL - sentToday);

    return {
        remaining,
        limit: DM_DAILY_LIMIT_GLOBAL,
        isLimited: remaining === 0,
    };
}

// Check if user has too many recent rejections (anti-spam protection)
export async function getRejectionStatus(
    userId: string
): Promise<{ recentRejections: number; isRateLimited: boolean }> {
    try {
        const db = getFirebaseDb();

        // Get rejections in last 24 hours
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const rejectionsQuery = query(
            collection(db, "privateConversations"),
            where("initiatedBy", "==", userId),
            where("status", "==", "declined")
        );

        const snapshot = await getDocs(rejectionsQuery);

        // Count recent rejections
        const recentRejections = snapshot.docs.filter(doc => {
            const declinedAt = doc.data().declinedAt?.toDate?.();
            return declinedAt && declinedAt >= yesterday;
        }).length;

        // Rate limit if 3+ recent rejections
        return {
            recentRejections,
            isRateLimited: recentRejections >= 3,
        };
    } catch (error) {
        console.error("Error checking rejection status:", error);
        return { recentRejections: 0, isRateLimited: false };
    }
}

// Initiate DM request
export async function initiateDMRequest(
    senderId: string,
    recipientId: string,
    eventId: string
): Promise<{ success: boolean; conversationId?: string; error?: string }> {
    try {
        // Check permissions
        const permCheck = await canInitiateDM(senderId, recipientId, eventId);
        if (!permCheck.allowed) {
            return { success: false, error: permCheck.reason };
        }

        // Check for existing conversation first (doesn't count against limits)
        const existing = await getExistingConversation(senderId, recipientId, eventId);
        if (existing) {
            if (existing.status === "blocked") {
                return { success: false, error: "Unable to message this user" };
            }
            return { success: true, conversationId: existing.id };
        }

        // ============================================
        // RATE LIMIT CHECKS - Anti-Creep Protection
        // ============================================

        // Check daily DM request limit
        const rateLimit = await getDMRequestsRemaining(senderId);
        if (rateLimit.isLimited) {
            return {
                success: false,
                error: "You've reached your daily limit for new message requests. Making meaningful connections takes time! Try again tomorrow."
            };
        }

        // Check if user has too many recent rejections
        const rejectionStatus = await getRejectionStatus(senderId);
        if (rejectionStatus.isRateLimited) {
            return {
                success: false,
                error: "Take a break! You've had several declined requests. Try again later."
            };
        }


        const db = getFirebaseDb();

        // Get event info for expiry calculation
        const eventRef = doc(db, "events", eventId);
        const eventDoc = await getDoc(eventRef);
        const eventDate = eventDoc.exists()
            ? eventDoc.data().startDate?.toDate?.() || new Date(eventDoc.data().startDate)
            : new Date();

        // Set expiry to 7 days after event
        const expiresAt = new Date(eventDate.getTime() + 7 * 24 * 60 * 60 * 1000);

        const conversation: Omit<PrivateConversation, "id"> = {
            eventId,
            participants: [senderId, recipientId],
            status: "pending",
            initiatedBy: senderId,
            createdAt: serverTimestamp(),
            expiresAt,
            isSaved: false,
        };

        const docRef = await addDoc(collection(db, "privateConversations"), conversation);

        return { success: true, conversationId: docRef.id };
    } catch (error: any) {
        console.error("Error initiating DM:", error);
        return { success: false, error: error.message };
    }
}

// Accept DM request
export async function acceptDMRequest(
    conversationId: string,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const db = getFirebaseDb();
        const convoRef = doc(db, "privateConversations", conversationId);
        const convoDoc = await getDoc(convoRef);

        if (!convoDoc.exists()) {
            return { success: false, error: "Conversation not found" };
        }

        const data = convoDoc.data();

        // Verify user is the recipient (not the initiator)
        if (data.initiatedBy === userId) {
            return { success: false, error: "You cannot accept your own request" };
        }

        if (!data.participants.includes(userId)) {
            return { success: false, error: "You are not part of this conversation" };
        }

        await updateDoc(convoRef, {
            status: "accepted",
            acceptedAt: serverTimestamp(),
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Decline DM request
export async function declineDMRequest(
    conversationId: string,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const db = getFirebaseDb();
        const convoRef = doc(db, "privateConversations", conversationId);

        await updateDoc(convoRef, {
            status: "declined",
            declinedAt: serverTimestamp(),
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Block user (prevents all future DMs)
export async function blockUser(
    blockerId: string,
    blockedId: string,
    eventId?: string,
    isGlobal: boolean = false
): Promise<{ success: boolean; error?: string }> {
    try {
        const db = getFirebaseDb();

        // Create block record
        const blockId = `${blockerId}_${blockedId}`;
        await setDoc(doc(db, "userBlocks", blockId), {
            blockerId,
            blockedId,
            eventId: eventId || null,
            isGlobal,
            createdAt: serverTimestamp(),
        });

        // Update any existing conversations to blocked status
        const q = query(
            collection(db, "privateConversations"),
            where("participants", "array-contains", blockerId)
        );
        const snapshot = await getDocs(q);
        const conversations = snapshot.docs.filter(doc => doc.data().participants.includes(blockedId));

        for (const convoDoc of conversations) {
            await updateDoc(convoDoc.ref, {
                status: "blocked",
            });
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Send DM message
export async function sendDirectMessage(
    conversationId: string,
    senderId: string,
    content: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        const db = getFirebaseDb();

        // Verify conversation is accepted
        const convoRef = doc(db, "privateConversations", conversationId);
        const convoDoc = await getDoc(convoRef);

        if (!convoDoc.exists()) {
            return { success: false, error: "Conversation not found" };
        }

        const convoData = convoDoc.data();

        if (convoData.status !== "accepted") {
            return { success: false, error: "This conversation is not active" };
        }

        if (!convoData.participants.includes(senderId)) {
            return { success: false, error: "You are not part of this conversation" };
        }

        // Send message
        const otherUserId = convoData.participants.find((p: string) => p !== senderId);

        const message: Omit<DirectMessage, "id"> = {
            conversationId,
            senderId,
            recipientId: otherUserId,
            content,
            type: "text",
            createdAt: serverTimestamp(),
        };

        const msgRef = await addDoc(collection(db, "directMessages"), message);

        // Update last message in conversation
        await updateDoc(convoRef, {
            lastMessage: {
                content,
                senderId,
                createdAt: serverTimestamp(),
            },
        });

        return { success: true, messageId: msgRef.id };
    } catch (error: any) {
        console.error("Error sending DM:", error);
        return { success: false, error: error.message };
    }
}

// Subscribe to DM messages
export function subscribeToDirectMessages(
    conversationId: string,
    onMessages: (messages: DirectMessage[]) => void,
    messageLimit: number = 100
): () => void {
    const db = getFirebaseDb();

    const messagesQuery = query(
        collection(db, "directMessages"),
        where("conversationId", "==", conversationId),
        orderBy("createdAt", "desc"),
        limit(messageLimit)
    );

    return onSnapshot(messagesQuery, (snapshot) => {
        const messages: DirectMessage[] = snapshot.docs
            .filter(doc => !doc.data().isDeleted)
            .map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as DirectMessage[];

        // Reverse to show oldest first
        onMessages(messages.reverse());
    });
}

// Get user's DM conversations for an event
export async function getUserEventConversations(
    userId: string,
    eventId: string
): Promise<PrivateConversation[]> {
    try {
        const db = getFirebaseDb();

        const convoQuery = query(
            collection(db, "privateConversations"),
            where("eventId", "==", eventId),
            where("participants", "array-contains", userId)
        );

        const snapshot = await getDocs(convoQuery);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as PrivateConversation[];
    } catch (error) {
        console.error("Error fetching conversations:", error);
        return [];
    }
}

// Get pending DM requests for user
export async function getPendingDMRequests(
    userId: string
): Promise<PrivateConversation[]> {
    try {
        const db = getFirebaseDb();

        const requestsQuery = query(
            collection(db, "privateConversations"),
            where("participants", "array-contains", userId),
            where("status", "==", "pending")
        );

        const snapshot = await getDocs(requestsQuery);

        // Filter to only show requests where user is recipient (not initiator)
        return snapshot.docs
            .filter(doc => doc.data().initiatedBy !== userId)
            .map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as PrivateConversation[];
    } catch (error) {
        console.error("Error fetching DM requests:", error);
        return [];
    }
}

// Save contact (persist connection beyond event)
export async function saveContact(
    userId: string,
    contactUserId: string,
    contactName: string,
    eventId: string,
    eventTitle: string,
    contactAvatar?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const db = getFirebaseDb();

        const contactId = `${userId}_${contactUserId}`;
        await setDoc(doc(db, "savedContacts", contactId), {
            userId,
            contactUserId,
            contactName,
            contactAvatar: contactAvatar || null,
            eventId,
            eventTitle,
            savedAt: serverTimestamp(),
        });

        // Mark conversation as saved
        const existing = await getExistingConversation(userId, contactUserId, eventId);
        if (existing) {
            await updateDoc(doc(db, "privateConversations", existing.id), {
                isSaved: true,
            });
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Get saved contacts
export async function getSavedContacts(userId: string): Promise<Array<{
    contactUserId: string;
    contactName: string;
    contactAvatar?: string;
    eventTitle: string;
    savedAt: any;
}>> {
    try {
        const db = getFirebaseDb();

        const contactsQuery = query(
            collection(db, "savedContacts"),
            where("userId", "==", userId),
            orderBy("savedAt", "desc")
        );

        const snapshot = await getDocs(contactsQuery);

        return snapshot.docs.map(doc => doc.data()) as any[];
    } catch (error) {
        console.error("Error fetching saved contacts:", error);
        return [];
    }
}
// Get unread DM counts for all conversations of a user
export async function getUnreadDMCounts(userId: string): Promise<Record<string, number>> {
    try {
        const db = getFirebaseDb();
        const q = query(
            collection(db, "directMessages"),
            where("recipientId", "==", userId),
            where("readAt", "==", null)
        );

        const snapshot = await getDocs(q);
        const counts: Record<string, number> = {};

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const convoId = data.conversationId;
            counts[convoId] = (counts[convoId] || 0) + 1;
        });

        return counts;
    } catch (error) {
        console.error("Error fetching unread DM counts:", error);
        return {};
    }
}

// Mark all messages in a conversation as read
export async function markDMAsRead(conversationId: string, userId: string): Promise<void> {
    try {
        const db = getFirebaseDb();
        const q = query(
            collection(db, "directMessages"),
            where("conversationId", "==", conversationId),
            where("recipientId", "==", userId),
            where("readAt", "==", null)
        );

        const snapshot = await getDocs(q);
        const batch = snapshot.docs.map(doc => updateDoc(doc.ref, { readAt: serverTimestamp() }));
        await Promise.all(batch);
    } catch (error) {
        console.error("Error marking DM as read:", error);
    }
}

// Toggle reaction on a DM message
export async function toggleDMReaction(
    conversationId: string,
    messageId: string,
    userId: string,
    emoji: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const db = getFirebaseDb();
        const messageRef = doc(db, "directMessages", messageId);
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
