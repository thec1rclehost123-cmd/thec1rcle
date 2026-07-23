/**
 * inbox.tsx — Chats screen
 * Segment control: Event Chats | Private Chats
 * Matches the Venues/Hosts tab style.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Image,
  Modal,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  runOnJS,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Search, MessageCircle, Heart, X, Lock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors } from '@/lib/design/theme';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { apiFetch } from '@/lib/api';
import type { EventChat, DirectChat } from '@/lib/chat';
import { DiscoLoader } from '@/components/ui/DiscoLoader';
import { GuestAuthPrompt } from '@/components/ui/GuestAuthPrompt';
import { InboxEventCardSkeletonList, SkeletonChatCardList } from '@/components/ui/Skeleton';

interface NewMatch {
  id: string;
  name: string;
  photoURL?: string;
  sharedEventTitle?: string;
  isNew: boolean;
}

type Tab = 'events' | 'private';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatChatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

function getEventTimeBadge(eventDate?: string | null): string {
  const eventTime = eventDate ? new Date(eventDate).getTime() : Number.NaN;
  if (!Number.isFinite(eventTime)) return 'EVENT CHAT';

  const diffH = Math.floor((eventTime - Date.now()) / 3600000);
  if (diffH < -12) return 'ENDED';
  if (diffH < 0) return 'LIVE NOW';
  if (diffH < 1) return 'STARTS SOON';
  if (diffH < 24) return `STARTS IN ${diffH}H`;
  if (diffH < 48) return 'TOMORROW';
  return new Date(eventTime).toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
}

// ── Event chat card ───────────────────────────────────────────────────────────

const EventChatCard = React.memo(function EventChatCard({
  chat,
  index,
}: {
  chat: EventChat;
  index: number;
}) {
  const isFirst = index === 0;
  const badge = getEventTimeBadge(chat.eventDate);
  const isLive = badge === 'LIVE NOW' || badge === 'STARTS SOON' || badge.startsWith('STARTS IN');

  return (
    <Pressable
      style={[cardStyles.card, isFirst && cardStyles.cardActive]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({
          pathname: '/social/group/[eventId]',
          params: { eventId: chat.eventId, eventTitle: chat.eventTitle },
        });
      }}
    >
      <Image
        source={{ uri: chat.eventCover }}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.75)']}
        locations={[0.2, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Top: badge + unread */}
      <View style={cardStyles.topRow}>
        <View style={[cardStyles.timeBadge, isLive && cardStyles.timeBadgeLive]}>
          <Text style={[cardStyles.timeBadgeText, isLive && cardStyles.timeBadgeTextLive]}>
            {badge}
          </Text>
        </View>
        {(chat.unreadCount ?? 0) > 0 && (
          <View style={cardStyles.unreadBadge}>
            <Text style={cardStyles.unreadText}>{chat.unreadCount ?? ''}</Text>
          </View>
        )}
      </View>

      {/* Bottom: title + members + avatar stack */}
      <View style={cardStyles.bottomRow}>
        <View style={{ flex: 1 }}>
          <Text style={cardStyles.eventTitle} numberOfLines={1}>
            {chat.eventTitle}
          </Text>
          <Text style={cardStyles.memberCount}>
            {chat.participantCount} {chat.participantCount === 1 ? 'member' : 'members'}
          </Text>
        </View>
        <View style={cardStyles.avatarStack}>
          {(chat.activeAvatars ?? []).slice(0, 3).map((img, i) => (
            <Image
              key={i}
              source={typeof img === 'string' ? { uri: img } : img}
              style={[cardStyles.stackAvatar, { marginLeft: i === 0 ? 0 : -10, zIndex: 3 - i }]}
            />
          ))}
        </View>
      </View>
    </Pressable>
  );
});

// ── Private chat row ──────────────────────────────────────────────────────────

const PrivateChatRow = React.memo(function PrivateChatRow({ chat }: { chat: DirectChat }) {
  const translateX = useSharedValue(0);
  const rowHeight = useSharedValue(80);
  const rowOpacity = useSharedValue(1);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      translateX.value = Math.max(-100, Math.min(0, event.translationX));
    })
    .onEnd((event) => {
      if (event.translationX < -50) {
        translateX.value = withTiming(-100, { duration: 200 });
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
        // Animate row away to archive
        rowHeight.value = withTiming(0, { duration: 300 });
        rowOpacity.value = withTiming(0, { duration: 200 });
      } else {
        translateX.value = withTiming(0, { duration: 200 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const archiveIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, -50], [0, 1]),
    transform: [{ scale: interpolate(translateX.value, [0, -50], [0.5, 1], Extrapolation.CLAMP) }],
  }));

  const containerStyle = useAnimatedStyle(() => ({
    height: rowHeight.value,
    opacity: rowOpacity.value,
    overflow: 'hidden',
    marginBottom: rowHeight.value > 0 ? 12 : 0,
  }));

  return (
    <Animated.View style={containerStyle}>
      <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 100, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.error, borderRadius: 16 }}>
        <Animated.View style={archiveIconStyle}>
          <X size={24} color="#fff" />
        </Animated.View>
      </View>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={animatedStyle}>
          <Pressable
            style={[rowStyles.row, { marginBottom: 0 }]}
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
                source={
                  typeof chat.otherUserAvatar === 'string'
                    ? { uri: chat.otherUserAvatar }
                    : chat.otherUserAvatar
                }
                style={rowStyles.avatar}
                resizeMode="cover"
              />
              {chat.isOnline && <View style={rowStyles.onlineDot} />}
            </View>
            <View style={rowStyles.content}>
              <View style={rowStyles.nameRow}>
                <Text style={rowStyles.name} numberOfLines={1}>
                  {chat.otherUserName}
                </Text>
                <Text style={rowStyles.time}>{formatChatTime(chat.lastMessageTime ?? '')}</Text>
              </View>
              <View style={rowStyles.msgRow}>
                <Text
                  style={[rowStyles.lastMsg, (chat.unreadCount ?? 0) > 0 && rowStyles.lastMsgUnread]}
                  numberOfLines={1}
                >
                  {chat.lastMessage}
                </Text>
                {(chat.unreadCount ?? 0) > 0 && (
                  <View style={rowStyles.badge}>
                    <Text style={rowStyles.badgeText}>{chat.unreadCount ?? ''}</Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
});

// ── Ditto Replica Empty State ─────────────────────────────────────────────────

function EmptyChatReplica() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: '#000', paddingTop: insets.top }}>
      {/* ── Header ── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 8,
        }}
      >
        <Text style={{ color: '#FFF', fontSize: 28, fontWeight: '700' }}>Chat</Text>
        <Pressable
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(255,255,255,0.1)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View>
            <Heart size={22} color="#FFF" strokeWidth={2.5} />
            <View
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: '#F44A22',
                borderWidth: 2,
                borderColor: '#1A1A1A',
              }}
            />
          </View>
        </Pressable>
      </View>

      {/* Empty State Content */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 }}>
        <View
          style={{
            width: 260,
            height: 240,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 0,
            position: 'relative',
          }}
        >
          {/* Phone Frame */}
          <View
            style={{
              width: 220,
              height: 240,
              borderTopLeftRadius: 36,
              borderTopRightRadius: 36,
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              borderWidth: 2,
              borderBottomWidth: 0,
              borderColor: 'rgba(255,255,255,0.1)',
              backgroundColor: '#0A0A0A',
              paddingTop: 32,
              paddingHorizontal: 16,
              overflow: 'hidden',
              position: 'absolute',
              bottom: 0,
            }}
          >
            {/* Mock Row 1 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: '#8B5CF6',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                <Image
                  source={require('../../assets/images/attendees/riya.png')}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              </View>
              <View style={{ flex: 1, justifyContent: 'center', gap: 6 }}>
                <View
                  style={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    width: 60,
                  }}
                />
                <View
                  style={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    width: 100,
                  }}
                />
              </View>
            </View>

            {/* Mock Row 2 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: '#F59E0B',
                  position: 'relative',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'visible',
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }}>
                  <Image
                    source={require('../../assets/images/attendees/sam.png')}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                </View>
                <View
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: -2,
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: '#10B981',
                    borderWidth: 2,
                    borderColor: '#0A0A0A',
                  }}
                />
              </View>
              <View style={{ flex: 1, justifyContent: 'center', gap: 6 }}>
                <View
                  style={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    width: 80,
                  }}
                />
                <View
                  style={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    width: 120,
                  }}
                />
              </View>
            </View>

            {/* Mock Row 3 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: '#EAB308',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                <Image
                  source={require('../../assets/images/attendees/neil.png')}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              </View>
              <View style={{ flex: 1, justifyContent: 'center', gap: 6 }}>
                <View
                  style={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    width: 50,
                  }}
                />
                <View
                  style={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    width: 140,
                  }}
                />
              </View>
            </View>

            {/* Bottom fade out gradient */}
            <LinearGradient
              colors={['rgba(10,10,10,0)', 'rgba(0,0,0,1)']}
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60 }}
            />
          </View>

          {/* Floating Bubbles */}
          <View
            style={{
              position: 'absolute',
              top: 10,
              right: 30,
              backgroundColor: '#4A4A4C',
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 20,
              borderBottomLeftRadius: 4,
              zIndex: 10,
            }}
          >
            <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '500', lineHeight: 18 }}>
              See u tomorrow{'\n'}for the event 🥳
            </Text>
          </View>

          <View
            style={{
              position: 'absolute',
              top: 65,
              right: -10,
              backgroundColor: colors.iris,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 20,
              borderBottomRightRadius: 4,
              zIndex: 11,
            }}
          >
            <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '500' }}>Can't wait!!</Text>
          </View>
        </View>

        <Text style={{ color: '#FFF', fontSize: 26, fontWeight: '800', marginBottom: 12 }}>
          It's quiet in here.
        </Text>
        <Text
          style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: 15,
            textAlign: 'center',
            lineHeight: 22,
            marginBottom: 32,
            paddingHorizontal: 40,
          }}
        >
          RSVP to events or start swiping{'\n'}to make connections.
        </Text>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('events');
  const [isLikesModalVisible, setIsLikesModalVisible] = useState(false);
  const windowWidth = Dimensions.get('window').width;
  const cardWidth = (windowWidth - 32 - 12) / 2;
  const cardHeight = cardWidth * 1.33;

  const scrollX = useSharedValue(0);

  useEffect(() => {
    scrollX.value = withTiming(activeTab === 'events' ? 0 : windowWidth, { duration: 180 });
  }, [activeTab, scrollX, windowWidth]);

  const animatedPillStyle = useAnimatedStyle(() => {
    const trackInnerWidth = windowWidth - 32 - 8;
    const pillWidth = (trackInnerWidth - 4) / 2;
    const translateX = interpolate(
      scrollX.value,
      [0, windowWidth],
      [0, pillWidth + 4],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateX }],
    };
  });

  const { user, isGuest } = useAuthStore();
  const {
    eventChats,
    privateChats,
    newMatches,
    totalUnread,
    loading,
    fetchAll,
    subscribeToUpdates,
  } = useChatStore();

  const [refreshing, setRefreshing] = useState(false);

  const ambientColor = useMemo(() => {
    if (eventChats.length === 0) return 'transparent';
    const badge = getEventTimeBadge(eventChats[0].eventDate);
    if (badge === 'LIVE NOW') return 'rgba(245,158,11,0.06)';
    if (badge === 'STARTS SOON' || badge.startsWith('STARTS IN')) return 'rgba(139,92,246,0.05)';
    if (badge === 'TOMORROW') return 'rgba(59,130,246,0.04)';
    return 'rgba(59,130,246,0.03)';
  }, [eventChats]);

  useFocusEffect(
    React.useCallback(() => {
      if (isGuest) return;
      if (!user?.uid) return;
      fetchAll(user.uid);
      const unsub = subscribeToUpdates(user.uid);
      return () => unsub();
    }, [user?.uid, isGuest]),
  );

  const onRefresh = useCallback(async () => {
    if (!user?.uid) return;
    setRefreshing(true);
    try {
      await fetchAll(user.uid);
    } finally {
      setRefreshing(false);
    }
  }, [user?.uid, fetchAll]);

  const switchTab = (tab: Tab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    void Haptics.selectionAsync();
  };

  const newMatchCount = newMatches.filter((m) => m.isNew).length;

  // if (isGuest) {
  //   return <GuestAuthPrompt onDismiss={() => router.replace('/(tabs)/explore')} />;
  // }


  const handleInboxSwipe = useCallback(
    (direction: 'next' | 'previous') => {
      switchTab(direction === 'next' ? 'private' : 'events');
    },
    [activeTab], // We'll ignore the dependency warning or just use activeTab
  );

  const inboxSwipeGesture = React.useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-24, 24])
        .failOffsetY([-18, 18])
        .onEnd((event) => {
          const shouldSwitch =
            Math.abs(event.translationX) >= 52 ||
            Math.abs(event.velocityX) >= 650;

          if (!shouldSwitch) return;

          runOnJS(handleInboxSwipe)(event.translationX < 0 ? 'next' : 'previous');
        }),
    [handleInboxSwipe],
  );

  if (isGuest) {
    return <EmptyChatReplica />;
  }

  const hasNoChats =
    !loading && eventChats.length === 0 && privateChats.length === 0 && newMatches.length === 0;

  if (hasNoChats) {
    return <EmptyChatReplica />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        pointerEvents="none"
        colors={['#8B0618', '#42050D', '#000000']}
        locations={[0, 0.38, 0.76]}
        style={StyleSheet.absoluteFill}
      />
      {/* ── Header ── */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            style={styles.searchBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsLikesModalVisible(true);
            }}
          >
            <Heart size={20} color="rgba(255,255,255,0.6)" strokeWidth={1.8} />
            {newMatchCount > 0 && <View style={styles.headerBadge} />}
          </Pressable>
          <Pressable style={styles.searchBtn}>
            <Search size={20} color="rgba(255,255,255,0.6)" strokeWidth={1.8} />
          </Pressable>
        </View>
      </Animated.View>

      {/* ── Segment control ── */}
        <Animated.View
          entering={FadeIn.duration(160)}
          style={styles.segmentWrap}
        >
          <View style={styles.segmentTrack}>
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: 4,
                  bottom: 4,
                  left: 4,
                  width: (windowWidth - 44) / 2,
                  backgroundColor: '#F44A22',
                  borderRadius: 11,
                },
                animatedPillStyle,
              ]}
            />
            {/* Event Chats tab */}
            <Pressable
              style={styles.segmentPill}
              onPress={() => switchTab('events')}
              accessibilityRole="tab"
              accessibilityLabel="Event Chats"
              accessibilityState={{ selected: activeTab === 'events' }}
            >
              <MessageCircle
                size={14}
                color={activeTab === 'events' ? '#fff' : 'rgba(255,255,255,0.4)'}
                strokeWidth={activeTab === 'events' ? 2.2 : 1.8}
              />
              <Text style={[styles.segmentText, activeTab === 'events' && styles.segmentTextActive]}>
                Event Chats
              </Text>
            </Pressable>

            {/* Private Chats tab */}
            <Pressable
              style={styles.segmentPill}
              onPress={() => switchTab('private')}
              accessibilityRole="tab"
              accessibilityLabel="Private Chats"
              accessibilityState={{ selected: activeTab === 'private' }}
            >
              <Heart
                size={14}
                color={activeTab === 'private' ? '#fff' : 'rgba(255,255,255,0.4)'}
                strokeWidth={activeTab === 'private' ? 2.2 : 1.8}
              />
              <Text style={[styles.segmentText, activeTab === 'private' && styles.segmentTextActive]}>
                Private Chats
              </Text>
              {/* Badge showing unread + new matches */}
              {activeTab !== 'private' && newMatchCount + totalUnread > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{newMatchCount + totalUnread}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </Animated.View>

      <GestureDetector gesture={inboxSwipeGesture}>
        <View style={{ flex: 1 }}>
          {activeTab === 'events' ? (
            <>
          {ambientColor !== 'transparent' && (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: ambientColor,
                  opacity: 0.6,
                },
              ]}
              pointerEvents="none"
            />
          )}
          <ScrollView
            key="event-chats"
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.iris}
              />
            }
          >
            <Animated.View entering={FadeIn.duration(200)}>
              {eventChats.length > 0 ? (
                eventChats.map((chat: EventChat, i: number) => (
                  <Animated.View key={chat.id} entering={FadeInDown.delay(i * 50).duration(400)}>
                    <EventChatCard chat={chat} index={i} />
                  </Animated.View>
                ))
              ) : loading ? (
                <InboxEventCardSkeletonList count={3} />
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No event chats yet</Text>
                  <Text style={styles.emptyBody}>
                    Get a ticket to an event — its group chat unlocks automatically.
                  </Text>
                </View>
              )}
            </Animated.View>
          </ScrollView>
            </>
          ) : (
          <ScrollView
            key="private-chats"
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.iris}
              />
            }
          >
            <Animated.View entering={FadeIn.duration(200)}>
              {privateChats.length > 0 ? (
                privateChats.map((chat: DirectChat, i: number) => (
                  <Animated.View key={chat.id} entering={FadeInDown.delay(i * 50).duration(400)}>
                    <PrivateChatRow chat={chat} />
                  </Animated.View>
                ))
              ) : loading ? (
                <SkeletonChatCardList count={4} />
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No messages yet</Text>
                  <Text style={styles.emptyBody}>
                    Match with someone at an event to start a private conversation.
                  </Text>
                </View>
              )}
            </Animated.View>
          </ScrollView>
          )}
        </View>
      </GestureDetector>

      {/* ── Likes Overlay ── */}
      <Modal
        visible={isLikesModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsLikesModalVisible(false)}
      >
        <View style={modalStyles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setIsLikesModalVisible(false)}
          />
          <View style={[modalStyles.sheet, { paddingBottom: insets.bottom || 24 }]}>
            <View style={modalStyles.header}>
              <Text style={modalStyles.title}>New Matches</Text>
              <Pressable
                style={modalStyles.closeBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIsLikesModalVisible(false);
                }}
              >
                <X size={18} color="#fff" strokeWidth={2.5} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }}
              showsVerticalScrollIndicator={false}
            >
              {newMatches.map((match: NewMatch) => (
                <Pressable
                  key={match.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: 'rgba(255,255,255,0.05)',
                  }}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsLikesModalVisible(false);
                    router.push({
                      pathname: '/social/dm/[id]',
                      params: { id: match.id, recipientName: match.name },
                    });
                  }}
                >
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      marginRight: 16,
                      backgroundColor: '#2C2C2E',
                      overflow: 'hidden',
                    }}
                  >
                    <Image
                      source={
                        typeof match.photoURL === 'string'
                          ? { uri: match.photoURL }
                          : match.photoURL
                      }
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                    />
                    {match.isNew && (
                      <View
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          width: 14,
                          height: 14,
                          borderRadius: 7,
                          backgroundColor: '#F44A22',
                          borderWidth: 2,
                          borderColor: '#2C2C2E',
                        }}
                      />
                    )}
                  </View>
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    <Text
                      style={{ color: '#FFF', fontSize: 17, fontWeight: '600', marginBottom: 4 }}
                    >
                      {match.name}
                    </Text>
                    <Text
                      style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15 }}
                      numberOfLines={1}
                    >
                      {match.sharedEventTitle}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Event card styles ─────────────────────────────────────────────────────────

const cardStyles = StyleSheet.create({
  card: {
    width: '100%',
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#1C1C1E',
  },
  cardActive: {
    borderWidth: 1.5,
    borderColor: '#F44A22',
    shadowColor: '#F44A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  timeBadge: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  timeBadgeLive: {
    backgroundColor: 'rgba(244,74,34,0.85)',
    borderColor: 'rgba(244,74,34,0.5)',
  },
  timeBadgeText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  timeBadgeTextLive: { color: '#fff' },
  unreadBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F44A22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  bottomRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: 14,
    paddingBottom: 16,
  },
  eventTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0,
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  memberCount: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '500' },
  avatarStack: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  stackAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#111113',
  },
});

// ── Private chat row styles ───────────────────────────────────────────────────

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1C',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  avatarWrap: { position: 'relative', flexShrink: 0 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#1A1A1C',
  },
  content: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  msgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0 },
  time: { color: 'rgba(255,255,255,0.35)', fontSize: 12 },
  lastMsg: { color: 'rgba(255,255,255,0.45)', fontSize: 13, flex: 1 },
  lastMsgUnread: { color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F44A22',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    flexShrink: 0,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});

// ── Modal styles ──────────────────────────────────────────────────────────────

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  title: { color: '#fff', fontSize: 24, fontWeight: '800' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    paddingBottom: 20,
  },
  matchCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#2C2C2E',
    position: 'relative',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  matchInfo: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
  },
  matchName: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 2 },
  matchEvent: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '500' },
  newDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#F44A22',
    borderWidth: 2,
    borderColor: '#1C1C1E',
  },
});

// ── Main layout styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111113' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0,
  },
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F44A22',
  },

  // ── Segment ──
  segmentWrap: { paddingHorizontal: 16, marginBottom: 16 },
  segmentTrack: {
    flexDirection: 'row',
    backgroundColor: '#161618',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 4,
    gap: 4,
  },
  segmentPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    borderRadius: 11,
  },
  segmentPillActive: {
    backgroundColor: '#F44A22',
  },
  segmentText: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  tabBadge: {
    backgroundColor: '#F44A22',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 2,
  },
  tabBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  // ── Scroll ──
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 150, paddingTop: 4 },

  // ── New Matches ──
  newMatchesBlock: { marginBottom: 20 },
  newMatchesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  newMatchesLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  newMatchesBadge: {
    backgroundColor: 'rgba(244,74,34,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(244,74,34,0.35)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  newMatchesBadgeText: { color: '#F44A22', fontSize: 10, fontWeight: '700' },
  matchScroll: { paddingRight: 8 },

  // ── Divider ──
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  dividerLabel: {
    color: 'rgba(255,255,255,0.28)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  // ── Empty ──
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 32,
    alignItems: 'center',
    marginTop: 12,
  },
  emptyTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyBody: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── FAB ──
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.iris,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.iris,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
});
