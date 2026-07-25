// Private DM Service via API Gateway
// Uses WebSocket for real-time delivery with polling fallback.
import { AppState } from 'react-native';
import { apiFetch } from '@/lib/api';
import { wsManager, type WSMessage } from '@/lib/websocket';
import { PrivateConversation, DirectMessage } from './types';

const MESSAGE_LIMIT_MAX = 50;
const FALLBACK_POLL_INTERVAL_MS = 30_000;
const INBOX_FALLBACK_POLL_INTERVAL_MS = 120_000;

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

function extractUrl(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.uri) return String(value.uri);
  return String(value);
}

function normalizeDirectMessage(raw: any, conversationId: string): DirectMessage | null {
  const id = raw?.id || raw?.messageId;
  if (!id) return null;
  const rawType = String(raw?.type || '').toLowerCase();
  const imageUrl = extractUrl(raw?.imageUrl || (rawType === 'image' ? raw?.content : undefined));
  return {
    id: String(id),
    conversationId: String(raw?.conversationId || conversationId),
    senderId: String(raw?.senderId || raw?.userId || ''),
    content: imageUrl || String(raw?.content || raw?.text || ''),
    imageUrl: imageUrl || undefined,
    type: rawType === 'image' || !!raw?.imageUrl ? 'image' : 'text',
    createdAt: raw?.createdAt || new Date().toISOString(),
    readAt: raw?.readAt,
    isDeleted: raw?.isDeleted === true,
  };
}

function mergeMessages(
  currentMessages: DirectMessage[],
  incomingMessages: DirectMessage[],
  limit: number,
): DirectMessage[] {
  const byId = new Map<string, DirectMessage>();
  [...currentMessages, ...incomingMessages].forEach((message) => byId.set(message.id, message));
  return [...byId.values()]
    .sort((left, right) => toTime(left.createdAt) - toTime(right.createdAt))
    .slice(-limit);
}

// Get or check existing conversation
export async function getExistingConversation(
  userId1: string,
  userId2: string,
  eventId: string,
): Promise<PrivateConversation | null> {
  try {
    const response = await apiFetch<{ conversations: PrivateConversation[] }>(
      `/api/v1/social/dm/conversations/${eventId}`,
      { requireAuth: true },
    );
    return response.conversations.find((c) => c.participants.includes(userId2)) || null;
  } catch (error) {
    return null;
  }
}

// Initiate DM request
export async function initiateDMRequest(
  senderId: string,
  recipientId: string,
  eventId: string,
): Promise<{ success: boolean; conversationId?: string; error?: string }> {
  try {
    const response = await apiFetch<any>('/api/v1/social/dm/request', {
      method: 'POST',
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
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    return await apiFetch(`/api/v1/social/dm/${conversationId}/accept`, {
      method: 'POST',
      requireAuth: true,
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Decline DM request
export async function declineDMRequest(
  conversationId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    return await apiFetch(`/api/v1/social/dm/${conversationId}/decline`, {
      method: 'POST',
      requireAuth: true,
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
  isGlobal: boolean = false,
): Promise<{ success: boolean; error?: string }> {
  try {
    return await apiFetch('/api/v1/social/block', {
      method: 'POST',
      body: JSON.stringify({ targetUid: blockedId, eventId, isGlobal }),
      requireAuth: true,
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Send DM message
export async function sendDirectMessage(
  conversationId: string,
  senderId: string,
  content: string,
  replyToId?: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await apiFetch<any>(
      `/api/v1/chats/${encodeURIComponent(conversationId)}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ text: content, replyToId }),
        requireAuth: true,
      },
    );
    return {
      success: true,
      messageId: response.data?.message?.id || response.message?.id,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Send an image message
export async function sendDirectImageMessage(
  conversationId: string,
  senderId: string,
  imageUrl: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await apiFetch<any>(
      `/api/v1/chats/${encodeURIComponent(conversationId)}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ imageUrl, type: 'image' }),
        requireAuth: true,
      },
    );
    return {
      success: true,
      messageId: response.data?.message?.id || response.message?.id,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Subscribe to DM messages via WebSocket + polling
export function subscribeToDirectMessages(
  conversationId: string,
  onMessages: (messages: DirectMessage[]) => void,
  messageLimit: number = 50,
  initialMessages: DirectMessage[] = [],
  enablePolling: boolean = true,
): () => void {
  let active = true;
  let unsubscribeWS: (() => void) | null = null;
  let pollIntervalId: ReturnType<typeof setInterval> | null = null;
  let connectCheck: ReturnType<typeof setInterval> | null = null;
  const safeMessageLimit = clampMessageLimit(messageLimit);
  let latestMessages: DirectMessage[] = initialMessages.slice(-safeMessageLimit);

  function publishMessages(nextMessages: DirectMessage[]) {
    latestMessages = nextMessages.slice(-safeMessageLimit);
    onMessages(latestMessages);
  }

  // WebSocket handler
  const wsHandler = (msg: WSMessage) => {
    if (!active) return;
    if (msg.type === 'dm:new_message' && msg.payload?.conversationId === conversationId) {
      const nextMessage = normalizeDirectMessage(
        msg.payload.message || msg.payload,
        conversationId,
      );
      if (nextMessage) {
        publishMessages(mergeMessages(latestMessages, [nextMessage], safeMessageLimit));
      }
    }
  };

  // Subscribe via WebSocket if connected
  if (wsManager.isConnected) {
    unsubscribeWS = wsManager.subscribe(`dm:${conversationId}`, wsHandler);
  } else {
    connectCheck = setInterval(() => {
      if (wsManager.isConnected && !unsubscribeWS) {
        unsubscribeWS = wsManager.subscribe(`dm:${conversationId}`, wsHandler);
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

  async function fetchHistory() {
    if (!active) return;
    try {
      const response = await apiFetch<{
        data?: { messages: DirectMessage[] };
        messages?: DirectMessage[];
      }>(`/api/v1/chats/${encodeURIComponent(conversationId)}/messages?limit=${safeMessageLimit}`, {
        requireAuth: true,
      });
      const responseMessages = response.data?.messages || response.messages;
      if (active && responseMessages) {
        publishMessages(
          mergeMessages(
            latestMessages,
            responseMessages
              .map((message) => normalizeDirectMessage(message, conversationId))
              .filter((message): message is DirectMessage => Boolean(message)),
            safeMessageLimit,
          ),
        );
      }
    } catch {
      console.warn('[privateDM] poll failed');
    }
  }

  async function pollOnce() {
    if (AppState.currentState !== 'active') return;
    await fetchHistory();
  }

  // A socket only delivers messages created after subscription. Every full
  // conversation must hydrate its authorized REST history once, then merge new
  // socket messages by id. Inbox preview subscriptions pass enablePolling=false
  // and keep avoiding one Firestore-backed request per conversation.
  if (enablePolling && initialMessages.length === 0) {
    void fetchHistory();
  }
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

// Get user's DM conversations for an event
export async function getUserEventConversations(
  userId: string,
  eventId: string,
): Promise<PrivateConversation[]> {
  try {
    const response = await apiFetch<{ conversations: PrivateConversation[] }>(
      `/api/v1/social/dm/conversations/${eventId}`,
      { requireAuth: true },
    );
    return response.conversations || [];
  } catch (error) {
    return [];
  }
}

// Get saved contacts for a user
export async function getSavedContacts(userId: string): Promise<any[]> {
  try {
    const response = await apiFetch<{ contacts: any[] }>('/api/v1/social/contacts', {
      requireAuth: true,
    });
    return response.contacts || [];
  } catch (error) {
    return [];
  }
}

// Get pending DM requests
export async function getPendingDMRequests(userId: string): Promise<PrivateConversation[]> {
  try {
    const response = await apiFetch<{ requests: PrivateConversation[] }>(
      '/api/v1/social/dm/requests',
      { requireAuth: true },
    );
    return response.requests || [];
  } catch (error) {
    return [];
  }
}
