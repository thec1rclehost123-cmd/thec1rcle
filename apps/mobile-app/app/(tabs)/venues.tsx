import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Building2,
  CalendarDays,
  Heart,
  MapPin,
  Music2,
  Search,
  Sparkles,
  Ticket,
  Users,
  Utensils,
  X,
  ChevronRight,
  ChevronDown,
} from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

import { colors, spacing, typography, radii } from '@/lib/design/theme';
import {
  getVenueDisplayName,
  getVenueLocationLabel,
  formatCompactCount,
} from '@/lib/venueDiscovery';
import { useAuth } from '@/hooks/useAuth';
import { useEventsStore, type Event } from '@/store/eventsStore';
import { useFollowStore } from '@/store/followStore';
import { useVenuesStore, type Venue } from '@/store/venuesStore';
import { useProfileStore } from '@/store/profileStore';
import { SkeletonList } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/EmptyState';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type Tab = 'venues' | 'hosts';
type VenueFilter = 'all' | 'bookable' | 'events' | 'tonight';

interface DerivedHost {
  id: string;
  name: string;
  photoURL?: string;
  events: Event[];
  eventsCount: number;
  upcomingCount: number;
  pastCount: number;
  nextEvent?: Event;
  categories: string[];
}

const VENUE_FILTERS = [
  { id: 'all', label: 'All', icon: Sparkles },
  { id: 'bookable', label: 'Bookable', icon: Utensils },
  { id: 'events', label: 'Events', icon: Ticket },
  { id: 'tonight', label: 'Tonight', icon: CalendarDays },
] as const;

// --- Helpers ---
function getVenueImage(venue?: Venue | null): string | undefined {
  return (
    venue?.coverImage || venue?.coverURL || venue?.bannerImage || venue?.photoURL || venue?.image
  );
}
function uniqueCompact(values: (string | undefined | null)[], limit = 3): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  values.forEach((value) => {
    const clean = value?.trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    output.push(clean);
  });
  return output.slice(0, limit);
}
function normalizeKey(value?: string | null): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}
function getEventVenueCandidates(event: Event): string[] {
  const loose = event as Event & { venueId?: string; venueName?: string };
  return uniqueCompact(
    [loose.venueId, loose.venueName, event.venue, event.location, event.city],
    5,
  ).map(normalizeKey);
}
function getVenueCandidates(venue: Venue): string[] {
  return uniqueCompact(
    [venue.id, venue.slug, venue.displayName, venue.name, venue.address, venue.area],
    6,
  ).map(normalizeKey);
}
function isUpcomingEvent(event: Event): boolean {
  if (!event.startDate) return false;
  const date = new Date(event.endDate || event.startDate);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() >= Date.now();
}
function isTodayEvent(event: Event): boolean {
  if (!event.startDate) return false;
  const date = new Date(event.startDate);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  return date.toDateString() === today.toDateString();
}
function getEventsForVenue(venue: Venue, events: Event[]): Event[] {
  const venueKeys = getVenueCandidates(venue).filter(Boolean);
  if (!venueKeys.length) return [];
  return events.filter((event) => {
    const eventKeys = getEventVenueCandidates(event).filter(Boolean);
    return eventKeys.some((eventKey) =>
      venueKeys.some(
        (venueKey) => eventKey === venueKey || eventKey.startsWith(venueKey) || venueKey.startsWith(eventKey),
      ),
    );
  });
}
function isVenueBookable(venue: Venue): boolean {
  return Boolean(venue.hasReservation || venue.tablesAvailable || venue.whatsapp || venue.phone);
}

// --- Zomato-Inspired Components ---

function ZomatoHeader({ search, setSearch, activeFilter, setFilter, insetsTop, cityName, avatarUrl, initials }: any) {
  return (
    <BlurView
      blurMethod="dimezisBlurView"
      intensity={85}
      tint="dark"
      style={[styles.headerBlur, { paddingTop: Math.max(insetsTop, 16) }]}
    >
      <View style={styles.headerTopRow}>
        <View style={styles.locationPill}>
          <MapPin size={16} color="#F44A22" />
          <Text style={styles.locationText}>{cityName || 'Pune'}</Text>
          <ChevronDown size={14} color="rgba(255,255,255,0.6)" />
        </View>
        <Pressable 
          style={styles.profileBtn}
          onPress={() => router.push('/(tabs)/profile')}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.profileImg} />
          ) : (
            <View style={[styles.profileImg, { backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{initials}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <View style={styles.searchContainer}>
        <Search size={18} color="rgba(255,255,255,0.5)" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search venues, cuisines, vibes..."
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}>
            <X size={18} color="rgba(255,255,255,0.5)" />
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRail}
      >
        {VENUE_FILTERS.map((f) => {
          const isActive = activeFilter === f.id;
          const Icon = f.icon;
          return (
            <Pressable
              key={f.id}
              style={[styles.filterPill, isActive && styles.filterPillActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFilter(f.id);
              }}
            >
              {isActive && <Icon size={14} color="#fff" style={{ marginRight: 6 }} />}
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </BlurView>
  );
}

function EditorialHeroCard({ venue }: { venue: Venue }) {
  if (!venue) return null;
  const image = getVenueImage(venue);

  return (
    <Animated.View entering={FadeInDown.delay(100)}>
      <Pressable
        style={styles.heroCard}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({ pathname: '/venue/[id]', params: { id: venue.id } });
        }}
      >
        {image ? (
          <Image
            source={{ uri: image }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={300}
          />
        ) : (
          <LinearGradient colors={['#2A1A12', '#111']} style={StyleSheet.absoluteFill} />
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)']}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.heroContent}>
          <View style={styles.heroBadge}>
            <Sparkles size={12} color="#F44A22" />
            <Text style={styles.heroBadgeText}>SPOTLIGHT</Text>
          </View>

          <Text style={styles.heroTitle}>{getVenueDisplayName(venue)}</Text>

          <View style={styles.heroMetaRow}>
            <Text style={styles.heroMetaText}>{getVenueLocationLabel(venue)}</Text>
            {venue.venueType && (
              <>
                <Text style={styles.heroMetaDot}>•</Text>
                <Text style={styles.heroMetaText}>{venue.venueType}</Text>
              </>
            )}
          </View>

          <View style={styles.heroActionRow}>
            {isVenueBookable(venue) && (
              <View style={styles.heroBookBtn}>
                <Text style={styles.heroBookText}>Reserve Table</Text>
              </View>
            )}
            {venue.upcomingEventsCount ? (
              <View style={styles.heroEventPill}>
                <Ticket size={12} color="#fff" />
                <Text style={styles.heroEventText}>{venue.upcomingEventsCount} Events</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function CuratedRail({ title, venues }: { title: string; venues: Venue[] }) {
  if (!venues.length) return null;
  return (
    <Animated.View entering={FadeInDown.delay(200)} style={styles.railSection}>
      <Text style={styles.railTitle}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railScroll}
      >
        {venues.map((v, i) => {
          const image = getVenueImage(v);
          return (
            <Pressable
              key={v.id}
              style={styles.railCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: '/venue/[id]', params: { id: v.id } });
              }}
            >
              <Image
                source={{ uri: image || 'https://thec1rcle.com/placeholder.png' }}
                style={styles.railImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={300}
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.8)']}
                style={styles.railGradient}
              />
              <View style={styles.railContent}>
                <Text style={styles.railVenueName} numberOfLines={1}>
                  {getVenueDisplayName(v)}
                </Text>
                <Text style={styles.railVenueLoc} numberOfLines={1}>
                  {getVenueLocationLabel(v)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}

function ZomatoVenueCard({ venue }: { venue: Venue }) {
  const image = getVenueImage(venue);

  return (
    <Animated.View entering={FadeInDown}>
      <Pressable
        style={styles.zCard}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({ pathname: '/venue/[id]', params: { id: venue.id } });
        }}
      >
        <View style={styles.zImageContainer}>
          <Image
            source={{ uri: image || 'https://thec1rcle.com/placeholder.png' }}
            style={styles.zImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={300}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.4)', 'transparent']}
            style={StyleSheet.absoluteFill}
          />

          {venue.isVerified && (
            <BlurView
              blurMethod="dimezisBlurView"
              intensity={40}
              tint="dark"
              style={styles.zBadgeVerified}
            >
              <Text style={styles.zBadgeText}>✓ Verified</Text>
            </BlurView>
          )}

          <View style={styles.zBadgesBottom}>
            {venue.upcomingEventsCount ? (
              <BlurView
                blurMethod="dimezisBlurView"
                intensity={40}
                tint="dark"
                style={styles.zBadgePill}
              >
                <Ticket size={10} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.zBadgeText}>{venue.upcomingEventsCount} Events</Text>
              </BlurView>
            ) : null}
            <BlurView
              blurMethod="dimezisBlurView"
              intensity={40}
              tint="dark"
              style={styles.zBadgePill}
            >
              <Heart size={10} color="#F44A22" style={{ marginRight: 4 }} />
              <Text style={styles.zBadgeText}>{formatCompactCount(venue.followers)}</Text>
            </BlurView>
          </View>
        </View>

        <View style={styles.zInfo}>
          <View style={styles.zInfoRow}>
            <Text style={styles.zTitle} numberOfLines={1}>
              {getVenueDisplayName(venue)}
            </Text>
            {isVenueBookable(venue) && (
              <View style={styles.zBookMark}>
                <Utensils size={12} color="#F44A22" />
              </View>
            )}
          </View>

          <Text style={styles.zSubText} numberOfLines={1}>
            {venue.venueType ? `${venue.venueType} • ` : ''}
            {getVenueLocationLabel(venue)}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// --- Main Export ---
export default function VenuesTab() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<VenueFilter>('all');
  const hasFetchedRef = useRef(false);

  const { venues, loading, error, fetchVenues } = useVenuesStore();
  const { events, fetchEvents } = useEventsStore();
  const { user } = useAuth();
  const profile = useProfileStore((s) => s.profile);
  const { fetchFollows } = useFollowStore();

  const cityName = profile?.city || '';
  const avatarUrl = profile?.photoURL || user?.photoURL || '';
  const initials = profile?.displayName
    ? profile.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.email
      ? user.email[0].toUpperCase()
      : '?';

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    fetchVenues();
    fetchEvents();
    if (user?.uid) fetchFollows(user.uid);
  }, [fetchVenues, fetchEvents, user?.uid, fetchFollows]);

  const enrichedVenues = useMemo(() => {
    const list = venues.map((v) => {
      const vEvents = getEventsForVenue(v, events);
      const upcoming = vEvents.filter(isUpcomingEvent);
      return { ...v, upcomingEventsCount: upcoming.length };
    });

    return list.sort((a, b) => (b.followers || 0) - (a.followers || 0));
  }, [venues, events]);

  const filteredVenues = useMemo(() => {
    let result = enrichedVenues;

    if (activeFilter === 'bookable') {
      result = result.filter(isVenueBookable);
    } else if (activeFilter === 'events') {
      result = result.filter((v) => (v.upcomingEventsCount || 0) > 0);
    } else if (activeFilter === 'tonight') {
      result = result.filter((v) => getEventsForVenue(v, events).some(isTodayEvent));
    }

    if (search.trim()) {
      const lower = search.toLowerCase();
      result = result.filter(
        (v) =>
          v.name?.toLowerCase().includes(lower) ||
          v.displayName?.toLowerCase().includes(lower) ||
          v.venueType?.toLowerCase().includes(lower) ||
          v.neighborhood?.toLowerCase().includes(lower) ||
          v.tags?.some((t) => t.toLowerCase().includes(lower)),
      );
    }

    return result;
  }, [enrichedVenues, activeFilter, search, events]);

  const spotlightVenue = enrichedVenues.find((v) => v.coverImage || v.image) || enrichedVenues[0];
  const bookableVenues = enrichedVenues.filter(isVenueBookable).slice(0, 6);

  // Remove spotlight and curated from main feed to avoid duplication
  const feedVenues = filteredVenues.filter((v) => v.id !== spotlightVenue?.id);

  const renderVenueCard = useCallback(
    ({ item }: { item: Venue }) => <ZomatoVenueCard venue={item} />,
    [],
  );

  return (
    <View style={styles.container}>
        <ZomatoHeader
          search={search}
          setSearch={setSearch}
          activeFilter={activeFilter}
          setFilter={setActiveFilter}
          insetsTop={insets.top}
          cityName={cityName}
          avatarUrl={avatarUrl}
          initials={initials}
        />

      {error && !loading && venues.length === 0 ? (
        <View style={[styles.scrollContent, { paddingTop: insets.top + 180 }]}>
          <ErrorState message={error} onRetry={() => { hasFetchedRef.current = false; fetchVenues(); }} />
        </View>
      ) : (
        <FlashList
          data={feedVenues}
          renderItem={renderVenueCard}
          keyExtractor={(item: Venue) => item.id}
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 180 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading && venues.length > 0}
              onRefresh={() => {
                fetchVenues();
                fetchEvents();
              }}
              tintColor="#F44A22"
            />
          }
          ListHeaderComponent={
            loading && venues.length === 0 ? (
              <SkeletonList count={3} />
            ) : (
              search === '' && activeFilter === 'all' ? (
                <>
                  {spotlightVenue && <EditorialHeroCard venue={spotlightVenue} />}
                  {bookableVenues.length > 0 && (
                    <CuratedRail title="Reserve a Table" venues={bookableVenues} />
                  )}
                </>
              ) : null
            )
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>🍽️</Text>
                <Text style={styles.emptyTitle}>No venues found</Text>
                <Text style={styles.emptySub}>Try adjusting your search or filters.</Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  headerBlur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  profileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  profileImg: {
    width: '100%',
    height: '100%',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    height: 48,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    marginLeft: 10,
    fontWeight: '500',
  },
  filterRail: {
    paddingHorizontal: 20,
    gap: 10,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filterPillActive: {
    backgroundColor: 'rgba(244,74,34,0.15)',
    borderColor: '#F44A22',
  },
  filterText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#fff',
  },

  // Hero Card
  heroCard: {
    marginHorizontal: 20,
    height: 320,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 32,
    marginTop: 10,
  },
  heroContent: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    marginBottom: 12,
    overflow: 'hidden',
  },
  heroBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 8,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  heroMetaText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
  },
  heroMetaDot: {
    color: 'rgba(255,255,255,0.4)',
  },
  heroActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  heroBookBtn: {
    backgroundColor: '#F44A22',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  heroBookText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  heroEventPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  heroEventText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Curated Rail
  railSection: {
    marginBottom: 32,
  },
  railTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  railScroll: {
    paddingHorizontal: 20,
    gap: 14,
  },
  railCard: {
    width: 140,
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
  },
  railImage: {
    width: '100%',
    height: '100%',
  },
  railGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  railContent: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
  },
  railVenueName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  railVenueLoc: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '500',
  },

  // Main Feed Zomato Card
  zCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  zImageContainer: {
    width: '100%',
    height: 220,
    position: 'relative',
  },
  zImage: {
    width: '100%',
    height: '100%',
  },
  zBadgeVerified: {
    position: 'absolute',
    top: 14,
    left: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    overflow: 'hidden',
  },
  zBadgesBottom: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    flexDirection: 'row',
    gap: 8,
  },
  zBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  zBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  zInfo: {
    padding: 16,
  },
  zInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  zTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    flex: 1,
    marginRight: 10,
  },
  zBookMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(244,74,34,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zSubText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  // Empty State
  emptyWrap: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptySub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
  },
});
