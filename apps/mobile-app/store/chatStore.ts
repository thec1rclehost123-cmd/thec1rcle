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
    const { eventChats, privateChats } = get();
    const unsubscribers: (() => void)[] = [];

    for (const chat of eventChats) {
      if (chat.eventId) {
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
        unsubscribers.push(unsub);
      }
    }

    for (const chat of privateChats) {
      if (chat.id) {
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
        unsubscribers.push(unsub);
      }
    }

    return () => unsubscribers.forEach((fn) => fn());
  },
}));
