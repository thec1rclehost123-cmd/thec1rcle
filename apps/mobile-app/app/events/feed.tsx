import React, { useState, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
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
import { Search, ListFilter, Share, Heart, Check, ChevronLeft } from 'lucide-react-native';
import { useEventsStore, type Event, getHeatScore } from '@/store/eventsStore';
import { useRecommendationsStore } from '@/store/recommendationsStore';
import { useEventInterestStore } from '@/store/eventInterestStore';
import { getEventImage } from '@/lib/utils/event';
import { safeDate, formatEventTime } from '@/lib/utils/date';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const AnimatedExpoImage = Animated.createAnimatedComponent(Image);
const ITEM_HEIGHT = SCREEN_HEIGHT;

// Tabs
const TABS = ['For You', 'Following', 'Saved'] as const;
type TabType = (typeof TABS)[number];

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

// ── Background Glow ────────────────────────────────────────────────────────────
function BackgroundItem({
  event,
  index,
  scrollY,
}: {
  event: Event;
  index: number;
  scrollY: SharedValue<number>;
}) {
  const img = getEventImage(event);
  const opacityStyle = useAnimatedStyle(() => {
    const input = [(index - 1) * ITEM_HEIGHT, index * ITEM_HEIGHT, (index + 1) * ITEM_HEIGHT];
    const opacity = interpolate(scrollY.value, input, [0, 1, 0], Extrapolate.CLAMP);
    return { opacity };
  });
  if (!img) return null;
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

function DynamicBackground({ events, scrollY }: { events: Event[]; scrollY: SharedValue<number> }) {
  return (
    <View style={StyleSheet.absoluteFillObject}>
      {events.slice(0, 10).map((event, index) => (
        <BackgroundItem key={event.id} event={event} index={index} scrollY={scrollY} />
      ))}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.6)' }]} />
    </View>
  );
}

// ── Feed Card ──────────────────────────────────────────────────────────────────
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

  const startDate = safeDate(event.startDate);
  const dateStr = startDate
    ? startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'TBA';
  const timeStr = formatEventTime(event.startDate);
  const venueStr = event.venue ?? event.location ?? 'TBA';

  const organizerName = event.hostName ?? 'THE C1RCLE';
  const price = event.minPrice ?? 20;

  const { interestedUsers } = useEventInterestStore();
  const eventInterested = interestedUsers[event.id] ?? [];

  const interestedFallbackUsers = [
    {
      userId: 'fallback-arya',
      displayName: 'Arya',
      photoURL: null,
      photoSource: attendeeAvatarImages.arya,
      likedAt: '',
    },
    {
      userId: 'fallback-riya',
      displayName: 'Riya',
      photoURL: null,
      photoSource: attendeeAvatarImages.riya,
      likedAt: '',
    },
    {
      userId: 'fallback-anaya',
      displayName: 'Anaya',
      photoURL: null,
      photoSource: attendeeAvatarImages.anaya,
      likedAt: '',
    },
    {
      userId: 'fallback-isha',
      displayName: 'Isha',
      photoURL: null,
      photoSource: attendeeAvatarImages.isha,
      likedAt: '',
    },
    {
      userId: 'fallback-hira',
      displayName: 'Hira',
      photoURL: null,
      photoSource: attendeeAvatarImages.hira,
      likedAt: '',
    },
    {
      userId: 'fallback-yash',
      displayName: 'Yash',
      photoURL: null,
      photoSource: attendeeAvatarImages.yash,
      likedAt: '',
    },
    {
      userId: 'fallback-neil',
      displayName: 'Neil',
      photoURL: null,
      photoSource: attendeeAvatarImages.neil,
      likedAt: '',
    },
    {
      userId: 'fallback-sam',
      displayName: 'Sam',
      photoURL: null,
      photoSource: attendeeAvatarImages.sam,
      likedAt: '',
    },
    {
      userId: 'fallback-arya-2',
      displayName: 'Arya',
      photoURL: null,
      photoSource: attendeeAvatarImages.arya,
      likedAt: '',
    },
    {
      userId: 'fallback-riya-2',
      displayName: 'Riya',
      photoURL: null,
      photoSource: attendeeAvatarImages.riya,
      likedAt: '',
    },
    {
      userId: 'fallback-anaya-2',
      displayName: 'Anaya',
      photoURL: null,
      photoSource: attendeeAvatarImages.anaya,
      likedAt: '',
    },
    {
      userId: 'fallback-isha-2',
      displayName: 'Isha',
      photoURL: null,
      photoSource: attendeeAvatarImages.isha,
      likedAt: '',
    },
  ];
  const guestlistUsers = eventInterested.length > 0 ? eventInterested : interestedFallbackUsers;
  const interestedLeadName = 'Arya';
  const interestedOthersCount = 60;

  const posterTransitionTag = `poster-${event.id}-feed-${index}`;

  // Card scale + opacity transition
  const cardAnimStyle = useAnimatedStyle(() => {
    const input = [(index - 1) * ITEM_HEIGHT, index * ITEM_HEIGHT, (index + 1) * ITEM_HEIGHT];
    const scale = interpolate(scrollY.value, input, [0.85, 1, 0.85], Extrapolate.CLAMP);
    const opacity = interpolate(scrollY.value, input, [0.3, 1, 0.3], Extrapolate.CLAMP);
    return { transform: [{ scale }], opacity };
  });

  return (
    <View style={[styles.itemContainer, { paddingTop: insetsTop + 70, paddingBottom: 120 }]}>
      <Animated.View style={[styles.cardWrapper, cardAnimStyle]}>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push({
              pathname: '/event/[id]',
              params: { id: event.id, posterTransitionTag },
            });
          }}
        >
          <View style={styles.posterContainer}>
            {img && (
              <AnimatedExpoImage
                sharedTransitionTag={posterTransitionTag}
                source={{ uri: img }}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
                contentPosition="top"
              />
            )}
          </View>

          {/* Info Block Below Poster */}
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
                  <View
                    style={{
                      backgroundColor: '#F44A22',
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: 6,
                    }}
                  >
                    <Check color="#FFFFFF" size={10} strokeWidth={3} />
                  </View>
                </View>
                <Text style={[styles.dateVenueText, { marginTop: 4 }]} numberOfLines={1}>
                  {dateStr} at {timeStr}
                </Text>
              </View>
              <View style={styles.actionIcons}>
                <Share color="rgba(255,255,255,0.7)" size={22} />
                <Heart color="rgba(255,255,255,0.7)" size={22} />
              </View>
            </View>

            <View style={styles.interestedBar}>
              <View style={styles.interestedAvatars}>
                {guestlistUsers.slice(0, 6).map((userInfo, idx) => {
                  const initial = (userInfo.displayName?.[0] ?? '?').toUpperCase();
                  const avatarSource = (userInfo as any).photoSource
                    ? (userInfo as any).photoSource
                    : typeof userInfo?.photoURL === 'string' &&
                        userInfo.photoURL.length > 0 &&
                        (userInfo.photoURL.startsWith('http') ||
                          userInfo.photoURL.startsWith('https'))
                      ? { uri: userInfo.photoURL }
                      : null;
                  return (
                    <View
                      key={userInfo.userId || `${initial}-${idx}`}
                      style={[
                        styles.interestedAvatar,
                        { marginLeft: idx > 0 ? -16 : 0, zIndex: 20 - idx },
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

// ── Main Screen ────────────────────────────────────────────────────────────────
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
  const recommendations = useRecommendationsStore((s) => s.recommendations);

  const feedEvents = useMemo(() => {
    let list = [...events];
    if (type === 'foryou' && recommendations.length > 0) {
      const recOrder = new Map(recommendations.map((e, i) => [e.id, i]));
      list.sort((a, b) => {
        const aIdx = recOrder.get(a.id) ?? Infinity;
        const bIdx = recOrder.get(b.id) ?? Infinity;
        return aIdx - bIdx;
      });
    } else if (type === 'trending' || type === 'similar') {
      list.sort((a, b) => getHeatScore(b) - getHeatScore(a));
    }
    return list;
  }, [events, type, recommendations]);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const [activeIndex, setActiveIndex] = useState(0);

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const idx = viewableItems[0].index;
      if (idx !== null) {
        setActiveIndex(idx);
      }
      Haptics.selectionAsync();
    }
  }, []);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  if (feedEvents.length === 0) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16 }}>No events found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <DynamicBackground events={feedEvents} scrollY={scrollY} />

      {/* Top Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        {/* Search Capsule */}
        <View style={styles.topCapsuleContainer}>
          <BlurView intensity={30} tint="dark" style={styles.topCapsule}>
            <Pressable
              hitSlop={15}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.push('/');
                }
              }}
            >
              <ChevronLeft color="#FFFFFF" size={20} />
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/search');
              }}
              style={{ flex: 1, alignItems: 'center' }}
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
            >
              <Search color="#FFFFFF" size={16} />
            </Pressable>
          </BlurView>
        </View>
      </View>

      {/* Vertical Card List */}
      <Animated.FlatList
        bounces={false}
        overScrollMode="never"
        data={feedEvents}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <FeedCard event={item} index={index} scrollY={scrollY} insetsTop={insets.top} />
        )}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />

      {/* Sticky Bottom Bar */}
      <View style={[styles.stickyBottomBar, { paddingBottom: insets.bottom }]}>
        <Pressable
          style={styles.buyButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const activeEvent = feedEvents[activeIndex];
            if (activeEvent) {
              router.push(`/checkout/${activeEvent.id}`);
            }
          }}
        >
          <Text style={styles.buyButtonText}>
            Get Tickets{' '}
            <Text style={styles.buyButtonSubtext}>
              {(() => {
                const activeEvent = feedEvents[activeIndex];
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
  topCapsuleText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  // ── Item Layout ─────────────────────────────────────────────────────────────
  itemContainer: {
    width: SCREEN_WIDTH,
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  cardWrapper: {
    width: SCREEN_WIDTH - 32,
    flex: 1,
  },
  posterContainer: {
    width: '100%',
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  // ── Info Block ──────────────────────────────────────────────────────────────
  infoBlock: {
    marginTop: 16,
    paddingHorizontal: 4,
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
  dateVenueText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '500',
  },
  interestedBar: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  interestedAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  interestedAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: '#050505',
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  interestedAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  interestedCopyRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  interestedText: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Bottom Bar ──────────────────────────────────────────────────────────────
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
