import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ChatKeyboardAvoidingView } from '@/components/ui/ChatKeyboardAvoidingView';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight, Crown, LockKeyhole, Send, Users, X } from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { DEMO_CHAT_MESSAGES, DEMO_EVENT_CHATS, DEMO_MODE } from '@/lib/demo';
import {
  createTypingHandler,
  sendGroupMessage,
  setGroupTypingStatus,
  subscribeToGroupChat,
  subscribeToGroupTyping,
  type GroupMessage,
  type TypingStatus,
} from '@/lib/social';
import { colors, radii, spacing, typography } from '@/lib/design/theme';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';

const fonts = typography.fontFamily;

type AttendeePreview = {
  userId: string;
  name: string;
  avatar?: string;
  badge?: string;
};

function TypingDot({ delay }: { delay: number }) {
  const lift = useSharedValue(0);

  useEffect(() => {
    lift.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-3, { duration: 220 }),
          withTiming(0, { duration: 220 }),
          withTiming(0, { duration: 320 }),
        ),
        -1,
      ),
    );
  }, [delay, lift]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }],
    opacity: lift.value < 0 ? 1 : 0.56,
  }));

  return <Animated.View style={[styles.typingDot, animatedStyle]} />;
}

function TypingIndicator({ attendee }: { attendee: AttendeePreview }) {
  return (
    <Animated.View entering={FadeIn} style={styles.typingRow}>
      <View style={styles.typingAvatar}>
        {attendee.avatar ? (
          <Image
            source={{ uri: attendee.avatar }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.avatarFallback}>{attendee.name.slice(0, 1).toUpperCase()}</Text>
        )}
      </View>
      <View style={styles.typingBubble}>
        <View style={styles.typingDots}>
          <TypingDot delay={0} />
          <TypingDot delay={120} />
          <TypingDot delay={240} />
        </View>
        <Text style={styles.typingText}>{attendee.name} is typing</Text>
      </View>
    </Animated.View>
  );
}

function MessageBubble({
  message,
  isOwnMessage,
  index,
}: {
  message: GroupMessage;
  isOwnMessage: boolean;
  index: number;
}) {
  const time = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  if (message.type === 'announcement') {
    return (
      <Animated.View
        entering={FadeInDown.delay(Math.min(index * 20, 160)).duration(240)}
        style={styles.announcement}
      >
        <View style={styles.announcementTop}>
          <Text style={styles.announcementLabel}>{message.senderName}</Text>
          <Text style={styles.announcementTime}>{time}</Text>
        </View>
        <Text style={styles.announcementText}>{message.content}</Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 20, 160)).duration(240)}
      style={[styles.messageWrap, isOwnMessage ? styles.messageWrapOwn : styles.messageWrapOther]}
    >
      {!isOwnMessage && <Text style={styles.senderName}>{message.senderName}</Text>}
      <View style={!isOwnMessage ? styles.otherMessageRow : undefined}>
        {!isOwnMessage && (
          <View style={styles.messageAvatarPeep}>
            {message.senderAvatar ? (
              <Image
                source={{ uri: message.senderAvatar }}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.avatarFallback}>
                {message.senderName.slice(0, 1).toUpperCase()}
              </Text>
            )}
          </View>
        )}
        <View style={[styles.messageBubble, isOwnMessage ? styles.ownBubble : styles.otherBubble]}>
          <Text style={styles.messageText}>{message.content}</Text>
          <Text style={styles.inlineTime}>{time}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

function AttendeesSheet({
  visible,
  onClose,
  attendees,
  total,
  subscribed,
}: {
  visible: boolean;
  onClose: () => void;
  attendees: AttendeePreview[];
  total: number;
  subscribed: boolean;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetScreen}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.base }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetEyebrow}>EVENT C1RCLE</Text>
              <Text style={styles.sheetTitle}>People going</Text>
              <Text style={styles.sheetSubtitle}>{total} verified ticket holders</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <X size={18} color={colors.gold} />
            </Pressable>
          </View>

          {!subscribed && (
            <View style={styles.lockNotice}>
              <View style={styles.lockIcon}>
                <LockKeyhole size={18} color={colors.gold} />
              </View>
              <View style={styles.lockCopy}>
                <Text style={styles.lockTitle}>Attendees are private</Text>
                <Text style={styles.lockBody}>Subscribe to C1RCLE+ to reveal everyone going.</Text>
              </View>
            </View>
          )}

          <ScrollView
            bounces={false}
            overScrollMode="never"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.attendeeList}
          >
            {attendees.map((attendee, index) => (
              <View key={attendee.userId} style={styles.attendeeRow}>
                <View style={styles.attendeeAvatar}>
                  {attendee.avatar ? (
                    <Image
                      source={{ uri: attendee.avatar }}
                      style={StyleSheet.absoluteFillObject}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={styles.attendeeInitial}>
                      {attendee.name.slice(0, 1).toUpperCase()}
                    </Text>
                  )}
                  {!subscribed && (
                    <BlurView
                      intensity={72}
                      tint="dark"
                      style={[StyleSheet.absoluteFillObject, styles.attendeeBlur]}
                    />
                  )}
                </View>
                <View style={styles.attendeeCopy}>
                  <Text style={styles.attendeeName}>
                    {subscribed ? attendee.name : `C1RCLE member ${index + 1}`}
                  </Text>
                  <Text style={styles.attendeeMeta}>
                    {subscribed ? attendee.badge || 'Verified attendee' : 'Subscribe to reveal'}
                  </Text>
                </View>
                {subscribed ? (
                  <Pressable style={styles.messageAttendeeButton}>
                    <Text style={styles.messageAttendeeText}>Message</Text>
                  </Pressable>
                ) : (
                  <LockKeyhole size={15} color={colors.goldMetallic} />
                )}
              </View>
            ))}
          </ScrollView>

          {!subscribed && (
            <Pressable
              style={styles.subscribeButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                Alert.alert('C1RCLE+', 'Subscription checkout will connect here.');
              }}
            >
              <Crown size={17} color={colors.gold} />
              <Text style={styles.subscribeText}>Unlock with C1RCLE+</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function ChatRoomScreen() {
  const { id: eventId, title } = useLocalSearchParams<{ id: string; title: string }>();
  const { user } = useAuthStore();
  const profile = useProfileStore((state) => state.profile);
  const scrollViewRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attendeesOpen, setAttendeesOpen] = useState(false);
  const [typingStatus, setTypingStatus] = useState<TypingStatus>({ isTyping: false, users: [] });

  const eventChat = DEMO_EVENT_CHATS.find((chat) => chat.eventId === eventId);
  const isSubscribed = profile?.isPremium === true;

  const attendees = useMemo<AttendeePreview[]>(() => {
    const unique = new Map<string, AttendeePreview>();
    messages.forEach((message) => {
      if (message.senderId === 'demo-user-001' || message.type === 'announcement') return;
      unique.set(message.senderId, {
        userId: message.senderId,
        name: message.senderName,
        avatar: message.senderAvatar,
        badge: message.senderBadge ? `${message.senderBadge} attendee` : 'Verified attendee',
      });
    });
    eventChat?.activeAvatars.forEach((avatar, index) => {
      const userId = `active-attendee-${index}`;
      if (!unique.has(userId) && unique.size < 6) {
        unique.set(userId, {
          userId,
          name: `Event guest ${index + 1}`,
          avatar,
          badge: 'Verified attendee',
        });
      }
    });
    return Array.from(unique.values()).slice(0, 8);
  }, [eventChat?.activeAvatars, messages]);

  const typingHandler = useMemo(() => {
    const senderId = user?.uid ?? (DEMO_MODE ? 'demo-user-001' : undefined);
    if (!eventId || !senderId) return { onChangeText: () => {}, onBlur: () => {} };
    return createTypingHandler(async (isTyping) => {
      if (!DEMO_MODE) {
        await setGroupTypingStatus(eventId, senderId, user?.displayName || 'Guest', isTyping);
      }
    });
  }, [eventId, user?.displayName, user?.uid]);

  useEffect(() => {
    if (!eventId) return;

    if (DEMO_MODE) {
      const nextMessages = (DEMO_CHAT_MESSAGES[eventId] ?? []) as GroupMessage[];
      setMessages(nextMessages);
      const demoTyper = nextMessages.find(
        (message) => message.senderId !== 'demo-user-001' && message.type === 'text',
      );
      if (demoTyper) {
        setTypingStatus({
          isTyping: true,
          users: [{ userId: demoTyper.senderId, userName: demoTyper.senderName }],
        });
      }
      setLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 100);
      return;
    }

    if (!user?.uid) return;
    const unsubscribeMessages = subscribeToGroupChat(eventId, (nextMessages) => {
      setMessages(nextMessages);
      setLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    });
    const unsubscribeTyping = subscribeToGroupTyping(eventId, user.uid, setTypingStatus);
    return () => {
      unsubscribeMessages();
      unsubscribeTyping();
    };
  }, [eventId, user?.uid]);

  const activeTyper = useMemo(() => {
    const typer = typingStatus.users[0];
    if (!typingStatus.isTyping || !typer) return null;
    return (
      attendees.find((attendee) => attendee.userId === typer.userId) ?? {
        userId: typer.userId,
        name: typer.userName,
      }
    );
  }, [attendees, typingStatus]);

  const handleSend = async () => {
    const senderId = user?.uid ?? (DEMO_MODE ? 'demo-user-001' : undefined);
    if (!inputText.trim() || !senderId || !eventId) return;

    const content = inputText.trim();
    setInputText('');
    setSending(true);
    setError(null);
    typingHandler.onBlur();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (DEMO_MODE) {
        setMessages((current) => [
          ...current,
          {
            id: `demo-group-message-${Date.now()}`,
            eventId,
            senderId,
            senderName: user?.displayName || 'Arjun M.',
            senderAvatar: user?.photoURL || 'https://i.pravatar.cc/100?img=68',
            content,
            type: 'text',
            createdAt: new Date().toISOString(),
          },
        ]);
        setTypingStatus({ isTyping: false, users: [] });
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 50);
      } else {
        const result = await sendGroupMessage(
          eventId,
          senderId,
          user?.displayName || 'Anonymous',
          content,
        );
        if (!result.success) {
          setError(result.error || 'Failed to send');
          setInputText(content);
        }
      }
    } catch (sendError: any) {
      setError(sendError.message);
      setInputText(content);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.conversationPanel} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={22} color={colors.gold} strokeWidth={2.2} />
          </Pressable>
          <Pressable
            style={styles.headerDetails}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setAttendeesOpen(true);
            }}
          >
            <View style={styles.groupIcon}>
              {eventChat?.eventCover ? (
                <Image
                  source={{ uri: eventChat.eventCover }}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="cover"
                />
              ) : (
                <Users size={19} color={colors.gold} />
              )}
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title || eventChat?.eventTitle || 'Event chat'}
              </Text>
              <Text style={styles.headerStatus}>
                {eventChat
                  ? `${eventChat.participantCount} people going · Tap to view`
                  : 'Tap to view attendees'}
              </Text>
            </View>
            <ChevronRight size={18} color="rgba(254,248,232,0.62)" />
          </Pressable>
        </View>

        <ScrollView
          bounces={false}
          overScrollMode="never"
          ref={scrollViewRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={colors.gold} />
              <Text style={styles.centerBody}>Opening event conversation</Text>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.centerState}>
              <Text style={styles.centerTitle}>Start the conversation</Text>
              <Text style={styles.centerBody}>Be the first to say hello to everyone going.</Text>
            </View>
          ) : (
            messages.map((message, index) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwnMessage={
                  message.senderId === user?.uid ||
                  (DEMO_MODE && message.senderId === 'demo-user-001')
                }
                index={index}
              />
            ))
          )}
          {activeTyper && <TypingIndicator attendee={activeTyper} />}
        </ScrollView>
      </SafeAreaView>

      <ChatKeyboardAvoidingView>
        {!loading && (
          <SafeAreaView style={styles.composerDock} edges={['bottom']}>
            {error && <Text style={styles.errorText}>{error}</Text>}
            <View style={styles.composerRow}>
              <TextInput
                value={inputText}
                onChangeText={(text) => {
                  setInputText(text);
                  typingHandler.onChangeText();
                }}
                onBlur={typingHandler.onBlur}
                placeholder="Message the event chat..."
                placeholderTextColor={colors.base[500]}
                multiline
                maxLength={500}
                style={styles.input}
              />
              <Pressable
                style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                onPress={handleSend}
                disabled={!inputText.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.goldLight} />
                ) : (
                  <Send size={18} color={colors.goldLight} fill={colors.goldLight} />
                )}
              </Pressable>
            </View>
          </SafeAreaView>
        )}
      </ChatKeyboardAvoidingView>

      <AttendeesSheet
        visible={attendeesOpen}
        onClose={() => setAttendeesOpen(false)}
        attendees={attendees}
        total={eventChat?.participantCount ?? attendees.length}
        subscribed={isSubscribed}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.base.DEFAULT },
  conversationPanel: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.base.DEFAULT,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
  },
  header: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.base[100],
  },
  backButton: {
    width: 34,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  headerDetails: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  groupIcon: {
    width: 42,
    height: 42,
    overflow: 'hidden',
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(22,22,22,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(254,248,232,0.38)',
  },
  headerCopy: { flex: 1 },
  headerTitle: {
    color: colors.gold,
    fontFamily: fonts.display,
    fontSize: typography.fontSize.lg,
    letterSpacing: -0.55,
  },
  headerStatus: {
    color: colors.goldMetallic,
    fontFamily: fonts.body,
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  messages: { flex: 1 },
  messagesContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  centerTitle: { color: colors.gold, fontFamily: fonts.heading, fontSize: typography.fontSize.lg },
  centerBody: {
    color: 'rgba(254,248,232,0.62)',
    fontFamily: fonts.body,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  messageWrap: { maxWidth: '84%', marginBottom: spacing.md },
  messageWrapOwn: { alignSelf: 'flex-end' },
  messageWrapOther: { alignSelf: 'flex-start' },
  senderName: {
    color: colors.goldMetallic,
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.xs,
    marginLeft: 32,
    marginBottom: spacing.xs,
  },
  otherMessageRow: { flexDirection: 'row', alignItems: 'flex-end', marginLeft: 4 },
  messageAvatarPeep: {
    width: 26,
    height: 26,
    marginRight: -7,
    marginBottom: -3,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.gold,
    backgroundColor: colors.base[100],
    zIndex: 2,
  },
  avatarFallback: {
    color: colors.gold,
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.xs,
  },
  messageBubble: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
  },
  ownBubble: { borderBottomRightRadius: radii.sm, backgroundColor: colors.iris },
  otherBubble: { borderBottomLeftRadius: radii.sm, backgroundColor: colors.irisDim },
  messageText: {
    flexShrink: 1,
    color: colors.goldLight,
    fontFamily: fonts.medium,
    fontSize: typography.fontSize.sm,
    lineHeight: 18,
  },
  inlineTime: {
    color: 'rgba(255,255,255,0.64)',
    fontFamily: fonts.medium,
    fontSize: 8,
    marginBottom: 1,
  },
  announcement: {
    alignSelf: 'stretch',
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.irisDim,
    borderWidth: 1,
    borderColor: colors.irisGlow,
  },
  announcementTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  announcementLabel: {
    color: colors.gold,
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  announcementText: {
    color: colors.goldLight,
    fontFamily: fonts.medium,
    fontSize: typography.fontSize.sm,
    lineHeight: 18,
  },
  announcementTime: { color: 'rgba(255,255,255,0.64)', fontFamily: fonts.medium, fontSize: 8 },
  typingRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: spacing.xs,
    marginLeft: 4,
  },
  typingAvatar: {
    width: 28,
    height: 28,
    marginRight: -7,
    marginBottom: -3,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.gold,
    backgroundColor: colors.base[100],
    zIndex: 2,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderBottomLeftRadius: radii.sm,
    backgroundColor: colors.irisDim,
  },
  typingDots: { flexDirection: 'row', gap: 3 },
  typingDot: { width: 4, height: 4, borderRadius: radii.pill, backgroundColor: colors.gold },
  typingText: { color: colors.gold, fontFamily: fonts.body, fontSize: typography.fontSize.xs },
  composerDock: {
    backgroundColor: colors.base.DEFAULT,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  composerRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.xs,
    borderRadius: radii.bubble,
    borderWidth: 1,
    borderColor: colors.base[400],
    backgroundColor: colors.base[50],
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 108,
    color: colors.gold,
    fontFamily: fonts.body,
    fontSize: typography.fontSize.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.iris,
  },
  sendButtonDisabled: { opacity: 0.55 },
  errorText: {
    color: colors.error,
    fontFamily: fonts.medium,
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  sheetScreen: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    maxHeight: '76%',
    backgroundColor: colors.base.DEFAULT,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.base[200],
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.base[300],
    marginBottom: spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  sheetEyebrow: {
    color: colors.irisGlow,
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.xs,
    letterSpacing: 1.2,
  },
  sheetTitle: {
    color: colors.gold,
    fontFamily: fonts.display,
    fontSize: typography.fontSize['2xl'],
    letterSpacing: -0.7,
    marginTop: 2,
  },
  sheetSubtitle: {
    color: colors.goldMetallic,
    fontFamily: fonts.body,
    fontSize: typography.fontSize.sm,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.base[100],
  },
  lockNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(244,74,34,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(244,74,34,0.35)',
  },
  lockIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.iris,
  },
  lockCopy: { flex: 1 },
  lockTitle: { color: colors.gold, fontFamily: fonts.heading, fontSize: typography.fontSize.base },
  lockBody: {
    color: colors.goldMetallic,
    fontFamily: fonts.body,
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  attendeeList: { paddingBottom: spacing.md },
  attendeeRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.base[100],
  },
  attendeeAvatar: {
    width: 46,
    height: 46,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.base[100],
  },
  attendeeBlur: { borderRadius: radii.pill, overflow: 'hidden' },
  attendeeInitial: {
    color: colors.gold,
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.base,
  },
  attendeeCopy: { flex: 1 },
  attendeeName: {
    color: colors.gold,
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.base,
  },
  attendeeMeta: {
    color: colors.goldMetallic,
    fontFamily: fonts.body,
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  messageAttendeeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.base[100],
  },
  messageAttendeeText: {
    color: colors.gold,
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.xs,
  },
  subscribeButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.iris,
    marginTop: spacing.sm,
  },
  subscribeText: {
    color: colors.gold,
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.base,
  },
});
