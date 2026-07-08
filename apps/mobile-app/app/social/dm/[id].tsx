import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
  Image,
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
  BrightToolButton,
  BrightTypingIndicator,
  SwipeableMessage,
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
  sendDirectImageMessage,
} from '@/lib/social';
import { useAuthStore } from '@/store/authStore';
import { useChatImagePicker } from '@/hooks/useChatImagePicker';
import { PremiumBadgeDot } from '@/components/ui/PremiumBadge';
import { MoreVertical, Flag, Ban, ImagePlus } from 'lucide-react-native';

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
  const [likedMessageIds, setLikedMessageIds] = useState<Set<string>>(() => new Set());
  const [conversationError, setConversationError] = useState(false);

  const { canSend, cooldownSeconds, checkRateLimit } = useChatRateLimit();
  const { uploading: imageUploading, pickAndUpload } = useChatImagePicker(
    user?.uid || '',
    `dm/${conversationId || 'unknown'}`,
  );
  const visibleMessages = useMemo(() => {
    const filtered = messages.filter((message) => !hiddenMessageIds.has(message.id));
    const tempIds = new Set(tempMessages.map((m) => m.id));
    for (const tm of tempMessages) {
      if (!filtered.find((m) => m.id === tm.id)) {
        filtered.push(tm);
      }
    }
    filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const withDividers: any[] = [];
    let lastDateStr = '';

    for (const msg of filtered) {
      const d = new Date(msg.createdAt);
      const dateStr = d.toLocaleDateString();
      if (dateStr !== lastDateStr) {
        const today = new Date().toLocaleDateString();
        const yesterday = new Date(Date.now() - 86400000).toLocaleDateString();
        let text = dateStr;
        if (dateStr === today) text = 'Today';
        else if (dateStr === yesterday) text = 'Yesterday';
        else {
          text = d.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          });
        }
        withDividers.push({ id: `divider-${dateStr}`, type: 'divider', text });
        lastDateStr = dateStr;
      }
      withDividers.push(msg);
    }
    return withDividers;
  }, [hiddenMessageIds, messages, tempMessages]);
  const sortedMessages = useMemo(() => [...visibleMessages].reverse(), [visibleMessages]);

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
          if (active) setConversationError(true);
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
          const result = await reportUser(user.uid, otherUserId, 'inappropriate');
          if (result.success) {
            Alert.alert('Reported', 'Thank you. Our team will review this.');
          } else {
            Alert.alert('Error', result.error || 'Failed to report user.');
          }
        },
      },
    ]);
  }, [otherUserId, otherUserName, user?.uid]);

  const handleViewProfile = useCallback(() => {
    if (!otherUserId) return;
    router.push({
      pathname: '/social/profile/[id]',
      params: { id: otherUserId },
    });
  }, [otherUserId]);

  const handleHeaderMenu = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['View Profile', 'Report User', 'Block User', 'Cancel'],
          cancelButtonIndex: 3,
          destructiveButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) handleViewProfile();
          else if (buttonIndex === 1) handleReportUser();
          else if (buttonIndex === 2) handleBlockUser();
        },
      );
    } else {
      Alert.alert('Options', undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'View Profile', onPress: handleViewProfile },
        { text: 'Report User', style: 'destructive', onPress: handleReportUser },
        { text: 'Block User', style: 'destructive', onPress: handleBlockUser },
      ]);
    }
  }, [handleBlockUser, handleReportUser, handleViewProfile]);

  const handleMessageOptions = useCallback(
    (message: DirectMessage) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const isOwnMessage = message.senderId === user?.uid;

      const actions = isOwnMessage
        ? [
            {
              text: 'Delete Message',
              style: 'destructive' as const,
              onPress: () => hideMessageLocally(message.id),
            },
          ]
        : [
            {
              text: 'Report Message',
              style: 'destructive' as const,
              onPress: () => handleReportMessage(message),
            },
          ];

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: [isOwnMessage ? 'Delete Message' : 'Report Message', 'Cancel'],
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
    [handleReportMessage, hideMessageLocally, user?.uid],
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
      const actions = isOwnMessage
        ? [
            {
              label: 'Delete',
              icon: <Ban size={14} color="#fff" />,
              color: '#FF3B30',
              onPress: () => hideMessageLocally(item.id),
            },
          ]
        : [
            {
              label: 'Report',
              icon: <Flag size={14} color="#fff" />,
              color: '#FF6B4A',
              onPress: () => handleReportMessage(item),
            },
          ];

      return (
        <View style={styles.flip}>
          <SwipeableMessage actions={actions}>
            <BrightMessage
              content={item.content}
              time={formatChatTime(item.createdAt)}
              senderAvatar={avatarUrl}
              type={item.type === 'image' ? 'image' : 'text'}
              isOwnMessage={isOwnMessage}
              index={index}
              animate={index < 5}
              isLiked={item.isLiked || likedMessageIds.has(item.id)}
              onLongPress={() => handleMessageOptions(item)}
              onDoubleTap={() => toggleMessageLikeLocally(item.id)}
            />
          </SwipeableMessage>
        </View>
      );
    },
    [
      avatarUrl,
      handleMessageOptions,
      toggleMessageLikeLocally,
      likedMessageIds,
      hideMessageLocally,
      handleReportMessage,
      user?.uid,
    ],
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
      likedMessageIds,
      messageCount: visibleMessages.length,
    }),
    [otherIsTyping, otherUserName, avatarUrl, user?.uid, likedMessageIds, visibleMessages.length],
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

  if (!loading && !conversation && conversationError) {
    return (
      <BrightChatSurface theme={theme}>
        <View style={styles.conversation}>
          <SafeAreaView style={styles.conversation} edges={['top']}>
            <BrightChatHeader
              theme={theme}
              onBack={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/(tabs)/inbox');
              }}
            />
            <View
              style={[
                styles.conversation,
                { alignItems: 'center', justifyContent: 'center', padding: 24 },
              ]}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
                Failed to load conversation
              </Text>
              <Text
                style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 16 }}
              >
                This conversation may not exist or you may not have access.
              </Text>
              <Pressable
                onPress={() => router.back()}
                style={{
                  backgroundColor: colors.iris,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 24,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Go Back</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </BrightChatSurface>
    );
  }

  return (
    <BrightChatSurface theme={theme}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
            data={sortedMessages}
            renderItem={renderMessage}
            keyExtractor={(message) => message.id}
            drawDistance={440}
            style={styles.messagesFlipped}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            onScroll={(e: any) => {
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
          <SafeAreaView edges={['bottom']}>
            <BrightComposerDock>
              <BrightTextInput
                value={inputText}
                onChangeText={(text) => {
                  setInputText(text);
                  typingHandler.onChangeText();
                }}
                onBlur={typingHandler.onBlur}
                placeholder="Type a message"
                multiline
                maxLength={500}
              />
              <BrightToolButton
                onPress={async () => {
                  if (!conversationId || !user?.uid) return;
                  if (!checkRateLimit()) return;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const url = await pickAndUpload();
                  if (url) {
                    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                    const tempMsg: DirectMessage = {
                      id: tempId,
                      conversationId,
                      senderId: user.uid,
                      content: url,
                      type: 'image',
                      createdAt: new Date().toISOString(),
                      readAt: undefined,
                      isDeleted: false,
                    };
                    setTempMessages((current) => [...current, tempMsg]);
                    const result = await sendDirectImageMessage(conversationId, user.uid, url);
                    setTempMessages((current) => current.filter((m) => m.id !== tempId));
                    if (!result.success) {
                      Alert.alert('Error', result.error || 'Failed to send image');
                    }
                  }
                }}
                disabled={imageUploading || !canSend}
              >
                {imageUploading ? (
                  <ActivityIndicator size="small" color={colors.iris} />
                ) : (
                  <ImagePlus size={19} color={colors.iris} />
                )}
              </BrightToolButton>
              <BrightSendButton
                onPress={handleSend}
                disabled={!inputText.trim() || sending || !canSend}
                loading={sending}
                cooldownSeconds={!canSend ? cooldownSeconds : undefined}
              />
            </BrightComposerDock>
          </SafeAreaView>
        ) : null}
      </KeyboardAvoidingView>
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
