// Private DM Service via API Gateway
import { canInitiateDM } from "./entitlements";
import { PrivateConversation, DirectMessage } from "./types";

import { apiFetch } from "@/lib/api";

// Get or check existing conversation
export async function getExistingConversation(
    userId1: string,
    userId2: string,
    eventId: string
): Promise<PrivateConversation | null> {
    try {
        const response = await apiFetch<{ conversations: PrivateConversation[] }>(
            `/api/v1/social/dm/conversations/${eventId}`,
            { requireAuth: true }
        );
        return response.conversations.find(c => c.participants.includes(userId2)) || null;
    } catch (error) {
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
        const response = await apiFetch<any>("/api/v1/social/dm/request", {
            method: "POST",
            body: JSON.stringify({ recipientId, eventId }),
            requireAuth: true,
        });
        return response;
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Accept DM request
export async function acceptDMRequest(
    conversationId: string,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        return await apiFetch(`/api/v1/social/dm/${conversationId}/accept`, {
            method: "POST",
            requireAuth: true
        });
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
        return await apiFetch(`/api/v1/social/dm/${conversationId}/decline`, {
            method: "POST",
            requireAuth: true
        });
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Block user
export async function blockUser(
    blockerId: string,
    blockedId: string,
    eventId?: string,
    isGlobal: boolean = false
): Promise<{ success: boolean; error?: string }> {
    try {
        return await apiFetch("/api/v1/social/block", {
            method: "POST",
            body: JSON.stringify({ targetUid: blockedId, eventId, isGlobal }),
            requireAuth: true
        });
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
        return await apiFetch(`/api/v1/social/dm/${conversationId}/send`, {
            method: "POST",
            body: JSON.stringify({ text: content }),
            requireAuth: true
        });
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Send an image message
export async function sendDirectImageMessage(
    conversationId: string,
    senderId: string,
    imageUrl: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        return await apiFetch(`/api/v1/social/dm/${conversationId}/send`, {
            method: "POST",
            body: JSON.stringify({ imageUrl }),
            requireAuth: true
        });
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Subscribe to DM messages via Polling
export function subscribeToDirectMessages(
    conversationId: string,
    onMessages: (messages: DirectMessage[]) => void,
    messageLimit: number = 100
): () => void {
    let active = true;

    async function poll() {
        if (!active) return;
        try {
            const response = await apiFetch<{ messages: DirectMessage[] }>(
                `/api/v1/social/dm/${conversationId}/messages?limit=${messageLimit}`,
                { requireAuth: true }
            );
            if (active && response.messages) {
                // Return reversed to match UI expectation (oldest first)
                onMessages([...response.messages].reverse());
            }
        } catch (e) {}
    }

    poll();
    const intervalId = setInterval(poll, 5000); // 5s poll

    return () => {
        active = false;
        clearInterval(intervalId);
    };
}

// Get user's DM conversations for an event
export async function getUserEventConversations(
    userId: string,
    eventId: string
): Promise<PrivateConversation[]> {
    try {
        const response = await apiFetch<{ conversations: PrivateConversation[] }>(
            `/api/v1/social/dm/conversations/${eventId}`,
            { requireAuth: true }
        );
        return response.conversations || [];
    } catch (error) {
        return [];
    }
}

// Get pending DM requests
export async function getPendingDMRequests(
    userId: string
): Promise<PrivateConversation[]> {
    try {
        const response = await apiFetch<{ requests: PrivateConversation[] }>(
            "/api/v1/social/dm/requests",
            { requireAuth: true }
        );
        return response.requests || [];
    } catch (error) {
        return [];
    }
}

// Save contact
export async function saveContact(
    userId: string,
    contactUserId: string,
    contactName: string,
    eventId: string,
    eventTitle: string,
    contactAvatar?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        return await apiFetch("/api/v1/social/contacts", {
            method: "POST",
            body: JSON.stringify({ contactUserId, contactName, eventId, eventTitle, contactAvatar }),
            requireAuth: true
        });
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Get saved contacts
export async function getSavedContacts(userId: string): Promise<any[]> {
    try {
        const response = await apiFetch<{ contacts: any[] }>("/api/v1/social/contacts", {
            requireAuth: true
        });
        return response.contacts || [];
    } catch (error) {
        return [];
    }
}
