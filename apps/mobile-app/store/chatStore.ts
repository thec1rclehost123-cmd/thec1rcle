import { create } from 'zustand';
import { apiFetch } from '@/lib/api';
import { subscribeToGroupChat } from '@/lib/social/groupChat';
import type { GroupMessage } from '@/lib/social';
import { subscribeToDirectMessages } from '@/lib/social/privateDM';
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

  fetchAll: (userId: string) => Promise<void>;
  subscribeToUpdates: (userId: string) => () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  eventChats: [],
  privateChats: [],
  newMatches: [],
  totalUnread: 0,
  loading: false,
  error: null,

  fetchAll: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const [chatsResponse, matchesResponse] = await Promise.all([
        apiFetch<{
          chats: EventChat[];
          eventChats: EventChat[];
          privateChats: DirectChat[];
          totalUnread: number;
        }>('/api/v1/social/my-chats', { requireAuth: true }),
        apiFetch<{ matches: NewMatch[] }>('/api/v1/social/matches', {
          requireAuth: true,
        }).catch(() => ({ matches: [] })),
      ]);

      set({
        eventChats: chatsResponse.eventChats || chatsResponse.chats || [],
        privateChats: chatsResponse.privateChats || [],
        totalUnread: chatsResponse.totalUnread || 0,
        newMatches: matchesResponse.matches || [],
        loading: false,
      });
    } catch (e: any) {
      set({ loading: false, error: e.message || 'Failed to load chats' });
    }
  },

  subscribeToUpdates: (userId: string) => {
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
        .sort()
        .join(',');
      const privateIds = state.privateChats
        .map((c) => c.id)
        .sort()
        .join(',');
      if (eventIds !== prevEventIds || privateIds !== prevPrivateIds) {
        prevEventIds = eventIds;
        prevPrivateIds = privateIds;
        syncSubscriptions();
      }
    });

    return () => {
      for (const unsub of subscriptions.values()) unsub();
      subscriptions.clear();
      unsubStore();
    };
  },
}));
