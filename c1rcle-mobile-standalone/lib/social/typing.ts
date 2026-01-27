// Real-time Typing Indicators Service (Optimized with RTDB)
import {
    ref,
    set,
    remove,
    onValue,
    off,
    serverTimestamp,
} from "firebase/database";
import { getRealtimeDb } from "@/lib/firebase";

// Typing indicator data
export interface TypingIndicator {
    userId: string;
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
const TYPING_DEBOUNCE = 2000;

// Track last typing update in memory to avoid redundant network hits
const lastTypingUpdate: Record<string, number> = {};

/**
 * Set typing status for group chat (RTDB implementation)
 * RTDB is chosen for typing because it's significantly cheaper for high-frequency updates.
 */
export async function setGroupTypingStatus(
    eventId: string,
    userId: string,
    userName: string,
    isTyping: boolean
): Promise<void> {
    try {
        const db = getRealtimeDb();
        const typingRef = ref(db, `typingIndicators/group/${eventId}/${userId}`);

        if (isTyping) {
            const now = Date.now();
            const key = `group_${eventId}_${userId}`;

            // Only update if we haven't sent an update in the last 2 seconds
            if (lastTypingUpdate[key] && now - lastTypingUpdate[key] < TYPING_DEBOUNCE) {
                return;
            }
            lastTypingUpdate[key] = now;

            await set(typingRef, {
                userId,
                userName,
                timestamp: serverTimestamp(),
            });

            // Fallback auto-remove for safety (onDisconnect is handled by the server normally)
            setTimeout(async () => {
                try {
                    await remove(typingRef);
                } catch { }
            }, TYPING_TIMEOUT);
        } else {
            await remove(typingRef);
        }
    } catch (error) {
        console.debug("Typing indicator error:", error);
    }
}

/**
 * Set typing status for DM (RTDB implementation)
 */
export async function setDMTypingStatus(
    conversationId: string,
    userId: string,
    userName: string,
    isTyping: boolean
): Promise<void> {
    try {
        const db = getRealtimeDb();
        const typingRef = ref(db, `typingIndicators/dm/${conversationId}/${userId}`);

        if (isTyping) {
            const now = Date.now();
            const key = `dm_${conversationId}_${userId}`;
            if (lastTypingUpdate[key] && now - lastTypingUpdate[key] < TYPING_DEBOUNCE) {
                return;
            }
            lastTypingUpdate[key] = now;

            await set(typingRef, {
                userId,
                userName,
                timestamp: serverTimestamp(),
            });

            setTimeout(async () => {
                try {
                    await remove(typingRef);
                } catch { }
            }, TYPING_TIMEOUT);
        } else {
            await remove(typingRef);
        }
    } catch (error) {
        console.debug("Typing indicator error:", error);
    }
}

/**
 * Subscribe to typing indicators for group chat (RTDB implementation)
 * This avoids the massive "Read Cost" spike that Firestore would trigger.
 */
export function subscribeToGroupTyping(
    eventId: string,
    currentUserId: string,
    onTypingChange: (status: TypingStatus) => void
): () => void {
    const db = getRealtimeDb();
    const typingRef = ref(db, `typingIndicators/group/${eventId}`);

    const handleValue = (snapshot: any) => {
        const data = snapshot.val();
        if (!data) {
            onTypingChange({ isTyping: false, users: [] });
            return;
        }

        const now = Date.now();
        const activeUsers: Array<{ userId: string; userName: string }> = [];

        Object.keys(data).forEach((userId) => {
            if (userId === currentUserId) return;

            const userTyping = data[userId];
            // Safety check for stale data (though RTDB is usually very fresh)
            const timestamp = userTyping.timestamp || now;

            if (now - timestamp < TYPING_TIMEOUT) {
                activeUsers.push({
                    userId,
                    userName: userTyping.userName,
                });
            }
        });

        onTypingChange({
            isTyping: activeUsers.length > 0,
            users: activeUsers,
        });
    };

    onValue(typingRef, handleValue);

    return () => off(typingRef, 'value', handleValue);
}

/**
 * Subscribe to typing indicators for DM (RTDB implementation)
 */
export function subscribeToDMTyping(
    conversationId: string,
    currentUserId: string,
    onTypingChange: (isTyping: boolean, userName?: string) => void
): () => void {
    const db = getRealtimeDb();
    const typingRef = ref(db, `typingIndicators/dm/${conversationId}`);

    const handleValue = (snapshot: any) => {
        const data = snapshot.val();
        if (!data) {
            onTypingChange(false);
            return;
        }

        let otherTyping = false;
        let otherName = "";
        const now = Date.now();

        Object.keys(data).forEach((userId) => {
            if (userId === currentUserId) return;

            const userTyping = data[userId];
            const timestamp = userTyping.timestamp || now;

            if (now - timestamp < TYPING_TIMEOUT) {
                otherTyping = true;
                otherName = userTyping.userName;
            }
        });

        onTypingChange(otherTyping, otherName);
    };

    onValue(typingRef, handleValue);

    return () => off(typingRef, 'value', handleValue);
}

/**
 * Helper to clear own typing on app background/disconnect
 */
export async function clearOwnTyping(userId: string) {
    try {
        const db = getRealtimeDb();
        // Since we don't know all active chats here easily without state,
        // this is more of a placeholder for where onDisconnect() would be set up.
        // In a full implementation, we'd use onDisconnect().remove() when setting the status.
    } catch (e) {
        console.error("Error clearing typing status:", e);
    }
}

// Utility functions for text input remain the same
export function formatTypingText(users: Array<{ userName: string }>): string {
    if (users.length === 0) return "";
    if (users.length === 1) return `${users[0].userName} is typing...`;
    if (users.length === 2) return `${users[0].userName} and ${users[1].userName} are typing...`;
    return `${users[0].userName} and ${users.length - 1} others are typing...`;
}

export function createTypingHandler(
    setTyping: (isTyping: boolean) => Promise<void>
): {
    onChangeText: () => void;
    onBlur: () => void;
} {
    let typingTimeout: NodeJS.Timeout | null = null;
    let isCurrentlyTyping = false;

    const onChangeText = () => {
        if (!isCurrentlyTyping) {
            isCurrentlyTyping = true;
            setTyping(true).catch(e => console.error(e));
        }

        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }

        typingTimeout = setTimeout(() => {
            isCurrentlyTyping = false;
            setTyping(false).catch(e => console.error(e));
        }, 2000) as any;
    };

    const onBlur = () => {
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
