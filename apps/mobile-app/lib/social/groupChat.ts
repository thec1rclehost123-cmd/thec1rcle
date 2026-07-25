// Event Group Chat Service via API Gateway
// Uses WebSocket for real-time delivery with polling fallback.
import { AppState } from 'react-native';
import { apiFetch } from '@/lib/api';
import { wsManager, type WSMessage } from '@/lib/websocket';
import { GroupMessage, EventPhase, getEventPhase } from './types';

// Client-side rate limiting for group chat messages (debounce 500ms)
let lastGroupMessageTime = 0;
const MESSAGE_LIMIT_MAX = 50;
const FALLBACK_POLL_INTERVAL_MS = 30_000;
const INBOX_FALLBACK_POLL_INTERVAL_MS = 120_000;

export function canSendGroupMessage(): boolean {
  const now = Date.now();
  if (now - lastGroupMessageTime < 500) return false;
  lastGroupMessageTime = now;
  return true;
}

function clampMessageLimit(limit: number): number {
  return Math.max(1, Math.min(Number(limit) || MESSAGE_LIMIT_MAX, MESSAGE_LIMIT_MAX));
}

function toTime(value: any): number {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function toDate(value: any): Date | null {
  const time = toTime(value);
  return time > 0 ? new Date(time) : null;
}

function unwrapEventDetail(payload: any): any {
  return payload?.event || payload?.data?.event || payload?.data || payload;
}

function getEventStartDate(event: any): Date | null {
  return (
    toDate(event?.startDate) ||
    toDate(event?.startAt) ||
    toDate(event?.startsAt) ||
    toDate(event?.startDateTime) ||
    toDate(event?.eventDate) ||
    toDate(event?.date)
  );
}

function normalizeGroupMessage(raw: any, eventId: string): GroupMessage | null {
  const id = raw?.id || raw?.messageId;
  if (!id) return null;
  const metadata =
    raw?.metadata && typeof raw.metadata === 'object' ? (raw.metadata as Record<string, any>) : {};
  const rawType = String(raw?.type || '').toLowerCase();
  const type: GroupMessage['type'] =
    rawType === 'announcement' || metadata.isAnnouncement
      ? 'announcement'
      : rawType === 'system'
        ? 'system'
        : rawType === 'image' || raw?.imageUrl
          ? 'image'
          : 'text';

  return {
    id: String(id),
    eventId: String(raw?.eventId || eventId),
    senderId: String(raw?.senderId || raw?.userId || ''),
    senderName: String(raw?.senderName || raw?.userName || 'Attendee'),
    senderAvatar: raw?.senderAvatar || raw?.senderPhoto || metadata.senderAvatar,
    senderBadge: raw?.senderBadge || metadata.senderBadge,
    content: String(raw?.content || raw?.text || raw?.imageUrl || raw?.videoUrl || ''),
    type,
    createdAt: raw?.createdAt || new Date().toISOString(),
    isDeleted: raw?.isDeleted === true,
    deletedBy: raw?.deletedBy,
    replyTo: raw?.replyTo || raw?.replyToId,
  };
}

function mergeMessages(
  currentMessages: GroupMessage[],
  incomingMessages: GroupMessage[],
  limit: number,
): GroupMessage[] {
  const byId = new Map<string, GroupMessage>();
  [...currentMessages, ...incomingMessages].forEach((message) => byId.set(message.id, message));
  return [...byId.values()]
    .sort((left, right) => toTime(left.createdAt) - toTime(right.createdAt))
    .slice(-limit);
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
    const eventDetail = await apiFetch<any>(`/api/v1/events/${eventId}`, { requireAuth: false });
    const event = unwrapEventDetail(eventDetail);
    if (!event) return { enabled: true, phase: 'pre-event', participantCount: 0 };

    const eventDate = getEventStartDate(event);
    const phase = getEventPhase(eventDate || new Date(Number.NaN));

    return {
      enabled: phase !== 'not-open',
      phase,
      participantCount: event.stats?.rsvps || event.stats?.interested || event.attendeeCount || 0,
    };
  } catch (error) {
    if (__DEV__) console.error('Error getting group chat status:', error);
    return { enabled: true, phase: 'pre-event', participantCount: 0 };
  }
}

/**
 * Send message to event group chat.
 * Uses the canonical /api/v1/chats writer.
 */
export async function sendGroupMessage(
  eventId: string,
  userId: string,
  userName: string,
  content: string,
  userAvatar?: string,
  userBadge?: string,
  replyToId?: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await apiFetch<any>(`/api/v1/chats/${encodeURIComponent(eventId)}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        text: content,
        replyToId,
      }),
      requireAuth: true,
    });

    return { success: true, messageId: response.data?.message?.id || response.message?.id };
  } catch (error: any) {
    if (__DEV__) console.error('Error sending group message:', error);
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
    const response = await apiFetch<any>(`/api/v1/chats/${encodeURIComponent(eventId)}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        imageUrl,
        type: 'image',
      }),
      requireAuth: true,
    });

    return { success: true, messageId: response.data?.message?.id || response.message?.id };
  } catch (error: any) {
    if (__DEV__) console.error('Error sending group image:', error);
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
    await apiFetch<any>(`/api/v1/chats/${encodeURIComponent(eventId)}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        text: content,
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
 * Uses WebSocket for real-time delivery, falls back to slow polling.
 */
export function subscribeToGroupChat(
  eventId: string,
  onMessages: (messages: GroupMessage[]) => void,
  messageLimit: number = 50,
  initialMessages: GroupMessage[] = [],
  enablePolling: boolean = true,
): () => void {
  let active = true;
  let unsubscribeWS: (() => void) | null = null;
  let pollIntervalId: ReturnType<typeof setInterval> | null = null;
  let connectCheck: ReturnType<typeof setInterval> | null = null;
  const safeMessageLimit = clampMessageLimit(messageLimit);
  let latestMessages: GroupMessage[] = initialMessages.slice(-safeMessageLimit);

  function publishMessages(nextMessages: GroupMessage[]) {
    latestMessages = nextMessages.slice(-safeMessageLimit);
    onMessages(latestMessages);
  }

  // WebSocket handler
  const wsHandler = (msg: WSMessage) => {
    if (!active) return;
    if (msg.type === 'chat:new_message' && msg.payload?.eventId === eventId) {
      const nextMessage = normalizeGroupMessage(msg.payload.message || msg.payload, eventId);
      if (nextMessage) {
        publishMessages(mergeMessages(latestMessages, [nextMessage], safeMessageLimit));
      }
    }
  };

  // Subscribe via WebSocket if connected
  if (wsManager.isConnected) {
    unsubscribeWS = wsManager.subscribe(`event-chat:${eventId}`, wsHandler);
  } else {
    // Check periodically for WS connection
    connectCheck = setInterval(() => {
      if (wsManager.isConnected && !unsubscribeWS) {
        unsubscribeWS = wsManager.subscribe(`event-chat:${eventId}`, wsHandler);
        if (connectCheck) clearInterval(connectCheck);
        connectCheck = null;
      }
    }, 1000);
    setTimeout(() => {
      if (connectCheck) {
        clearInterval(connectCheck);
        connectCheck = null;
      }
    }, 10000);
  }

  async function pollOnce() {
    if (!active) return;
    if (AppState.currentState !== 'active') return;
    try {
      const response = await apiFetch<{
        data?: { messages: GroupMessage[] };
        messages?: GroupMessage[];
      }>(`/api/v1/chats/${encodeURIComponent(eventId)}/messages?limit=${safeMessageLimit}`, {
        requireAuth: true,
      });
      const responseMessages = response.data?.messages || response.messages;
      if (active && responseMessages) {
        publishMessages(
          mergeMessages(
            latestMessages,
            responseMessages
              .map((message) => normalizeGroupMessage(message, eventId))
              .filter((message): message is GroupMessage => Boolean(message)),
            safeMessageLimit,
          ),
        );
      }
    } catch {
      // Polling error, ignore
    }
  }

  // The websocket is authoritative while connected. Poll only as a fallback,
  // otherwise every open chat causes a redundant Firestore-backed request.
  if (enablePolling && initialMessages.length === 0 && !wsManager.isConnected) {
    pollOnce();
  }

  // Slow polling fallback with jitter to prevent thundering herd when many chats are active.
  const jitterMs = Math.random() * 10_000;
  const fallbackInterval =
    safeMessageLimit === 1 ? INBOX_FALLBACK_POLL_INTERVAL_MS : FALLBACK_POLL_INTERVAL_MS;
  if (enablePolling) {
    pollIntervalId = setInterval(() => {
      if (!wsManager.isConnected) void pollOnce();
    }, fallbackInterval + jitterMs);
  }

  return () => {
    active = false;
    if (unsubscribeWS) unsubscribeWS();
    if (pollIntervalId) clearInterval(pollIntervalId);
    if (connectCheck) {
      clearInterval(connectCheck);
      connectCheck = null;
    }
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
    const safeMessageLimit = clampMessageLimit(messageLimit);
    const response = await apiFetch<{
      data?: { messages: GroupMessage[] };
      messages?: GroupMessage[];
    }>(`/api/v1/chats/${encodeURIComponent(eventId)}/messages?limit=${safeMessageLimit}`, {
      requireAuth: true,
    });
    return mergeMessages(
      [],
      (response.data?.messages || response.messages || [])
        .map((message) => normalizeGroupMessage(message, eventId))
        .filter((message): message is GroupMessage => Boolean(message)),
      safeMessageLimit,
    );
  } catch (error) {
    if (__DEV__) console.error('Error fetching group messages:', error);
    return [];
  }
}
