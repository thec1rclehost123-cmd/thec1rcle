import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Dimensions,
  Image as RNImage,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInRight,
  useSharedValue,
  useAnimatedStyle,
  withTiming,

} from 'react-native-reanimated';
import { router } from 'expo-router';
import { colors, radii, spacing, typography } from '@/lib/design/theme';
import type { Event } from '@/store/eventsStore';
import { useVenuesStore } from '@/store/venuesStore';
import { useProfileStore } from '@/store/profileStore';
import { useAuth } from '@/hooks/useAuth';
import { formatEventDate } from '@/lib/utils/date';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
export const EXPLORE_SIDE_INSET = 16;
export const EXPLORE_RAIL_GAP = 12;
export const EXPLORE_CARD_OVERLAP = 18;
export const EXPLORE_FEATURED_CARD_OVERLAP = 24;
export const EXPLORE_GRID_CARD_WIDTH = Math.floor(
  (SCREEN_WIDTH - EXPLORE_SIDE_INSET * 2 - EXPLORE_RAIL_GAP) / 2,
);
export const EXPLORE_FEATURED_CARD_WIDTH = Math.min(
  (SCREEN_WIDTH - EXPLORE_SIDE_INSET * 2 - 24) * 0.9,
  270,
);
const FOR_YOU_CARD_WIDTH = EXPLORE_GRID_CARD_WIDTH;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function getDisplayPrice(event: Event): string {
  const tiers = [
    ...((event as any).tickets || []),
    ...((event as any).ticketTiers || []),
    ...((event as any).tiers || []),
  ];
  const availablePrices = tiers
    .filter((tier: any) => Number(tier?.remaining ?? tier?.available ?? 1) > 0)
    .map((tier: any) => Number(tier?.price ?? tier?.amount ?? 0))
    .filter((price: number) => Number.isFinite(price));
  const allPrices = tiers
    .map((tier: any) => Number(tier?.price ?? tier?.amount ?? 0))
    .filter((price: number) => Number.isFinite(price));
  const lowest =
    availablePrices.length > 0
      ? Math.min(...availablePrices)
      : allPrices.length > 0
        ? Math.min(...allPrices)
        : event.minPrice;

  if (lowest === undefined || lowest === null) return 'Tickets';
  return Number(lowest) <= 0 ? 'Free' : `₹${Math.round(Number(lowest)).toLocaleString('en-IN')}`;
}



function SectionHeader({ title, icon, onViewAll, viewAllLabel = 'See All' }: any) {
  const words = title.trim().split(' ');
  const lastWord = words.pop() || '';
  const firstPart = words.join(' ');

  return (
    <View style={styles.sectionHeader}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>

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

function HypeCashPill() {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: '/events/feed', params: { type: 'free' } });
      }}
      style={styles.hypeCashPill}
    >
      <LinearGradient
        colors={['rgba(244,74,34,0.22)', 'rgba(244,74,34,0.06)', 'rgba(255,255,255,0.035)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.hypeCashIcon}>
        <Text style={styles.hypeCashIconText}>₹</Text>
      </View>
      <Text style={styles.hypeCashText} numberOfLines={1}>
        10% C1RCLE Cash on these tickets
      </Text>
    </Pressable>
  );
}

function HorizontalEventRail({
  events,
  limit = 5,
  variant = 'compact',
  hideGradient = false,
}: {
  events: Event[];
  limit?: number;
  variant?: 'compact' | 'standard';
  hideGradient?: boolean;
}) {
  const visibleEvents = events.slice(0, limit);
  return (
    <ScrollView
      horizontal
      bounces={false}
      overScrollMode="never"
      showsHorizontalScrollIndicator={false}
      snapToInterval={FOR_YOU_CARD_WIDTH + EXPLORE_RAIL_GAP}
      decelerationRate="fast"
      contentContainerStyle={styles.horizontalRailContent}
    >
      {visibleEvents.map((item, index) => (
        <View
          key={item.id}
          style={[
            styles.horizontalRailItem,
            { zIndex: index + 1 },
          ]}
        >
          <PremiumEventCard
            event={item}
            index={index}
            variant={variant}
            hideGradient={hideGradient}
          />
        </View>
      ))}
    </ScrollView>
  );
}

// ── 3. Scenes Worth It ──
export function ScenesWorthIt({ events }: { events: Event[] }) {
  if (!events.length) return null;
  return (
    <View style={styles.section}>
      <SectionHeader
        title="Worth The Hype"
        onViewAll={() => router.push({ pathname: '/events/feed', params: { type: 'free' } })}
      />
      <HypeCashPill />
      <HorizontalEventRail events={events} />
    </View>
  );
}

// ── 4. Top Venues ──
export function TopVenues({ city }: { city?: string }) {
  const { venues, fetchVenues } = useVenuesStore();
  const { user, initialized } = useAuth();
  const profile = useProfileStore((state) => state.profile);
  const profileCity = profile?.discoveryProfile?.cityName || profile?.city || '';
  const selectedCity = city || profileCity || undefined;

  React.useEffect(() => {
    if (!initialized) return;
    if (user && !selectedCity) return;
    void fetchVenues(selectedCity ? { city: selectedCity } : undefined);
  }, [selectedCity, initialized, user?.uid, fetchVenues]);

  if (!venues.length) return null;

  return (
    <View style={styles.section}>
      <SectionHeader title="Top Venues" onViewAll={() => router.push('/(tabs)/venues')} />
      <ScrollView
        horizontal
        bounces={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: EXPLORE_SIDE_INSET, gap: EXPLORE_RAIL_GAP }}
      >
        {venues.slice(0, 8).map((venue, index) => {
          const img = venue.photoURL || venue.image || venue.coverImage || venue.coverURL || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600';
          return (
            <AnimatedPressable
              key={venue.id}
              entering={FadeInRight.delay(index * 50).duration(400)}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/venue/${venue.id}`);
              }}
              style={{ alignItems: 'center', width: 116 }}
            >
              <View
                style={{
                  width: 116,
                  height: 116,
                  borderRadius: 58,
                  overflow: 'hidden',
                  marginBottom: 10,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)',
                }}
              >
                <Image source={{ uri: img }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
              </View>
              <Text
                style={{
                  color: '#FFF',
                  fontSize: typography.fontSize.sm + 1,
                  fontWeight: '800',
                  textAlign: 'center',
                  letterSpacing: 0,
                }}
                numberOfLines={1}
              >
                {venue.name || venue.displayName}
              </Text>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.55)',
                  fontSize: typography.fontSize.xs,
                  fontWeight: '600',
                  textAlign: 'center',
                  marginTop: 3,
                }}
                numberOfLines={1}
              >
                {venue.area || venue.neighborhood || venue.city}
              </Text>
            </AnimatedPressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── 5. Editor's Picks ──
export function EditorsPicks({ events, title = 'Handpicked Curations' }: { events: Event[]; title?: string }) {
  if (!events.length) return null;
  return (
    <View style={styles.section}>
      <SectionHeader title={title} />
      <HorizontalEventRail events={events} />
    </View>
  );
}

// ── 6. Trending Right Now (Ranked) ──
export function TrendingRightNow({ events }: { events: Event[] }) {
  if (!events.length) return null;
  return (
    <View style={styles.section}>
      <SectionHeader
        title="Hottest Scenes"
        onViewAll={() => router.push({ pathname: '/events/feed', params: { type: 'trending' } })}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: EXPLORE_SIDE_INSET, gap: EXPLORE_RAIL_GAP }}
      >
        {events.slice(0, 6).map((item, index) => (
          <View key={item.id} style={{ width: FOR_YOU_CARD_WIDTH }}>
            <Text style={styles.rankNumber}>{index + 1}</Text>
            <PremiumEventCard event={item} index={index} variant="standard" hideGradient />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ── 7. Coming Up This Week ──
export function ComingUpThisWeek({ events }: { events: Event[] }) {
  if (!events.length) return null;
  return (
    <View style={styles.section}>
      <SectionHeader
        title="The Weekly Lineup"
        onViewAll={() => router.push({ pathname: '/events/feed', params: { type: 'this-week' } })}
      />
      <HorizontalEventRail events={events} />
    </View>
  );
}

// ── 8. When Is The Plan? ──
export function WhenIsThePlan({
  filter,
  setFilter,
}: {
  filter: string;
  setFilter: (f: string) => void;
}) {
  const filters = [
    { id: 'tonight', label: 'Today' },
    { id: 'weekend', label: 'This Weekend' },
    { id: 'this-week', label: 'This Week' },
    { id: 'next-weekend', label: 'Next Weekend' },
  ];
  return (
    <View style={styles.section}>
      <SectionHeader title="When Is The Plan?" icon="⏳" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16 }}>
        {filters.map((f) => {
          const isActive = filter === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFilter(f.id);
              }}
              style={[
                {
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  borderRadius: 16,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)',
                },
                isActive && {
                  backgroundColor: 'rgba(244,74,34,0.15)',
                  borderColor: '#F44A22',
                  shadowColor: '#F44A22',
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 4 },
                },
              ]}
            >
              <Text
                style={[
                  {
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: typography.fontSize.base,
                    fontWeight: '600',
                  },
                  isActive && { color: '#F44A22', fontWeight: '800' },
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ── 9. All Scenes ──
export function AllScenes({
  events,
  onPageChange,
}: {
  events: Event[];
  onPageChange?: () => void;
}) {
  const [currentPage, setCurrentPage] = React.useState(1);
  const eventsPerPage = 8;

  React.useEffect(() => {
    setCurrentPage(1);
  }, [events]);

  const totalPages = Math.ceil(events.length / eventsPerPage);
  const startIndex = (currentPage - 1) * eventsPerPage;
  const endIndex = startIndex + eventsPerPage;
  const visibleEvents = events.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentPage(page);
      onPageChange?.();
    }
  };

  return (
    <View style={styles.section}>
      <SectionHeader 
        title="All Scenes" 
        onViewAll={() => router.push({ pathname: '/events/feed' })} 
      />
      <View style={styles.allScenesGrid}>
        {visibleEvents.map((item, index) => (
          <PremiumEventCard key={item.id} event={item} index={index} variant="standard" />
        ))}
      </View>

      {totalPages > 1 && (
        <View style={styles.paginationContainer}>
          <Pressable
            onPress={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            style={[styles.pageButton, currentPage === 1 && styles.disabledPageButton]}
          >
            <ChevronLeft size={16} color={currentPage === 1 ? 'rgba(255,255,255,0.2)' : '#FFF'} />
          </Pressable>

          <View style={styles.pageNumbersContainer}>
            {Array.from({ length: totalPages }).map((_, i) => {
              const pageNum = i + 1;
              const isSelected = pageNum === currentPage;
              const shouldShow =
                totalPages <= 5 ||
                pageNum === 1 ||
                pageNum === totalPages ||
                Math.abs(pageNum - currentPage) <= 1;

              if (!shouldShow) {
                if (
                  (pageNum === 2 && currentPage > 3) ||
                  (pageNum === totalPages - 1 && currentPage < totalPages - 2)
                ) {
                  return (
                    <Text key={`dots-${pageNum}`} style={styles.paginationEllipsis}>
                      ...
                    </Text>
                  );
                }
                return null;
              }

              return (
                <Pressable
                  key={pageNum}
                  onPress={() => handlePageChange(pageNum)}
                  style={[styles.pageNumberButton, isSelected && styles.selectedPageNumberButton]}
                >
                  <Text
                    style={[styles.pageNumberText, isSelected && styles.selectedPageNumberText]}
                  >
                    {pageNum}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            style={[styles.pageButton, currentPage === totalPages && styles.disabledPageButton]}
          >
            <ChevronRight
              size={16}
              color={currentPage === totalPages ? 'rgba(255,255,255,0.2)' : '#FFF'}
            />
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ── The Premium Event Card Component ──
export function PremiumEventCard({
  event,
  index,
  variant = 'standard',
  hideGradient = false,
}: any) {
  const scale = useSharedValue(1);
  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const img =
    event.coverImage ||
    event.images?.[0] ||
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600';
  const price = getDisplayPrice(event);
  const posterTransitionTag = `poster-${event.id}-${variant}`;

  let cardStyle: any = {
    width: FOR_YOU_CARD_WIDTH,
    height: FOR_YOU_CARD_WIDTH * 1.35,
    borderRadius: 16,
    overflow: 'hidden',
  };
  if (variant === 'featured')
    cardStyle = {
      width: EXPLORE_FEATURED_CARD_WIDTH,
      height: EXPLORE_FEATURED_CARD_WIDTH * 1.32,
      borderRadius: 20,
      overflow: 'hidden',
    };
  if (variant === 'list')
    cardStyle = {
      width: '100%',
      height: 140,
      borderRadius: 16,
      overflow: 'hidden',
      flexDirection: 'row',
    };

  return (
    <Animated.View
      entering={FadeInRight.delay(index * 50).duration(400)}
      style={[cardAnimatedStyle, { position: 'relative' }]}
    >
      {/* Dual-Gradient Border Glass Wrapper (Light Reflection) */}
      <View style={[cardStyle, { position: 'relative', backgroundColor: 'transparent' }]}>
        {/* 1. Bottom-Right Ambient Reflection (Iris Orange/Red Glow Border) */}
        <LinearGradient
          colors={['rgba(244, 74, 34, 0.45)', 'transparent']}
          start={{ x: 1, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: cardStyle.borderRadius }]}
        />

        {/* 2. Top-Left Light Specular Highlight (Light Reflection Border) */}
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.35)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: cardStyle.borderRadius }]}
        />

        {/* Inner Content Card (inset by padding to show border) */}
        <View style={{ flex: 1, padding: 1.2 }}>
          <AnimatedPressable
            onPressIn={() => {
              scale.value = withTiming(0.96, { duration: 150 });
            }}
            onPressOut={() => {
              scale.value = withTiming(1, { duration: 150 });
            }}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({
                pathname: '/event/[id]',
                params: { id: event.id, posterTransitionTag },
              });
            }}
            style={{
              flex: 1,
              backgroundColor: '#161616',
              borderRadius: cardStyle.borderRadius - 1.2,
              overflow: 'hidden',
            }}
          >
            <Animated.Image
              sharedTransitionTag={posterTransitionTag}
              source={{ uri: img }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />

            {/* Holographic / Glass Overlay */}
            <LinearGradient
              colors={['rgba(244,74,34,0.15)', 'rgba(254,248,232,0.05)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />

            {!hideGradient && (
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.75)', 'rgba(0,0,0,1)']}
                locations={[0.2, 0.65, 1]}
                style={StyleSheet.absoluteFillObject}
              />
            )}

            <View style={{ flex: 1, justifyContent: 'space-between' }}>
              <View style={{ padding: variant === 'compact' ? spacing.md : spacing.base, flexDirection: 'row', justifyContent: 'space-between' }}>
                <View
                  style={{
                    backgroundColor: 'rgba(10, 10, 10, 0.75)',
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: 100,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.15)',
                  }}
                >
                  <Text
                    style={{
                      color: '#FFF',
                      fontSize: typography.fontSize.xs + 1,
                      fontWeight: '800',
                      letterSpacing: 0.5,
                    }}
                  >
                    {formatEventDate(event.startDate)}
                  </Text>
                </View>
              </View>

              <BlurView
                blurMethod="dimezisBlurView"
                intensity={80}
                tint="dark"
                style={{
                  padding: variant === 'compact' ? spacing.md : spacing.base,
                  paddingTop: spacing.md,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: 'rgba(255,255,255,0.1)',
                }}
              >
                <Text
                  style={{
                    color: '#FFF',
                    fontSize:
                      variant === 'large' ? typography.fontSize['2xl'] : typography.fontSize.base,
                    fontWeight: '900',
                    letterSpacing: 0,
                    textShadowColor: 'rgba(0,0,0,0.8)',
                    textShadowOffset: { width: 0, height: 2 },
                    textShadowRadius: 4,
                  }}
                  numberOfLines={2}
                >
                  {event.title}
                </Text>
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: typography.fontSize.sm,
                    marginTop: 2,
                    fontWeight: '600',
                  }}
                  numberOfLines={1}
                >
                  {event.venue}
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: spacing.sm,
                  }}
                >
                  <Text
                    style={{
                      color: '#F44A22',
                      fontSize: typography.fontSize.md,
                      fontWeight: '900',
                    }}
                  >
                    {price}
                  </Text>
                  {variant === 'list' && (
                    <View
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        paddingHorizontal: spacing.base,
                        paddingVertical: spacing.sm,
                        borderRadius: 100,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.15)',
                      }}
                    >
                      <Text
                        style={{
                          color: '#FFF',
                          fontSize: typography.fontSize.xs + 1,
                          fontWeight: '800',
                        }}
                      >
                        Get Tickets
                      </Text>
                    </View>
                  )}
                </View>
              </BlurView>
            </View>
          </AnimatedPressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 48 },
  horizontalRailContent: {
    paddingLeft: EXPLORE_SIDE_INSET,
    paddingRight: EXPLORE_SIDE_INSET,
    gap: EXPLORE_RAIL_GAP,
  },
  horizontalRailItem: {
    width: FOR_YOU_CARD_WIDTH,
  },
  allScenesGrid: {
    paddingHorizontal: EXPLORE_SIDE_INSET,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 22,
  },
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
  hypeCashPill: {
    alignSelf: 'flex-start',
    marginHorizontal: 16,
    marginTop: -6,
    marginBottom: spacing.base,
    minHeight: 34,
    maxWidth: '92%',
    borderRadius: 17,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(244,74,34,0.32)',
  },
  hypeCashIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(244,74,34,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(244,74,34,0.45)',
  },
  hypeCashIconText: {
    color: colors.iris,
    fontSize: typography.fontSize.base,
    fontWeight: '900',
    lineHeight: 17,
  },
  hypeCashText: {
    flexShrink: 1,
    color: 'rgba(255,255,255,0.84)',
    fontSize: typography.fontSize.sm,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  rankNumber: {
    position: 'absolute',
    top: -30,
    left: -15,
    fontSize: 120,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.1)',
    zIndex: -1,
    fontStyle: 'italic',
    letterSpacing: 0,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xxl,
    gap: 8,
  },
  pageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledPageButton: {
    opacity: 0.3,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  pageNumbersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pageNumberButton: {
    minWidth: 40,
    height: 40,
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedPageNumberButton: {
    backgroundColor: colors.iris,
    borderColor: colors.irisGlow,
    shadowColor: colors.iris,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  pageNumberText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: typography.fontSize.base,
    fontWeight: '700',
  },
  selectedPageNumberText: {
    color: '#FFF',
    fontWeight: '900',
  },
  paginationEllipsis: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: typography.fontSize.base,
    fontWeight: '700',
    marginHorizontal: 4,
  },
});
