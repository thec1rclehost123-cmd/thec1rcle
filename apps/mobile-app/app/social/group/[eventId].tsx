import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChatKeyboardAvoidingView } from '@/components/ui/ChatKeyboardAvoidingView';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import {
  CalendarDays,
  Flag,
  Ban,
  ImagePlus,
  Images,
  LockKeyhole,
  Users,
  X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  BrightCenterState,
  BrightChatHeader,
  BrightChatSurface,
  BrightComposerDock,
  BrightMessage,
  BrightSendButton,
  BrightTextInput,
  BrightToolButton,
  BrightTypingIndicator,
  SwipeableMessage,
  formatChatTime,
  type ChatSurfaceTheme,
} from '@/components/chat/BrightChatSurface';
import { useChatRateLimit } from '@/hooks/useChatRateLimit';
import { useChatImagePicker } from '@/hooks/useChatImagePicker';
import {
  checkEventEntitlement,
  getEventGroupChat,
  subscribeToGroupChat,
  sendGroupMessage,
  sendGroupImageMessage,
  getEventAttendees,
  getEventMediaCount,
  type GroupMessage,
  type EventPhase,
  getPhaseInfo,
  canAccessEventChat,
  setGroupTypingStatus,
  subscribeToGroupTyping,
  createTypingHandler,
  type TypingStatus,
  initiateDMRequest,
  reportMessage,
} from '@/lib/social';
import { DEMO_EVENT_CHATS, DEMO_MODE } from '@/lib/demo';
import { colors, radii, spacing, typography } from '@/lib/design/theme';
import { useAuthStore } from '@/store/authStore';
import { trackScreen } from '@/lib/analytics';
import { apiFetch } from '@/lib/api';

const fonts = typography.fontFamily;

type EventAttendee = {
  userId: string;
  name: string;
  avatar?: string;
};

function PhaseBadge({ phase }: { phase: EventPhase }) {
  const info = getPhaseInfo(phase);

  return (
    <View
      style={[
        styles.phaseBadge,
        {
          backgroundColor: 'rgba(255,255,255,0.12)',
          borderColor: 'rgba(255,255,255,0.2)',
          borderWidth: 1,
        },
      ]}
    >
      <Text style={styles.phaseIcon}>{info.icon}</Text>
      <Text style={[styles.phaseText, { color: '#FFFFFF' }]}>{info.label}</Text>
    </View>
  );
}

export default function EventGroupChatScreen() {
  const { eventId, eventTitle } = useLocalSearchParams<{
    eventId: string;
    eventTitle: string;
  }>();
  const user = useAuthStore((state) => state.user);
  const messagesListRef = useRef<FlashListRef<GroupMessage>>(null);

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [tempMessages, setTempMessages] = useState<GroupMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [phase, setPhase] = useState<EventPhase>('pre-event');
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [mediaCount, setMediaCount] = useState(0);
  const [typingStatus, setTypingStatus] = useState<TypingStatus>({ isTyping: false, users: [] });
  const [replyMessageId, setReplyMessageId] = useState<string | null>(null);
  const [hiddenMessageIds, setHiddenMessageIds] = useState<Set<string>>(() => new Set());
  const [likedMessageIds, setLikedMessageIds] = useState<Set<string>>(() => new Set());
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [eventHostId, setEventHostId] = useState<string | null>(null);
  const [eventTitleSafe, setEventTitleSafe] = useState(eventTitle || '');
  const [eventPoster, setEventPoster] = useState<string | null>(null);

  const { canSend, cooldownSeconds, checkRateLimit } = useChatRateLimit();
  const { uploading: imageUploading, pickAndUpload } = useChatImagePicker(
    user?.uid || '',
    `group/${eventId || 'unknown'}`,
  );

  const demoEventChat = DEMO_MODE
    ? DEMO_EVENT_CHATS.find((chat) => chat.eventId === eventId)
    : undefined;
  const phaseInfo = getPhaseInfo(phase);
  const isArchived = phase === 'expired';
  const canCompose = hasAccess && !isArchived;
  const archivedNotice = 'This event chat has ended. You can still read the history.';
  const visibleMessages = useMemo(() => {
    const filtered = messages.filter((message) => !hiddenMessageIds.has(message.id));
    for (const tm of tempMessages) {
      if (!filtered.find((m) => m.id === tm.id)) {
        filtered.push(tm);
      }
    }
    filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return filtered;
  }, [hiddenMessageIds, messages, tempMessages]);
  const reversedMessages = useMemo(() => [...visibleMessages].reverse(), [visibleMessages]);

  const replyMessage = useMemo(() => {
    if (!replyMessageId) return null;
    return messages.find((m) => m.id === replyMessageId) || null;
  }, [replyMessageId, messages]);

  const phaseColors: Record<string, string> = {
    'pre-event': '#8B5CF6',
    during: '#F59E0B',
    'post-event': '#3B82F6',
    expired: '',
  };
  const moodColor = phaseColors[phase] || '';
  const phasePlaceholders: Record<string, string> = {
    'pre-event': 'Get the hype started…',
    during: 'Share the moment…',
    'post-event': 'Relive the night…',
    expired: 'Chat history is read-only',
  };
  const placeholder = isArchived
    ? 'Chat history is read-only'
    : phasePlaceholders[phase] || 'Type a message';

  const theme: ChatSurfaceTheme = {
    mode: 'event',
    title: eventTitleSafe || eventTitle || demoEventChat?.eventTitle || 'Event group',
    subtitle: `${attendeeCount || demoEventChat?.participantCount || 0} people going`,
    backgroundImage: eventPoster || demoEventChat?.eventCover,
    heroImage: eventPoster || demoEventChat?.eventCover,
    avatarUrls: demoEventChat?.activeAvatars || [],
    accentColor: colors.iris,
  };

  const typingHandler = useMemo(() => {
    if (eventId && user?.uid && !isArchived) {
      return createTypingHandler(async (isTyping) => {
        await setGroupTypingStatus(eventId, user.uid, user.displayName || 'Guest', isTyping);
      });
    }
    return { onChangeText: () => {}, onBlur: () => {} };
  }, [eventId, isArchived, user?.uid, user?.displayName]);

  useEffect(() => {
    trackScreen('GroupChat');
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!eventId || !user?.uid) {
        setLoading(false);
        return;
      }

      let active = true;
      let unsubscribeMessages: (() => void) | undefined;
      let unsubscribeTyping: (() => void) | undefined;

      async function initializeChat() {
        setLoading(true);

        try {
          const [entitlement, chatInfo, eventDetail, initialChatResponse] = await Promise.all([
            checkEventEntitlement(user!.uid, eventId!),
            getEventGroupChat(eventId!),
            apiFetch<any>(`/api/v1/events/${eventId}`, { requireAuth: false }).catch(() => null),
            apiFetch<any>(`/api/v1/chats/${encodeURIComponent(eventId!)}/messages?limit=50`, {
              requireAuth: true,
            }).catch(() => null),
          ]);
          if (!active) return;

          const eventData =
            eventDetail?.event || eventDetail?.data?.event || eventDetail?.data || eventDetail;
          if (eventData) {
            if (!eventTitleSafe) {
              setEventTitleSafe(eventData.title || eventData.name || eventTitle || '');
            }
            setEventHostId(eventData.createdBy || eventData.hostId || null);
            setEventPoster(
              eventData.posterUrl || eventData.coverImage || eventData.imageUrl || null,
            );
          }

          setPhase(chatInfo.phase);
          setAttendeeCount(chatInfo.participantCount);

          const access = canAccessEventChat(entitlement, chatInfo.phase);
          setHasAccess(access.allowed);
          setAccessError(access.reason || null);

          if (!access.allowed) {
            return;
          }

          // Pre-populate messages if the parallel fetch succeeded
          let initialMessages: GroupMessage[] = [];
          const initialResponseMessages =
            initialChatResponse?.data?.messages || initialChatResponse?.messages;
          if (initialResponseMessages) {
            const normalized = initialResponseMessages
              .map((m: any) => ({
                id: String(m.id || m.messageId),
                eventId: String(m.eventId || eventId),
                senderId: String(m.senderId || m.userId || ''),
                senderName: String(m.senderName || m.userName || 'Attendee'),
                senderAvatar: m.senderAvatar || m.senderPhoto || m.metadata?.senderAvatar,
                senderBadge: m.senderBadge || m.metadata?.senderBadge,
                content: String(m.content || m.text || m.imageUrl || m.videoUrl || ''),
                type: m.type || (m.imageUrl ? 'image' : m.videoUrl ? 'image' : 'text'),
                createdAt: m.createdAt || new Date().toISOString(),
                isDeleted: m.isDeleted === true,
                deletedBy: m.deletedBy,
                replyTo: m.replyTo || m.replyToId,
              }))
              .filter((m: any) => Boolean(m.id));

            // Sort and limit
            const sorted = normalized.sort(
              (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
            );
            initialMessages = sorted.slice(-50);
            setMessages(initialMessages);
          }

          // Fetch side data asynchronously without blocking the UI
          Promise.all([getEventAttendees(eventId!, 10), getEventMediaCount(eventId!)])
            .then(([eventAttendees, count]) => {
              if (!active) return;
              setAttendees(eventAttendees);
              setMediaCount(count);
            })
            .catch((err) => console.warn('Failed to load side data:', err));

          let lastSeenMessageId =
            initialMessages.length > 0 ? initialMessages[initialMessages.length - 1].id : null;
          unsubscribeMessages = subscribeToGroupChat(
            eventId!,
            (newMessages) => {
              if (!active) return;
              if (newMessages.length > 0) {
                const latestMsg = newMessages[newMessages.length - 1];
                if (
                  lastSeenMessageId &&
                  latestMsg.id !== lastSeenMessageId &&
                  latestMsg.senderId !== user!.uid
                ) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                }
                lastSeenMessageId = latestMsg.id;
              }
              setMessages(newMessages);
            },
            50,
            initialMessages,
          );
          if (chatInfo.phase !== 'expired') {
            unsubscribeTyping = subscribeToGroupTyping(eventId!, user!.uid, (status) => {
              if (active) setTypingStatus(status);
            });
          }
        } catch (error) {
          console.error('Failed to initialize chat:', error);
        } finally {
          if (active) setLoading(false);
        }
      }

      initializeChat();
      return () => {
        active = false;
        unsubscribeMessages?.();
        unsubscribeTyping?.();
      };
    }, [eventId, user?.uid]),
  );

  const handleTextChange = (text: string) => {
    if (!canCompose) return;
    setInputText(text);
    typingHandler.onChangeText();
  };

  const handleSend = async () => {
    if (!canCompose || !inputText.trim() || !user?.uid || !eventId) return;
    if (!checkRateLimit()) return;

    const messageContent = inputText.trim();
    setInputText('');
    setSending(true);
    typingHandler.onBlur();
    setGroupTypingStatus(eventId, user.uid, user.displayName || 'Guest', false).catch(
      console.error,
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tempMsg: GroupMessage = {
      id: tempId,
      eventId,
      senderId: user.uid,
      senderName: user.displayName || 'Guest',
      senderAvatar: user.photoURL || undefined,
      content: messageContent,
      type: 'text',
      createdAt: new Date().toISOString(),
      isDeleted: false,
      replyTo: replyMessageId || undefined,
    };
    setTempMessages((current) => [...current, tempMsg]);
    setReplyMessageId(null);

    const result = await sendGroupMessage(
      eventId,
      user.uid,
      user.displayName || 'Guest',
      messageContent,
      user.photoURL || undefined,
      undefined, // badge
      replyMessageId || undefined,
    );
    setTempMessages((current) => current.filter((m) => m.id !== tempId));

    if (!result.success) {
      Alert.alert('Error', result.error || 'Failed to send message');
      setInputText(messageContent);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setSending(false);
  };

  const hideMessageLocally = useCallback((messageId: string) => {
    setHiddenMessageIds((current) => {
      const next = new Set(current);
      next.add(messageId);
      return next;
    });
  }, []);

  const restoreMessageLocally = useCallback((messageId: string) => {
    setHiddenMessageIds((current) => {
      const next = new Set(current);
      next.delete(messageId);
      return next;
    });
  }, []);

  const toggleMessageLikeLocally = useCallback((messageId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLikedMessageIds((current) => {
      const next = new Set(current);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  }, []);

  const handleReportMessage = useCallback(
    async (message: GroupMessage) => {
      if (!eventId || !message.id || !message.senderId) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      hideMessageLocally(message.id);

      const result = await reportMessage({
        messageId: message.id,
        eventId,
        senderId: message.senderId,
      });

      if (!result.success) {
        restoreMessageLocally(message.id);
        Alert.alert('Unable to report', result.error || 'Please try again.');
      }
    },
    [eventId, hideMessageLocally, restoreMessageLocally],
  );

  const handleMessageOptions = useCallback(
    (message: GroupMessage) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const isOwnMessage = message.senderId === user?.uid;

      const actions = [
        !isOwnMessage && {
          text: 'View Profile',
          onPress: () =>
            router.push({
              pathname: '/social/profile/[id]',
              params: { id: message.senderId, eventId },
            }),
        },
        !isOwnMessage && {
          text: 'Send DM',
          onPress: async () => {
            if (!user?.uid || !eventId) return;
            const result = await initiateDMRequest(user.uid, message.senderId, eventId);
            if (result.success && result.conversationId) {
              router.push({
                pathname: '/social/dm/[id]',
                params: { id: result.conversationId, eventId },
              });
            } else {
              Alert.alert(
                'Unable to start DM',
                result.error || "This user can't be messaged right now.",
              );
            }
          },
        },
        !isOwnMessage && {
          text: 'Report Message',
          style: 'destructive' as const,
          onPress: () => handleReportMessage(message),
        },
        isOwnMessage && {
          text: 'Delete Message',
          style: 'destructive' as const,
          onPress: () => hideMessageLocally(message.id),
        },
      ].filter(Boolean) as Array<{
        text: string;
        style?: 'default' | 'destructive';
        onPress: () => void;
      }>;

      if (Platform.OS === 'ios') {
        const cancelIndex = actions.length;
        const destructiveIndex = actions.findIndex((action) => action.style === 'destructive');
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: [...actions.map((action) => action.text), 'Cancel'],
            cancelButtonIndex: cancelIndex,
            destructiveButtonIndex: destructiveIndex >= 0 ? destructiveIndex : undefined,
          },
          (buttonIndex) => {
            if (buttonIndex < actions.length) actions[buttonIndex].onPress();
          },
        );
        return;
      }

      Alert.alert('Message', undefined, [{ text: 'Cancel', style: 'cancel' }, ...actions]);
    },
    [eventId, handleReportMessage, hideMessageLocally, user?.uid],
  );

  const activeTyper = canCompose && typingStatus.isTyping ? typingStatus.users[0] : null;

  const flashListExtraData = useMemo(
    () => ({
      activeTyper,
      userId: user?.uid,
      likedMessageIds,
      messageCount: visibleMessages.length,
    }),
    [activeTyper, user?.uid, likedMessageIds, visibleMessages.length],
  );

  const renderMessage = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      if (item.type === 'divider') {
        return (
          <View style={[styles.flip, { alignItems: 'center', marginVertical: 16 }]}>
            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.15)',
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' }}>
                {item.text}
              </Text>
            </View>
          </View>
        );
      }

      const isOwnMessage = item.senderId === user?.uid;
      const isHost = eventHostId !== null && item.senderId === eventHostId;

      const message = (
        <BrightMessage
          content={item.content}
          time={formatChatTime(item.createdAt, 'en-IN')}
          senderName={item.senderName}
          senderAvatar={item.senderAvatar}
          type={
            item.type === 'announcement'
              ? 'announcement'
              : item.type === 'system'
                ? 'system'
                : item.type === 'image'
                  ? 'image'
                  : 'text'
          }
          isOwnMessage={isOwnMessage}
          index={index}
          animate={index < 5}
          isLiked={item.isLiked || likedMessageIds.has(item.id)}
          onLongPress={() => handleMessageOptions(item)}
          onDoubleTap={() => toggleMessageLikeLocally(item.id)}
          badgeLabel={isHost ? 'HOST' : undefined}
        />
      );

      return <View style={styles.flip}>{message}</View>;
    },
    [
      handleMessageOptions,
      toggleMessageLikeLocally,
      likedMessageIds,
      hideMessageLocally,
      handleReportMessage,
      user?.uid,
    ],
  );

  const messageListEmpty = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loaderText}>Loading messages...</Text>
        </View>
      );
    }
    return (
      <BrightCenterState
        title="Start the conversation"
        body="Be the first to say hi to other attendees."
      />
    );
  }, [loading]);

  if (!hasAccess && !loading) {
    return (
      <BrightChatSurface theme={theme}>
        <SafeAreaView style={styles.lockedScreen} edges={['top', 'bottom']}>
          <BrightChatHeader
            theme={theme}
            onBack={() => router.back()}
            onDetails={() => setDetailsModalVisible(true)}
          />
          <View style={styles.lockedBody}>
            <View style={styles.lockedIcon}>
              <LockKeyhole size={34} color="#FFFFFF" />
            </View>
            <Text style={styles.lockedTitle}>Access Required</Text>
            <Text style={styles.lockedCopy}>
              {accessError || 'You need a ticket to join this chat'}
            </Text>
            {accessError === 'You need a ticket to join this chat' ? (
              <Pressable
                onPress={() => router.push({ pathname: '/event/[id]', params: { id: eventId } })}
                style={styles.lockedButton}
              >
                <Text style={styles.lockedButtonText}>Get Tickets</Text>
              </Pressable>
            ) : null}
          </View>
        </SafeAreaView>
      </BrightChatSurface>
    );
  }

  return (
    <BrightChatSurface theme={theme}>
      <ChatKeyboardAvoidingView style={{ flex: 1 }}>
        <SafeAreaView style={styles.conversation} edges={['top']}>
          <BrightChatHeader
            theme={theme}
            onBack={() => router.back()}
            onDetails={() => setDetailsModalVisible(true)}
          />

          <FlashList
            ref={messagesListRef}
            data={loading ? [] : reversedMessages}
            renderItem={renderMessage}
            drawDistance={500}
            style={styles.messagesFlipped}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<View style={styles.flip}>{messageListEmpty}</View>}
            ListHeaderComponent={
              activeTyper ? (
                <View style={styles.flip}>
                  <BrightTypingIndicator
                    name={activeTyper.userName}
                    energy={phase === 'during' ? 0.8 : phase === 'pre-event' ? 0.4 : 0.3}
                  />
                </View>
              ) : null
            }
            extraData={flashListExtraData}
          />
        </SafeAreaView>

        <SafeAreaView edges={['bottom']}>
          <BrightComposerDock error={isArchived ? archivedNotice : null}>
            <BrightTextInput
              value={inputText}
              onChangeText={handleTextChange}
              onBlur={typingHandler.onBlur}
              placeholder={placeholder}
              editable={canCompose}
              style={isArchived ? styles.readOnlyComposerInput : undefined}
              multiline
              maxLength={500}
            />
            <BrightSendButton
              onPress={handleSend}
              disabled={!canCompose || !inputText.trim() || sending || !canSend}
              loading={sending}
              cooldownSeconds={canCompose && !canSend ? cooldownSeconds : undefined}
            />
          </BrightComposerDock>
        </SafeAreaView>
      </ChatKeyboardAvoidingView>

      <Modal
        visible={detailsModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailsModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setDetailsModalVisible(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Event Details</Text>
            <Pressable onPress={() => setDetailsModalVisible(false)} style={styles.modalClose}>
              <X size={18} color="#fff" strokeWidth={2.5} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {demoEventChat?.eventCover && (
              <Image
                source={{ uri: demoEventChat.eventCover }}
                style={styles.modalCover}
                resizeMode="cover"
              />
            )}

            <Text style={styles.modalEventTitle}>
              {eventTitleSafe || eventTitle || demoEventChat?.eventTitle}
            </Text>

            <PhaseBadge phase={phase} />

            <View style={styles.modalInfoRow}>
              <Users size={16} color="rgba(255,255,255,0.5)" />
              <Text style={styles.modalInfoText}>
                {attendeeCount || demoEventChat?.participantCount || 0} attendees
              </Text>
            </View>

            <View style={styles.sectionTitle}>
              <Text style={styles.sectionLabel}>Attendees</Text>
            </View>

            {attendees.length > 0 ? (
              attendees.map((a) => (
                <Pressable
                  key={a.userId}
                  style={styles.attendeeRow}
                  onPress={() => {
                    setDetailsModalVisible(false);
                    router.push({
                      pathname: '/social/profile/[id]',
                      params: { id: a.userId, eventId },
                    });
                  }}
                >
                  <View style={styles.attendeeAvatar}>
                    {a.avatar ? (
                      <Image
                        source={{ uri: a.avatar }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text style={styles.attendeeInitial}>{a.name.slice(0, 1).toUpperCase()}</Text>
                    )}
                  </View>
                  <Text style={styles.attendeeName}>{a.name}</Text>
                </Pressable>
              ))
            ) : (
              <Text style={styles.modalEmptyText}>No attendees loaded</Text>
            )}
          </ScrollView>
        </View>
      </Modal>
    </BrightChatSurface>
  );
}

const styles = StyleSheet.create({
  conversation: {
    flex: 1,
  },
  lockedScreen: {
    flex: 1,
  },
  lockedBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  lockedIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.iris,
    marginBottom: spacing.lg,
  },
  lockedTitle: {
    color: '#FFFFFF',
    fontFamily: fonts.display,
    fontSize: typography.fontSize['2xl'],
    textAlign: 'center',
  },
  lockedCopy: {
    color: 'rgba(255,255,255,0.86)',
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  lockedButton: {
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.iris,
  },
  lockedButtonText: {
    color: '#FFFFFF',
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.base,
  },
  phaseBadge: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  phaseIcon: {
    fontSize: typography.fontSize.sm,
  },
  phaseText: {
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.xs,
  },
  previewWrap: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  previewRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  previewPill: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  previewAvatars: {
    flexDirection: 'row',
    marginRight: spacing.xs,
  },
  previewAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.iris,
  },
  previewAvatarText: {
    color: '#FFFFFF',
    fontFamily: fonts.display,
    fontSize: 9,
  },
  previewText: {
    color: '#FFFFFF',
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.sm,
  },
  phaseDescription: {
    color: 'rgba(255,255,255,0.86)',
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.xs,
    paddingHorizontal: spacing.xs,
  },
  readOnlyComposerInput: {
    color: 'rgba(255,255,255,0.52)',
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  loader: {
    flex: 1,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesFlipped: {
    flex: 1,
    transform: [{ scaleY: -1 }],
  },
  flip: {
    transform: [{ scaleY: -1 }],
  },
  loaderText: {
    color: '#FFFFFF',
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.sm,
    marginTop: spacing.md,
  },

  // ── Details Modal ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: Dimensions.get('window').height * 0.75,
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontFamily: fonts.display,
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: 20,
  },
  modalCover: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginBottom: 16,
  },
  modalEventTitle: {
    color: '#FFFFFF',
    fontFamily: fonts.display,
    fontSize: typography.fontSize['2xl'],
    fontWeight: '700',
    marginBottom: 10,
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 20,
  },
  modalInfoText: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: fonts.body,
    fontSize: typography.fontSize.sm,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  attendeeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  attendeeInitial: {
    color: '#FFFFFF',
    fontFamily: fonts.display,
    fontSize: typography.fontSize.md,
    fontWeight: '700',
  },
  attendeeName: {
    color: '#FFFFFF',
    fontFamily: fonts.body,
    fontSize: typography.fontSize.md,
    fontWeight: '500',
  },
  modalEmptyText: {
    color: 'rgba(255,255,255,0.3)',
    fontFamily: fonts.body,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    paddingVertical: 20,
  },
  sectionTitle: {
    marginTop: 4,
  },
});
