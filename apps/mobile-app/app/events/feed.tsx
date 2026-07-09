import React, { useMemo, useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  ActivityIndicator,
  Share as RNShare,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
  useAnimatedScrollHandler,
  SharedValue,
} from 'react-native-reanimated';
import { ChevronLeft, Search, Share, Heart, Check } from 'lucide-react-native';
import { useEventsStore, type Event, getHeatScore } from '@/store/eventsStore';
import { useRecommendationsStore } from '@/store/recommendationsStore';
import { useEventInterestStore } from '@/store/eventInterestStore';
import { useProfileStore } from '@/store/profileStore';
import { useAuth } from '@/hooks/useAuth';
import { getEventImage } from '@/lib/utils/event';
import { safeDate, formatEventTime } from '@/lib/utils/date';

// Scene types from ExploreChooseScene mapped to filter keywords
const SCENE_KEYWORDS: Record<string, string[]> = {
  bollywood: ['bollywood', 'indian', 'desi', 'bhangra'],
  techno: ['techno', 'electronic', 'house', 'techno music'],
  raves: ['rave', 'edm', 'electronic', 'underground'],
  'pool-parties': ['pool', 'pool party', 'day party', 'swim'],
  sundowners: ['sundowner', 'sunset', 'rooftop', 'happy hour', 'evening'],
};

function matchSceneKeywords(event: Event, keywords: string[]): boolean {
  const cat = (event.category ?? event.type ?? '').toLowerCase();
  const tags = (event.tags ?? []).map((t: string) => t.toLowerCase());
  const title = (event.title ?? '').toLowerCase();
  return keywords.some(
    (kw) => cat.includes(kw) || tags.some((t) => t.includes(kw)) || title.includes(kw),
  );
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const AnimatedExpoImage = Animated.createAnimatedComponent(Image);
const ITEM_HEIGHT = SCREEN_HEIGHT;

const attendeeAvatarImages = {
  arya: require('../../assets/images/attendees/arya.png'),
  riya: require('../../assets/images/attendees/riya.png'),
  anaya: require('../../assets/images/attendees/anaya.png'),
  isha: require('../../assets/images/attendees/isha.png'),
  hira: require('../../assets/images/attendees/hira.png'),
  yash: require('../../assets/images/attendees/yash.png'),
  neil: require('../../assets/images/attendees/neil.png'),
  sam: require('../../assets/images/attendees/sam.png'),
};

const AVATAR_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#98D8C8',
  '#F7DC6F',
];

function getFallbackInterestedUsers() {
  return [
    {
      userId: 'fallback-arya',
      displayName: 'Arya',
      photoURL: null,
      photoSource: attendeeAvatarImages.arya,
    },
    {
      userId: 'fallback-riya',
      displayName: 'Riya',
      photoURL: null,
      photoSource: attendeeAvatarImages.riya,
    },
    {
      userId: 'fallback-anaya',
      displayName: 'Anaya',
      photoURL: null,
      photoSource: attendeeAvatarImages.anaya,
    },
    {
      userId: 'fallback-isha',
      displayName: 'Isha',
      photoURL: null,
      photoSource: attendeeAvatarImages.isha,
    },
    {
      userId: 'fallback-hira',
      displayName: 'Hira',
      photoURL: null,
      photoSource: attendeeAvatarImages.hira,
    },
    {
      userId: 'fallback-yash',
      displayName: 'Yash',
      photoURL: null,
      photoSource: attendeeAvatarImages.yash,
    },
    {
      userId: 'fallback-neil',
      displayName: 'Neil',
      photoURL: null,
      photoSource: attendeeAvatarImages.neil,
    },
    {
      userId: 'fallback-sam',
      displayName: 'Sam',
      photoURL: null,
      photoSource: attendeeAvatarImages.sam,
    },
    {
      userId: 'fallback-arya-2',
      displayName: 'Arya',
      photoURL: null,
      photoSource: attendeeAvatarImages.arya,
    },
    {
      userId: 'fallback-riya-2',
      displayName: 'Riya',
      photoURL: null,
      photoSource: attendeeAvatarImages.riya,
    },
    {
      userId: 'fallback-anaya-2',
      displayName: 'Anaya',
      photoURL: null,
      photoSource: attendeeAvatarImages.anaya,
    },
    {
      userId: 'fallback-isha-2',
      displayName: 'Isha',
      photoURL: null,
      photoSource: attendeeAvatarImages.isha,
    },
  ];
}

function firstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return '';
}

function resolveUserPhoto(profile: any, user: any): string | null {
  return (
    firstNonEmptyString(
      profile?.photoURL,
      profile?.photos?.[0],
      profile?.datingPhotos?.[0],
      profile?.avatar,
      profile?.photo,
      profile?.imageUrl,
      user?.photoURL,
    ) || null
  );
}

function normalizeIdentityString(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isViewerInterestedEntry(
  userInfo: any,
  viewerUid: string,
  viewerDisplayName: string,
  viewerPhoto: string | null,
) {
  const candidateId = firstNonEmptyString(userInfo?.userId, userInfo?.id, userInfo?.uid);
  if (candidateId && candidateId === viewerUid) return true;

  const candidateName = normalizeIdentityString(userInfo?.displayName || userInfo?.name);
  const candidatePhoto = firstNonEmptyString(
    userInfo?.photoURL,
    userInfo?.avatar,
    userInfo?.photo,
    userInfo?.imageUrl,
  );

  return Boolean(
    (viewerDisplayName && candidateName === normalizeIdentityString(viewerDisplayName)) ||
    (viewerPhoto && candidatePhoto === viewerPhoto),
  );
}

function DynamicBackgroundLayer({
  img,
  opacityStyle,
}: {
  img: string;
  opacityStyle: { opacity: number };
}) {
  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, opacityStyle]}>
      <Image
        source={{ uri: img }}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        blurRadius={60}
      />
    </Animated.View>
  );
}

interface LayerData {
  key: string;
  img: string;
}

const MAX_DYNAMIC_LAYERS = 3;

function DynamicBackground({ events, scrollY }: { events: Event[]; scrollY: SharedValue<number> }) {
  const layers: (LayerData | null)[] = useMemo(() => {
    const arr: (LayerData | null)[] = [];
    for (let i = 0; i < MAX_DYNAMIC_LAYERS; i++) {
      const event = events[i];
      const img = event ? getEventImage(event) : null;
      arr.push(img ? { key: event.id, img } : null);
    }
    return arr;
  }, [events]);

  return (
    <View style={StyleSheet.absoluteFillObject}>
      {layers.map((layer, index) => {
        if (!layer) {
          return <View key={`bg-empty-${index}`} style={StyleSheet.absoluteFillObject} />;
        }

        const opacityStyle = useAnimatedStyle(() => {
          const input = [(index - 1) * ITEM_HEIGHT, index * ITEM_HEIGHT, (index + 1) * ITEM_HEIGHT];
          const opacity = interpolate(scrollY.value, input, [0, 1, 0], Extrapolate.CLAMP);
          return { opacity };
        });

        return (
          <DynamicBackgroundLayer key={layer.key} img={layer.img} opacityStyle={opacityStyle} />
        );
      })}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.6)' }]} />
    </View>
  );
}

function FeedCard({
  event,
  index,
  scrollY,
  insetsTop,
}: {
  event: Event;
  index: number;
  scrollY: SharedValue<number>;
  insetsTop: number;
}) {
  const router = useRouter();
  const img = getEventImage(event);

  const { isInterested, toggleInterest, interestedUsers } = useEventInterestStore();
  const { user } = useAuth();
  const profile = useProfileStore((s) => s.profile);
  const interested = isInterested(event.id);

  const handleShare = async () => {
    try {
      await RNShare.share({
        message: `Check out ${event.title} at ${event.venue ?? 'this venue'}!`,
        title: event.title,
      });
    } catch (error) {
      console.log('Error sharing event', error);
    }
  };

  const startDate = safeDate(event.startDate);
  const dateStr = startDate
    ? startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'TBA';
  const timeStr = formatEventTime(event.startDate);
  const venueStr = event.venue ?? event.location ?? 'TBA';

  const guestlistUsers = useMemo(() => {
    const storeUsers = interestedUsers[event.id] ?? [];
    const eventUsers = Array.isArray(event.interestedData?.users) ? event.interestedData.users : [];
    const sourceUsers = storeUsers.length > 0 ? storeUsers : eventUsers;
    const viewerDisplayName = firstNonEmptyString(profile?.displayName, user?.displayName);
    const viewerPhoto = resolveUserPhoto(profile, user);
    const viewerInterestedUser =
      interested && user?.uid
        ? {
            userId: user.uid,
            displayName: viewerDisplayName || 'C1rcle User',
            photoURL: viewerPhoto,
            isCurrentUser: true,
          }
        : null;
    const users = viewerInterestedUser
      ? [
          viewerInterestedUser,
          ...sourceUsers.filter(
            (userInfo: any) =>
              !isViewerInterestedEntry(
                userInfo,
                viewerInterestedUser.userId,
                viewerDisplayName,
                viewerPhoto,
              ),
          ),
        ]
      : sourceUsers;

    return users.length > 0 ? users : getFallbackInterestedUsers();
  }, [event, interested, interestedUsers, profile, user]);

  const posterTransitionTag = `poster-${event.id}-feed-${index}`;
  const cardAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 }], opacity: 1 }));

  return (
    <View style={[styles.itemContainer, { paddingBottom: 0 }]}>
      <Animated.View style={[styles.cardWrapper, cardAnimStyle]}>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => {
            const Haptics = require('expo-haptics');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push({
              pathname: '/event/[id]',
              params: { id: event.id, posterTransitionTag },
            });
          }}
        >
          <View style={{ flex: 1 }}>
            <View style={styles.posterContainer}>
              {img ? (
                <AnimatedExpoImage
                  sharedTransitionTag={posterTransitionTag}
                  source={{ uri: img }}
                  style={StyleSheet.absoluteFillObject}
                  contentFit="cover"
                  contentPosition="top"
                />
              ) : (
                <LinearGradient
                  colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
                  style={StyleSheet.absoluteFillObject}
                />
              )}
              {/* Gradient to make text legible */}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.8)', '#000']}
                locations={[0.5, 0.85, 1]}
                style={StyleSheet.absoluteFillObject}
              />
            </View>

            <View style={styles.infoOverlay}>
              <View style={styles.infoBlock}>
                <View style={styles.titleRow}>
                  <View style={{ flex: 1, marginRight: 16 }}>
                    <Text style={styles.eventTitle} numberOfLines={2}>
                      {event.title}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                      <Text
                        style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600' }}
                        numberOfLines={1}
                      >
                        {venueStr}
                      </Text>
                      <View style={styles.verifiedVenueDot}>
                        <Check color="#FFFFFF" size={10} strokeWidth={3} />
                      </View>
                    </View>
                    <Text style={[styles.dateVenueText, { marginTop: 4 }]} numberOfLines={1}>
                      {dateStr} at {timeStr}
                    </Text>
                  </View>
                  <View style={styles.actionIcons}>
                    <Pressable
                      hitSlop={12}
                      onPress={(e) => {
                        e.stopPropagation();
                        const Haptics = require('expo-haptics');
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        handleShare();
                      }}
                    >
                      <Share color="rgba(255,255,255,0.7)" size={22} />
                    </Pressable>
                    <Pressable
                      hitSlop={12}
                      onPress={(e) => {
                        e.stopPropagation();
                        const Haptics = require('expo-haptics');
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        if (!user?.uid) return;
                        toggleInterest(event.id, user.uid, {
                          displayName: profile?.displayName || user.displayName || 'C1rcle User',
                          photoURL: profile?.photoURL || user.photoURL || null,
                        });
                      }}
                    >
                      <Heart
                        color={interested ? '#F44A22' : 'rgba(255,255,255,0.7)'}
                        fill={interested ? '#F44A22' : 'transparent'}
                        size={22}
                      />
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.interestedBar}>
              <View style={styles.interestedAvatars}>
                {guestlistUsers.slice(0, 5).map((userInfo: any, idx: number) => {
                  const initial = (userInfo?.displayName || userInfo?.name || '?')
                    .charAt(0)
                    .toUpperCase();
                  const avatarUri = firstNonEmptyString(
                    userInfo?.photoURL,
                    userInfo?.avatar,
                    userInfo?.photo,
                    userInfo?.imageUrl,
                  );
                  const avatarSource = userInfo?.photoSource
                    ? userInfo.photoSource
                    : avatarUri
                      ? { uri: avatarUri }
                      : null;

                  return (
                    <View
                      key={userInfo?.userId ?? userInfo?.uid ?? userInfo?.id ?? `${initial}-${idx}`}
                      style={[
                        styles.interestedAvatar,
                        {
                          marginLeft: idx > 0 ? -11 : 0,
                          backgroundColor: AVATAR_COLORS[(index + idx) % AVATAR_COLORS.length],
                          zIndex: 20 - idx,
                        },
                      ]}
                    >
                      {avatarSource ? (
                        <Image
                          source={avatarSource}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                        />
                      ) : (
                        <Text style={styles.interestedAvatarText}>{initial}</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export default function ImmersiveFeedScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [topPrefix, topSuffix] = useMemo(() => {
    if (!type || type === 'foryou') return ['This Month', ' Near Me'];
    if (type === 'trending') return ['Trending', ' Now'];
    if (type === 'similar') return ['Similar', ' Events'];
    if (type === 'free') return ['Free', ' Events'];
    if (type === 'this-week') return ['This Week', ''];
    return [type.charAt(0).toUpperCase() + type.slice(1), ' Events'];
  }, [type]);

  const events = useEventsStore((s) => s.events);
  const loading = useEventsStore((s) => s.loading);
  const fetchEvents = useEventsStore((s) => s.fetchEvents);
  const scoredEvents = useRecommendationsStore((s) => s.scoredEvents);

  useEffect(() => {
    if (events.length === 0 && !loading) {
      fetchEvents();
    }
  }, [type]);

  const feedEvents = useMemo(() => {
    const list = [...events];

    // Filter by scene keywords if type maps to a known scene
    const sceneKeywords = type ? SCENE_KEYWORDS[type] : null;
    if (sceneKeywords) {
      return list
        .filter((e) => matchSceneKeywords(e, sceneKeywords))
        .sort((a, b) => getHeatScore(b) - getHeatScore(a));
    }

    if (type === 'foryou') {
      const sortedIds = Object.keys(scoredEvents).sort(
        (a, b) => scoredEvents[b].score - scoredEvents[a].score,
      );
      list.sort((a, b) => {
        const aIdx = sortedIds.indexOf(a.id);
        const bIdx = sortedIds.indexOf(b.id);
        if (aIdx === -1 && bIdx === -1) return 0;
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
      });
    } else if (type === 'trending' || type === 'similar') {
      list.sort((a, b) => getHeatScore(b) - getHeatScore(a));
    }
    return list;
  }, [events, type, scoredEvents]);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const [activeIndex, setActiveIndex] = useState(0);

  const viewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: 50,
    }),
    [],
  );

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const idx = viewableItems[0].index;
      if (idx !== null) {
        setActiveIndex((current) => (current === idx ? current : idx));
      }
    }
  }, []);

  const renderFeedItem = useCallback(
    ({ item, index }: { item: Event; index: number }) => (
      <FeedCard event={item} index={index} scrollY={scrollY} insetsTop={insets.top} />
    ),
    [insets.top, scrollY],
  );

  if (loading && events.length === 0) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#F44A22" />
      </View>
    );
  }

  if (feedEvents.length === 0) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16 }}>No events found.</Text>
      </View>
    );
  }

  const activeFeedIndex = Math.min(activeIndex, Math.max(feedEvents.length - 1, 0));
  const activeEvent = feedEvents[activeFeedIndex];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <DynamicBackground events={feedEvents} scrollY={scrollY} />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topCapsuleContainer}>
          <BlurView
            blurMethod="dimezisBlurView"
            intensity={30}
            tint="dark"
            style={styles.topCapsule}
          >
            <Pressable
              hitSlop={15}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)/explore');
                }
              }}
              style={styles.topCapsuleIconButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ChevronLeft color="#FFFFFF" size={21} strokeWidth={2.4} />
            </Pressable>

            <Pressable
              hitSlop={15}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/search');
              }}
              style={styles.topCapsuleTitleButton}
            >
              <Text style={styles.topCapsuleText}>
                {topPrefix} <Text style={{ color: 'rgba(255,255,255,0.5)' }}>{topSuffix}</Text>
              </Text>
            </Pressable>

            <Pressable
              hitSlop={15}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/search');
              }}
              style={styles.topCapsuleIconButton}
              accessibilityRole="button"
              accessibilityLabel="Search events"
            >
              <Search color="#FFFFFF" size={16} />
            </Pressable>
          </BlurView>
        </View>
      </View>

      <Animated.FlatList
        bounces={false}
        overScrollMode="never"
        data={feedEvents}
        keyExtractor={(item: Event) => item.id}
        renderItem={renderFeedItem}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onScroll={scrollHandler as any}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />

      <View style={[styles.stickyBottomBar, { paddingBottom: insets.bottom }]}>
        <Pressable
          style={styles.buyButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (activeEvent) {
              router.push(`/checkout/${activeEvent.id}`);
            }
          }}
        >
          <Text style={styles.buyButtonText}>
            Get Tickets{' '}
            <Text style={styles.buyButtonSubtext}>
              {(() => {
                const displayPrice = activeEvent?.minPrice ?? 20;
                return displayPrice === 0
                  ? 'Free'
                  : `from ₹${displayPrice.toLocaleString('en-IN')}`;
              })()}
            </Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
  },
  topCapsuleContainer: {
    paddingHorizontal: 16,
    width: '100%',
    marginBottom: 16,
  },
  topCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  topCapsuleIconButton: {
    width: 38,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topCapsuleTitleButton: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topCapsuleText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },

  itemContainer: {
    width: SCREEN_WIDTH,
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  cardWrapper: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  posterContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#000',
  },

  infoBlock: {
    gap: 4,
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 24, // Space for the interested bar
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  eventTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0,
    lineHeight: 26,
  },
  actionIcons: {
    flexDirection: 'column',
    gap: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedVenueDot: {
    backgroundColor: '#F44A22',
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  dateVenueText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '500',
  },
  interestedBar: {
    position: 'absolute',
    bottom: 8,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  interestedAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  interestedAvatar: {
    width: 53,
    height: 53,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#050505',
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  interestedAvatarText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },

  stickyBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: 'transparent',
  },
  buyButton: {
    backgroundColor: '#F44A22',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
  },
  buyButtonSubtext: {
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
});
