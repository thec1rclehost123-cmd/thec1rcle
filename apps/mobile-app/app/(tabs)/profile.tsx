import { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Linking,
  Share,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Settings, Ticket } from 'lucide-react-native';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { useTicketsStore, Order } from '@/store/ticketsStore';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { colors, gradients } from '@/lib/design/theme';
import { safeDate } from '@/lib/utils/date';
import { trackScreen } from '@/lib/analytics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PROFILE_AVATAR_SIZE = 136;
const PROFILE_AVATAR_TOP = Math.max(160, SCREEN_HEIGHT * 0.3 - PROFILE_AVATAR_SIZE / 2);

function HistoryTimelineItem({
  order,
  index,
  isLast,
}: {
  order: Order;
  index: number;
  isLast: boolean;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (order.eventId) {
      router.push({
        pathname: '/event/[id]',
        params: { id: order.eventId },
      });
    }
  };

  const dateStr = (() => {
    const d = safeDate(order.eventDate);
    if (!d) return '';
    const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const dayPart = d.toLocaleDateString('en-US', { weekday: 'long' });
    return `${datePart} ${dayPart}`;
  })();

  const ticketsInfo = (() => {
    const qty = order.tickets?.reduce((acc, t) => acc + t.quantity, 0) || 1;
    const tier = order.tickets?.[0]?.tierName || (order.isRSVP ? 'RSVP' : 'General Admission');
    return `${qty}x ${tier}`;
  })();
  const hostVenueLabel = order.hostName
    ? `Hosted by ${order.hostName}`
    : order.venueLocation
      ? `Hosted at ${order.venueLocation}`
      : 'Hosted by THE C1RCLE';

  return (
    <View style={styles.timelineItem}>
      {/* Timeline dot */}
      <View style={styles.timelineDot} />

      {/* Date Header above the card */}
      <Text style={styles.timelineDateText}>{dateStr}</Text>

      {/* Ticket Card */}
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={() => {
          scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 400 });
        }}
        style={[animStyle, styles.historyCard]}
      >
        <View style={styles.historyCardInner} collapsable={false}>
          {order.eventCoverImage ? (
            <Image
              source={{ uri: order.eventCoverImage }}
              style={styles.historyPoster}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <LinearGradient colors={['#2a1a0e', '#161616']} style={styles.historyPoster} />
          )}

          <View style={styles.historyDetailsColumn}>
            <View style={styles.historyInfo}>
              <Text style={styles.historyTitle} numberOfLines={2}>
                {order.eventTitle}
              </Text>
              <Text style={styles.historyTimeVenue} numberOfLines={2}>
                {hostVenueLabel}
              </Text>
            </View>

            <View style={styles.historyBottomRow}>
              <View style={styles.historyBottomLeft}>
                <Ticket size={14} color="rgba(255,255,255,0.42)" strokeWidth={2.2} />
                <Text style={styles.historyYourTickets}>Your tickets</Text>
              </View>
              <Text style={styles.historyTicketQty}>{ticketsInfo}</Text>
            </View>
          </View>
        </View>
      </AnimatedPressable>
    </View>
  );
}

function formatEventDate(order?: Order) {
  const d = safeDate(order?.eventDate);
  if (!d) return order?.eventTime || 'Date TBA';
  const date = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return order?.eventTime ? `${date} at ${order.eventTime}` : date;
}

function formatJoinedDate(value: unknown) {
  const d = safeDate(value);
  if (!d) return '';
  return `Joined ${d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
}

function openInstagramProfile(handle: string) {
  const cleanHandle = handle.trim().replace(/^@+/, '');
  if (!cleanHandle) return;

  const instagramUrl = `instagram://user?username=${encodeURIComponent(cleanHandle)}`;
  const webUrl = `https://www.instagram.com/${encodeURIComponent(cleanHandle)}`;
  Linking.openURL(instagramUrl).catch(() => Linking.openURL(webUrl));
}

export default function ProfileScreen() {
  const { user } = useAuthStore();
  const { orders, fetchUserOrders } = useTicketsStore();
  const profile = useProfileStore((state) => state.profile);
  const loadProfile = useProfileStore((state) => state.loadProfile);
  const subscribeToProfile = useProfileStore((state) => state.subscribeToProfile);
  const insets = useSafeAreaInsets();

  // Avatar animation
  const avatarScale = useSharedValue(1);

  useEffect(() => {
    trackScreen('Profile');
  }, []);

  useEffect(() => {
    if (!user?.uid) return;

    const syncScreenState = async () => {
      await Promise.allSettled([fetchUserOrders(user.uid), loadProfile(user.uid)]);
    };

    void syncScreenState();

    const unsubscribe = subscribeToProfile(user.uid);

    return () => {
      unsubscribe?.();
    };
  }, [user?.uid, fetchUserOrders, loadProfile, subscribeToProfile]);

  const avatarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: avatarScale.value }],
  }));

  const nowMs = Date.now();
  const pastOrders = [...orders]
    .filter((o) => o.eventDate && (safeDate(o.eventDate)?.getTime() ?? 0) < nowMs)
    .sort(
      (a, b) => (safeDate(b.eventDate)?.getTime() ?? 0) - (safeDate(a.eventDate)?.getTime() ?? 0),
    );
  const nextUpcomingOrder = [...orders]
    .filter((o) => o.eventDate && (safeDate(o.eventDate)?.getTime() ?? 0) > nowMs)
    .sort(
      (a, b) => (safeDate(a.eventDate)?.getTime() ?? 0) - (safeDate(b.eventDate)?.getTime() ?? 0),
    )[0];

  const displayName = 'Aayush Divase';
  const attendedCount = pastOrders.length;
  const displayPhoto = profile?.photoURL || user?.photoURL || '';
  const isDefaultMockPhoto = !displayPhoto || displayPhoto.includes('img=68');
  const avatarSource =
    displayPhoto && !isDefaultMockPhoto
      ? { uri: displayPhoto }
      : require('../../assets/images/user_avatar.jpg');
  const instagramHandle = profile?.instagram?.trim().replace(/^@+/, '') || '';
  const joinedDateText = formatJoinedDate(profile?.createdAt ?? user?.metadata?.creationTime);
  const handleShareProfile = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Share.share({
      message: `Check out ${displayName} on THE C1RCLE.`,
    });
  };

  return (
    <View style={styles.container}>
      {/* Top Actions */}
      <Animated.View entering={FadeIn} style={[styles.topActions, { top: insets.top - 2 }]}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.topActionButton}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </Pressable>

        <View style={styles.topRightActions}>
          <Pressable
            onPress={() => void handleShareProfile()}
            style={styles.topActionButton}
            hitSlop={8}
          >
            <Ionicons name="share-outline" size={24} color="#fff" />
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/settings');
            }}
            style={styles.topActionButton}
          >
            <Settings size={22} color="#fff" strokeWidth={2.5} />
          </Pressable>
        </View>
      </Animated.View>

      <ScrollView
        bounces={false}
        overScrollMode="never"
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 148 }}
      >
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.profileHeader}>
          <Image
            source={avatarSource}
            style={styles.profileHeroImage}
            contentFit="cover"
            contentPosition="top center"
            blurRadius={14}
            cachePolicy="memory-disk"
          />
          <LinearGradient
            colors={['rgba(0, 0, 0, 0.22)', 'rgba(0, 0, 0, 0.5)', colors.base.DEFAULT]}
            locations={[0, 0.56, 1]}
            style={StyleSheet.absoluteFill}
          />

          <Animated.View style={[styles.avatarContainer, avatarAnimatedStyle]}>
            <Pressable onPress={() => router.push('/profile/edit')}>
              <LinearGradient
                colors={gradients.primary as [string, string]}
                style={styles.avatarGradient}
              >
                <Image
                  source={avatarSource}
                  style={styles.avatarPhoto}
                  contentFit="cover"
                  contentPosition="top center"
                  cachePolicy="memory-disk"
                />
              </LinearGradient>
            </Pressable>
          </Animated.View>

          <Text style={styles.userName}>{displayName}</Text>

          <Text style={styles.profileStatText}>
            {attendedCount} {attendedCount === 1 ? 'event' : 'events'} attended
          </Text>

          {joinedDateText ? <Text style={styles.profileJoinedText}>{joinedDateText}</Text> : null}

          <Pressable
            onPress={() => {
              if (instagramHandle) {
                openInstagramProfile(instagramHandle);
                return;
              }

              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/profile/edit');
            }}
            style={styles.instagramProfileButton}
            hitSlop={10}
          >
            <Ionicons name="logo-instagram" size={19} color="#fff" />
          </Pressable>
        </Animated.View>

        <View style={styles.nightsContent}>
          {nextUpcomingOrder ? (
            <AnimatedPressable
              entering={FadeInDown.delay(140).springify()}
              onPress={() => {
                if (nextUpcomingOrder.eventId) {
                  router.push({
                    pathname: '/event/[id]',
                    params: { id: nextUpcomingOrder.eventId },
                  });
                }
              }}
              style={styles.upcomingCard}
            >
              {nextUpcomingOrder.eventCoverImage ? (
                <Image
                  source={{ uri: nextUpcomingOrder.eventCoverImage }}
                  style={styles.upcomingPoster}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <LinearGradient colors={['#2a1a0e', '#161616']} style={styles.upcomingPoster} />
              )}

              <View style={styles.upcomingInfo}>
                <Text style={styles.upcomingEyebrow}>Your Next Event</Text>
                <Text style={styles.upcomingTitle} numberOfLines={2}>
                  {nextUpcomingOrder.eventTitle || 'Upcoming Event'}
                </Text>
                <Text style={styles.upcomingDate} numberOfLines={1}>
                  {formatEventDate(nextUpcomingOrder)}
                </Text>
                <Text style={styles.upcomingAction}>Get Tickets</Text>
              </View>
            </AnimatedPressable>
          ) : null}

          {pastOrders.length > 0 ? (
            <View style={styles.timelineContainer}>
              <View style={styles.timelineAxis} />

              {pastOrders.map((order, i) => (
                <HistoryTimelineItem
                  key={order.id}
                  order={order}
                  index={i}
                  isLast={i === pastOrders.length - 1}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyHistoryContainer}>
              <Text style={styles.emptyHistoryText}>No past events attended yet</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
  },
  topActions: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(25, 25, 25, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },

  // Profile Header
  profileHeader: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: PROFILE_AVATAR_TOP + 270,
    paddingTop: PROFILE_AVATAR_TOP,
    paddingBottom: 22,
    paddingHorizontal: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  profileHeroImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.42,
  },
  avatarContainer: {
    width: 136,
    height: 136,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    position: 'relative',
  },
  avatarGradient: {
    width: 128,
    height: 128,
    borderRadius: 64,
    padding: 3,
  },
  avatarPhoto: {
    width: 122,
    height: 122,
    borderRadius: 61,
  },
  userName: {
    color: colors.gold,
    fontSize: 38,
    fontWeight: '900',
    textAlign: 'center',
  },
  profileStatText: {
    color: 'rgba(255, 250, 238, 0.68)',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginTop: 8,
    textAlign: 'center',
  },
  profileJoinedText: {
    color: 'rgba(255, 250, 238, 0.46)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginTop: 4,
    textAlign: 'center',
  },
  instagramProfileButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },

  upcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.base[50],
    borderRadius: 12,
    padding: 10,
    gap: 11,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    shadowColor: colors.iris,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  upcomingPoster: {
    width: 88,
    height: 88,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  upcomingInfo: {
    flex: 1,
    minHeight: 88,
    justifyContent: 'center',
  },
  upcomingEyebrow: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  upcomingTitle: {
    color: '#fff',
    fontSize: 19,
    lineHeight: 21,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  upcomingDate: {
    color: 'rgba(255, 255, 255, 0.46)',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  upcomingAction: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 10,
  },

  // Event History Timeline Layout
  nightsContent: {
    paddingHorizontal: 20,
  },
  timelineContainer: {
    paddingLeft: 16,
    position: 'relative',
    marginTop: 8,
  },
  timelineAxis: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 24,
    width: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 1,
  },
  timelineItem: {
    position: 'relative',
    marginBottom: 18,
    zIndex: 2,
  },
  timelineDot: {
    position: 'absolute',
    left: -20,
    top: 6, // Vertically centered with the date header text
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderWidth: 1.5,
    borderColor: colors.base.DEFAULT,
    zIndex: 3,
  },
  timelineDateText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // Ticket Stub Card (Vertical Timeline list)
  historyCard: {
    marginTop: 6,
    minHeight: 98,
    position: 'relative',
  },
  historyCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingRight: 4,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  historyPoster: {
    width: 68,
    height: 90,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  historyDetailsColumn: {
    flex: 1,
    minHeight: 90,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  historyInfo: {
    gap: 5,
  },
  historyTitle: {
    color: '#fff',
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  historyTimeVenue: {
    color: 'rgba(255, 255, 255, 0.58)',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 15,
  },
  historyBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  historyBottomLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyYourTickets: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 10,
    fontWeight: '700',
  },
  historyTicketQty: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  emptyHistoryContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyHistoryText: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 14,
    fontWeight: '600',
  },
});
