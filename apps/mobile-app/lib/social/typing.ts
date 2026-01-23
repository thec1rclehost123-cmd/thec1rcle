// Real-time Typing Indicators Service
import {
    doc,
    setDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp,
    Timestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

// Typing indicator data
export interface TypingIndicator {
    oderId: string;
    userName: string;
    timestamp: any;
}

// Typing status for a conversation/chat
export interface TypingStatus {
    isTyping: boolean;
    users: Array<{
        userId: string;
        userName: string;
    }>;
}

// Typing indicator timeout (ms) - auto-remove after this duration
const TYPING_TIMEOUT = 5000;

// Debounce interval for typing updates (ms)
const TYPING_DEBOUNCE = 1000;

// Track last typing update to debounce
const lastTypingUpdate: Record<string, number> = {};

// Set typing status for group chat
export async function setGroupTypingStatus(
    eventId: string,
    userId: string,
    userName: string,
    isTyping: boolean
): Promise<void> {
    try {
        const db = getFirebaseDb();
        const typingRef = doc(db, "typingIndicators", `group_${eventId}_${userId}`);

        if (isTyping) {
            // Debounce - don't update too frequently
            const now = Date.now();
            const key = `group_${eventId}_${userId}`;
            if (lastTypingUpdate[key] && now - lastTypingUpdate[key] < TYPING_DEBOUNCE) {
                return;
            }
            lastTypingUpdate[key] = now;

            await setDoc(typingRef, {
                chatType: "group",
                chatId: eventId,
                userId,
                userName,
                timestamp: serverTimestamp(),
            });

            // Auto-remove after timeout
            setTimeout(async () => {
                try {
                    await deleteDoc(typingRef);
                } catch { }
            }, TYPING_TIMEOUT);
        } else {
            await deleteDoc(typingRef);
        }
    } catch (error) {
        // Silently fail - typing indicators are non-critical
        console.debug("Typing indicator error:", error);
    }
}

// Set typing status for DM
export async function setDMTypingStatus(
    conversationId: string,
    userId: string,
    userName: string,
    isTyping: boolean
): Promise<void> {
    try {
        const db = getFirebaseDb();
        const typingRef = doc(db, "typingIndicators", `dm_${conversationId}_${userId}`);

        if (isTyping) {
            // Debounce
            const now = Date.now();
            const key = `dm_${conversationId}_${userId}`;
            if (lastTypingUpdate[key] && now - lastTypingUpdate[key] < TYPING_DEBOUNCE) {
                return;
            }
            lastTypingUpdate[key] = now;

            await setDoc(typingRef, {
                chatType: "dm",
                chatId: conversationId,
                userId,
                userName,
                timestamp: serverTimestamp(),
            });

            // Auto-remove after timeout
            setTimeout(async () => {
                try {
                    await deleteDoc(typingRef);
                } catch { }
            }, TYPING_TIMEOUT);
        } else {
            await deleteDoc(typingRef);
        }
    } catch (error) {
        console.debug("Typing indicator error:", error);
    }
}

// Subscribe to typing indicators for group chat
export function subscribeToGroupTyping(
    eventId: string,
    currentUserId: string,
    onTypingChange: (status: TypingStatus) => void
): () => void {
    const db = getFirebaseDb();

    // We need to listen to multiple documents, so we use collection query
    // For simplicity, we'll poll or use a workaround
    // Since we're using document IDs with pattern, we track known typers

    const typersMap = new Map<string, { userName: string; timestamp: number }>();
    const unsubscribers: Array<() => void> = [];

    // Clean up stale indicators periodically
    const cleanupInterval = setInterval(() => {
        const now = Date.now();
        let changed = false;

        typersMap.forEach((data, oderId) => {
            if (now - data.timestamp > TYPING_TIMEOUT) {
                typersMap.delete(oderId);
                changed = true;
            }
        });

        if (changed) {
            emitStatus();
        }
    }, 1000);

    const emitStatus = () => {
        const users = Array.from(typersMap.entries())
            .filter(([oderId]) => oderId !== currentUserId)
            .map(([oderId, data]) => ({ userId: oderId, userName: data.userName }));

        onTypingChange({
            isTyping: users.length > 0,
            users,
        });
    };

    // For now, we'll use a simpler approach - subscribe to the typing collection
    // and filter client-side
    const { collection, query, where } = require("firebase/firestore");

    const typingQuery = query(
        collection(db, "typingIndicators"),
        where("chatType", "==", "group"),
        where("chatId", "==", eventId)
    );

    const unsubscribe = onSnapshot(typingQuery, (snapshot) => {
        typersMap.clear();

        snapshot.docs.forEach((doc) => {
            const data = doc.data();
            if (data.userId !== currentUserId) {
                const timestamp = data.timestamp?.toDate?.()?.getTime() || Date.now();
                if (Date.now() - timestamp < TYPING_TIMEOUT) {
                    typersMap.set(data.userId, {
                        userName: data.userName,
                        timestamp,
                    });
                }
            }
        });

        emitStatus();
    });

    unsubscribers.push(unsubscribe);

    return () => {
        clearInterval(cleanupInterval);
        unsubscribers.forEach((unsub) => unsub());
    };
}

// Subscribe to typing indicators for DM
export function subscribeToDMTyping(
    conversationId: string,
    currentUserId: string,
    onTypingChange: (isTyping: boolean, userName?: string) => void
): () => void {
    const db = getFirebaseDb();

    const { collection, query, where } = require("firebase/firestore");

    const typingQuery = query(
        collection(db, "typingIndicators"),
        where("chatType", "==", "dm"),
        where("chatId", "==", conversationId)
    );

    return onSnapshot(typingQuery, (snapshot) => {
        let otherTyping = false;
        let otherName = "";

        snapshot.docs.forEach((doc) => {
            const data = doc.data();
            if (data.userId !== currentUserId) {
                const timestamp = data.timestamp?.toDate?.()?.getTime() || Date.now();
                if (Date.now() - timestamp < TYPING_TIMEOUT) {
                    otherTyping = true;
                    otherName = data.userName;
                }
            }
        });

        onTypingChange(otherTyping, otherName);
    });
}

// Hook-style typing handler for text input
export function createTypingHandler(
    setTyping: (isTyping: boolean) => Promise<void>
): {
    onChangeText: () => void;
    onBlur: () => void;
} {
    let typingTimeout: NodeJS.Timeout | null = null;
    let isCurrentlyTyping = false;

    const onChangeText = () => {
        // Set typing to true
        if (!isCurrentlyTyping) {
            isCurrentlyTyping = true;
            setTyping(true);
        }

        // Clear existing timeout
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }

        // Set timeout to clear typing status
        typingTimeout = setTimeout(() => {
            isCurrentlyTyping = false;
            setTyping(false);
        }, 2000);
    };

    const onBlur = () => {
        // Clear typing when input loses focus
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }
        if (isCurrentlyTyping) {
            isCurrentlyTyping = false;
            setTyping(false);
        }
    };

    return { onChangeText, onBlur };
}

// Format typing indicator text
export function formatTypingText(users: Array<{ userName: string }>): string {
    if (users.length === 0) return "";
    if (users.length === 1) return `${users[0].userName} is typing...`;
    if (users.length === 2) return `${users[0].userName} and ${users[1].userName} are typing...`;
    return `${users[0].userName} and ${users.length - 1} others are typing...`;
}
