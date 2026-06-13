// Event Entitlement Service - Access Control for Social Features via API Gateway
import { apiFetch } from "@/lib/api";
import { EventEntitlement } from "./types";

/**
 * Check if user has valid entitlement for event.
 * Now routes through the API Gateway.
 */
export async function checkEventEntitlement(
    userId: string,
    eventId: string
): Promise<EventEntitlement | null> {
    try {
        const response = await apiFetch<{ entitlement: EventEntitlement | null }>(
            `/api/v1/social/entitlement/${eventId}`,
            { requireAuth: true }
        );
        return response.entitlement;
    } catch (error) {
        console.error("Error checking entitlement:", error);
        return null;
    }
}

/**
 * Subscribe to entitlement changes (polling fallback).
 */
export function subscribeToEntitlement(
    userId: string,
    eventId: string,
    onUpdate: (entitlement: EventEntitlement | null) => void
): () => void {
    let active = true;

    async function poll() {
        if (!active) return;
        const result = await checkEventEntitlement(userId, eventId);
        if (active) onUpdate(result);
    }

    poll();
    const intervalId = setInterval(poll, 30000); // 30s polling for tickets

    return () => {
        active = false;
        clearInterval(intervalId);
    };
}

/**
 * Get all attendees for an event (via API Gateway).
 * Note: Need to implement /api/v1/social/attendees/:eventId in gateway later if needed.
 * For now, using a placeholder or existing event logic.
 */
export async function getEventAttendees(
    eventId: string,
    limit: number = 50
): Promise<Array<{ userId: string; name: string; avatar?: string; badge?: string }>> {
    try {
        // Fallback or implementation of attendee list via Gateway
        const response = await apiFetch<{ attendees: any[] }>(
            `/api/v1/events/${eventId}/attendees?limit=${limit}`,
            { requireAuth: false }
        );
        return response.attendees || [];
    } catch (error) {
        console.error("Error fetching attendees:", error);
        return [];
    }
}

/**
 * Get attendee count for event (via API Gateway).
 */
export async function getAttendeeCount(eventId: string): Promise<number> {
    try {
        const event = await apiFetch<any>(`/api/v1/events/${eventId}`, { requireAuth: false });
        return event?.stats?.rsvps || 0;
    } catch (error) {
        console.error("Error counting attendees:", error);
        return 0;
    }
}

/**
 * Verify two users can DM.
 * Routes block check and entitlement through Gateway.
 */
export async function canInitiateDM(
    senderId: string,
    recipientId: string,
    eventId: string
): Promise<{ allowed: boolean; reason?: string }> {
    try {
        const response = await apiFetch<{ allowed: boolean, reason?: string }>(
            `/api/v1/social/can-dm`,
            {
                method: 'POST',
                body: JSON.stringify({ recipientId, eventId }),
                requireAuth: true
            }
        );
        return response;
    } catch (error: any) {
        console.error("Error checking DM permissions:", error);
        return { allowed: false, reason: "Unable to verify permissions" };
    }
}
