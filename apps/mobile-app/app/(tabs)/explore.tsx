import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Dimensions,
  Modal,
  DeviceEventEmitter,
  AppState,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useEventsStore, type Event, getHeatScore } from '@/store/eventsStore';
import { useRecommendationsStore } from '@/store/recommendationsStore';
import { useProfileStore } from '@/store/profileStore';
import { getEventImage } from '@/lib/utils/event';
import { useTicketsStore } from '@/store/ticketsStore';
import { cacheEvents, getCachedEvents, updateLastSyncTime } from '@/lib/cache';
import { useEventInterestStore } from '@/store/eventInterestStore';
import { useAuth } from '@/hooks/useAuth';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withSpring,
  withTiming,
  withRepeat,
  Easing,
  interpolateColor,
  FadeInDown,
  FadeInRight,
  FadeIn,
  useFrameCallback,
  interpolate,
  Extrapolation,
  useAnimatedRef,
  useAnimatedReaction,
  scrollTo,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { colors, spacing, typography } from '@/lib/design/theme';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { trackScreen } from '@/lib/analytics';
import { formatEventDate, safeDate } from '@/lib/utils/date';
import { Search, MapPin, Compass } from 'lucide-react-native';
import {
  ScenesWorthIt,
  TopVenues,
  EditorsPicks,
  TrendingRightNow,
  ComingUpThisWeek,
  AllScenes,
  PremiumEventCard,
} from '@/components/ui/PremiumExploreSections';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PURE_BLACK = '#000000';

const DEFAULT_MAP_REGION = {
  latitude: 19.076,
  longitude: 72.8777,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d1d1d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1d1d1d' }] },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#bdbdbd' }],
  },
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#1a2e1a' }, { visibility: 'simplified' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.fill',
    stylers: [{ color: '#2c2c2c' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#212121' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.fill',
    stylers: [{ color: '#3c3c3c' }],
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0e1626' }],
  },
];

// ── Date filter pills ─────────────────────────────────────────────────────────
const DATE_FILTERS = [
  { id: 'all', label: 'All Dates' },
  { id: 'tonight', label: 'Tonight' },
  { id: 'weekend', label: 'Weekend' },
  { id: 'this-week', label: 'This Week' },
] as const;
type DateFilter = (typeof DATE_FILTERS)[number]['id'];

// ── Quick filter pills ─────────────────────────────────────────────────────────
const QUICK_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'free', label: 'Free' },
  { id: 'tonight', label: 'Tonight' },
  { id: 'trending', label: 'Trending' },
  { id: 'weekend', label: 'Weekend' },
] as const;
export type QuickFilter = (typeof QUICK_FILTERS)[number]['id'];

// ── Category filter pills ─────────────────────────────────────────────────────
const CATEGORY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'club', label: 'Clubbing' },
  { id: 'concert', label: 'Concerts' },
  { id: 'festival', label: 'Festivals' },
  { id: 'party', label: 'Parties' },
  { id: 'brunch', label: 'Brunch' },
  { id: 'comedy', label: 'Comedy' },
] as const;
type CategoryFilter = (typeof CATEGORY_FILTERS)[number]['id'];

// ── Category config ────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'club', label: 'Club Nights', emoji: '🎧', keywords: ['club', 'nightclub', 'dj'] },
  { id: 'concert', label: 'Concerts', emoji: '🎤', keywords: ['concert', 'live music', 'gig'] },
  { id: 'festival', label: 'Festivals', emoji: '🎡', keywords: ['festival', 'fest'] },
  { id: 'party', label: 'Parties', emoji: '🎉', keywords: ['party', 'parties', 'blowout'] },
  { id: 'brunch', label: 'Brunches', emoji: '🥂', keywords: ['brunch', 'day party'] },
  { id: 'comedy', label: 'Comedy', emoji: '😂', keywords: ['comedy', 'standup', 'stand-up'] },
  { id: 'music', label: 'Music', emoji: '🎵', keywords: ['music'] },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
function getLowestPrice(event: Event): number {
  return event.minPrice ?? 0;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function applyDateFilter(events: Event[], filter: DateFilter): Event[] {
  if (filter === 'all') return events;
  const now = new Date();
  return events.filter((e) => {
    const d = safeDate(e.startDate);
    if (!d) return false;
    if (filter === 'tonight') return d.toDateString() === now.toDateString();
    if (filter === 'this-week') {
      const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return d >= now && d <= weekAhead;
    }
    if (filter === 'weekend') {
      const day = d.getDay();
      return (day === 5 || day === 6 || day === 0) && d >= now;
    }
    return true;
  });
}

function matchCategory(event: Event, keywords: readonly string[]): boolean {
  const cat = (event.category ?? event.type ?? '').toLowerCase();
  const tags = (event.tags ?? []).map((t: string) => t.toLowerCase());
  const title = (event.title ?? '').toLowerCase();
  return keywords.some(
    (kw) => cat.includes(kw) || tags.some((t) => t.includes(kw)) || title.includes(kw),
  );
}

function applyCategoryFilter(events: Event[], category: CategoryFilter): Event[] {
  if (category === 'all') return events;
  const cat = CATEGORIES.find((c) => c.id === category);
  if (!cat) return events;
  return events.filter((e) => matchCategory(e, cat.keywords));
}

// ── AnimatedPressable ──────────────────────────────────────────────────────────
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ── Profile Avatar (header) ────────────────────────────────────────────────────
function HeaderProfileAvatar() {
  const profile = useProfileStore((s) => s.profile);
  const initials = profile?.displayName
    ? profile.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'ME';

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push('/(tabs)/profile');
      }}
      style={styles.avatarRing}
    >
      {profile?.photoURL ? (
        <Image source={{ uri: profile.photoURL }} style={styles.avatarImage} contentFit="cover" />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarInitials}>{initials}</Text>
        </View>
      )}
    </Pressable>
  );
}

function AnimatedPeekCard({ event, index, scrollX, itemWidth }: any) {
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * itemWidth, index * itemWidth, (index + 1) * itemWidth];

    // Scale down side cards
    const scale = interpolate(scrollX.value, inputRange, [0.85, 1, 0.85], Extrapolation.CLAMP);

    // Push side cards inwards to create the "stacked/overlapping" effect
    const translateX = interpolate(
      scrollX.value,
      inputRange,
      [-itemWidth * 0.15, 0, itemWidth * 0.15],
      Extrapolation.CLAMP,
    );

    // Fade out side cards slightly
    const opacity = interpolate(scrollX.value, inputRange, [0.6, 1, 0.6], Extrapolation.CLAMP);

    // Center card is always on top
    const zIndex = interpolate(scrollX.value, inputRange, [0, 10, 0], Extrapolation.CLAMP);

    return {
      transform: [{ translateX }, { scale }],
      opacity,
      zIndex: Math.round(zIndex),
    };
  });

  return (
    <Animated.View style={[{ width: itemWidth, alignItems: 'center' }, animatedStyle]}>
      <View style={{ width: '100%', paddingHorizontal: 4, position: 'relative' }}>
        <PremiumEventCard event={event} index={index} variant="featured" />
      </View>
    </Animated.View>
  );
}

function FeaturedCarousel({ events }: { events: Event[] }) {
  if (!events.length) return null;

  const scrollX = useSharedValue(0);
  const targetX = useSharedValue(0);
  const isInteracting = useSharedValue(false);

  const ITEM_WIDTH = SCREEN_WIDTH * 0.78;
  const SPACER = (SCREEN_WIDTH - ITEM_WIDTH) / 2;
  const scrollViewRef = useAnimatedRef<Animated.ScrollView>();

  // Keep the visual carousel bounded; an oversized repeated rail is expensive on iOS.
  const rail = useMemo(() => {
    return events.slice(0, 8);
  }, [events]);
  const isScreenFocused = useSharedValue(false);
  const isAppActive = useSharedValue(AppState.currentState === 'active');

  // Custom smooth scroll logic on the UI thread
  useAnimatedReaction(
    () => targetX.value,
    (val, prevVal) => {
      if (val !== prevVal && !isInteracting.value && isScreenFocused.value && isAppActive.value) {
        scrollTo(scrollViewRef, val, 0, false);
      }
    },
  );

  useFocusEffect(
    useCallback(() => {
      isScreenFocused.value = true;
      return () => {
        isScreenFocused.value = false;
      };
    }, [isScreenFocused]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      isAppActive.value = state === 'active';
    });
    return () => sub.remove();
  }, [isAppActive]);

  useEffect(() => {
    if (!rail.length) return;

    setTimeout(() => {
      targetX.value = 0;
      scrollX.value = 0;
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ x: 0, animated: false });
      }
    }, 100);

    if (rail.length < 2) return;

    const interval = setInterval(() => {
      if (
        !isInteracting.value &&
        isScreenFocused.value &&
        isAppActive.value &&
        scrollViewRef.current
      ) {
        const currentIndex = Math.round(scrollX.value / ITEM_WIDTH);
        const nextIndex = (currentIndex + 1) % rail.length;
        const nextOffset = nextIndex * ITEM_WIDTH;
        targetX.value = withTiming(nextOffset, { duration: 800 });
      }
    }, 2800); // 2000ms pause + 800ms transition

    return () => clearInterval(interval);
  }, [rail.length, ITEM_WIDTH, isAppActive, isScreenFocused]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
      if (isInteracting.value) {
        targetX.value = e.contentOffset.x;
      }
    },
    onBeginDrag: () => {
      isInteracting.value = true;
    },
    onEndDrag: () => {
      isInteracting.value = false;
    },
  });

  return (
    <View style={{ marginBottom: 36, position: 'relative' }}>
      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM_WIDTH}
        snapToAlignment="center"
        decelerationRate="normal"
        bounces={false}
        onScroll={scrollHandler}
        onScrollBeginDrag={() => {
          isInteracting.value = true;
        }}
        onScrollEndDrag={() => {
          isInteracting.value = false;
        }}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingHorizontal: SPACER,
          paddingBottom: 20,
        }}
      >
        {rail.map((event, index) => (
          <AnimatedPeekCard
            key={`${event.id}-${index}`}
            event={event}
            index={index}
            scrollX={scrollX}
            itemWidth={ITEM_WIDTH}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

// ── Category filter pills ─────────────────────────────────────────────────────
function CategoryFilterRow({
  active,
  onChange,
}: {
  active: CategoryFilter;
  onChange: (v: CategoryFilter) => void;
}) {
  return (
    <ScrollView
      bounces={false}
      overScrollMode="never"
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterRowContent}
    >
      {CATEGORY_FILTERS.map((f) => (
        <Pressable
          key={f.id}
          onPress={() => {
            Haptics.selectionAsync();
            onChange(f.id);
          }}
          style={[styles.filterPill, active === f.id && styles.filterPillActive]}
        >
          <Text style={[styles.filterPillText, active === f.id && styles.filterPillTextActive]}>
            {f.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ── Quick filter pills ─────────────────────────────────────────────────────────
function QuickFilterRow({
  active,
  onChange,
}: {
  active: QuickFilter;
  onChange: (v: QuickFilter) => void;
}) {
  return (
    <ScrollView
      bounces={false}
      overScrollMode="never"
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterRowContent}
    >
      {QUICK_FILTERS.map((f) => (
        <Pressable
          key={f.id}
          onPress={() => {
            Haptics.selectionAsync();
            onChange(f.id);
          }}
          style={[styles.filterPill, active === f.id && styles.filterPillActive]}
        >
          <Text style={[styles.filterPillText, active === f.id && styles.filterPillTextActive]}>
            {f.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// LargeEventCard replaced by standard PremiumEventCard

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({
  title,
  icon,
  onViewAll,
  viewAllLabel = 'See All',
}: {
  title: string;
  icon?: string;
  onViewAll?: () => void;
  viewAllLabel?: string;
}) {
  const words = title.trim().split(' ');
  const lastWord = words.pop() || '';
  const firstPart = words.join(' ');

  return (
    <View style={styles.sectionHeader}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {/* Vertical Glow Bar */}
        <View
          style={{
            width: 4,
            height: 18,
            borderRadius: 2,
            backgroundColor: colors.iris,
            shadowColor: colors.iris,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 4,
          }}
        />

        {icon && <Text style={{ fontSize: 18, marginLeft: 4 }}>{icon}</Text>}
        <Text style={styles.sectionTitle}>
          {firstPart}
          {firstPart ? ' ' : ''}
          <Text style={styles.sectionTitleAccent}>{lastWord}</Text>
        </Text>
      </View>
      {onViewAll && (
        <Pressable onPress={onViewAll} hitSlop={8}>
          <Text style={styles.viewAll}>{viewAllLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Map preview section ────────────────────────────────────────────────────────
function MapSection({ events }: { events: Event[] }) {
  const eventsWithCoords = useMemo(() => {
    return events.filter((e) => e.coordinates?.latitude && e.coordinates?.longitude);
  }, [events]);

  const initialRegion = useMemo(() => {
    if (eventsWithCoords.length > 0) {
      const first = eventsWithCoords[0].coordinates!;
      return {
        latitude: first.latitude,
        longitude: first.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
    }
    return DEFAULT_MAP_REGION;
  }, [eventsWithCoords]);

  return (
    <View style={styles.section}>
      <SectionHeader
        title="Explore on Map"
        onViewAll={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/map');
        }}
        viewAllLabel="View Map →"
      />
      <Pressable
        style={styles.mapCard}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/map');
        }}
      >
        <MapView
          style={StyleSheet.absoluteFillObject}
          provider={PROVIDER_DEFAULT}
          initialRegion={initialRegion}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
          userInterfaceStyle="dark"
          customMapStyle={darkMapStyle}
        >
          {eventsWithCoords.slice(0, 10).map((e) => (
            <Marker key={e.id} coordinate={e.coordinates!} pinColor="#F44A22" />
          ))}
        </MapView>
        {/* Dark overlay so badge is readable */}
        <View style={styles.mapOverlay} />
        {/* Events nearby badge */}
        <View style={styles.mapBadge}>
          <Text style={styles.mapBadgeText}>
            📍 {eventsWithCoords.length || events.length} events nearby
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
const SCENE_CATEGORIES = [
  {
    id: 'bollywood',
    label: 'BOLLYWOOD',
    bg: '#F44A22',
    image: require('../../assets/bollywood.jpg'),
  },
  { id: 'techno', label: 'TECHNO', bg: '#8B5CF6', image: require('../../assets/techno.jpg') },
  { id: 'raves', label: 'RAVES', bg: '#3B82F6', image: require('../../assets/raves.jpg') },
  {
    id: 'pool-parties',
    label: 'POOL\nPARTIES',
    bg: '#06B6D4',
    image: require('../../assets/pool.jpg'),
  },
  {
    id: 'sundowners',
    label: 'SUN\nDOWNERS',
    bg: '#EAB308',
    image: require('../../assets/09f5dd049312a8bf3c50ea656e1a203b.jpg'),
  },
];

function ChooseYourSceneGrid() {
  const handlePress = (cat: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/events/feed', params: { type: cat.id } });
  };

  const renderCard = (cat: any, fontSize = 16) => (
    <Pressable
      onPress={() => handlePress(cat)}
      style={{ flex: 1, backgroundColor: cat.bg, borderRadius: 12, overflow: 'hidden' }}
    >
      <Image source={cat.image} style={StyleSheet.absoluteFillObject} contentFit="cover" />
      <LinearGradient
        colors={['rgba(0,0,0,0.7)', 'transparent']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 48 }}
      />
      <Text
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          right: 12,
          color: '#FFF',
          fontSize,
          fontWeight: '900',
          letterSpacing: 0,
          lineHeight: fontSize * 1.1,
        }}
        numberOfLines={2}
        adjustsFontSizeToFit
      >
        {cat.label}
      </Text>
    </Pressable>
  );

  const CONTAINER_SIZE = SCREEN_WIDTH;

  return (
    <View style={{ marginTop: 12, marginBottom: 44 }}>
      <SectionHeader title="Choose Your Scene" />

      <View style={{ paddingHorizontal: 0 }}>
        <View style={{ width: CONTAINER_SIZE, height: CONTAINER_SIZE, gap: 6 }}>
          {/* Top Row */}
          <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
            <View style={{ flex: 2 }}>{renderCard(SCENE_CATEGORIES[0], 18)}</View>
            <View style={{ flex: 1 }}>{renderCard(SCENE_CATEGORIES[4], 18)}</View>
          </View>

          {/* Bottom Row */}
          <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
            <View style={{ flex: 1 }}>{renderCard(SCENE_CATEGORIES[2], 18)}</View>
            <View style={{ flex: 1 }}>{renderCard(SCENE_CATEGORIES[3], 18)}</View>
            <View style={{ flex: 1 }}>{renderCard(SCENE_CATEGORIES[1], 18)}</View>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function ExploreScreen() {
  const insets = useSafeAreaInsets();

  const { events, featuredEvents, loading, fetchEvents, fetchFeaturedEvents } = useEventsStore();
  const { recommendations, score, loadBrowsed } = useRecommendationsStore();
  const ticketsStore = useTicketsStore();
  const { user } = useAuth();
  const { loadUserInterests } = useEventInterestStore();

  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [showCityModal, setShowCityModal] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [cachedEvents, setCachedEvents] = useState<Event[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const mainScrollRef = useRef<ScrollView>(null);
  const [allScenesY, setAllScenesY] = useState(0);
  const lastTabBarScrollY = useRef(0);
  const lastTabBarEmitAt = useRef(0);

  const baseEvents = events.length > 0 ? events : cachedEvents;

  const allEvents = baseEvents;
  const cityOptions = useMemo(() => {
    const seen = new Map<string, string>();
    allEvents.forEach((e) => {
      const city = e.city ?? e.location ?? '';
      if (city) seen.set(city.toLowerCase(), city);
    });
    return [
      { value: 'all', label: 'Mumbai' },
      ...Array.from(seen.entries()).map(([, label]) => ({ value: label.toLowerCase(), label })),
    ];
  }, [allEvents]);

  const activeCityLabel = cityOptions.find((o) => o.value === cityFilter)?.label ?? 'Mumbai';

  const heroSlides = useMemo(() => {
    const src = featuredEvents.length > 0 ? featuredEvents : allEvents;
    return [...src].sort((a, b) => getHeatScore(b) - getHeatScore(a)).slice(0, 6);
  }, [featuredEvents, allEvents]);

  const filteredEvents = useMemo(() => {
    let result = allEvents;
    if (cityFilter !== 'all') {
      result = result.filter((e) => {
        const c = (e.city ?? e.location ?? '').toLowerCase();
        return c.includes(cityFilter);
      });
    }

    if (quickFilter !== 'all') {
      if (quickFilter === 'free') {
        result = result.filter((e) => getLowestPrice(e) === 0);
      } else if (quickFilter === 'tonight') {
        const now = new Date();
        result = result.filter((e) => safeDate(e.startDate)?.toDateString() === now.toDateString());
      } else if (quickFilter === 'weekend') {
        const now = new Date();
        result = result.filter((e) => {
          const d = safeDate(e.startDate);
          if (!d) return false;
          const day = d.getDay();
          return (day === 5 || day === 6 || day === 0) && d >= now;
        });
      } else if (quickFilter === 'trending') {
        result = [...result].sort((a, b) => getHeatScore(b) - getHeatScore(a)).slice(0, 20);
      }
    }

    result = applyDateFilter(result, dateFilter);
    result = applyCategoryFilter(result, categoryFilter);
    return result;
  }, [allEvents, cityFilter, dateFilter, categoryFilter, quickFilter]);

  // "Similar to you" — events NOT in recommendations, by heat score
  const similarEvents = useMemo(() => {
    const recIds = new Set(recommendations.map((e) => e.id));
    return [...allEvents]
      .filter((e) => !recIds.has(e.id))
      .sort((a, b) => getHeatScore(b) - getHeatScore(a))
      .slice(0, 8);
  }, [allEvents, recommendations]);

  // "Trending This Week" — events happening within the next 7 days, sorted by heat
  const trendingThisWeek = useMemo(() => {
    const nowMs = Date.now();
    const weekAheadMs = nowMs + 7 * 24 * 60 * 60 * 1000;
    return [...allEvents]
      .filter((e) => {
        const t = safeDate(e.startDate)?.getTime() ?? 0;
        return t >= nowMs && t <= weekAheadMs;
      })
      .sort((a, b) => getHeatScore(b) - getHeatScore(a))
      .slice(0, 10);
  }, [allEvents]);

  // "Free Entry" — events with zero price
  const freeEvents = useMemo(() => {
    return [...allEvents]
      .filter((e) => getLowestPrice(e) === 0)
      .sort((a, b) => getHeatScore(b) - getHeatScore(a))
      .slice(0, 10);
  }, [allEvents]);

  const pastOrderCategories = useMemo(() => {
    const orders = (ticketsStore as any).orders ?? [];
    return Array.from(
      new Set(
        orders.flatMap((o: any) => {
          const cat = o.eventCategory ?? o.category ?? '';
          return cat ? [cat.toLowerCase()] : [];
        }),
      ),
    ) as string[];
  }, [(ticketsStore as any).orders]);

  useEffect(() => {
    trackScreen('Explore');
    void loadBrowsed();
    void loadData();
    if (user?.uid) void loadUserInterests(user.uid);
  }, [user?.uid]);

  useEffect(() => {
    if (allEvents.length > 0) score(allEvents, pastOrderCategories);
  }, [allEvents, pastOrderCategories]);

  const loadData = async () => {
    const cached = await getCachedEvents();
    if (cached.data?.length) setCachedEvents(cached.data);

    const [eventsResult] = await Promise.allSettled([fetchEvents(), fetchFeaturedEvents()]);

    if (eventsResult.status === 'fulfilled') {
      const store = useEventsStore.getState();
      if (store.events.length > 0) {
        await cacheEvents(store.events);
        await updateLastSyncTime();
      }
      setIsOffline(false);
    } else {
      setIsOffline(true);
    }
  };

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const isInitialLoading = loading && allEvents.length === 0;

  const greeting = getGreeting();

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const now = Date.now();
    if (Math.abs(y - lastTabBarScrollY.current) < 18 && now - lastTabBarEmitAt.current < 120) {
      return;
    }
    lastTabBarScrollY.current = y;
    lastTabBarEmitAt.current = now;
    DeviceEventEmitter.emit('tabBarScroll', y);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollLayer}
        ref={mainScrollRef}
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.iris}
            progressViewOffset={insets.top}
          />
        }
      >
        {/* Header background gradient that scrolls with content */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 400 + insets.top,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        >
          <LinearGradient
            colors={['rgba(244, 74, 34, 0.33)', 'rgba(5,5,6,0)']}
            locations={[0, 0.85]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.headerRow}>
            {/* Left: greeting + location */}
            <Pressable onPress={() => setShowCityModal(true)} style={styles.locationBlock}>
              <Text style={styles.greetingText}>{greeting}</Text>
              <View style={styles.cityRow}>
                <MapPin size={22} color="#F44A22" strokeWidth={2.5} style={{ marginRight: 6 }} />
                <Text style={styles.cityName}>{activeCityLabel}</Text>
              </View>
            </Pressable>

            {/* Right: bell + profile avatar */}
            <View style={styles.headerRight}>
              <NotificationBell variant="solid" />
              <HeaderProfileAvatar />
            </View>
          </View>

          {/* Search bar */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/search');
            }}
            style={styles.searchBar}
          >
            <Search size={18} color="rgba(255,255,255,0.4)" strokeWidth={2.5} />
            <Text style={styles.searchBarPlaceholder}>Search events...</Text>
          </Pressable>
        </View>

        {/* Filter Pills (Moved outside header to allow edge-to-edge scrolling) */}
        <View style={{ marginBottom: 24 }}>
          <QuickFilterRow active={quickFilter} onChange={setQuickFilter} />
        </View>

        {/* Offline banner */}
        {isOffline && (
          <Animated.View entering={FadeIn} style={styles.offlineBanner}>
            <Text style={styles.offlineText}>📡 Offline — showing cached content</Text>
          </Animated.View>
        )}

        {/* Loading */}
        {isInitialLoading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.iris} />
            <Text style={styles.loadingText}>Loading events…</Text>
          </View>
        )}

        {quickFilter === 'all' ? (
          <>
            {/* ── 1. Featured Scene ── */}
            {!isInitialLoading && heroSlides.length > 0 && <FeaturedCarousel events={heroSlides} />}

            {/* ── 2. Choose Your Scene ── */}
            <ChooseYourSceneGrid />

            {/* ── 3. Scenes Worth It ── */}
            {freeEvents.length > 0 && <ScenesWorthIt events={freeEvents} />}

            {/* ── 4. Top Venues ── */}
            <TopVenues />

            {/* ── 5. Editor's Picks ── */}
            {recommendations.length > 0 && <EditorsPicks events={recommendations} />}

            {/* ── 6. Trending Right Now ── */}
            {trendingThisWeek.length > 0 && <TrendingRightNow events={trendingThisWeek} />}

            {/* ── 7. Coming Up This Week ── */}
            {similarEvents.length > 0 && <ComingUpThisWeek events={similarEvents} />}
          </>
        ) : null}

        {/* ── 9. All Scenes ── */}
        {filteredEvents.length > 0 ? (
          <View onLayout={(e) => setAllScenesY(e.nativeEvent.layout.y)}>
            <AllScenes
              events={filteredEvents}
              onPageChange={() => {
                mainScrollRef.current?.scrollTo({ y: allScenesY - 20, animated: true });
              }}
            />
          </View>
        ) : (
          !loading && (
            <View style={styles.emptyState}>
              <Search size={48} color="rgba(255,255,255,0.15)" strokeWidth={2} />
              <Text style={styles.emptyText}>No events found</Text>
              <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
            </View>
          )
        )}

        {/* No content */}
        {!loading && allEvents.length === 0 && !isOffline && (
          <View style={styles.emptyState}>
            <Compass size={48} color="rgba(255,255,255,0.15)" strokeWidth={2} />
            <Text style={styles.emptyText}>No events yet</Text>
            <Text style={styles.emptySubtext}>Pull down to refresh</Text>
          </View>
        )}

        {!isInitialLoading && allEvents.length > 0 && <MapSection events={allEvents} />}
      </ScrollView>

      {/* ── City Picker Modal ── */}
      <Modal
        visible={showCityModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCityModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowCityModal(false)} />
        <View style={[styles.cityModal, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.cityModalHandle} />
          <Text style={styles.cityModalTitle}>Choose City</Text>
          <ScrollView bounces={false} overScrollMode="never" showsVerticalScrollIndicator={false}>
            {cityOptions.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => {
                  Haptics.selectionAsync();
                  setCityFilter(opt.value);
                  setShowCityModal(false);
                }}
                style={styles.cityOption}
              >
                <Text
                  style={[
                    styles.cityOptionText,
                    cityFilter === opt.value && styles.cityOptionTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
                {cityFilter === opt.value && <Text style={styles.cityOptionCheck}>✓</Text>}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PURE_BLACK },
  scrollLayer: { flex: 1, zIndex: 1 },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: { paddingHorizontal: 16, paddingTop: spacing.sm, paddingBottom: spacing.sm, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  locationBlock: { flex: 1, gap: 2 },
  greetingText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
  },
  cityRow: { flexDirection: 'row', alignItems: 'center' },
  locationPin: { fontSize: 16, marginRight: 4 },
  cityName: {
    color: colors.goldLight,
    fontSize: typography.fontSize['3xl'],
    fontWeight: '800',
    letterSpacing: 0,
  },
  cityChevron: { color: 'rgba(255,255,255,0.55)', fontSize: 18, fontWeight: '600', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },

  // Profile avatar in header
  avatarRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.base[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { color: colors.gold, fontSize: 11, fontWeight: '700' },

  // ── Search bar ───────────────────────────────────────────────────────────────
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  searchBarIcon: { fontSize: typography.fontSize.base },
  searchBarPlaceholder: { color: colors.goldMuted, fontSize: typography.fontSize.base, flex: 1 },
  // ── Quick Filters ────────────────────────────────────────────────────────────
  filterRowContent: {
    paddingTop: 16,
    paddingBottom: 4,
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  filterPillActive: {
    backgroundColor: '#FFF',
    borderColor: '#FFF',
  },
  filterPillText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    letterSpacing: 0,
  },
  filterPillTextActive: {
    color: '#000',
    fontWeight: '800',
  },

  // ── Offline / loading ────────────────────────────────────────────────────────
  offlineBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: 10,
    backgroundColor: 'rgba(255,170,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,170,0,0.25)',
  },
  offlineText: { color: '#FFAA00', fontSize: typography.fontSize.sm, fontWeight: '500' },
  loadingWrap: { paddingTop: 60, alignItems: 'center', gap: 12 },
  loadingText: { color: 'rgba(255,255,255,0.4)', fontSize: typography.fontSize.base },

  // ── Load more ─────────────────────────────────────────────────────────────────
  loadMoreBtn: {
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: spacing.base,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  loadMoreText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },

  // ── Generic Section Styles ──
  section: { marginBottom: 44 },
  sectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: '800',
    color: colors.goldLight,
    letterSpacing: 0,
  },
  sectionTitleAccent: {
    color: colors.iris,
    textShadowColor: 'rgba(244,74,34,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  viewAll: { color: colors.iris, fontSize: typography.fontSize.base, fontWeight: '700' },

  // ── Map section ───────────────────────────────────────────────────────────────
  mapCard: {
    marginHorizontal: 16,
    height: 180,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  mapBadge: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  mapBadgeText: { color: colors.goldLight, fontSize: typography.fontSize.sm, fontWeight: '700' },

  // ── Empty state ───────────────────────────────────────────────────────────────
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { color: colors.goldLight, fontSize: typography.fontSize.lg, fontWeight: '700' },
  emptySubtext: { color: 'rgba(255,255,255,0.4)', fontSize: typography.fontSize.base },

  // ── City modal ────────────────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  cityModal: {
    backgroundColor: '#111111',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 16,
    maxHeight: '60%',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cityModalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  cityModalTitle: {
    color: colors.goldLight,
    fontSize: typography.fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  cityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.base,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  cityOptionText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: typography.fontSize.base,
    fontWeight: '500',
  },
  cityOptionTextActive: { color: '#FFFFFF', fontWeight: '700' },
  cityOptionCheck: { color: '#F44A22', fontSize: typography.fontSize.md, fontWeight: '700' },
});
