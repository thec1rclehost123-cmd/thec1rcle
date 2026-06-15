// Event Group Chat Service via API Gateway
import { GroupMessage, EventPhase, getEventPhase } from "./types";

import { apiFetch } from "@/lib/api";

/**
 * Get or create event group chat status.
 * Routes through the API Gateway.
 */
export async function getEventGroupChat(eventId: string): Promise<{
    enabled: boolean;
    phase: EventPhase;
    participantCount: number;
}> {
    if (!eventId || typeof eventId !== "string") {
        return { enabled: false, phase: "expired", participantCount: 0 };
    }
    try {
        const event = await apiFetch<any>(`/api/v1/events/${eventId}`, { requireAuth: false });
        if (!event) return { enabled: false, phase: "expired", participantCount: 0 };

        const eventDate = new Date(event.startDate);
        const phase = getEventPhase(eventDate);

        return {
            enabled: phase !== "expired",
            phase,
            participantCount: event.stats?.rsvps || 0,
        };
    } catch (error) {
        console.error("Error getting group chat status:", error);
        return { enabled: false, phase: "expired", participantCount: 0 };
    }
}

/**
 * Send message to event group chat.
 * Uses: POST /api/v1/social/chat
 */
export async function sendGroupMessage(
    eventId: string,
    userId: string,
    userName: string,
    content: string,
    userAvatar?: string,
    userBadge?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        const response = await apiFetch<any>("/api/v1/social/chat", {
            method: "POST",
            body: JSON.stringify({
                eventId,
                text: content,
                metadata: {
                    senderAvatar: userAvatar,
                    senderBadge: userBadge
                }
            }),
            requireAuth: true,
        });

        return { success: true, messageId: response.id };
    } catch (error: any) {
        console.error("Error sending group message:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Send image message to event group chat.
 */
export async function sendGroupImageMessage(
    eventId: string,
    userId: string,
    userName: string,
    imageUrl: string,
    userAvatar?: string,
    userBadge?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        const response = await apiFetch<any>("/api/v1/social/chat", {
            method: "POST",
            body: JSON.stringify({
                eventId,
                imageUrl,
                metadata: {
                    senderAvatar: userAvatar,
                    senderBadge: userBadge
                }
            }),
            requireAuth: true,
        });

        return { success: true, messageId: response.id };
    } catch (error: any) {
        console.error("Error sending group image:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Send announcement (hosts/venues only).
 */
export async function sendAnnouncement(
    eventId: string,
    userId: string,
    userName: string,
    content: string,
    badge: "host" | "venue"
): Promise<{ success: boolean; error?: string }> {
    try {
        await apiFetch<any>("/api/v1/social/chat", {
            method: "POST",
            body: JSON.stringify({
                eventId,
                text: content,
                metadata: {
                    senderBadge: badge,
                    isAnnouncement: true
                }
            }),
            requireAuth: true,
        });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Subscribe to group chat messages via polling.
 */
export function subscribeToGroupChat(
    eventId: string,
    onMessages: (messages: GroupMessage[]) => void,
    messageLimit: number = 100
): () => void {
    let active = true;

    async function poll() {
        if (!active) return;
        try {
            const response = await apiFetch<{ messages: GroupMessage[] }>(
                `/api/v1/social/chat/${eventId}?limit=${messageLimit}`,
                { requireAuth: false }
            );
            if (active && response.messages) {
                onMessages(response.messages);
            }
        } catch (e) {
            // Polling error, ignore
        }
    }

    poll();
    const intervalId = setInterval(poll, 5000); // 5s polling for messages

    return () => {
        active = false;
        clearInterval(intervalId);
    };
}

/**
 * Delete message (moderators only).
 */
export async function deleteGroupMessage(
    messageId: string,
    deletedByUserId: string
): Promise<{ success: boolean; error?: string }> {
    // Note: Need to implement DELETE route in Gateway if needed
    try {
        await apiFetch(`/api/v1/social/chat/${messageId}`, {
            method: "DELETE",
            requireAuth: true
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Get recent messages (for initial load).
 */
export async function getRecentGroupMessages(
    eventId: string,
    messageLimit: number = 50
): Promise<GroupMessage[]> {
    try {
        const response = await apiFetch<{ messages: GroupMessage[] }>(
            `/api/v1/social/chat/${eventId}?limit=${messageLimit}`,
            { requireAuth: false }
        );
        return response.messages || [];
    } catch (error) {
        console.error("Error fetching group messages:", error);
        return [];
    }
}
