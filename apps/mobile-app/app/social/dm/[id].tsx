import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  BrightCenterState,
  BrightChatHeader,
  BrightChatSurface,
  BrightComposerDock,
  BrightMessage,
  BrightSendButton,
  BrightTextInput,
  BrightTypingIndicator,
  formatChatTime,
  type ChatSurfaceTheme,
} from '@/components/chat/BrightChatSurface';
import { useChatRateLimit } from '@/hooks/useChatRateLimit';
import { apiFetch } from '@/lib/api';
import { colors, radii, spacing, typography } from '@/lib/design/theme';
import {
  acceptDMRequest,
  createTypingHandler,
  declineDMRequest,
  type DirectMessage,
  type PrivateConversation,
  sendDirectMessage,
  setDMTypingStatus,
  subscribeToDirectMessages,
  subscribeToDMTyping,
  reportMessage,
  reportUser,
  blockUser,
} from '@/lib/social';
import { useAuthStore } from '@/store/authStore';
import { PremiumBadgeDot } from '@/components/ui/PremiumBadge';
import { MoreVertical } from 'lucide-react-native';

const fonts = typography.fontFamily;

function RequestBanner({
  loading,
  onAccept,
  onDecline,
}: {
  loading: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <View style={styles.requestBanner}>
      <Text style={styles.requestTitle}>New chat request</Text>
      <Text style={styles.requestText}>Accept this request to continue chatting.</Text>
      <View style={styles.requestActions}>
        <Pressable style={styles.requestSecondary} onPress={onDecline} disabled={loading}>
          <Text style={styles.requestSecondaryText}>Decline</Text>
        </Pressable>
        <Pressable style={styles.requestPrimary} onPress={onAccept} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.requestPrimaryText}>Accept</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

export default function DirectMessageScreen() {
  const { id: conversationId, recipientName } = useLocalSearchParams<{
    id: string;
    recipientName?: string;
    eventId?: string;
  }>();
  const { user } = useAuthStore();
  const messagesListRef = useRef<FlashListRef<DirectMessage>>(null);

  const [conversation, setConversation] = useState<PrivateConversation | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [tempMessages, setTempMessages] = useState<DirectMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [otherUserId, setOtherUserId] = useState<string | undefined>(undefined);
  const [otherUserName, setOtherUserName] = useState(recipientName || 'Guest');
  const [otherIsPremium, setOtherIsPremium] = useState(false);
  const [otherIsTyping, setOtherIsTyping] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [sharedEvent, setSharedEvent] = useState<string | undefined>(undefined);
  const [hiddenMessageIds, setHiddenMessageIds] = useState<Set<string>>(() => new Set());

  const { canSend, cooldownSeconds, checkRateLimit } = useChatRateLimit();
  const visibleMessages = useMemo(() => {
    const filtered = messages.filter((message) => !hiddenMessageIds.has(message.id));
    const tempIds = new Set(tempMessages.map((m) => m.id));
    for (const tm of tempMessages) {
      if (!filtered.find((m) => m.id === tm.id)) {
        filtered.push(tm);
      }
    }
    return filtered;
  }, [hiddenMessageIds, messages, tempMessages]);

  const typingHandler = useMemo(() => {
    if (conversationId && user?.uid) {
      return createTypingHandler(async (isTyping) => {
        await setDMTypingStatus(conversationId, user.uid, user.displayName || 'Guest', isTyping);
      });
    }
    return { onChangeText: () => {}, onBlur: () => {} };
  }, [conversationId, user?.uid, user?.displayName]);

  useFocusEffect(
    useCallback(() => {
      if (!conversationId || !user?.uid) return;
      let active = true;

      async function fetchConversation() {
        try {
          const response = await apiFetch<{ conversation: PrivateConversation }>(
            `/api/v1/social/dm/${conversationId}`,
            { requireAuth: true },
          );
          if (active) {
            setConversation(response.conversation);
            setSharedEvent(
              response.conversation.eventId ? `Event ${response.conversation.eventId}` : undefined,
            );
            const otherUserId = response.conversation.participants.find(
              (participant) => participant !== user!.uid,
            );
            if (otherUserId) {
              setOtherUserId(otherUserId);
              const profile = await apiFetch<any>(`/api/v1/profiles/${otherUserId}`, {
                requireAuth: false,
              });
              const publicProfile = profile?.data || profile;
              setOtherUserName(publicProfile?.displayName || 'Guest');
              setAvatarUrl(publicProfile?.photoURL);
              setOtherIsPremium(
                publicProfile?.isPremium === true ||
                  publicProfile?.subscription?.tier === 'premium',
              );
            }
          }
        } catch {
          // Preserve the existing silent live-chat fallback.
        } finally {
          if (active) setLoading(false);
        }
      }

      fetchConversation();
      const unsubscribeMessages = subscribeToDirectMessages(conversationId, (nextMessages) => {
        if (active) {
          setMessages(nextMessages);
        }
      });
      const unsubscribeTyping = subscribeToDMTyping(conversationId, user.uid, (isTyping, name) => {
        if (active) {
          setOtherIsTyping(isTyping);
          if (name) setOtherUserName(name);
        }
      });

      return () => {
        active = false;
        unsubscribeMessages();
        unsubscribeTyping();
      };
    }, [conversationId, user?.uid, recipientName]),
  );

  const handleSend = async () => {
    const senderId = user?.uid;
    if (!inputText.trim() || !conversationId || !senderId || !checkRateLimit()) return;

    const content = inputText.trim();
    setInputText('');
    setSending(true);
    typingHandler.onBlur();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tempMsg: DirectMessage = {
      id: tempId,
      conversationId,
      senderId,
      content,
      type: 'text',
      createdAt: new Date().toISOString(),
      readAt: undefined,
      isDeleted: false,
    };
    setTempMessages((current) => [...current, tempMsg]);

    try {
      await sendDirectMessage(conversationId, senderId, content);
      setTempMessages((current) => current.filter((m) => m.id !== tempId));
    } catch (error: any) {
      setTempMessages((current) => current.filter((m) => m.id !== tempId));
      Alert.alert('Error', error.message);
      setInputText(content);
    } finally {
      setSending(false);
    }
  };

  const isPending = conversation?.status === 'pending';
  const isRecipient = conversation?.initiatedBy !== user?.uid;
  const isAccepted = conversation?.status === 'accepted';
  const theme: ChatSurfaceTheme = {
    mode: 'dm',
    title: otherUserName,
    subtitle: otherIsTyping
      ? 'typing...'
      : sharedEvent
        ? `Met through ${sharedEvent}`
        : isAccepted
          ? 'Connected through THE C1RCLE'
          : 'Request pending',
    backgroundImage: avatarUrl,
    heroImage: avatarUrl,
    avatarUrls: user?.photoURL ? [user.photoURL] : [],
    accentColor: colors.iris,
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

  const handleReportMessage = useCallback(
    async (message: DirectMessage) => {
      if (!conversationId || !message.id || !message.senderId) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      hideMessageLocally(message.id);

      const result = await reportMessage({
        messageId: message.id,
        conversationId,
        eventId: conversation?.eventId,
        senderId: message.senderId,
      });

      if (!result.success) {
        restoreMessageLocally(message.id);
        Alert.alert('Unable to report', result.error || 'Please try again.');
      }
    },
    [conversation?.eventId, conversationId, hideMessageLocally, restoreMessageLocally],
  );

  const handleBlockUser = useCallback(async () => {
    if (!otherUserId || !user?.uid) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Block User', `Are you sure you want to block ${otherUserName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          const result = await blockUser(user.uid, otherUserId);
          if (result.success) {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/inbox');
            }
          } else {
            Alert.alert('Error', result.error || 'Failed to block user.');
          }
        },
      },
    ]);
  }, [otherUserId, otherUserName, user?.uid]);

  const handleReportUser = useCallback(() => {
    if (!otherUserId || !user?.uid) return;
    Alert.alert('Report User', `Report ${otherUserName} for inappropriate behaviour?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report',
        style: 'destructive',
        onPress: async () => {
          const result = await reportUser(user.uid, otherUserId, 'inappropriate_behaviour');
          if (result.success) {
            Alert.alert('Reported', 'Thank you. Our team will review this.');
          } else {
            Alert.alert('Error', result.error || 'Failed to report user.');
          }
        },
      },
    ]);
  }, [otherUserId, otherUserName, user?.uid]);

  const handleHeaderMenu = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Report User', 'Block User', 'Cancel'],
          cancelButtonIndex: 2,
          destructiveButtonIndex: 1,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) handleReportUser();
          else if (buttonIndex === 1) handleBlockUser();
        },
      );
    } else {
      Alert.alert('Options', undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Report User', style: 'destructive', onPress: handleReportUser },
        { text: 'Block User', style: 'destructive', onPress: handleBlockUser },
      ]);
    }
  }, [handleBlockUser, handleReportUser]);

  const handleMessageOptions = useCallback(
    (message: DirectMessage) => {
      if (message.senderId === user?.uid) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const actions = [
        {
          text: 'Report Message',
          style: 'destructive' as const,
          onPress: () => handleReportMessage(message),
        },
      ];

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Report Message', 'Cancel'],
            cancelButtonIndex: 1,
            destructiveButtonIndex: 0,
          },
          (buttonIndex) => {
            if (buttonIndex === 0) actions[0].onPress();
          },
        );
        return;
      }

      Alert.alert('Message', undefined, [{ text: 'Cancel', style: 'cancel' }, ...actions]);
    },
    [handleReportMessage, user?.uid],
  );

  const renderMessage = useCallback(
    ({ item, index }: { item: DirectMessage; index: number }) => (
      <View style={styles.flip}>
        <BrightMessage
          content={item.content}
          time={formatChatTime(item.createdAt)}
          senderAvatar={avatarUrl}
          type={item.type === 'image' ? 'image' : 'text'}
          isOwnMessage={item.senderId === user?.uid}
          index={index}
          animate={index < 5}
          onLongPress={() => handleMessageOptions(item)}
        />
      </View>
    ),
    [avatarUrl, handleMessageOptions, user?.uid],
  );

  const messageListEmpty = useMemo(
    () => <BrightCenterState title="Say hello" body="Your conversation will appear here." />,
    [],
  );

  const [isScrolled, setIsScrolled] = useState(false);

  const flashListExtraData = useMemo(
    () => ({
      otherIsTyping,
      otherUserName,
      avatarUrl,
      userId: user?.uid,
      messageCount: visibleMessages.length,
    }),
    [otherIsTyping, otherUserName, avatarUrl, user?.uid, visibleMessages.length],
  );

  if (loading) {
    return (
      <BrightChatSurface theme={theme}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      </BrightChatSurface>
    );
  }

  return (
    <BrightChatSurface theme={theme}>
      <SafeAreaView style={styles.conversation} edges={['top']}>
        <BrightChatHeader
          theme={theme}
          compact={isScrolled}
          onBack={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/inbox');
            }
          }}
          rightAccessory={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {otherUserId ? (
                <Pressable
                  onPress={handleHeaderMenu}
                  hitSlop={8}
                  style={styles.headerMenuBtn}
                  accessibilityLabel="More options"
                >
                  <MoreVertical size={18} color="rgba(255,255,255,0.7)" strokeWidth={1.8} />
                </Pressable>
              ) : null}
              <PremiumBadgeDot visible={otherIsPremium} />
            </View>
          }
        />

        {isPending && isRecipient ? (
          <RequestBanner
            loading={actionLoading}
            onAccept={async () => {
              if (!user?.uid) return;
              setActionLoading(true);
              await acceptDMRequest(conversationId, user.uid);
              setConversation((current) =>
                current ? { ...current, status: 'accepted' } : current,
              );
              setActionLoading(false);
            }}
            onDecline={() => {
              if (!user?.uid) return;
              declineDMRequest(conversationId, user.uid).then(() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)/inbox');
                }
              });
            }}
          />
        ) : null}

        <FlashList
          ref={messagesListRef}
          data={[...visibleMessages].reverse()}
          renderItem={renderMessage}
          keyExtractor={(message) => message.id}
          drawDistance={440}
          style={styles.messagesFlipped}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
            const y = e.nativeEvent.contentOffset.y;
            if (y > 40 && !isScrolled) setIsScrolled(true);
            else if (y <= 40 && isScrolled) setIsScrolled(false);
          }}
          scrollEventThrottle={16}
          ListEmptyComponent={<View style={styles.flip}>{messageListEmpty}</View>}
          ListHeaderComponent={
            otherIsTyping ? (
              <View style={styles.flip}>
                <BrightTypingIndicator name={otherUserName} avatarUrl={avatarUrl} />
              </View>
            ) : null
          }
          extraData={flashListExtraData}
        />
      </SafeAreaView>

      {isAccepted ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView edges={['bottom']}>
            <BrightComposerDock>
              <BrightTextInput
                value={inputText}
                onChangeText={(text) => {
                  setInputText(text);
                  typingHandler.onChangeText();
                }}
                onBlur={typingHandler.onBlur}
                placeholder="Your message..."
                multiline
                maxLength={500}
              />
              <BrightSendButton
                onPress={handleSend}
                disabled={!inputText.trim() || sending || !canSend}
                loading={sending}
                cooldownSeconds={!canSend ? cooldownSeconds : undefined}
              />
            </BrightComposerDock>
          </SafeAreaView>
        </KeyboardAvoidingView>
      ) : null}
    </BrightChatSurface>
  );
}

const styles = StyleSheet.create({
  conversation: {
    flex: 1,
  },
  headerMenuBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  requestBanner: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    padding: spacing.base,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#07324A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
  requestTitle: {
    color: '#121212',
    fontFamily: fonts.display,
    fontSize: typography.fontSize.lg,
    textAlign: 'center',
  },
  requestText: {
    color: 'rgba(18,18,18,0.58)',
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  requestSecondary: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(18,18,18,0.08)',
  },
  requestPrimary: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.iris,
  },
  messagesFlipped: {
    flex: 1,
    transform: [{ scaleY: -1 }],
  },
  flip: {
    transform: [{ scaleY: -1 }],
  },
  requestSecondaryText: {
    color: '#121212',
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.sm,
  },
  requestPrimaryText: {
    color: '#FFFFFF',
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.sm,
  },
});
