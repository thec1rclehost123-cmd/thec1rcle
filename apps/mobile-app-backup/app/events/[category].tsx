'use client';
import { useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInDown,
} from 'react-native-reanimated';
import { colors, radii, gradients, shadows } from '@/lib/design/theme';
import { useEventsStore, type Event } from '@/store/eventsStore';
import { formatEventDate, formatEventTime, safeDate } from '@/lib/utils/date';
import { trackScreen } from '@/lib/analytics';

const CATEGORY_META: Record<string, { label: string; emoji: string; accent: string }> = {
  club: { label: 'Club Nights', emoji: '🎧', accent: '#8B5CF6' },
  concert: { label: 'Concerts', emoji: '🎤', accent: '#3B82F6' },
  festival: { label: 'Festivals', emoji: '🎡', accent: '#10B981' },
  party: { label: 'Parties', emoji: '🎉', accent: '#F44A22' },
  brunch: { label: 'Brunches', emoji: '🥂', accent: '#F59E0B' },
  comedy: { label: 'Comedy Shows', emoji: '😂', accent: '#EC4899' },
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function CategoryEventCard({ event, index }: { event: Event; index: number }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const lowestPrice =
    event.tickets?.reduce(
      (min, t) => (t.price < min ? t.price : min),
      event.tickets[0]?.price ?? 0,
    ) ?? 0;

  const parsedDate = safeDate(event.startDate);
  const dateStr = parsedDate ? formatEventDate(event.startDate) : '';
  const timeStr = parsedDate ? formatEventTime(event.startDate) : '';

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60)
        .springify()
        .damping(16)}
      style={animatedStyle}
    >
      <AnimatedPressable
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 400 });
        }}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push({ pathname: '/event/[id]', params: { id: event.id } });
        }}
        style={styles.card}
      >
        <View style={styles.cardImageWrap}>
          {event.coverImage ? (
            <Image
              source={{ uri: event.coverImage }}
              style={styles.cardImage}
              contentFit="cover"
              transition={300}
            />
          ) : (
            <View style={[styles.cardImage, styles.cardImagePlaceholder]} />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.85)']}
            style={StyleSheet.absoluteFillObject}
          />
          {event.isFeatured && (
            <View style={styles.featuredBadge}>
              <Text style={styles.featuredBadgeText}>FEATURED</Text>
            </View>
          )}
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {event.title}
          </Text>
          <Text style={styles.cardVenue} numberOfLines={1}>
            {event.venue ?? event.location ?? ''}
          </Text>
          <View style={styles.cardMeta}>
            <Text style={styles.cardDate}>
              {dateStr}
              {timeStr ? `  ·  ${timeStr}` : ''}
            </Text>
            {lowestPrice > 0 && (
              <View style={styles.pricePill}>
                <Text style={styles.priceText}>₹{lowestPrice.toLocaleString('en-IN')}</Text>
              </View>
            )}
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function CategoryScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const insets = useSafeAreaInsets();

  const { categoryEvents, categoryLoading, categoryHasMore, fetchByCategory, loadMoreByCategory } =
    useEventsStore();

  const cat = category ?? '';
  const meta = CATEGORY_META[cat] ?? { label: cat, emoji: '🎭', accent: colors.iris };
  const events = categoryEvents[cat] ?? [];
  const isLoading = categoryLoading[cat] ?? false;
  const hasMore = categoryHasMore[cat] ?? true;

  const loadingMoreRef = useRef(false);

  useEffect(() => {
    trackScreen(`Category_${cat}`);
    void fetchByCategory(cat);
  }, [cat]);

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fetchByCategory(cat);
  }, [cat]);

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || loadingMoreRef.current || isLoading) return;
    loadingMoreRef.current = true;
    try {
      await loadMoreByCategory(cat);
    } finally {
      loadingMoreRef.current = false;
    }
  }, [cat, hasMore, isLoading]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <View style={styles.headerTitle}>
          <Text style={styles.headerEmoji}>{meta.emoji}</Text>
          <Text style={styles.headerLabel}>{meta.label}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {isLoading && events.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.iris} />
        </View>
      ) : (
        <FlashList
          bounces={false}
          overScrollMode="never"
          data={events}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}
          renderItem={({ item, index }) => <CategoryEventCard event={item} index={index} />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={isLoading && events.length > 0}
              onRefresh={onRefresh}
              tintColor={colors.iris}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>{meta.emoji}</Text>
              <Text style={styles.emptyTitle}>No {meta.label} yet</Text>
              <Text style={styles.emptySubtitle}>Check back soon for upcoming events</Text>
            </View>
          }
          ListFooterComponent={
            hasMore && events.length > 0 ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.goldMetallic} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: '600',
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerEmoji: {
    fontSize: 22,
  },
  headerLabel: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },

  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Card
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radii.lg,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardImageWrap: {
    height: 180,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImagePlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  featuredBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: colors.iris,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  featuredBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  cardBody: {
    padding: 14,
    gap: 4,
  },
  cardTitle: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardVenue: {
    color: colors.goldMetallic,
    fontSize: 13,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  cardDate: {
    color: colors.goldMetallic,
    fontSize: 12,
  },
  pricePill: {
    backgroundColor: 'rgba(244,74,34,0.15)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(244,74,34,0.3)',
  },
  priceText: {
    color: colors.iris,
    fontSize: 12,
    fontWeight: '700',
  },

  // Empty + footer
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: colors.goldMetallic,
    fontSize: 14,
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: 24,
    alignItems: 'center',
  },
});
