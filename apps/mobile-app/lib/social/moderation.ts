// Moderation and Safety Service via API Gateway
import { UserReport, UserBlock } from "./types";

import { apiFetch } from "@/lib/api";

/**
 * Report a user via API Gateway.
 */
export async function reportUser(
    reporterId: string,
    reportedId: string,
    category: UserReport["category"],
    description?: string,
    eventId?: string,
    messageId?: string
): Promise<{ success: boolean; reportId?: string; error?: string }> {
    try {
        const response = await apiFetch<any>("/api/v1/social/report", {
            method: "POST",
            body: JSON.stringify({
                targetId: reportedId,
                targetType: "user",
                reason: category,
                details: description,
                metadata: { eventId, messageId }
            }),
            requireAuth: true,
        });

        return { success: true, reportId: response.reportId };
    } catch (error: any) {
        console.error("Error reporting user:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Check if user is blocked (client-side check against cached block list).
 */
export async function isUserBlocked(
    userId: string,
    otherUserId: string
): Promise<boolean> {
    try {
        const response = await apiFetch<{ blockedUserIds: string[] }>("/api/v1/social/blocks", {
            requireAuth: true
        });
        return response.blockedUserIds.includes(otherUserId);
    } catch (error) {
        console.error("Error checking block status:", error);
        return false;
    }
}

/**
 * Get blocked users list via API Gateway.
 */
export async function getBlockedUsers(userId: string): Promise<string[]> {
    try {
        const response = await apiFetch<{ blockedUserIds: string[] }>("/api/v1/social/blocks", {
            requireAuth: true
        });
        return response.blockedUserIds;
    } catch (error) {
        console.error("Error fetching blocked users:", error);
        return [];
    }
}

/**
 * Unblock user via API Gateway.
 */
export async function unblockUser(
    blockerId: string,
    blockedId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await apiFetch("/api/v1/social/unblock", {
            method: "POST",
            body: JSON.stringify({ targetUid: blockedId }),
            requireAuth: true
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Mute user in event chat.
 */
export async function muteUserInEvent(
    eventId: string,
    userId: string,
    mutedByUserId: string,
    durationMinutes: number = 60
): Promise<{ success: boolean; error?: string }> {
    try {
        await apiFetch("/api/v1/social/mute", {
            method: "POST",
            body: JSON.stringify({ eventId, targetUid: userId, durationMinutes }),
            requireAuth: true
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Check if user is muted (polling fallback).
 */
export async function isUserMutedInEvent(
    eventId: string,
    userId: string
): Promise<boolean> {
    try {
        const response = await apiFetch<{ isMuted: boolean }>(
            `/api/v1/social/is-muted/${eventId}`,
            { requireAuth: true }
        );
        return response.isMuted;
    } catch (error) {
        return false;
    }
}

/**
 * Remove user from event chat.
 */
export async function removeUserFromEventChat(
    eventId: string,
    userId: string,
    removedByUserId: string,
    reason?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await apiFetch("/api/v1/social/remove-from-chat", {
            method: "POST",
            body: JSON.stringify({ eventId, targetUid: userId, reason }),
            requireAuth: true
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Check if user is removed from event chat.
 */
export async function isUserRemovedFromEventChat(
    eventId: string,
    userId: string
): Promise<boolean> {
    try {
        const response = await apiFetch<{ isRemoved: boolean }>(
            `/api/v1/social/is-removed/${eventId}`,
            { requireAuth: true }
        );
        return response.isRemoved;
    } catch (error) {
        return false;
    }
}
