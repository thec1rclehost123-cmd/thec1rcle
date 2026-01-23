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
import { PrivateConversation, DirectMessage } from "./types";
import { canInitiateDM } from "./entitlements";

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

        // Check for existing conversation
        const existing = await getExistingConversation(senderId, recipientId, eventId);
        if (existing) {
            if (existing.status === "blocked") {
                return { success: false, error: "Unable to message this user" };
            }
            return { success: true, conversationId: existing.id };
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
        if (eventId) {
            const existing = await getExistingConversation(blockerId, blockedId, eventId);
            if (existing) {
                await updateDoc(doc(db, "privateConversations", existing.id), {
                    status: "blocked",
                });
            }
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
        const message: Omit<DirectMessage, "id"> = {
            conversationId,
            senderId,
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
