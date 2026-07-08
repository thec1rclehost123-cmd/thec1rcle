// Event-based chat service via API Gateway
import { AppState } from 'react-native';
import { apiFetch } from './api';

export interface ChatMessage {
  id: string;
  eventChatId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  type: 'text' | 'image' | 'system';
  createdAt: string;
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
    createdAt: string;
  };
  createdAt: string;
  eventCover?: string;
  unreadCount?: number;
  activeAvatars?: string[];
}

export interface DirectChat {
  id: string;
  participants: string[];
  eventId?: string; // Optional - if they met at an event
  otherUserName?: string;
  otherUserAvatar?: string;
  isOnline?: boolean;
  lastMessageTime?: string;
  unreadCount?: number;
  lastMessage?: string;
  createdAt: string;
}

/**
 * Check if user has ticket for event (required for chat access)
 * Proxied via Gateway
 */
interface EntitlementResponse {
  entitlement: unknown;
}

export async function hasEventAccess(userId: string, eventId: string): Promise<boolean> {
  try {
    const response = await apiFetch<EntitlementResponse>(`/api/v1/social/entitlement/${eventId}`);
    return !!response.entitlement;
  } catch (error) {
    console.warn('hasEventAccess failed:', error);
    return false;
  }
}

/**
 * Get or create event chat room via Gateway
 */
export async function getEventChat(
  eventId: string,
  userId: string,
): Promise<{ chat: EventChat | null; error?: string }> {
  try {
    // We use the Gateway's group chat endpoint
    const response = await apiFetch<{ chat: EventChat }>(`/api/v1/social/group-chat/${eventId}`, {
      method: 'POST',
      requireAuth: true,
    });
    return { chat: response.chat };
  } catch (error: any) {
    return { chat: null, error: error.message };
  }
}

/**
 * Send message to event chat via Gateway
 */
interface SendMessageResponse {
  id: string;
}

export async function sendEventMessage(
  eventChatId: string,
  senderId: string,
  senderName: string,
  content: string,
  senderAvatar?: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!content.trim()) {
    return { success: false, error: 'Message content cannot be empty' };
  }
  try {
    const eventId = eventChatId.replace(/^event_/, '');
    const response = await apiFetch<SendMessageResponse>(`/api/v1/social/chat`, {
      method: 'POST',
      body: JSON.stringify({
        eventId,
        text: content,
      }),
      requireAuth: true,
    });
    return { success: true, messageId: response.id };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Subscribe to event chat messages via Polling (Gateway fallback)
 */
export function subscribeToEventMessages(
  eventChatId: string,
  onMessage: (messages: ChatMessage[]) => void,
  messageLimit: number = 50,
): () => void {
  let active = true;
  const eventId = eventChatId.replace(/^event_/, '');

  async function poll() {
    if (!active) return;
    if (AppState.currentState !== 'active') return;
    try {
      const response = await apiFetch<{ messages: ChatMessage[] }>(
        `/api/v1/social/chat/${eventId}?limit=${messageLimit}`,
        { requireAuth: true },
      );
      if (active && response.messages) onMessage(response.messages);
    } catch (error) {
      console.warn('subscribeToEventMessages poll failed:', error);
    }
  }

  poll();
  const intervalId = setInterval(poll, 3000); // 3s poll for messages

  return () => {
    active = false;
    clearInterval(intervalId);
  };
}

/**
 * Get user's event chats via Gateway
 */
export async function getUserEventChats(): Promise<EventChat[]> {
  try {
    const response = await apiFetch<{ chats: EventChat[] }>('/api/v1/social/my-chats');
    return response.chats || [];
  } catch (error) {
    return [];
  }
}

/**
 * Direct message between users via Gateway
 */
interface DmRequestResponse {
  conversationId: string;
}

export async function startDirectChat(
  userId: string,
  otherUserId: string,
  eventId?: string,
): Promise<{ chatId: string | null; error?: string }> {
  try {
    const body: Record<string, string> = { recipientId: otherUserId };
    if (eventId) body.eventId = eventId;
    const response = await apiFetch<DmRequestResponse>('/api/v1/social/dm/request', {
      method: 'POST',
      body: JSON.stringify(body),
      requireAuth: true,
    });
    return { chatId: response.conversationId };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { chatId: null, error: message };
  }
}
