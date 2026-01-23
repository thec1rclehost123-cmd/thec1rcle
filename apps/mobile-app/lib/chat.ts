// Event-based chat service
import {
    doc,
    setDoc,
    getDoc,
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    addDoc,
    onSnapshot,
    serverTimestamp,
    Timestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "./firebase";

export interface ChatMessage {
    id: string;
    eventChatId: string;
    senderId: string;
    senderName: string;
    senderAvatar?: string;
    content: string;
    type: "text" | "image" | "system";
    createdAt: any;
    readBy: string[];
}

export interface EventChat {
    id: string;
    eventId: string;
    eventTitle: string;
    eventDate: string;
    participants: string[]; // User IDs
    participantCount: number;
    lastMessage?: {
        content: string;
        senderId: string;
        senderName: string;
        createdAt: any;
    };
    createdAt: any;
}

export interface DirectChat {
    id: string;
    participants: string[];
    eventId?: string; // Optional - if they met at an event
    lastMessage?: {
        content: string;
        senderId: string;
        createdAt: any;
    };
    createdAt: any;
}

// Check if user has ticket for event (required for chat access)
export async function hasEventAccess(
    userId: string,
    eventId: string
): Promise<boolean> {
    try {
        const db = getFirebaseDb();
        const ordersQuery = query(
            collection(db, "orders"),
            where("userId", "==", userId),
            where("eventId", "==", eventId),
            where("status", "in", ["confirmed", "checked_in"])
        );

        const snapshot = await getDocs(ordersQuery);
        return !snapshot.empty;
    } catch (error) {
        console.error("Error checking event access:", error);
        return false;
    }
}

// Get or create event chat room
export async function getEventChat(
    eventId: string,
    userId: string
): Promise<{ chat: EventChat | null; error?: string }> {
    try {
        // First verify user has access
        const hasAccess = await hasEventAccess(userId, eventId);
        if (!hasAccess) {
            return { chat: null, error: "You need a ticket to access this chat" };
        }

        const db = getFirebaseDb();
        const chatId = `event_${eventId}`;
        const chatRef = doc(db, "eventChats", chatId);
        const chatDoc = await getDoc(chatRef);

        if (chatDoc.exists()) {
            // Add user to participants if not already
            const data = chatDoc.data();
            if (!data.participants.includes(userId)) {
                await setDoc(chatRef, {
                    ...data,
                    participants: [...data.participants, userId],
                    participantCount: data.participantCount + 1,
                }, { merge: true });
            }
            return { chat: { id: chatDoc.id, ...data } as EventChat };
        }

        // Get event details
        const eventRef = doc(db, "events", eventId);
        const eventDoc = await getDoc(eventRef);

        if (!eventDoc.exists()) {
            return { chat: null, error: "Event not found" };
        }

        const eventData = eventDoc.data();

        // Create new chat room
        const newChat: Omit<EventChat, "id"> = {
            eventId,
            eventTitle: eventData.title,
            eventDate: eventData.startDate,
            participants: [userId],
            participantCount: 1,
            createdAt: serverTimestamp(),
        };

        await setDoc(chatRef, newChat);

        return { chat: { id: chatId, ...newChat } as EventChat };
    } catch (error: any) {
        return { chat: null, error: error.message };
    }
}

// Send message to event chat
export async function sendEventMessage(
    eventChatId: string,
    senderId: string,
    senderName: string,
    content: string,
    senderAvatar?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        const db = getFirebaseDb();

        const message: Omit<ChatMessage, "id"> = {
            eventChatId,
            senderId,
            senderName,
            senderAvatar: senderAvatar || null,
            content,
            type: "text",
            createdAt: serverTimestamp(),
            readBy: [senderId],
        };

        const msgRef = await addDoc(collection(db, "eventMessages"), message);

        // Update last message in chat
        const chatRef = doc(db, "eventChats", eventChatId);
        await setDoc(chatRef, {
            lastMessage: {
                content,
                senderId,
                senderName,
                createdAt: serverTimestamp(),
            },
        }, { merge: true });

        return { success: true, messageId: msgRef.id };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Subscribe to event chat messages
export function subscribeToEventMessages(
    eventChatId: string,
    onMessage: (messages: ChatMessage[]) => void,
    messageLimit: number = 50
): () => void {
    const db = getFirebaseDb();
    const messagesQuery = query(
        collection(db, "eventMessages"),
        where("eventChatId", "==", eventChatId),
        orderBy("createdAt", "desc"),
        limit(messageLimit)
    );

    return onSnapshot(messagesQuery, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as ChatMessage[];

        onMessage(messages.reverse()); // Reverse to show oldest first
    });
}

// Get user's event chats (events they have tickets to)
export async function getUserEventChats(
    userId: string
): Promise<EventChat[]> {
    try {
        const db = getFirebaseDb();

        // Get user's orders
        const ordersQuery = query(
            collection(db, "orders"),
            where("userId", "==", userId),
            where("status", "in", ["confirmed", "checked_in"])
        );
        const ordersSnap = await getDocs(ordersQuery);

        const eventIds = ordersSnap.docs.map(doc => doc.data().eventId);

        if (eventIds.length === 0) return [];

        // Get chats for those events
        const chats: EventChat[] = [];

        for (const eventId of eventIds) {
            const chatId = `event_${eventId}`;
            const chatRef = doc(db, "eventChats", chatId);
            const chatDoc = await getDoc(chatRef);

            if (chatDoc.exists()) {
                chats.push({ id: chatDoc.id, ...chatDoc.data() } as EventChat);
            } else {
                // Create placeholder chat info from order
                const order = ordersSnap.docs.find(d => d.data().eventId === eventId)?.data();
                if (order) {
                    chats.push({
                        id: chatId,
                        eventId,
                        eventTitle: order.eventTitle || "Event Chat",
                        eventDate: order.eventDate,
                        participants: [],
                        participantCount: 0,
                        createdAt: null,
                    });
                }
            }
        }

        // Sort by event date (upcoming first)
        return chats.sort((a, b) => {
            const dateA = new Date(a.eventDate || 0);
            const dateB = new Date(b.eventDate || 0);
            return dateA.getTime() - dateB.getTime();
        });
    } catch (error) {
        console.error("Error getting user chats:", error);
        return [];
    }
}

// Direct message between users (must have been at same event)
export async function startDirectChat(
    userId: string,
    otherUserId: string,
    eventId?: string
): Promise<{ chatId: string | null; error?: string }> {
    try {
        const db = getFirebaseDb();

        // Check if chat already exists
        const existingQuery = query(
            collection(db, "directChats"),
            where("participants", "array-contains", userId)
        );
        const existingSnap = await getDocs(existingQuery);

        const existingChat = existingSnap.docs.find(doc =>
            doc.data().participants.includes(otherUserId)
        );

        if (existingChat) {
            return { chatId: existingChat.id };
        }

        // Create new direct chat
        const chatData: Omit<DirectChat, "id"> = {
            participants: [userId, otherUserId],
            eventId: eventId || null,
            createdAt: serverTimestamp(),
        };

        const chatRef = await addDoc(collection(db, "directChats"), chatData);

        return { chatId: chatRef.id };
    } catch (error: any) {
        return { chatId: null, error: error.message };
    }
}
