import { create } from 'zustand';
import { apiFetch, deduplicateRequest } from '@/lib/api';
import { subscribeToGroupChat } from '@/lib/social/groupChat';
import type { GroupMessage } from '@/lib/social';
import { subscribeToDirectMessages } from '@/lib/social/privateDM';
import { checkEventEntitlement } from '@/lib/social/entitlements';
import type { EventChat, DirectChat } from '@/lib/chat';

interface NewMatch {
  id: string;
  name: string;
  photoURL?: string;
  sharedEventTitle?: string;
  isNew: boolean;
}

interface ChatState {
  eventChats: EventChat[];
  privateChats: DirectChat[];
  newMatches: NewMatch[];
  totalUnread: number;
  loading: boolean;
  error: string | null;
  _unsubscribe: (() => void) | null;

  fetchAll: (userId: string) => Promise<void>;
  subscribeToUpdates: (userId: string) => () => void;
  clearNewMatches: () => void;
  decrementUnread: (count: number) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  eventChats: [],
  privateChats: [],
  newMatches: [],
  totalUnread: 0,
  loading: false,
  error: null,
  _unsubscribe: null,

  fetchAll: async (userId: string) => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const [chatsResponse, matchesResponse] = await Promise.all([
        deduplicateRequest<{
          chats: EventChat[];
          eventChats: EventChat[];
          privateChats: DirectChat[];
          totalUnread: number;
        }>('chatStore:my-chats', () =>
          apiFetch<{
            chats: EventChat[];
            eventChats: EventChat[];
            privateChats: DirectChat[];
            totalUnread: number;
          }>('/api/v1/social/my-chats', { requireAuth: true }),
        ),
        deduplicateRequest<{ matches: NewMatch[] }>('chatStore:matches', () =>
          apiFetch<{ matches: NewMatch[] }>('/api/v1/social/matches', {
            requireAuth: true,
          }).catch(() => ({ matches: [] })),
        ),
      ]);

      const allEventChats = chatsResponse.eventChats || chatsResponse.chats || [];

      set({
        eventChats: allEventChats,
        privateChats: chatsResponse.privateChats || [],
        totalUnread: chatsResponse.totalUnread || 0,
        newMatches: matchesResponse.matches || [],
        loading: false,
      });
    } catch (e: any) {
      set({ loading: false, error: e.message || 'Failed to load chats' });
    }
  },

  clearNewMatches: () => {
    set({ newMatches: [] });
  },

  decrementUnread: (count: number) => {
    set((state) => ({ totalUnread: Math.max(0, state.totalUnread - count) }));
  },

  subscribeToUpdates: (userId: string) => {
    get()._unsubscribe?.();

    const subscriptions = new Map<string, () => void>();

    function syncSubscriptions() {
      const { eventChats, privateChats } = get();
      const activeEventIds = new Set(eventChats.map((c) => c.eventId).filter(Boolean));
      const activePrivateIds = new Set(privateChats.map((c) => c.id).filter(Boolean));

      for (const [key, unsub] of subscriptions) {
        const [type, id] = [key.startsWith('event:') ? 'event' : 'private', key.split(':')[1]];
        if (
          (type === 'event' && !activeEventIds.has(id)) ||
          (type === 'private' && !activePrivateIds.has(id))
        ) {
          unsub();
          subscriptions.delete(key);
        }
      }

      for (const chat of eventChats) {
        const key = `event:${chat.eventId}`;
        if (!chat.eventId || subscriptions.has(key)) continue;
        const unsub = subscribeToGroupChat(
          chat.eventId,
          (messages: GroupMessage[]) => {
            const updated = messages[messages.length - 1];
            if (updated) {
              set((state) => ({
                eventChats: state.eventChats.map((c) =>
                  c.eventId === chat.eventId
                    ? {
                        ...c,
                        lastMessage: {
                          content: updated.content,
                          senderId: updated.senderId,
                          senderName: updated.senderName,
                          createdAt: updated.createdAt,
                        },
                      }
                    : c,
                ),
              }));
            }
          },
          1,
        );
        subscriptions.set(key, unsub);
      }

      for (const chat of privateChats) {
        const key = `private:${chat.id}`;
        if (!chat.id || subscriptions.has(key)) continue;
        const unsub = subscribeToDirectMessages(
          chat.id,
          (messages) => {
            const updated = messages[messages.length - 1];
            if (updated) {
              set((state) => ({
                privateChats: state.privateChats.map((c) =>
                  c.id === chat.id
                    ? {
                        ...c,
                        lastMessage: updated.content,
                      }
                    : c,
                ),
              }));
            }
          },
          1,
        );
        subscriptions.set(key, unsub);
      }
    }

    syncSubscriptions();

    let prevEventIds = '';
    let prevPrivateIds = '';
    const unsubStore = useChatStore.subscribe((state) => {
      const eventIds = state.eventChats
        .map((c) => c.eventId)
        .slice()
        .sort()
        .join(',');
      const privateIds = state.privateChats
        .map((c) => c.id)
        .slice()
        .sort()
        .join(',');
      if (eventIds !== prevEventIds || privateIds !== prevPrivateIds) {
        prevEventIds = eventIds;
        prevPrivateIds = privateIds;
        syncSubscriptions();
      }
    });

    const unsubscribe = () => {
      for (const unsub of subscriptions.values()) unsub();
      subscriptions.clear();
      unsubStore();
    };

    set({ _unsubscribe: unsubscribe });

    return unsubscribe;
  },
}));
