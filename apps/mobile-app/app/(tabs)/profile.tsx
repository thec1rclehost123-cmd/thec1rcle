import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Linking,
  Share,
  Dimensions,
  Platform,
  RefreshControl,
  ActivityIndicator,
  ToastAndroid,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
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
  withTiming,
} from 'react-native-reanimated';
import { colors, gradients } from '@/lib/design/theme';
import { safeDate } from '@/lib/utils/date';
import { trackScreen } from '@/lib/analytics';
import { PremiumBadge } from '@/components/ui/PremiumBadge';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PROFILE_AVATAR_SIZE = 136;
const PROFILE_AVATAR_TOP = SCREEN_HEIGHT * 0.42 - PROFILE_AVATAR_SIZE;

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
          scale.value = withTiming(0.98, { duration: 250 });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 250 });
        }}
        style={[animStyle, styles.historyCard]}
      >
        <View style={styles.historyCardInner} collapsable={false}>
          {order.eventCoverImage ? (
            <Image
              source={{ uri: order.eventCoverImage }}
              style={styles.historyPoster}
              contentFit="cover"
              contentPosition="top center"
              cachePolicy="memory-disk"
            />
          ) : (
            <LinearGradient
              colors={order.accentColor ? [order.accentColor, '#161616'] : ['#2a1a0e', '#161616']}
              style={styles.historyPoster}
            />
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
  const d = safeDate(order?.eventDate || order?.eventStartDate);
  if (!d) return order?.eventTime || 'Date TBA';
  const date = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return order?.eventTime ? `${date} at ${order.eventTime}` : date;
}

function getOrderEventTime(order: Order) {
  return safeDate(order.eventDate || order.eventStartDate)?.getTime() ?? null;
}

function isProfileVisibleOrder(order: Order) {
  return order.status === 'confirmed' || order.status === 'checked_in';
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

function UpcomingOrderCard({ order, index }: { order: Order; index: number }) {
  return (
    <AnimatedPressable
      entering={FadeInDown.delay(140 + index * 35)}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (order.eventId) {
          router.push({
            pathname: '/event/[id]',
            params: { id: order.eventId },
          });
        }
      }}
      style={styles.upcomingCard}
    >
      {Platform.select({
        android: (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(15, 15, 15, 0.85)', borderRadius: 12 },
            ]}
          />
        ),
        default: (
          <BlurView
            blurMethod="dimezisBlurView"
            intensity={28}
            tint="dark"
            style={[StyleSheet.absoluteFill, { borderRadius: 12, overflow: 'hidden' }]}
          />
        ),
      })}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: 'rgba(15, 15, 15, 0.45)', borderRadius: 12 },
        ]}
      />

      {order.eventCoverImage ? (
        <Image
          source={{ uri: order.eventCoverImage }}
          style={styles.upcomingPoster}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <LinearGradient colors={['#2a1a0e', '#161616']} style={styles.upcomingPoster} />
      )}

      <View style={styles.upcomingInfo}>
        <Text style={styles.upcomingEyebrow}>
          {index === 0 ? 'Your Next Event' : 'Upcoming Event'}
        </Text>
        <Text style={styles.upcomingTitle} numberOfLines={2}>
          {order.eventTitle || 'Upcoming Event'}
        </Text>
        <Text style={styles.upcomingDate} numberOfLines={1}>
          {formatEventDate(order)}
        </Text>
        <Text style={styles.upcomingAction}>View Ticket</Text>
      </View>
    </AnimatedPressable>
  );
}

export default function ProfileScreen() {
  const { user } = useAuthStore();
  const { orders, fetchUserOrders, loading: ticketsLoading } = useTicketsStore();
  const profile = useProfileStore((state) => state.profile);
  const profileError = useProfileStore((state) => state.error);
  const loadProfile = useProfileStore((state) => state.loadProfile);
  const profileLoading = useProfileStore((state) => state.loading);
  const nightlifePromptDismissed = useProfileStore((state) => state.nightlifePromptDismissed);
  const hydrateNightlifePromptDismissed = useProfileStore(
    (state) => state.hydrateNightlifePromptDismissed,
  );
  const dismissNightlifePrompt = useProfileStore((state) => state.dismissNightlifePrompt);
  const insets = useSafeAreaInsets();
  const userId = user?.uid;
  const [refreshing, setRefreshing] = useState(false);
  const [errorDismissed, setErrorDismissed] = useState(false);

  // Avatar animation
  const avatarScale = useSharedValue(1);

  useEffect(() => {
    trackScreen('Profile');
  }, []);

  useEffect(() => {
    if (!userId) return;
    void hydrateNightlifePromptDismissed(userId);
  }, [hydrateNightlifePromptDismissed, userId]);

  useEffect(() => {
    if (!userId) return;

    const syncScreenState = async () => {
      const tasks: Promise<any>[] = [];
      if (orders.length === 0) tasks.push(fetchUserOrders());
      if (!profile) tasks.push(loadProfile(userId));
      if (tasks.length > 0) await Promise.allSettled(tasks);
    };

    void syncScreenState();
  }, [userId, fetchUserOrders, loadProfile]);

  const onRefresh = useCallback(() => {
    if (!userId) return;
    setRefreshing(true);
    setErrorDismissed(false);
    Promise.allSettled([fetchUserOrders(), loadProfile(userId)]).finally(() => {
      setRefreshing(false);
    });
  }, [userId, fetchUserOrders, loadProfile]);

  const avatarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: avatarScale.value }],
  }));

  const nowMs = Date.now();
  const profileOrders = orders.filter(isProfileVisibleOrder);
  const upcomingOrders = [...profileOrders]
    .filter((order) => {
      const eventTime = getOrderEventTime(order);
      return eventTime === null || eventTime >= nowMs;
    })
    .sort(
      (a, b) =>
        (getOrderEventTime(a) ?? Number.MAX_SAFE_INTEGER) -
        (getOrderEventTime(b) ?? Number.MAX_SAFE_INTEGER),
    );
  const pastOrders = [...profileOrders]
    .filter((order) => {
      const eventTime = getOrderEventTime(order);
      return eventTime !== null && eventTime < nowMs;
    })
    .sort((a, b) => (getOrderEventTime(b) ?? 0) - (getOrderEventTime(a) ?? 0));
  const hasProfileEvents = upcomingOrders.length > 0 || pastOrders.length > 0;

  const profilePhotos = Array.from(
    new Set([profile?.photoURL, ...(profile?.photos ?? []), ...(profile?.datingPhotos ?? [])]),
  ).filter((photo): photo is string => Boolean(photo && !photo.includes('img=68')));
  const displayName = profile?.displayName?.trim() || 'Your profile';
  const walletAttendedCount = new Set(pastOrders.map((order) => order.eventId).filter(Boolean))
    .size;
  const attendedCount = Math.max(Number(profile?.eventsAttended ?? 0), walletAttendedCount);
  const displayPhoto = profilePhotos[0] || '';
  const isDefaultMockPhoto = !displayPhoto || displayPhoto.includes('img=68');
  const avatarSource =
    displayPhoto && !isDefaultMockPhoto
      ? { uri: displayPhoto }
      : require('../../assets/images/user_avatar.jpg');
  const instagramHandle = profile?.instagram?.trim().replace(/^@+/, '') || '';
  const joinedDateText = formatJoinedDate(profile?.createdAt);
  const profileBio = profile?.bio?.trim() || '';
  const profileTags = (profile?.vibeTags ?? [])
    .filter(Boolean)
    .map((tag) =>
      String(tag)
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase()),
    )
    .slice(0, 6);
  const shouldShowNightlifePrompt = !nightlifePromptDismissed && profile?.datingActive !== true;
  const handleShareProfile = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Share.share({
      message: `Check out ${displayName} on THE C1RCLE.`,
    });
  };

  if (!userId) {
    return (
      <View
        style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}
      >
        <View style={{ marginBottom: 32, alignItems: 'center' }}>
          <View
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: 'rgba(255,255,255,0.05)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="person" size={60} color="rgba(255,255,255,0.2)" />
          </View>
          <Text style={[styles.userName, { fontSize: 28, marginTop: 16 }]}>Welcome Guest</Text>
        </View>

        <View style={[styles.emptyStateContainer, { backgroundColor: 'transparent', padding: 0 }]}>
          <Text style={styles.emptyStateTitle}>Login Required</Text>
          <Text style={[styles.emptyStateText, { textAlign: 'center', marginBottom: 32 }]}>
            Login or sign up to view your profile, manage your tickets, and join the party.
          </Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(auth)/login');
            }}
            style={styles.emptyStateButton}
          >
            <Text style={styles.emptyStateButtonText}>Login / Sign Up</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if ((!profile && profileLoading) || (orders.length === 0 && ticketsLoading)) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Actions */}
      <Animated.View entering={FadeIn} style={[styles.topActions, { top: insets.top - 2 }]}>
        {router.canGoBack() ? (
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
        ) : (
          <View style={{ width: 44 }} />
        )}

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
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 148 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.iris} />
        }
      >
        <Animated.View entering={FadeInDown.delay(100)} style={styles.profileHeader}>
          <Image
            source={avatarSource}
            style={styles.profileHeroImage}
            contentFit="cover"
            contentPosition="top center"
            blurRadius={6}
            cachePolicy="memory-disk"
          />
          <LinearGradient
            colors={['rgba(0, 0, 0, 0.12)', 'rgba(0, 0, 0, 0.2)', colors.base.DEFAULT]}
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

          <View style={styles.userNameRow}>
            <Text style={styles.userName}>{displayName}</Text>
            <PremiumBadge visible={profile?.isPremium === true} compact />
          </View>

          <View style={styles.profileStatsRow}>
            <Text style={styles.profileStatText}>
              {attendedCount} {attendedCount === 1 ? 'event' : 'events'} attended
            </Text>
          </View>

          {joinedDateText ? <Text style={styles.profileJoinedText}>{joinedDateText}</Text> : null}

          {profileBio ? (
            <Text style={styles.profileBio} numberOfLines={3}>
              {profileBio}
            </Text>
          ) : null}

          {profileTags.length > 0 ? (
            <View style={styles.profileTagsRow}>
              {profileTags.map((tag) => (
                <View key={tag} style={styles.profileTag}>
                  <Text style={styles.profileTagText}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', marginTop: 12 }}>
            <Pressable
              onPress={() => {
                if (instagramHandle) {
                  openInstagramProfile(instagramHandle);
                  return;
                }

                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/profile/edit');
              }}
              style={styles.socialProfileButton}
              hitSlop={10}
            >
              <Ionicons name="logo-instagram" size={22} color="#E1306C" />
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/profile/edit');
              }}
              style={styles.socialProfileButton}
              hitSlop={10}
            >
              <FontAwesome5 name="spotify" size={22} color="#1DB954" />
            </Pressable>
          </View>

          {shouldShowNightlifePrompt ? (
            <Animated.View entering={FadeInDown.delay(120)} style={styles.nightlifePromptShell}>
              <View style={styles.nightlifePromptCard}>
                <Pressable
                  onPress={() => userId && void dismissNightlifePrompt(userId)}
                  style={styles.nightlifePromptClose}
                  hitSlop={10}
                >
                  <Ionicons name="close" size={20} color="#000" />
                </Pressable>

                <View style={styles.nightlifePromptContent}>
                  <Text style={styles.nightlifePromptTitle}>Unlock Party Mode</Text>
                  <Text style={styles.nightlifePromptText}>
                    Set up your Nightlife Profile to connect with the crowd at your next event.
                  </Text>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push('/(nightlife-onboarding)/intro');
                    }}
                    style={styles.nightlifePromptButton}
                  >
                    <Text style={styles.nightlifePromptButtonText}>GET STARTED</Text>
                  </Pressable>
                </View>

                {/* Illustration Placeholder */}
                <View style={styles.nightlifePromptIllustration}>
                  <Ionicons
                    name="musical-notes"
                    size={60}
                    color="#000"
                    style={{ transform: [{ rotate: '15deg' }] }}
                  />
                </View>
              </View>
            </Animated.View>
          ) : null}
        </Animated.View>

        {/* Error banner */}
        {profileError && !errorDismissed ? (
          <Animated.View entering={FadeInDown.delay(120)} style={styles.nightsContent}>
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{profileError}</Text>
              <View style={styles.errorBannerActions}>
                <Pressable
                  onPress={() => {
                    setErrorDismissed(true);
                  }}
                  style={styles.errorBannerBtn}
                >
                  <Text style={styles.errorBannerBtnText}>Dismiss</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (userId) loadProfile(userId);
                  }}
                  style={[styles.errorBannerBtn, { backgroundColor: colors.iris }]}
                >
                  <Text style={[styles.errorBannerBtnText, { color: '#fff' }]}>Retry</Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        ) : null}

        <View style={styles.nightsContent}>
          {upcomingOrders.map((order, index) => (
            <UpcomingOrderCard
              key={order.id || `${order.eventId}-${index}`}
              order={order}
              index={index}
            />
          ))}

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
          ) : null}

          {!hasProfileEvents ? (
            <View style={styles.emptyStateContainer}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/');
                }}
                style={styles.emptyStateButton}
              >
                <Text style={styles.emptyStateButtonText}>Discover Events</Text>
              </Pressable>
            </View>
          ) : null}
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
    opacity: 0.8,
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
    flexShrink: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    maxWidth: '100%',
  },
  profileStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  profileStatText: {
    color: 'rgba(255, 250, 238, 0.68)',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  profileStatDivider: {
    color: 'rgba(255, 250, 238, 0.36)',
    fontSize: 13,
    fontWeight: '900',
  },
  profileJoinedText: {
    color: 'rgba(255, 250, 238, 0.46)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginTop: 4,
    textAlign: 'center',
  },
  profileBio: {
    color: 'rgba(255, 250, 238, 0.82)',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    marginTop: 14,
    maxWidth: 320,
    textAlign: 'center',
  },
  profileTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    maxWidth: 340,
  },
  profileTag: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  profileTagText: {
    color: 'rgba(255, 250, 238, 0.82)',
    fontSize: 12,
    fontWeight: '800',
  },
  socialProfileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  nightlifePromptShell: {
    width: '100%',
    maxWidth: 352,
    marginTop: 14,
  },
  nightlifePromptCard: {
    minHeight: 130,
    borderRadius: 8,
    padding: 18,
    paddingRight: 8,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  nightlifePromptContent: {
    flex: 1,
    paddingRight: 10,
    alignItems: 'flex-start',
  },
  nightlifePromptClose: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  nightlifePromptTitle: {
    color: '#000',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 6,
  },
  nightlifePromptText: {
    color: '#000',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  nightlifePromptButton: {
    minHeight: 32,
    borderRadius: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  nightlifePromptButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  nightlifePromptIllustration: {
    width: 80,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingRight: 10,
  },

  upcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 10,
    gap: 11,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: colors.iris,
    shadowOpacity: 0.25,
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
  sectionTitle: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 12,
  },
  errorBanner: {
    backgroundColor: 'rgba(244, 74, 34, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 74, 34, 0.3)',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  errorBannerText: {
    color: '#F44A22',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  errorBannerActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  errorBannerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  errorBannerBtnText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyStateContainer: {
    paddingTop: 16,
    paddingBottom: 40,
    alignItems: 'center',
  },
  emptyStateTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyStateText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 40,
  },
  emptyStateButton: {
    backgroundColor: '#F44A22',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  profilePhotoStrip: {
    marginBottom: 20,
  },
  profilePhotoStripContent: {
    gap: 10,
    paddingRight: 2,
  },
  profileGalleryPhoto: {
    width: 118,
    height: 148,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
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
