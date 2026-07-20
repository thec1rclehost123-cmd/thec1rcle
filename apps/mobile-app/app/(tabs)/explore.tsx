import { useEffect, useState, useCallback, useMemo, useRef, type ReactElement } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
  Dimensions,
  Modal,
  DeviceEventEmitter,
  AppState,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';

import { ExploreFeaturedCarousel } from '@/components/ui/ExploreFeaturedCarousel';
import { ExploreChooseScene } from '@/components/ui/ExploreChooseScene';
import { ExploreMapPreview } from '@/components/ui/ExploreMapPreview';
import { useEventsStore, type Event, getHeatScore } from '@/store/eventsStore';
import { useRecommendationsStore } from '@/store/recommendationsStore';
import { useProfileStore } from '@/store/profileStore';
import { getEventImage } from '@/lib/utils/event';
import { cacheEvents, getCachedEvents, updateLastSyncTime } from '@/lib/cache';
import { useEventInterestStore } from '@/store/eventInterestStore';
import { useAuth } from '@/hooks/useAuth';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
  interpolateColor,
  FadeInRight,
  FadeIn,
  useFrameCallback,
  interpolate,
  Extrapolation,
  useAnimatedRef,
  useAnimatedReaction,
  scrollTo,
} from 'react-native-reanimated';

import { colors, spacing, typography } from '@/lib/design/theme';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { EventCardSkeletonList } from '@/components/ui/Skeleton';
import { trackScreen } from '@/lib/analytics';
import { resumePendingDeepLink } from '@/lib/deeplinks';
import { formatEventDate, safeDate } from '@/lib/utils/date';
import { Search, MapPin, Compass, User, X } from 'lucide-react-native';
import {
  ScenesWorthIt,
  TopVenues,
  EditorsPicks,
  TrendingRightNow,
  ComingUpThisWeek,
  AllScenes,
} from '@/components/ui/PremiumExploreSections';
import {
  shouldPromptForLocation,
  recordLocationPrompt,
  showSettingsAlert,
} from '@/lib/permissions';
import { cityIdFromName, DISCOVERY_CITIES } from '@/lib/firstRun';
import { useFirstRunStore } from '@/store/firstRunStore';
import { FIRST_RUN_EVENTS, trackFirstRun } from '@/lib/firstRunAnalytics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
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
type ExploreSection = {
  key: string;
  render: () => any;
};

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
function getLowestPrice(event: Event): number | null {
  const tiers = [
    ...((event as any).tickets || []),
    ...((event as any).ticketTiers || []),
    ...((event as any).tiers || []),
  ];
  const availablePrices = tiers
    .filter((tier: any) => Number(tier?.remaining ?? tier?.available ?? 1) > 0)
    .map((tier: any) => Number(tier?.price ?? tier?.amount ?? 0))
    .filter((price: number) => Number.isFinite(price));
  if (availablePrices.length > 0) return Math.min(...availablePrices);
  if (event.minPrice !== undefined && event.minPrice !== null) return Number(event.minPrice);
  return null;
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

function eventMatchesCity(event: Event, city: string): boolean {
  if (!city || city === 'all') return true;
  const eventCity = String(event.city ?? event.location ?? '')
    .trim()
    .toLowerCase();
  const selectedCity = city.trim().toLowerCase();
  return eventCity === selectedCity || eventCity.startsWith(`${selectedCity},`);
}

function HeaderProfileAvatar() {
  const profile = useProfileStore((s) => s.profile);
  const initials = profile?.displayName
    ? profile.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : null;

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
          {initials ? (
            <Text style={styles.avatarInitials}>{initials}</Text>
          ) : (
            <User size={20} color="#FFFFFF" strokeWidth={2.5} />
          )}
        </View>
      )}
    </Pressable>
  );
}

// ── Animated filter pill ───────────────────────────────────────────────────────
function FilterPill({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withTiming(isActive ? 1 : 0.96, { duration: 250 });
  }, [isActive]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          scale.value = withSequence(
            withSpring(0.93, { damping: 10, stiffness: 300 }),
            withSpring(isActive ? 1 : 0.96, { damping: 14, stiffness: 200 }),
          );
          onPress();
        }}
      >
        <LinearGradient
          colors={isActive ? [colors.iris, '#FF6B4A'] : ['transparent', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.filterPill, isActive && styles.filterPillActive]}
        >
          <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
            {label}
          </Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
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
        <FilterPill
          key={f.id}
          label={f.label}
          isActive={active === f.id}
          onPress={() => onChange(f.id)}
        />
      ))}
    </ScrollView>
  );
}

// ── Category filter pills ──────────────────────────────────────────────────────
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
      contentContainerStyle={styles.catFilterRowContent}
    >
      {CATEGORY_FILTERS.map((f) => (
        <FilterPill
          key={f.id}
          label={f.label}
          isActive={active === f.id}
          onPress={() => onChange(f.id)}
        />
      ))}
    </ScrollView>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ firstRun?: string }>();

  const { events, loading, fetchEvents } = useEventsStore();
  const {
    items: recommendationItems,
    recommendations,
    source: recommendationSource,
    loading: recommendationLoading,
    fallbackUsed,
    loadServerRecommendations,
    setFallbackEvents,
    clear: clearRecommendations,
  } = useRecommendationsStore();
  const { user } = useAuth();
  const { loadUserInterests } = useEventInterestStore();
  const profile = useProfileStore((s) => s.profile);
  const firstRunSnapshot = useFirstRunStore((state) => state.snapshot);
  const saveCity = useFirstRunStore((state) => state.saveCity);
  const citySaving = useFirstRunStore((state) => state.loading);
  const cityError = useFirstRunStore((state) => state.error);

  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const profileCity =
    firstRunSnapshot?.cityName || profile?.discoveryProfile?.cityName || profile?.city || '';
  const [cityFilter, setCityFilter] = useState(profileCity.toLowerCase() || 'all');
  const [showCityModal, setShowCityModal] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [cachedEvents, setCachedEvents] = useState<Event[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showLocationNudge, setShowLocationNudge] = useState(false);
  const mainScrollRef = useRef<FlashListRef<ExploreSection>>(null);
  const [allScenesY, setAllScenesY] = useState(0);
  const lastTabBarScrollY = useRef(0);
  const lastTabBarEmitAt = useRef(0);
  const exploreStartedAt = useRef(Date.now());
  const exploreRenderedTracked = useRef(false);

  useEffect(() => {
    if (user?.uid && profileCity) setCityFilter(profileCity.toLowerCase());
  }, [profileCity, user?.uid]);

  const baseEvents = events.length > 0 ? events : cachedEvents;

  const allEvents = baseEvents;
  const cityOptions = useMemo(() => {
    if (user?.uid) {
      return DISCOVERY_CITIES.map((city) => ({ value: city.name.toLowerCase(), label: city.name }));
    }
    const seen = new Map<string, string>();
    allEvents.forEach((e) => {
      const city = e.city ?? e.location ?? '';
      if (city) seen.set(city.toLowerCase(), city);
    });
    return [
      { value: 'all', label: 'All cities' },
      ...Array.from(seen.entries()).map(([, label]) => ({ value: label.toLowerCase(), label })),
    ];
  }, [allEvents, user?.uid]);

  const activeCityLabel =
    cityOptions.find((o) => o.value === cityFilter)?.label ??
    (cityFilter === 'all'
      ? 'Choose a city'
      : cityFilter.replace(/\b\w/g, (letter) => letter.toUpperCase()));
  const cityScopedEvents = useMemo(
    () => allEvents.filter((event) => eventMatchesCity(event, cityFilter)),
    [allEvents, cityFilter],
  );

  // Derived featured events — eliminates separate API call
  const featuredSlides = useMemo(() => {
    return [...cityScopedEvents]
      .filter((e) => e.isFeatured)
      .sort((a, b) => getHeatScore(b) - getHeatScore(a))
      .slice(0, 6);
  }, [cityScopedEvents]);

  const visibleRecommendations = useMemo(
    () => recommendations.filter((event) => eventMatchesCity(event, cityFilter)),
    [cityFilter, recommendations],
  );
  const visibleReasonLabel = useMemo(() => {
    const firstId = visibleRecommendations[0]?.id;
    return (
      recommendationItems.find((item) => item.event.id === firstId)?.reasonLabel ||
      (activeCityLabel === 'Choose a city' ? 'Popular right now' : `Popular in ${activeCityLabel}`)
    );
  }, [activeCityLabel, recommendationItems, visibleRecommendations]);

  const heroSlides = useMemo(() => {
    if (visibleRecommendations.length > 0) return visibleRecommendations.slice(0, 6);
    const src = featuredSlides.length > 0 ? featuredSlides : cityScopedEvents;
    return [...src].sort((a, b) => getHeatScore(b) - getHeatScore(a)).slice(0, 6);
  }, [featuredSlides, cityScopedEvents, visibleRecommendations]);

  const filteredEvents = useMemo(() => {
    let result = cityScopedEvents;

    // Apply strict filtering BEFORE sorting/slicing
    result = applyDateFilter(result, dateFilter);
    result = applyCategoryFilter(result, categoryFilter);
    // Apply quick filters (including trending sort) on the accurately filtered data
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

    return result;
  }, [cityScopedEvents, dateFilter, categoryFilter, quickFilter]);

  // "Similar to you" — events NOT in recommendations, by heat score
  const similarEvents = useMemo(() => {
    const recIds = new Set(recommendations.map((e) => e.id));
    return [...cityScopedEvents]
      .filter((e) => !recIds.has(e.id))
      .sort((a, b) => getHeatScore(b) - getHeatScore(a))
      .slice(0, 8);
  }, [cityScopedEvents, recommendations]);

  // "Trending This Week" — events happening within the next 7 days, sorted by heat
  const trendingThisWeek = useMemo(() => {
    const nowMs = Date.now();
    const weekAheadMs = nowMs + 7 * 24 * 60 * 60 * 1000;
    return [...cityScopedEvents]
      .filter((e) => {
        const t = safeDate(e.startDate)?.getTime() ?? 0;
        return t >= nowMs && t <= weekAheadMs;
      })
      .sort((a, b) => getHeatScore(b) - getHeatScore(a))
      .slice(0, 10);
  }, [cityScopedEvents]);

  // "Free Entry" — events with zero price
  const freeEvents = useMemo(() => {
    return [...cityScopedEvents]
      .filter((e) => getLowestPrice(e) === 0)
      .sort((a, b) => getHeatScore(b) - getHeatScore(a))
      .slice(0, 10);
  }, [cityScopedEvents]);

  const loadData = useCallback(
    async (city?: string) => {
      const cached = await getCachedEvents();
      if (cached.data?.length) setCachedEvents(cached.data);

      try {
        const cityParam = city && city !== 'all' ? city : undefined;
        await fetchEvents(cityParam);
        const store = useEventsStore.getState();
        if (store.events.length > 0) {
          await cacheEvents(store.events);
          await updateLastSyncTime();
        }
        setIsOffline(false);
      } catch {
        setIsOffline(true);
      }
    },
    [fetchEvents],
  );

  useEffect(() => {
    trackScreen('Explore');
    if (user?.uid) void resumePendingDeepLink();
    if (user?.uid) void loadServerRecommendations(user.uid);
    else clearRecommendations();
    void loadData(cityFilter);
    if (user?.uid) void loadUserInterests(user.uid);
  }, [
    user?.uid,
    cityFilter,
    loadData,
    loadServerRecommendations,
    clearRecommendations,
    loadUserInterests,
  ]);

  useEffect(() => {
    if (recommendationLoading || exploreRenderedTracked.current) return;
    if (!recommendations.length && !fallbackUsed) return;
    exploreRenderedTracked.current = true;
    trackFirstRun(FIRST_RUN_EVENTS.EXPLORE_RENDERED, {
      feedSource: recommendationSource,
      outcome: fallbackUsed ? 'fallback' : 'personalized',
      latencyMs: Date.now() - exploreStartedAt.current,
      cityId: cityFilter === 'all' ? undefined : cityIdFromName(cityFilter),
    });
  }, [
    cityFilter,
    fallbackUsed,
    recommendationLoading,
    recommendationSource,
    recommendations.length,
  ]);

  useEffect(() => {
    if (!allEvents.length || recommendationLoading) return;
    if (recommendationSource === 'server' || recommendationSource === 'cache') return;
    setFallbackEvents(
      cityScopedEvents,
      cityFilter === 'all' ? 'Popular right now' : `Popular in ${activeCityLabel}`,
    );
  }, [
    activeCityLabel,
    cityScopedEvents,
    cityFilter,
    recommendationLoading,
    recommendationSource,
    setFallbackEvents,
  ]);

  useEffect(() => {
    shouldPromptForLocation(user?.uid).then((show) => {
      setShowLocationNudge(show);
    });
  }, [user?.uid]);

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await Promise.all([
      loadData(cityFilter),
      user?.uid ? loadServerRecommendations(user.uid, true) : Promise.resolve(false),
    ]);
    setRefreshing(false);
  }, [loadData, cityFilter, loadServerRecommendations, user?.uid]);

  const chooseCity = useCallback(
    async (value: string, label: string) => {
      void Haptics.selectionAsync();
      if (user?.uid) {
        const saved = await saveCity(cityIdFromName(label), label, 'manual');
        if (!saved) return;
        clearRecommendations();
      }
      setCityFilter(value);
      setShowCityModal(false);
    },
    [clearRecommendations, saveCity, user?.uid],
  );

  const isInitialLoading = loading && allEvents.length === 0;

  const [greeting, setGreeting] = useState(getGreeting());

  useFocusEffect(
    useCallback(() => {
      setGreeting(getGreeting());
    }, []),
  );

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const now = Date.now();
    if (Math.abs(y - lastTabBarScrollY.current) < 18 && now - lastTabBarEmitAt.current < 120) {
      return;
    }
    lastTabBarScrollY.current = y;
    lastTabBarEmitAt.current = now;
    DeviceEventEmitter.emit('tabBarScroll', y);
  }, []);

  const exploreSections = useMemo<ExploreSection[]>(
    () => [
      {
        key: 'header',
        render: () => (
          <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
            <View style={styles.headerRow}>
              <Pressable onPress={() => setShowCityModal(true)} style={styles.locationBlock}>
                <Text style={styles.greetingText}>
                  {greeting}
                  {profile?.displayName ? `, ${profile.displayName.split(' ')[0]}` : ''}
                </Text>
                <View style={styles.cityRow}>
                  <MapPin size={22} color="#F44A22" strokeWidth={2.5} style={{ marginRight: 6 }} />
                  <Text style={styles.cityName}>{activeCityLabel}</Text>
                </View>
              </Pressable>

              <View style={styles.headerRight}>
                <NotificationBell variant="solid" />
                <HeaderProfileAvatar />
              </View>
            </View>

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
        ),
      },
      {
        key: 'filters',
        render: () => (
          <View style={{ marginBottom: 0 }}>
            <QuickFilterRow active={quickFilter} onChange={setQuickFilter} />
          </View>
        ),
      },
      {
        key: 'offline',
        render: () =>
          isOffline ? (
            <Animated.View entering={FadeIn} style={styles.offlineBanner}>
              <Text style={styles.offlineText}>📡 Offline — showing cached content</Text>
            </Animated.View>
          ) : null,
      },
      {
        key: 'location-nudge',
        render: () =>
          showLocationNudge ? (
            <Animated.View entering={FadeIn} style={styles.locationBanner}>
              <MapPin size={18} color="#F44A22" strokeWidth={2.5} />
              <Text style={styles.locationBannerText}>Enable location to see events near you</Text>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowLocationNudge(false);
                  recordLocationPrompt(user?.uid);
                  showSettingsAlert(
                    'Location Access',
                    'Turn on location access in Settings to discover events near you.',
                  );
                }}
                style={styles.locationBannerAction}
              >
                <Text style={styles.locationBannerActionText}>Enable</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowLocationNudge(false);
                  recordLocationPrompt(user?.uid);
                }}
                hitSlop={8}
              >
                <X size={16} color="rgba(255,255,255,0.4)" strokeWidth={2} />
              </Pressable>
            </Animated.View>
          ) : null,
      },
      {
        key: 'loading',
        render: () =>
          isInitialLoading || (recommendationLoading && params.firstRun === 'complete') ? (
            <EventCardSkeletonList count={3} style={styles.loadingSkeletons} />
          ) : null,
      },
      {
        key: 'featured',
        render: () =>
          quickFilter === 'all' && !isInitialLoading && heroSlides.length > 0 ? (
            <ExploreFeaturedCarousel events={heroSlides} />
          ) : null,
      },
      {
        key: 'choose-scene',
        render: () => (quickFilter === 'all' ? <ExploreChooseScene /> : null),
      },
      {
        key: 'worth-it',
        render: () =>
          quickFilter === 'all' && freeEvents.length > 0 ? (
            <ScenesWorthIt events={freeEvents} />
          ) : null,
      },
      {
        key: 'top-venues',
        render: () =>
          quickFilter === 'all' ? (
            <TopVenues city={cityFilter === 'all' ? undefined : activeCityLabel} />
          ) : null,
      },
      {
        key: 'editors-picks',
        render: () =>
          quickFilter === 'all' && visibleRecommendations.length > 0 ? (
            <EditorsPicks events={visibleRecommendations} title={visibleReasonLabel} />
          ) : null,
      },
      {
        key: 'trending',
        render: () =>
          quickFilter === 'all' && trendingThisWeek.length > 0 ? (
            <TrendingRightNow events={trendingThisWeek} />
          ) : null,
      },
      {
        key: 'coming-up',
        render: () =>
          quickFilter === 'all' && similarEvents.length > 0 ? (
            <ComingUpThisWeek events={similarEvents} />
          ) : null,
      },
      {
        key: 'all-scenes',
        render: () =>
          filteredEvents.length > 0 ? (
            <View onLayout={(e) => setAllScenesY(e.nativeEvent.layout.y)}>
              <AllScenes
                events={filteredEvents}
                onPageChange={() => {
                  mainScrollRef.current?.scrollToOffset({
                    offset: Math.max(0, allScenesY - 20),
                    animated: true,
                  });
                }}
              />
            </View>
          ) : !loading && quickFilter !== 'all' ? (
            <View style={styles.emptyState}>
              <Search size={48} color="rgba(255,255,255,0.15)" strokeWidth={2} />
              <Text style={styles.emptyText}>No events found</Text>
              <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
            </View>
          ) : null,
      },
      {
        key: 'no-content',
        render: () =>
          !loading && cityScopedEvents.length === 0 && !isOffline ? (
            <View style={styles.emptyState}>
              <Compass size={48} color="rgba(255,255,255,0.15)" strokeWidth={2} />
              <Text style={styles.emptyText}>No events yet</Text>
              <Text style={styles.emptySubtext}>Pull down to refresh</Text>
            </View>
          ) : null,
      },
      {
        key: 'map',
        render: () =>
          !isInitialLoading && cityScopedEvents.length > 0 ? (
            <ExploreMapPreview events={cityScopedEvents} />
          ) : null,
      },
    ],
    [
      activeCityLabel,
      allEvents,
      allScenesY,
      categoryFilter,
      cityScopedEvents,
      dateFilter,
      filteredEvents,
      freeEvents,
      greeting,
      heroSlides,
      insets.top,
      isInitialLoading,
      isOffline,
      loading,
      quickFilter,
      recommendations,
      params.firstRun,
      recommendationLoading,
      recommendationSource,
      similarEvents,
      trendingThisWeek,
      fallbackUsed,
      user?.uid,
      visibleReasonLabel,
      visibleRecommendations,
    ],
  );
  return (
    <View style={styles.container}>
      {/* Subtle top-down thec1rcle orange glow */}
      <LinearGradient
        colors={['rgba(244, 74, 34, 0.4)', 'transparent']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 600, zIndex: 0 }}
        pointerEvents="none"
      />
      <FlashList
        style={styles.scrollLayer}
        ref={mainScrollRef}
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 76 }}
        data={exploreSections}
        getItemType={(section) => section.key}
        keyExtractor={(section) => section.key}
        renderItem={useCallback(({ item }: any) => item.render(), [])}
        extraData={useMemo(
          () => ({
            allScenesY,
            cityFilter,
            dateFilter,
            categoryFilter,
            quickFilter,
            refreshing,
            showCityModal,
          }),
          [
            allScenesY,
            cityFilter,
            dateFilter,
            categoryFilter,
            quickFilter,
            refreshing,
            showCityModal,
          ],
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.iris}
            progressViewOffset={insets.top}
          />
        }
      />

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
                accessibilityRole="radio"
                accessibilityState={{ selected: cityFilter === opt.value, disabled: citySaving }}
                disabled={citySaving}
                onPress={() => void chooseCity(opt.value, opt.label)}
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
            {cityError ? <Text style={styles.cityError}>{cityError}</Text> : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.base.DEFAULT },
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
    color: '#FFFFFF',
    fontSize: typography.fontSize['3xl'],
    fontWeight: '800',
    letterSpacing: 0,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cityChevron: { color: 'rgba(255,255,255,0.55)', fontSize: 18, fontWeight: '600', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },

  // Profile avatar in header
  avatarRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(7,7,9,0.94)',
    borderWidth: 1.5,
    borderColor: colors.iris,
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(7,7,9,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

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
    paddingTop: 0,
    paddingBottom: 4,
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  filterPillActive: {
    borderColor: 'rgba(255,255,255,0)',
  },
  filterPillText: {
    color: colors.goldMetallic,
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    letterSpacing: 0,
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  catFilterRowContent: {
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: 16,
    gap: 8,
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
  locationBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(244, 74, 34, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationBannerText: {
    flex: 1,
    color: 'rgba(255,255,255,0.8)',
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
  },
  locationBannerAction: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(244, 74, 34, 0.2)',
  },
  locationBannerActionText: {
    color: '#F44A22',
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
  },
  loadingSkeletons: { paddingTop: 8, paddingBottom: 18 },

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
  cityError: { color: '#FF796B', fontSize: 13, lineHeight: 18, paddingVertical: 12 },
});
