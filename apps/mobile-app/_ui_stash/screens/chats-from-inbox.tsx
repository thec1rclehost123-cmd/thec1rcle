import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, MessageCircle, Search, Users } from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import {
  DEMO_EVENT_CHATS,
  DEMO_MODE,
  DEMO_NEW_MATCHES,
  DEMO_PRIVATE_CHATS,
  type DemoEventChat,
  type DemoNewMatch,
  type DemoPrivateChat,
} from '@/lib/demo';
import { colors, radii, spacing, typography } from '@/lib/design/theme';

type ChatTab = 'direct' | 'groups';

const fonts = typography.fontFamily;

function formatChatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMinutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m`;
  if (diffMinutes < 1440)
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (diffMinutes < 2880) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function LikeRequest({ match, index }: { match: DemoNewMatch; index: number }) {
  const hidden = index > 0;

  return (
    <Pressable
      style={requestStyles.item}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (!hidden) {
          router.push({
            pathname: '/social/dm/[id]',
            params: { id: match.id, recipientName: match.name },
          });
        }
      }}
    >
      <View style={requestStyles.avatarShell}>
        <Image source={{ uri: match.photoURL }} style={requestStyles.avatar} resizeMode="cover" />
        {hidden && (
          <BlurView
            intensity={80}
            tint="dark"
            style={[StyleSheet.absoluteFillObject, requestStyles.blur]}
          />
        )}
      </View>
      <Text style={requestStyles.name} numberOfLines={1}>
        {hidden ? 'Like' : match.name}
      </Text>
    </Pressable>
  );
}

function OrangeRequestPanel() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(true);
  const progress = useSharedValue(1);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    progress.value = withSpring(next ? 1 : 0, { damping: 20, stiffness: 190 });
  };

  const panelStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [insets.top + 82, insets.top + 300]),
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: withTiming(open ? 1 : 0, { duration: open ? 220 : 100 }),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [-18, 0]) }],
  }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(progress.value, [0, 1], [180, 0])}deg` }],
  }));

  return (
    <Animated.View style={[styles.orangePanel, panelStyle]}>
      <View style={[styles.searchRow, { marginTop: insets.top + spacing.sm }]}>
        <Pressable style={styles.searchPill}>
          <Search size={16} color={colors.base[100]} strokeWidth={2} />
          <Text style={styles.searchText}>Search</Text>
        </Pressable>
        <Pressable style={styles.collapseButton} onPress={toggle}>
          <Animated.View style={chevronStyle}>
            <ChevronDown size={24} color={colors.gold} strokeWidth={2.2} />
          </Animated.View>
        </Pressable>
      </View>

      <Animated.View
        style={[styles.orangePanelContent, contentStyle]}
        pointerEvents={open ? 'auto' : 'none'}
      >
        <Text style={styles.connectedTitle}>Let&apos;s Stay{'\n'}Connected</Text>
        <Text style={styles.requestCaption}>Like requests</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={requestStyles.list}
        >
          {DEMO_NEW_MATCHES.slice(0, 6).map((match, index) => (
            <LikeRequest key={match.id} match={match} index={index} />
          ))}
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

function DirectMessageRow({ chat, index }: { chat: DemoPrivateChat; index: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(260)}>
      <Pressable
        style={rowStyles.row}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({
            pathname: '/social/dm/[id]',
            params: { id: chat.id, recipientName: chat.otherUserName },
          });
        }}
      >
        <View style={rowStyles.avatarWrap}>
          <Image
            source={{ uri: chat.otherUserAvatar }}
            style={rowStyles.avatar}
            resizeMode="cover"
          />
          {chat.isOnline && <View style={rowStyles.onlineDot} />}
        </View>
        <View style={rowStyles.copy}>
          <View style={rowStyles.titleRow}>
            <Text style={rowStyles.title} numberOfLines={1}>
              {chat.otherUserName}
            </Text>
            <Text style={rowStyles.time}>{formatChatTime(chat.lastMessageTime)}</Text>
          </View>
          <View style={rowStyles.previewRow}>
            <Text
              style={[rowStyles.preview, chat.unreadCount > 0 && rowStyles.previewUnread]}
              numberOfLines={1}
            >
              {chat.lastMessage}
            </Text>
            {chat.unreadCount > 0 && <View style={rowStyles.unreadDot} />}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function EventGroupRow({ chat, index }: { chat: DemoEventChat; index: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(260)}>
      <Pressable
        style={rowStyles.row}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({
            pathname: '/chat/[id]',
            params: { id: chat.eventId, title: chat.eventTitle },
          });
        }}
      >
        <View style={rowStyles.eventCoverWrap}>
          <Image
            source={{ uri: chat.eventCover }}
            style={rowStyles.eventCover}
            resizeMode="cover"
          />
          <View style={rowStyles.eventIcon}>
            <Users size={13} color={colors.goldLight} />
          </View>
        </View>
        <View style={rowStyles.copy}>
          <View style={rowStyles.titleRow}>
            <Text style={rowStyles.title} numberOfLines={1}>
              {chat.eventTitle}
            </Text>
            <Text style={rowStyles.time}>{formatChatTime(chat.lastMessageTime)}</Text>
          </View>
          <View style={rowStyles.previewRow}>
            <Text
              style={[rowStyles.preview, chat.unreadCount > 0 && rowStyles.previewUnread]}
              numberOfLines={1}
            >
              {chat.lastMessageSender}: {chat.lastMessage}
            </Text>
            {chat.unreadCount > 0 && <View style={rowStyles.unreadDot} />}
          </View>
          <Text style={rowStyles.groupMeta}>{chat.participantCount} people in this event chat</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function ChatTabs({
  activeTab,
  onChange,
}: {
  activeTab: ChatTab;
  onChange: (tab: ChatTab) => void;
}) {
  return (
    <View style={styles.tabs}>
      <Pressable style={styles.tab} onPress={() => onChange('direct')}>
        <MessageCircle
          size={15}
          color={activeTab === 'direct' ? colors.gold : colors.goldMetallic}
        />
        <Text style={[styles.tabText, activeTab === 'direct' && styles.tabTextActive]}>Direct</Text>
        {activeTab === 'direct' && <View style={styles.tabLine} />}
      </Pressable>
      <Pressable style={styles.tab} onPress={() => onChange('groups')}>
        <Users size={15} color={activeTab === 'groups' ? colors.gold : colors.goldMetallic} />
        <Text style={[styles.tabText, activeTab === 'groups' && styles.tabTextActive]}>
          Event groups
        </Text>
        {activeTab === 'groups' && <View style={styles.tabLine} />}
      </Pressable>
    </View>
  );
}

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<ChatTab>('direct');

  const switchTab = (tab: ChatTab) => {
    Haptics.selectionAsync();
    setActiveTab(tab);
  };

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-24, 24])
    .failOffsetY([-18, 18])
    .onEnd((event) => {
      if (event.translationX < -52 && activeTab === 'direct') {
        runOnJS(switchTab)('groups');
      } else if (event.translationX > 52 && activeTab === 'groups') {
        runOnJS(switchTab)('direct');
      }
    });

  return (
    <View style={styles.container}>
      <OrangeRequestPanel />
      <GestureDetector gesture={swipeGesture}>
        <View style={styles.blackList}>
          <ChatTabs activeTab={activeTab} onChange={switchTab} />
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
            showsVerticalScrollIndicator={false}
          >
            {activeTab === 'direct' ? (
              <Animated.View entering={FadeIn.duration(180)}>
                {DEMO_MODE && DEMO_PRIVATE_CHATS.length > 0 ? (
                  DEMO_PRIVATE_CHATS.map((chat, index) => (
                    <DirectMessageRow key={chat.id} chat={chat} index={index} />
                  ))
                ) : (
                  <View style={styles.empty}>
                    <Text style={styles.emptyTitle}>No direct messages yet</Text>
                    <Text style={styles.emptyBody}>
                      Your one-on-one conversations will appear here.
                    </Text>
                  </View>
                )}
              </Animated.View>
            ) : (
              <Animated.View entering={FadeIn.duration(180)}>
                {DEMO_MODE && DEMO_EVENT_CHATS.length > 0 ? (
                  DEMO_EVENT_CHATS.map((chat, index) => (
                    <EventGroupRow key={chat.id} chat={chat} index={index} />
                  ))
                ) : (
                  <View style={styles.empty}>
                    <Text style={styles.emptyTitle}>No event groups yet</Text>
                    <Text style={styles.emptyBody}>Ticketed event chats will appear here.</Text>
                  </View>
                )}
              </Animated.View>
            )}
          </ScrollView>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
  },
  orangePanel: {
    overflow: 'hidden',
    zIndex: 2,
    backgroundColor: colors.iris,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
  },
  searchPill: {
    flex: 1,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(22,22,22,0.12)',
  },
  searchText: {
    color: colors.base[100],
    fontFamily: fonts.medium,
    fontSize: typography.fontSize.sm,
  },
  collapseButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orangePanelContent: {
    paddingTop: spacing.lg,
  },
  connectedTitle: {
    color: colors.gold,
    fontFamily: fonts.display,
    fontSize: typography.fontSize['3xl'],
    lineHeight: 31,
    letterSpacing: -1,
    paddingHorizontal: spacing.base,
  },
  requestCaption: {
    color: 'rgba(22,22,22,0.56)',
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.xs,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.base,
    marginTop: spacing.base,
    marginBottom: spacing.sm,
  },
  blackList: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.base[100],
    paddingHorizontal: spacing.base,
  },
  tab: {
    position: 'relative',
    flex: 1,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  tabText: {
    color: colors.goldMetallic,
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.sm,
  },
  tabTextActive: {
    color: colors.gold,
  },
  tabLine: {
    position: 'absolute',
    left: '28%',
    right: '28%',
    bottom: 0,
    height: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.iris,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: spacing.base,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyTitle: {
    color: colors.gold,
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.base,
  },
  emptyBody: {
    color: colors.goldMetallic,
    fontFamily: fonts.body,
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
});

const requestStyles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing.base,
    paddingRight: spacing.xxl,
  },
  item: {
    width: 70,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  avatarShell: {
    width: 58,
    height: 58,
    borderRadius: radii.pill,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.gold,
    backgroundColor: colors.irisDim,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  blur: {
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  name: {
    color: colors.gold,
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});

const rowStyles = StyleSheet.create({
  row: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.base[100],
    paddingVertical: spacing.md,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radii.pill,
  },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 11,
    height: 11,
    borderRadius: radii.pill,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.base.DEFAULT,
  },
  eventCoverWrap: {
    position: 'relative',
    width: 52,
    height: 52,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  eventCover: {
    width: '100%',
    height: '100%',
  },
  eventIcon: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 21,
    height: 21,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlayHeavy,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    color: colors.gold,
    fontFamily: fonts.heading,
    fontSize: typography.fontSize.base,
    letterSpacing: -0.2,
  },
  time: {
    color: colors.goldMetallic,
    fontFamily: fonts.medium,
    fontSize: typography.fontSize.xs,
    opacity: 0.62,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  preview: {
    flex: 1,
    color: colors.goldMetallic,
    fontFamily: fonts.body,
    fontSize: typography.fontSize.sm,
    opacity: 0.66,
  },
  previewUnread: {
    color: colors.goldDark,
    fontFamily: fonts.medium,
    opacity: 1,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.iris,
  },
  groupMeta: {
    color: colors.irisGlow,
    fontFamily: fonts.medium,
    fontSize: 9,
  },
});
