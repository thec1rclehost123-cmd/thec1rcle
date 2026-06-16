import React, { useMemo, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable, ViewToken, Platform } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
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
  FadeIn,
} from 'react-native-reanimated';
import { ArrowLeft } from 'lucide-react-native';
import { useEventsStore, type Event, getHeatScore } from '@/store/eventsStore';
import { useRecommendationsStore } from '@/store/recommendationsStore';
import { getEventImage } from '@/lib/utils/event';
import { safeDate, formatEventTime } from '@/lib/utils/date';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.9;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.58;
const ITEM_HEIGHT = SCREEN_HEIGHT * 0.78; // Shorter than screen so next card peeks
const DATE_AREA_HEIGHT = ITEM_HEIGHT * 0.22; // Space for date above card

// ── Date filter tabs ───────────────────────────────────────────────────────────
const FEED_TABS = [
  { id: 'coming-soon', label: 'Coming Soon' },
  { id: 'now-playing', label: 'Now Playing' },
  { id: 'tomorrow', label: 'Tomorrow' },
] as const;
type FeedTab = (typeof FEED_TABS)[number]['id'];

// ── Helpers ────────────────────────────────────────────────────────────────────
function getDateDisplay(event: Event): { day: string; month: string } {
  const d = safeDate(event.startDate);
  if (!d) return { day: 'TBD', month: '' };
  const day = d.getDate().toString().padStart(2, '0');
  const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  return { day, month };
}

function getLowestPrice(event: Event): number {
  return event.minPrice ?? 0;
}

function filterByTab(events: Event[], tab: FeedTab): Event[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const dayAfterTomorrow = new Date(today.getTime() + 2 * 86_400_000);

  return events.filter((e) => {
    const d = safeDate(e.startDate);
    if (!d) return tab === 'coming-soon';

    switch (tab) {
      case 'now-playing':
        // Events happening today
        return d >= today && d < tomorrow;
      case 'tomorrow':
        // Events happening tomorrow
        return d >= tomorrow && d < dayAfterTomorrow;
      case 'coming-soon':
        // Events in the future (after tomorrow)
        return d >= dayAfterTomorrow;
      default:
        return true;
    }
  });
}

// ── Background Glow ────────────────────────────────────────────────────────────
function DynamicBackground({ events, scrollY }: { events: Event[]; scrollY: SharedValue<number> }) {
  return (
    <View style={StyleSheet.absoluteFillObject}>
      {events.slice(0, 10).map((event, index) => {
        const img = getEventImage(event);
        if (!img) return null;

        const opacityStyle = useAnimatedStyle(() => {
          const input = [(index - 1) * ITEM_HEIGHT, index * ITEM_HEIGHT, (index + 1) * ITEM_HEIGHT];
          const opacity = interpolate(scrollY.value, input, [0, 1, 0], Extrapolate.CLAMP);
          return { opacity };
        });

        return (
          <Animated.View key={event.id} style={[StyleSheet.absoluteFillObject, opacityStyle]}>
            <Image
              source={{ uri: img }}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              blurRadius={90}
            />
          </Animated.View>
        );
      })}
      {/* Dark overlay to keep text legible */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
      <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
    </View>
  );
}

// ── Top Navigation Tabs ────────────────────────────────────────────────────────
function FeedTabBar({ active, onChange }: { active: FeedTab; onChange: (tab: FeedTab) => void }) {
  return (
    <View style={styles.tabBarOuter}>
      <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={styles.tabBarInner}>
        {FEED_TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => {
                Haptics.selectionAsync();
                onChange(tab.id);
              }}
              style={[styles.tabPill, isActive && styles.tabPillActive]}
            >
              <Text style={[styles.tabPillText, isActive && styles.tabPillTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ── Feed Card ──────────────────────────────────────────────────────────────────
function FeedCard({
  event,
  index,
  scrollY,
}: {
  event: Event;
  index: number;
  scrollY: SharedValue<number>;
}) {
  const router = useRouter();
  const img = getEventImage(event);
  const { day, month } = getDateDisplay(event);
  const price = getLowestPrice(event);
  const isFree = price === 0;
  const timeStr = formatEventTime(event.startDate);

  // Card scale + opacity transition
  const cardAnimStyle = useAnimatedStyle(() => {
    const input = [(index - 1) * ITEM_HEIGHT, index * ITEM_HEIGHT, (index + 1) * ITEM_HEIGHT];
    const scale = interpolate(scrollY.value, input, [0.82, 1, 0.82], Extrapolate.CLAMP);
    const opacity = interpolate(scrollY.value, input, [0.3, 1, 0.3], Extrapolate.CLAMP);
    return { transform: [{ scale }], opacity };
  });

  // Parallax date movement
  const dateTranslateStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [(index - 1) * ITEM_HEIGHT, index * ITEM_HEIGHT, (index + 1) * ITEM_HEIGHT],
      [180, 0, -180],
    );
    const opacity = interpolate(
      scrollY.value,
      [(index - 1) * ITEM_HEIGHT, index * ITEM_HEIGHT, (index + 1) * ITEM_HEIGHT],
      [0, 1, 0],
      Extrapolate.CLAMP,
    );
    return { transform: [{ translateY }], opacity };
  });

  return (
    <View style={styles.cardContainer}>
      {/* Massive Sticky Date Behind the Card */}
      <Animated.View style={[styles.dateBackgroundContainer, dateTranslateStyle]}>
        <Text style={styles.dateBackgroundDay} numberOfLines={1} adjustsFontSizeToFit>
          {day}
        </Text>
        <Text style={styles.dateBackgroundMonth}>{month}</Text>
      </Animated.View>

      {/* The Card */}
      <Animated.View style={[styles.cardWrapper, cardAnimStyle]}>
        <Pressable
          style={styles.cardInner}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push({
              pathname: '/event/[id]',
              params: { id: event.id },
            });
          }}
        >
          {/* Full-bleed poster */}
          {img ? (
            <Image source={{ uri: img }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          ) : (
            <LinearGradient
              colors={['#2D1A14', '#1A0A0A', '#0A0A0A']}
              style={StyleSheet.absoluteFillObject}
            />
          )}

          {/* Gradient overlays */}
          <LinearGradient
            colors={['rgba(0,0,0,0.55)', 'transparent', 'transparent', 'rgba(0,0,0,0.75)']}
            locations={[0, 0.2, 0.6, 1]}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Glassmorphism Badges — top-left */}
          <View style={styles.badgeColumn}>
            {/* Time / Duration badge */}
            <View style={styles.glassBadge}>
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
              <Text style={styles.glassBadgeText}>
                {timeStr !== 'TBD'
                  ? timeStr
                  : isFree
                    ? 'Free'
                    : `₹${price.toLocaleString('en-IN')}`}
              </Text>
            </View>

            {/* Category badge */}
            {event.category && (
              <View style={styles.glassBadge}>
                <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
                <Text style={styles.glassBadgeText}>
                  {event.category.charAt(0).toUpperCase() + event.category.slice(1)}
                </Text>
              </View>
            )}
          </View>

          {/* Bottom Info — title and venue */}
          <View style={styles.bottomInfo}>
            <Text style={styles.eventTitle} numberOfLines={2}>
              {event.title}
            </Text>
            <Text style={styles.eventVenue} numberOfLines={1}>
              {event.venue ?? event.location ?? 'TBA'}
            </Text>
            {/* Price tag at bottom */}
            {!isFree && (
              <View style={styles.priceRow}>
                <View style={styles.priceBadge}>
                  <Text style={styles.priceBadgeText}>₹{price.toLocaleString('en-IN')}+</Text>
                </View>
              </View>
            )}
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

  const { events } = useEventsStore();
  const { recommendations } = useRecommendationsStore();

  const [activeTab, setActiveTab] = useState<FeedTab>('now-playing');

  // Build the base event list based on the type param
  const baseEvents = useMemo(() => {
    if (type === 'foryou') return recommendations;
    if (type === 'similar') {
      const recIds = new Set(recommendations.map((e) => e.id));
      return [...events]
        .filter((e) => !recIds.has(e.id))
        .sort((a, b) => getHeatScore(b) - getHeatScore(a));
    }
    return events;
  }, [type, events, recommendations]);

  // Apply tab filter; fallback to all events if filter yields empty
  const feedEvents = useMemo(() => {
    const filtered = filterByTab(baseEvents, activeTab);
    return filtered.length > 0 ? filtered : baseEvents;
  }, [baseEvents, activeTab]);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const [activeIndex, setActiveIndex] = useState(0);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(viewableItems[0].index);
        Haptics.selectionAsync();
      }
    },
    [],
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const feedTitle = useMemo(() => {
    if (type === 'foryou') return 'For You';
    if (type === 'similar') return 'Similar';
    return 'Events';
  }, [type]);

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

      {/* Dynamic Glass Background */}
      <DynamicBackground events={feedEvents} scrollY={scrollY} />

      {/* Top Header — Nav Tabs */}
      <Animated.View
        entering={FadeIn.duration(400)}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        {/* Filter tabs */}
        <FeedTabBar active={activeTab} onChange={setActiveTab} />
      </Animated.View>

      {/* Vertical Card List — folder-style stacking */}
      <Animated.FlatList
        data={feedEvents}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => <FeedCard event={item} index={index} scrollY={scrollY} />}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        contentContainerStyle={{
          paddingTop: SCREEN_HEIGHT * 0.12,
          paddingBottom: SCREEN_HEIGHT * 0.15,
        }}
      />

      {/* Bottom Bar — Back + Title */}
      <Animated.View
        entering={FadeIn.delay(200).duration(400)}
        style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}
      >
        <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.bottomBackBtn}
          hitSlop={12}
        >
          <ArrowLeft color="#FFFFFF" size={20} />
        </Pressable>
        <Text style={styles.bottomTitle}>{feedTitle}</Text>
        {/* Page indicator */}
        <Text style={styles.bottomCounter}>
          {activeIndex + 1}/{feedEvents.length}
        </Text>
      </Animated.View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
    paddingHorizontal: 16,
  },

  // ── Tab Bar ─────────────────────────────────────────────────────────────────
  tabBarOuter: {
    overflow: 'hidden',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  tabBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  tabPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
  },
  tabPillActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  tabPillText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  tabPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // ── Card Container — folder-style stacking ──────────────────────────────────
  cardContainer: {
    width: SCREEN_WIDTH,
    height: ITEM_HEIGHT,
    alignItems: 'center',
    position: 'relative',
  },

  // ── Massive Date (behind card) ──────────────────────────────────────────────
  dateBackgroundContainer: {
    position: 'absolute',
    top: 0,
    width: '100%',
    height: DATE_AREA_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  dateBackgroundDay: {
    color: '#FFFFFF',
    fontSize: 96,
    fontWeight: '900',
    letterSpacing: -4,
    lineHeight: 100,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
  dateBackgroundMonth: {
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 6,
    marginTop: -6,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },

  // ── Card Wrapper ────────────────────────────────────────────────────────────
  cardWrapper: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginTop: DATE_AREA_HEIGHT,
    zIndex: 10,
  },
  cardInner: {
    flex: 1,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    // Deep shadow for floating effect
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 24 },
        shadowOpacity: 0.6,
        shadowRadius: 40,
      },
      android: {
        elevation: 20,
      },
    }),
  },

  // ── Glassmorphism Badges ────────────────────────────────────────────────────
  badgeColumn: {
    position: 'absolute',
    top: 20,
    left: 16,
    gap: 8,
    zIndex: 20,
  },
  glassBadge: {
    overflow: 'hidden',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  glassBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ── Bottom Info (on card) ───────────────────────────────────────────────────
  bottomInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  eventTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
    lineHeight: 34,
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  eventVenue: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  priceBadge: {
    backgroundColor: 'rgba(244,74,34,0.25)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(244,74,34,0.40)',
  },
  priceBadgeText: {
    color: '#F44A22',
    fontSize: 13,
    fontWeight: '800',
  },

  // ── Bottom Bar ──────────────────────────────────────────────────────────────
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  bottomBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  bottomTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  bottomCounter: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
  },
});
