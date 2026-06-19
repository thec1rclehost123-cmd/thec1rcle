// Event Group Chat Service via API Gateway
// Uses WebSocket for real-time delivery with polling fallback.
import { AppState } from 'react-native';
import { apiFetch } from '@/lib/api';
import { wsManager, type WSMessage } from '@/lib/websocket';
import { GroupMessage, EventPhase, getEventPhase } from './types';

// Client-side rate limiting for group chat messages (debounce 500ms)
let lastGroupMessageTime = 0;
export function canSendGroupMessage(): boolean {
  const now = Date.now();
  if (now - lastGroupMessageTime < 500) return false;
  lastGroupMessageTime = now;
  return true;
}

/**
 * Get or create event group chat status.
 * Routes through the API Gateway.
 */
export async function getEventGroupChat(eventId: string): Promise<{
  enabled: boolean;
  phase: EventPhase;
  participantCount: number;
}> {
  if (!eventId || typeof eventId !== 'string') {
    return { enabled: false, phase: 'expired', participantCount: 0 };
  }
  try {
    const event = await apiFetch<any>(`/api/v1/events/${eventId}`, { requireAuth: false });
    if (!event) return { enabled: false, phase: 'expired', participantCount: 0 };

    const eventDate = new Date(event.startDate);
    const phase = getEventPhase(eventDate);

    return {
      enabled: phase !== 'expired',
      phase,
      participantCount: event.stats?.rsvps || 0,
    };
  } catch (error) {
    console.error('Error getting group chat status:', error);
    return { enabled: false, phase: 'expired', participantCount: 0 };
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
  userBadge?: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await apiFetch<any>('/api/v1/social/chat', {
      method: 'POST',
      body: JSON.stringify({
        eventId,
        text: content,
        metadata: {
          senderAvatar: userAvatar,
          senderBadge: userBadge,
        },
      }),
      requireAuth: true,
    });

    return { success: true, messageId: response.id };
  } catch (error: any) {
    console.error('Error sending group message:', error);
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
  userBadge?: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await apiFetch<any>('/api/v1/social/chat', {
      method: 'POST',
      body: JSON.stringify({
        eventId,
        imageUrl,
        metadata: {
          senderAvatar: userAvatar,
          senderBadge: userBadge,
        },
      }),
      requireAuth: true,
    });

    return { success: true, messageId: response.id };
  } catch (error: any) {
    console.error('Error sending group image:', error);
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
  badge: 'host' | 'venue',
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiFetch<any>('/api/v1/social/chat', {
      method: 'POST',
      body: JSON.stringify({
        eventId,
        text: content,
        metadata: {
          senderBadge: badge,
          isAnnouncement: true,
        },
      }),
      requireAuth: true,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Subscribe to group chat messages.
 * Uses WebSocket for real-time delivery, falls back to 5s polling.
 */
export function subscribeToGroupChat(
  eventId: string,
  onMessages: (messages: GroupMessage[]) => void,
  messageLimit: number = 100,
): () => void {
  let active = true;
  let unsubscribeWS: (() => void) | null = null;
  let pollIntervalId: ReturnType<typeof setInterval> | null = null;

  // WebSocket handler
  const wsHandler = (msg: WSMessage) => {
    if (!active) return;
    if (msg.type === 'chat:new_message' && msg.payload?.eventId === eventId) {
      // Single new message received via WS — fetch latest batch
      pollOnce();
    }
  };

  // Subscribe via WebSocket if connected
  if (wsManager.isConnected) {
    unsubscribeWS = wsManager.subscribe(`event:${eventId}`, wsHandler);
  } else {
    // Listen for WS connection and subscribe then
    const connectHandler = () => {
      if (active) {
        unsubscribeWS = wsManager.subscribe(`event:${eventId}`, wsHandler);
      }
    };
    // Check periodically for WS connection
    const connectCheck = setInterval(() => {
      if (wsManager.isConnected && !unsubscribeWS) {
        unsubscribeWS = wsManager.subscribe(`event:${eventId}`, wsHandler);
        clearInterval(connectCheck);
      }
    }, 1000);
    setTimeout(() => clearInterval(connectCheck), 10000);
  }

  async function pollOnce() {
    if (!active) return;
    if (AppState.currentState !== 'active') return;
    try {
      const response = await apiFetch<{ messages: GroupMessage[] }>(
        `/api/v1/social/chat/${eventId}?limit=${messageLimit}`,
        { requireAuth: false },
      );
      if (active && response.messages) {
        onMessages(response.messages);
      }
    } catch (e) {
      // Polling error, ignore
    }
  }

  // Initial fetch
  pollOnce();

  // Polling fallback (every 5s) — keeps working even without WS
  pollIntervalId = setInterval(pollOnce, 5000);

  return () => {
    active = false;
    if (unsubscribeWS) unsubscribeWS();
    if (pollIntervalId) clearInterval(pollIntervalId);
  };
}

/**
 * Delete message (moderators only).
 */
export async function deleteGroupMessage(
  messageId: string,
  deletedByUserId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiFetch(`/api/v1/social/chat/${messageId}`, {
      method: 'DELETE',
      requireAuth: true,
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
  messageLimit: number = 50,
): Promise<GroupMessage[]> {
  try {
    const response = await apiFetch<{ messages: GroupMessage[] }>(
      `/api/v1/social/chat/${eventId}?limit=${messageLimit}`,
      { requireAuth: false },
    );
    return response.messages || [];
  } catch (error) {
    console.error('Error fetching group messages:', error);
    return [];
  }
}
