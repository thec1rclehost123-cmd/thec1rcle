// Typing Indicators Service via API Gateway
import { AppState } from 'react-native';
import { apiFetch } from '@/lib/api';
import { wsManager, type WSMessage } from '@/lib/websocket';

// Typing indicator data
export interface TypingIndicator {
  chatId: string;
  userName: string;
  userId: string;
  timestamp: string;
}

// Typing status for group chat
export interface TypingStatus {
  isTyping: boolean;
  users: Array<{
    userId: string;
    userName: string;
  }>;
}

const TYPING_TIMEOUT = 5000;
const lastTypingUpdate: Record<string, number> = {};

// Set typing status (works for both group and DM)
async function setTypingStatus(
  chatId: string,
  chatType: 'group' | 'dm',
  userId: string,
  userName: string,
  isTyping: boolean,
): Promise<void> {
  try {
    const now = Date.now();
    const key = `${chatType}_${chatId}_${userId}`;

    if (isTyping) {
      // Debounce - don't spam API
      if (lastTypingUpdate[key] && now - lastTypingUpdate[key] < 2000) {
        return;
      }
      lastTypingUpdate[key] = now;
    }

    await apiFetch('/api/v1/social/typing', {
      method: 'POST',
      body: JSON.stringify({ chatId, chatType, isTyping, userName }),
      requireAuth: true,
    });

    if (isTyping) {
      // Auto-clear locally to avoid being stuck in typing state
      setTimeout(() => {
        if (Date.now() - (lastTypingUpdate[key] || 0) >= TYPING_TIMEOUT) {
          setTypingStatus(chatId, chatType, userId, userName, false);
        }
      }, TYPING_TIMEOUT);
    }
  } catch (e) {}
}

export async function setGroupTypingStatus(
  eventId: string,
  userId: string,
  userName: string,
  isTyping: boolean,
): Promise<void> {
  return setTypingStatus(eventId, 'group', userId, userName, isTyping);
}

export async function setDMTypingStatus(
  conversationId: string,
  userId: string,
  userName: string,
  isTyping: boolean,
): Promise<void> {
  return setTypingStatus(conversationId, 'dm', userId, userName, isTyping);
}

// Subscribe to group typing via polling
export function subscribeToGroupTyping(
  eventId: string,
  currentUserId: string,
  onTypingChange: (status: TypingStatus) => void,
): () => void {
  let active = true;
  let clearTimer: ReturnType<typeof setTimeout> | null = null;

  const unsubscribeWS = wsManager.subscribe(`event-chat:${eventId}`, (message: WSMessage) => {
    if (!active || message.type !== 'chat:typing') return;
    const payload = message.payload as any;
    if (payload.chatType !== 'group' || payload.chatId !== eventId) return;
    if (payload.userId === currentUserId) return;
    const users = payload.isTyping
      ? [{ userId: String(payload.userId), userName: String(payload.userName || 'Attendee') }]
      : [];
    onTypingChange({ isTyping: users.length > 0, users });
    if (clearTimer) clearTimeout(clearTimer);
    if (users.length > 0) {
      clearTimer = setTimeout(() => {
        if (active) onTypingChange({ isTyping: false, users: [] });
      }, TYPING_TIMEOUT + 1000);
    }
  });

  async function poll() {
    if (!active) return;
    if (AppState.currentState !== 'active') return;
    try {
      const response = await apiFetch<{ typers: TypingIndicator[] }>(
        `/api/v1/social/typing/${eventId}?chatType=group`,
        {
          requireAuth: true,
        },
      );
      if (active && response.typers) {
        const now = new Date().getTime();
        const users = response.typers
          .filter(
            (t) =>
              t.userId !== currentUserId && now - new Date(t.timestamp).getTime() < TYPING_TIMEOUT,
          )
          .map((t) => ({ userId: t.userId, userName: t.userName }));

        onTypingChange({
          isTyping: users.length > 0,
          users,
        });
      }
    } catch (e) {}
  }

  if (!wsManager.isConnected) void poll();
  const intervalId = setInterval(() => {
    if (!wsManager.isConnected) void poll();
  }, 10_000);

  return () => {
    active = false;
    unsubscribeWS();
    if (clearTimer) clearTimeout(clearTimer);
    clearInterval(intervalId);
  };
}

// Subscribe to DM typing via polling
export function subscribeToDMTyping(
  conversationId: string,
  currentUserId: string,
  onTypingChange: (isTyping: boolean, userName?: string) => void,
): () => void {
  let active = true;
  let clearTimer: ReturnType<typeof setTimeout> | null = null;

  const unsubscribeWS = wsManager.subscribe(`dm:${conversationId}`, (message: WSMessage) => {
    if (!active || message.type !== 'chat:typing') return;
    const payload = message.payload as any;
    if (payload.chatType !== 'dm' || payload.chatId !== conversationId) return;
    if (payload.userId === currentUserId) return;
    const isTyping = payload.isTyping === true;
    onTypingChange(isTyping, isTyping ? String(payload.userName || 'Attendee') : undefined);
    if (clearTimer) clearTimeout(clearTimer);
    if (isTyping) {
      clearTimer = setTimeout(() => {
        if (active) onTypingChange(false);
      }, TYPING_TIMEOUT + 1000);
    }
  });

  async function poll() {
    if (!active) return;
    if (AppState.currentState !== 'active') return;
    try {
      const response = await apiFetch<{ typers: TypingIndicator[] }>(
        `/api/v1/social/typing/${conversationId}?chatType=dm`,
        {
          requireAuth: true,
        },
      );
      if (active && response.typers) {
        const now = new Date().getTime();
        const otherTyper = response.typers.find(
          (t) =>
            t.userId !== currentUserId && now - new Date(t.timestamp).getTime() < TYPING_TIMEOUT,
        );
        onTypingChange(!!otherTyper, otherTyper?.userName);
      }
    } catch (e) {}
  }

  if (!wsManager.isConnected) void poll();
  const intervalId = setInterval(() => {
    if (!wsManager.isConnected) void poll();
  }, 10_000);

  return () => {
    active = false;
    unsubscribeWS();
    if (clearTimer) clearTimeout(clearTimer);
    clearInterval(intervalId);
  };
}

export function createTypingHandler(setTyping: (isTyping: boolean) => Promise<void>): {
  onChangeText: () => void;
  onBlur: () => void;
} {
  let typingTimeout: ReturnType<typeof setTimeout> | null = null;
  let isCurrentlyTyping = false;

  const onChangeText = () => {
    if (!isCurrentlyTyping) {
      isCurrentlyTyping = true;
      setTyping(true);
    }
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      isCurrentlyTyping = false;
      setTyping(false);
    }, 3000);
  };

  const onBlur = () => {
    if (typingTimeout) clearTimeout(typingTimeout);
    if (isCurrentlyTyping) {
      isCurrentlyTyping = false;
      setTyping(false);
    }
  };

  return { onChangeText, onBlur };
}

export function formatTypingText(users: Array<{ userName: string }>): string {
  if (users.length === 0) return '';
  if (users.length === 1) return `${users[0].userName} is typing...`;
  if (users.length === 2) return `${users[0].userName} and ${users[1].userName} are typing...`;
  return `${users[0].userName} and ${users.length - 1} others are typing...`;
}
