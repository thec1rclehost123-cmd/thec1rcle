import { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

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

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PURE_BLACK = colors.base.DEFAULT;

function clamp(min: number, value: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const CONTENT_W = SCREEN_W - 32;
const FEATURED_H = Math.round(clamp(284, SCREEN_H * 0.39, 368));
const VENUE_IMAGE_H = Math.round(clamp(164, SCREEN_H * 0.225, 214));
const HOST_CARD_W = Math.round(clamp(268, SCREEN_W * 0.72, 316));
const HOST_IMAGE_H = Math.round(clamp(144, SCREEN_H * 0.19, 188));
const EVENT_CARD_W = Math.round(clamp(236, SCREEN_W * 0.66, 292));
const EVENT_CARD_H = Math.round(clamp(170, SCREEN_H * 0.23, 214));
const PUNE_CITY = 'Pune';
const PUNE_SIGNAL_WORDS = [
  'pune',
  'koregaon park',
  'kalyani nagar',
  'viman nagar',
  'kharadi',
  'baner',
  'aundh',
  'wakad',
  'balewadi',
  'mundhwa',
  'hadapsar',
  'shivaji nagar',
  'fc road',
  'camp',
  'yerwada',
  'magarpatta',
  'hinjewadi',
];

type Tab = 'venues' | 'hosts';
type VenueFilter = 'all' | 'bookable' | 'events' | 'tonight';
type HostFilter = 'all' | 'upcoming' | 'past' | 'sound';

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
  { id: 'all', label: 'All Pune', icon: Building2 },
  { id: 'bookable', label: 'Bookable', icon: Utensils },
  { id: 'events', label: 'Events', icon: Ticket },
  { id: 'tonight', label: 'Tonight', icon: CalendarDays },
] as const;

const HOST_FILTERS = [
  { id: 'all', label: 'All Pune', icon: Users },
  { id: 'upcoming', label: 'Upcoming', icon: CalendarDays },
  { id: 'past', label: 'Past', icon: Ticket },
  { id: 'sound', label: 'Sound', icon: Music2 },
] as const;

function getVenueImage(venue?: Venue | null): string | undefined {
  return (
    venue?.coverImage || venue?.coverURL || venue?.bannerImage || venue?.photoURL || venue?.image
  );
}

function getEventImage(event?: Event): string | undefined {
  return event?.coverImage || event?.poster || event?.image;
}

function compactDate(value?: string): string {
  if (!value) return 'TBA';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TBA';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function compactTime(value?: string): string {
  if (!value) return 'Time TBA';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time TBA';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
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

function hasPuneSignal(values: (string | undefined | null)[]): boolean {
  const haystack = values.filter(Boolean).join(' ').toLowerCase();

  if (!haystack) return false;
  return PUNE_SIGNAL_WORDS.some((word) => haystack.includes(word));
}

function isPuneVenue(venue: Venue): boolean {
  return hasPuneSignal([
    venue.city,
    venue.area,
    venue.neighborhood,
    venue.address,
    venue.addressLine1,
    venue.displayName,
    venue.name,
  ]);
}

function isPuneEvent(event: Event): boolean {
  return hasPuneSignal([event.city, event.location, event.venue, event.title, event.description]);
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
        (venueKey) =>
          eventKey === venueKey || eventKey.includes(venueKey) || venueKey.includes(eventKey),
      ),
    );
  });
}

function isVenueBookable(venue: Venue): boolean {
  return Boolean(venue.hasReservation || venue.tablesAvailable || venue.whatsapp || venue.phone);
}

function getVenueCtaLabel(venue: Venue, eventCount: number): string {
  if (isVenueBookable(venue)) return 'Reserve';
  if (eventCount > 0 || venue.upcomingEventsCount) return 'Events';
  return 'Details';
}

function getVenueUtilityLine(venue: Venue, eventCount: number): string {
  if (isVenueBookable(venue)) return 'Pune reservations and table requests';
  if (eventCount > 0 || venue.upcomingEventsCount) return 'Upcoming Pune events and venue info';
  return 'Photos, vibe notes and Pune host history';
}

function SectionHeader({
  title,
  eyebrow,
  actionLabel,
  onAction,
}: {
  title: string;
  eyebrow?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const words = title.trim().split(' ');
  const lastWord = words.pop() || '';
  const firstPart = words.join(' ');

  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <View style={styles.sectionGlowBar} />
        <View style={styles.sectionTextWrap}>
          {eyebrow ? <Text style={styles.sectionEyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.sectionTitle}>
            {firstPart}
            {firstPart ? ' ' : ''}
            <Text style={styles.sectionTitleAccent}>{lastWord}</Text>
          </Text>
        </View>
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function EmptyState({ activeTab, search }: { activeTab: Tab; search: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>
        {search
          ? 'No Pune matches yet'
          : activeTab === 'venues'
            ? 'No Pune venues yet'
            : 'No Pune hosts yet'}
      </Text>
      <Text style={styles.emptyBody}>
        {search
          ? `Nothing matched "${search}" in Pune. Try Koregaon Park, Kalyani Nagar, Baner or another vibe.`
          : 'Live Pune profiles will appear here as venues and hosts publish their scene.'}
      </Text>
    </View>
  );
}

function SearchHeader({
  activeTab,
  count,
  search,
  setSearch,
  setActiveTab,
  insetsTop,
}: {
  activeTab: Tab;
  count: number;
  search: string;
  setSearch: (value: string) => void;
  setActiveTab: (tab: Tab) => void;
  insetsTop: number;
}) {
  return (
    <BlurView intensity={80} tint="dark" style={[styles.header, { paddingTop: Math.max(insetsTop, 16) }]}>
      <View style={styles.headerRow}>
        <View style={styles.locationBlock}>
          <Text style={styles.greetingText}>C1RCLE Pune</Text>
          <View style={styles.cityRow}>
            <Sparkles size={16} color={colors.iris} strokeWidth={2.4} />
            <Text style={styles.cityName} numberOfLines={1}>
              {activeTab === 'venues' ? 'Pune venues' : 'Pune hosts'}
            </Text>
          </View>
          <Text style={styles.resultLine}>
            {count} live{' '}
            {activeTab === 'venues'
              ? 'Pune places to book, follow or catch events at'
              : 'Pune hosts with past and upcoming nights'}
          </Text>
        </View>
        <Pressable
          onPress={() =>
            router.push({ pathname: '/map', params: { mode: 'venues', city: PUNE_CITY } })
          }
          style={styles.mapButton}
        >
          <MapPin size={17} color="#FFFFFF" strokeWidth={2.3} />
        </Pressable>
      </View>

      <View style={styles.searchBar}>
        <Search size={16} color="rgba(255,255,255,0.45)" strokeWidth={2.4} />
        <TextInput
          style={styles.searchInput}
          placeholder={
            activeTab === 'venues'
              ? 'Search Pune venues, areas, vibes'
              : 'Search Pune hosts, crews, sounds'
          }
          placeholderTextColor="rgba(255,255,255,0.38)"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 ? (
          <Pressable onPress={() => setSearch('')} hitSlop={10}>
            <X size={18} color="rgba(255,255,255,0.45)" strokeWidth={2.4} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.segmentTrack}>
        {(['venues', 'hosts'] as Tab[]).map((tab) => {
          const isActive = activeTab === tab;
          const Icon = tab === 'venues' ? Building2 : Users;
          return (
            <Pressable
              key={tab}
              style={[styles.segmentPill, isActive && styles.segmentPillActive]}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab(tab);
                setSearch('');
              }}
            >
              <Icon
                size={15}
                color={isActive ? '#FFFFFF' : 'rgba(255,255,255,0.62)'}
                strokeWidth={2.2}
              />
              <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                {tab === 'venues' ? 'Venues' : 'Hosts'}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </BlurView>
  );
}

function FilterRail({
  activeTab,
  activeVenueFilter,
  activeHostFilter,
  onVenueFilter,
  onHostFilter,
}: {
  activeTab: Tab;
  activeVenueFilter: VenueFilter;
  activeHostFilter: HostFilter;
  onVenueFilter: (filter: VenueFilter) => void;
  onHostFilter: (filter: HostFilter) => void;
}) {
  const items = activeTab === 'venues' ? VENUE_FILTERS : HOST_FILTERS;
  const active = activeTab === 'venues' ? activeVenueFilter : activeHostFilter;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterRail}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        return (
          <Pressable
            key={item.id}
            style={[styles.filterChip, isActive && styles.filterChipActive]}
            onPress={() => {
              void Haptics.selectionAsync();
              if (activeTab === 'venues') onVenueFilter(item.id as VenueFilter);
              else onHostFilter(item.id as HostFilter);
            }}
          >
            {isActive ? (
              <LinearGradient
                colors={['rgba(244,74,34,0.15)', 'rgba(255,107,74,0.05)']}
                style={StyleSheet.absoluteFillObject}
              />
            ) : null}
            <Icon
              size={15}
              color={isActive ? colors.iris : 'rgba(255,255,255,0.62)'}
              strokeWidth={2.2}
            />
            <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function FeaturedVenueHero({
  venue,
  venueEvents,
  isFollowed,
  onFollow,
}: {
  venue?: Venue;
  venueEvents: Event[];
  isFollowed: boolean;
  onFollow: () => void;
}) {
  if (!venue) return null;

  const name = getVenueDisplayName(venue);
  const area = getVenueLocationLabel(venue);
  const imageUrl = getVenueImage(venue);
  const nextEvent = venueEvents.find(isUpcomingEvent);
  const eventCount = venueEvents.length || venue.upcomingEventsCount || 0;
  const cta = getVenueCtaLabel(venue, eventCount);
  const tags = uniqueCompact(
    [venue.venueType, ...(venue.vibes ?? []), ...(venue.genres ?? []), ...(venue.tags ?? [])],
    3,
  );

  return (
    <View style={styles.featuredWrap}>
      <SectionHeader title="Pune spotlight" eyebrow="Live venue signal" />
      <Animated.View entering={FadeInDown.springify().damping(24)}>
        <View style={styles.featuredCard}>
          <Pressable
            style={styles.featuredImagePress}
            onPress={() => router.push(`/venue/${venue.slug || venue.id}` as never)}
          >
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
                transition={300}
              />
            ) : (
              <LinearGradient
                colors={['#252525', '#090909']}
                style={StyleSheet.absoluteFillObject}
              />
            )}
            <LinearGradient
              colors={['rgba(0,0,0,0.04)', 'rgba(0,0,0,0.32)', 'rgba(0,0,0,0.92)']}
              locations={[0, 0.44, 1]}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.featuredTopRow}>
              <View style={styles.eyebrowPill}>
                <Sparkles size={13} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.eyebrowPillText}>
                  {isVenueBookable(venue)
                    ? 'Pune booking'
                    : nextEvent
                      ? 'Pune next up'
                      : 'Pune profile'}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onFollow();
                }}
                style={[styles.iconButton, isFollowed && styles.iconButtonActive]}
                hitSlop={8}
              >
                <Heart
                  size={18}
                  color={isFollowed ? colors.iris : '#FFFFFF'}
                  fill={isFollowed ? colors.iris : 'none'}
                  strokeWidth={2.2}
                />
              </Pressable>
            </View>
            <View style={styles.featuredBody}>
              <Text style={styles.featuredTitle} numberOfLines={2}>
                {name}
              </Text>
              {area ? (
                <Text style={styles.featuredMeta} numberOfLines={1}>
                  {area}
                </Text>
              ) : null}
              {tags.length ? (
                <Text style={styles.featuredTags} numberOfLines={1}>
                  {tags.join(' / ')}
                </Text>
              ) : null}
              <View style={styles.featuredStats}>
                <View style={styles.glassStat}>
                  <Utensils size={13} color={colors.iris} strokeWidth={2.2} />
                  <Text style={styles.glassStatText}>
                    {isVenueBookable(venue) ? 'Reserve' : 'Info'}
                  </Text>
                </View>
                <View style={styles.glassStat}>
                  <Ticket size={13} color={colors.iris} strokeWidth={2.2} />
                  <Text style={styles.glassStatText}>
                    {eventCount ? `${eventCount} events` : 'Event history'}
                  </Text>
                </View>
                <View style={styles.glassStat}>
                  <Users size={13} color={colors.iris} strokeWidth={2.2} />
                  <Text style={styles.glassStatText}>
                    {formatCompactCount(venue.followers)} following
                  </Text>
                </View>
              </View>
            </View>
          </Pressable>

          <View style={styles.featuredUtility}>
            <View style={styles.nextEventBlock}>
              <Text style={styles.utilityLabel}>{nextEvent ? 'Next event' : 'Utility'}</Text>
              <Text style={styles.utilityTitle} numberOfLines={1}>
                {nextEvent ? nextEvent.title : getVenueUtilityLine(venue, eventCount)}
              </Text>
              <Text style={styles.utilityMeta} numberOfLines={1}>
                {nextEvent
                  ? `${compactDate(nextEvent.startDate)} at ${compactTime(nextEvent.startDate)}`
                  : 'Reservations, events, Pune host drops and vibe notes'}
              </Text>
            </View>
            <Pressable
              style={styles.primaryCta}
              onPress={() => router.push(`/venue/${venue.slug || venue.id}` as never)}
            >
              <Text style={styles.primaryCtaText}>{cta}</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

function VenueSceneCard({
  venue,
  venueEvents,
  index,
  isFollowed,
  onFollow,
}: {
  venue: Venue;
  venueEvents: Event[];
  index: number;
  isFollowed: boolean;
  onFollow: () => void;
}) {
  const name = getVenueDisplayName(venue);
  const area = getVenueLocationLabel(venue);
  const imageUrl = getVenueImage(venue);
  const nextEvent = venueEvents.find(isUpcomingEvent);
  const eventCount = venueEvents.length || venue.upcomingEventsCount || 0;
  const tags = uniqueCompact(
    [venue.venueType, ...(venue.vibes ?? []), ...(venue.genres ?? []), ...(venue.tags ?? [])],
    2,
  );
  const cta = getVenueCtaLabel(venue, eventCount);

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 45, 260))
        .springify()
        .damping(24)}
    >
      <Pressable
        style={styles.venueCard}
        onPress={() => router.push(`/venue/${venue.slug || venue.id}` as never)}
      >
        <View style={styles.venueImageWrap}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              transition={300}
            />
          ) : (
            <LinearGradient
              colors={[colors.base[100], '#111111']}
              style={StyleSheet.absoluteFillObject}
            />
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.68)']}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.cardTopRow}>
            <View style={styles.darkPill}>
              <Text style={styles.darkPillText}>
                {isVenueBookable(venue) ? 'Bookable' : eventCount ? 'Events' : 'Pune'}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onFollow();
              }}
              style={[styles.iconButton, isFollowed && styles.iconButtonActive]}
              hitSlop={8}
            >
              <Heart
                size={18}
                color={isFollowed ? colors.iris : '#FFFFFF'}
                fill={isFollowed ? colors.iris : 'none'}
                strokeWidth={2.2}
              />
            </Pressable>
          </View>
          <View style={styles.imageNamePlate}>
            <Text style={styles.venueName} numberOfLines={1}>
              {name}
            </Text>
            {area ? (
              <Text style={styles.venueMeta} numberOfLines={1}>
                {area}
              </Text>
            ) : null}
          </View>
        </View>

        <BlurView intensity={40} tint="dark" style={styles.venueInfoPanel}>
          <Text style={styles.venueUtility} numberOfLines={1}>
            {getVenueUtilityLine(venue, eventCount)}
          </Text>
          <View style={styles.venueDetailsRow}>
            <View style={styles.detailCell}>
              <Text style={styles.detailLabel}>Booking</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {isVenueBookable(venue) ? 'Open' : 'Ask venue'}
              </Text>
            </View>
            <View style={styles.detailCell}>
              <Text style={styles.detailLabel}>Next</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {nextEvent
                  ? compactDate(nextEvent.startDate)
                  : venue.nextEventDate
                    ? compactDate(venue.nextEventDate)
                    : 'TBA'}
              </Text>
            </View>
            <View style={styles.detailCell}>
              <Text style={styles.detailLabel}>Scene</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {tags[0] || venue.venueType || 'C1RCLE'}
              </Text>
            </View>
          </View>
          <View style={styles.cardFooter}>
            <Text style={styles.footerMeta} numberOfLines={1}>
              {tags.length ? tags.join(' / ') : `${formatCompactCount(venue.followers)} following`}
            </Text>
            <View style={styles.smallCta}>
              <Text style={styles.smallCtaText}>{cta}</Text>
            </View>
          </View>
        </BlurView>
      </Pressable>
    </Animated.View>
  );
}

function MiniEventCard({ event, index }: { event: Event; index: number }) {
  const imageUrl = getEventImage(event);

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 45, 260))
        .springify()
        .damping(24)}
      style={styles.eventCardFrame}
    >
      <Pressable
        style={styles.eventCard}
        onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id } })}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={300}
          />
        ) : (
          <LinearGradient colors={['#2A2A2A', '#080808']} style={StyleSheet.absoluteFillObject} />
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.95)']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.eventDatePill}>
          <CalendarDays size={12} color="#FFFFFF" strokeWidth={2.2} />
          <Text style={styles.eventDateText}>{compactDate(event.startDate)}</Text>
        </View>
        <View style={styles.eventCardBody}>
          <Text style={styles.eventTitle} numberOfLines={2}>
            {event.title}
          </Text>
          <Text style={styles.eventVenue} numberOfLines={1}>
            {event.venue || event.location || 'Venue TBA'}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function HostCard({
  host,
  index,
  compact = false,
}: {
  host: DerivedHost;
  index: number;
  compact?: boolean;
}) {
  const imageUrl = host.photoURL || getEventImage(host.nextEvent || host.events[0]);
  const leadEvent = host.nextEvent || host.events[0];

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 45, 260))
        .springify()
        .damping(24)}
      style={compact ? styles.hostCompactFrame : undefined}
    >
      <Pressable
        style={[styles.hostCard, compact && styles.hostCardCompact]}
        onPress={() => {
          if (leadEvent?.id) router.push({ pathname: '/event/[id]', params: { id: leadEvent.id } });
        }}
      >
        <View style={styles.hostImageWrap}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              transition={300}
            />
          ) : (
            <LinearGradient colors={['#2F2F2F', '#080808']} style={StyleSheet.absoluteFillObject} />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.95)']}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.hostTopBadge}>
            <Users size={13} color="#FFFFFF" strokeWidth={2.2} />
            <Text style={styles.hostTopBadgeText}>Pune host</Text>
          </View>
          <View style={styles.hostOverlay}>
            <Text style={styles.hostName} numberOfLines={1}>
              {host.name}
            </Text>
            <Text style={styles.hostMeta} numberOfLines={1}>
              {host.upcomingCount} upcoming - {host.pastCount} past
            </Text>
          </View>
          <View style={styles.hostInfoPanel}>
          <Text style={styles.hostCategories} numberOfLines={1}>
            {host.categories.length ? host.categories.join(' / ') : 'Pune event host'}
          </Text>
          <View style={styles.hostFooter}>
            <Text style={styles.hostEventLine} numberOfLines={2}>
              {leadEvent
                ? `${leadEvent.title} - ${compactDate(leadEvent.startDate)}`
                : 'Past and upcoming Pune events will live here.'}
            </Text>
            <View style={styles.hostCta}>
              <Text style={styles.hostCtaText}>{leadEvent ? 'Open' : 'Follow'}</Text>
            </View>
          </View>
        </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function VenuesTab() {
  const insets = useSafeAreaInsets();
  const { venues, loading: venuesLoading, fetchVenues } = useVenuesStore();
  const { events, fetchEvents } = useEventsStore();
  const { user } = useAuth();
  const { isFollowingVenue, toggleVenueFollow, fetchFollows, loaded } = useFollowStore();

  const [activeTab, setActiveTab] = useState<Tab>('venues');
  const [activeVenueFilter, setActiveVenueFilter] = useState<VenueFilter>('all');
  const [activeHostFilter, setActiveHostFilter] = useState<HostFilter>('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void fetchVenues({ area: PUNE_CITY });
  }, [fetchVenues]);

  useEffect(() => {
    void fetchEvents().catch(() => undefined);
  }, [fetchEvents]);

  useEffect(() => {
    if (user?.uid && !loaded) void fetchFollows(user.uid);
  }, [user?.uid, loaded, fetchFollows]);

  const puneVenues = useMemo(() => {
    return venues.filter(isPuneVenue);
  }, [venues]);

  const livePuneEvents = useMemo(() => {
    return events.filter(isPuneEvent);
  }, [events]);

  const upcomingEvents = useMemo(() => {
    return livePuneEvents
      .filter(isUpcomingEvent)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [livePuneEvents]);

  const hosts = useMemo<DerivedHost[]>(() => {
    const now = Date.now();
    const map = new Map<string, DerivedHost>();

    livePuneEvents.forEach((event) => {
      if (!event.hostName) return;

      const key = event.hostId ?? event.hostName;
      const existing = map.get(key);
      const eventDate = event.startDate ? new Date(event.startDate).getTime() : Number.NaN;
      const isPast = Number.isFinite(eventDate) && eventDate < now;
      const eventCategories = uniqueCompact([event.category, event.type, ...(event.tags ?? [])], 4);

      if (existing) {
        existing.events.push(event);
        existing.eventsCount += 1;
        existing.pastCount += isPast ? 1 : 0;
        existing.upcomingCount += isPast ? 0 : 1;
        existing.categories = uniqueCompact([...existing.categories, ...eventCategories], 4);

        if (!existing.photoURL) existing.photoURL = getEventImage(event);
        if (!isPast) {
          const currentNext = existing.nextEvent?.startDate
            ? new Date(existing.nextEvent.startDate).getTime()
            : Number.POSITIVE_INFINITY;
          if (!existing.nextEvent || eventDate < currentNext) existing.nextEvent = event;
        }
        return;
      }

      map.set(key, {
        id: key,
        name: event.hostName,
        photoURL: getEventImage(event),
        events: [event],
        eventsCount: 1,
        upcomingCount: isPast ? 0 : 1,
        pastCount: isPast ? 1 : 0,
        nextEvent: isPast ? undefined : event,
        categories: eventCategories,
      });
    });

    return [...map.values()].sort((a, b) => {
      if (b.upcomingCount !== a.upcomingCount) return b.upcomingCount - a.upcomingCount;
      return b.eventsCount - a.eventsCount;
    });
  }, [livePuneEvents]);

  const venueEventsMap = useMemo(() => {
    const map = new Map<string, Event[]>();
    puneVenues.forEach((venue) => {
      map.set(venue.id, getEventsForVenue(venue, upcomingEvents));
    });
    return map;
  }, [puneVenues, upcomingEvents]);

  const filteredVenues = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = puneVenues;

    if (q) {
      result = result.filter((venue) => {
        const venueEvents = venueEventsMap.get(venue.id) ?? [];
        const haystack = [
          venue.displayName,
          venue.name,
          venue.neighborhood,
          venue.area,
          venue.city,
          venue.venueType,
          venue.description,
          venue.nextEventTitle,
          ...venueEvents.map((event) => event.title),
          ...(venue.tags ?? []),
          ...(venue.vibes ?? []),
          ...(venue.genres ?? []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(q);
      });
    }

    if (activeVenueFilter === 'bookable') {
      result = result.filter(isVenueBookable);
    } else if (activeVenueFilter === 'events') {
      result = result.filter((venue) =>
        Boolean(
          (venueEventsMap.get(venue.id) ?? []).length ||
          venue.upcomingEventsCount ||
          venue.nextEventId,
        ),
      );
    } else if (activeVenueFilter === 'tonight') {
      result = result.filter((venue) => (venueEventsMap.get(venue.id) ?? []).some(isTodayEvent));
    }

    return [...result].sort((a, b) => {
      const aEvents = venueEventsMap.get(a.id)?.length ?? a.upcomingEventsCount ?? 0;
      const bEvents = venueEventsMap.get(b.id)?.length ?? b.upcomingEventsCount ?? 0;
      const aScore = (isVenueBookable(a) ? 25 : 0) + aEvents * 8 + (a.followers ?? 0);
      const bScore = (isVenueBookable(b) ? 25 : 0) + bEvents * 8 + (b.followers ?? 0);
      return bScore - aScore;
    });
  }, [puneVenues, search, activeVenueFilter, venueEventsMap]);

  const filteredHosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = hosts;

    if (q) {
      result = result.filter((host) => {
        const haystack = [
          host.name,
          ...host.categories,
          ...host.events.map((event) => event.title),
          ...host.events.map((event) => event.venue),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(q);
      });
    }

    if (activeHostFilter === 'upcoming') {
      result = result.filter((host) => host.upcomingCount > 0);
    } else if (activeHostFilter === 'past') {
      result = result.filter((host) => host.pastCount > 0);
    } else if (activeHostFilter === 'sound') {
      result = result.filter((host) => {
        const haystack = host.categories.join(' ').toLowerCase();
        return ['music', 'dj', 'bass', 'house', 'techno', 'live'].some((word) =>
          haystack.includes(word),
        );
      });
    }

    return result;
  }, [hosts, search, activeHostFilter]);

  const featuredVenue = useMemo(() => {
    return filteredVenues.find((venue) => getVenueImage(venue)) ?? filteredVenues[0];
  }, [filteredVenues]);

  const bookableVenues = useMemo(() => {
    const pool =
      activeVenueFilter === 'all' ? filteredVenues.filter(isVenueBookable) : filteredVenues;
    return pool.slice(0, 8);
  }, [activeVenueFilter, filteredVenues]);

  const activeVenueEvents = useMemo(() => {
    const visibleVenueKeys = new Set(filteredVenues.flatMap(getVenueCandidates).filter(Boolean));
    const matched = upcomingEvents.filter((event) =>
      getEventVenueCandidates(event).some((key) => visibleVenueKeys.has(key)),
    );
    return (matched.length ? matched : upcomingEvents).slice(0, 8);
  }, [filteredVenues, upcomingEvents]);

  const count = activeTab === 'venues' ? filteredVenues.length : filteredHosts.length;
  const isLoading = venuesLoading && puneVenues.length === 0;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchVenues({ area: PUNE_CITY }), fetchEvents().catch(() => undefined)]);
    setRefreshing(false);
  };

  const followVenue = (venue: Venue) => {
    if (!user?.uid) return;
    void toggleVenueFollow(venue.id, getVenueDisplayName(venue), user.uid);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.iris} />
        }
      >
        <SearchHeader
          activeTab={activeTab}
          count={count}
          search={search}
          setSearch={setSearch}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setActiveVenueFilter('all');
            setActiveHostFilter('all');
          }}
          insetsTop={insets.top}
        />

        <FilterRail
          activeTab={activeTab}
          activeVenueFilter={activeVenueFilter}
          activeHostFilter={activeHostFilter}
          onVenueFilter={(filter) => {
            setSearch('');
            setActiveVenueFilter(filter);
          }}
          onHostFilter={(filter) => {
            setSearch('');
            setActiveHostFilter(filter);
          }}
        />

        {activeTab === 'venues' ? (
          <>
            <FeaturedVenueHero
              venue={featuredVenue}
              venueEvents={featuredVenue ? (venueEventsMap.get(featuredVenue.id) ?? []) : []}
              isFollowed={featuredVenue ? isFollowingVenue(featuredVenue.id) : false}
              onFollow={() => {
                if (featuredVenue) followVenue(featuredVenue);
              }}
            />

            <View style={styles.sectionBlock}>
              <SectionHeader title="Bookable in Pune" eyebrow="Live venue utility" />
              {isLoading ? (
                <View style={styles.loadingPanel}>
                  <Text style={styles.loadingText}>Loading live Pune venues...</Text>
                </View>
              ) : bookableVenues.length ? (
                <View style={styles.cardList}>
                  {bookableVenues.map((venue, index) => (
                    <VenueSceneCard
                      key={venue.id}
                      venue={venue}
                      venueEvents={venueEventsMap.get(venue.id) ?? []}
                      index={index}
                      isFollowed={isFollowingVenue(venue.id)}
                      onFollow={() => followVenue(venue)}
                    />
                  ))}
                </View>
              ) : (
                <EmptyState activeTab={activeTab} search={search} />
              )}
            </View>

            {filteredHosts.length ? (
              <View style={styles.sectionBlock}>
                <SectionHeader title="Pune hosts" eyebrow="People behind the nights" />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.hostRail}
                >
                  {filteredHosts.slice(0, 6).map((host, index) => (
                    <HostCard key={host.id} host={host} index={index} compact />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {activeVenueEvents.length ? (
              <View style={styles.sectionBlock}>
                <SectionHeader title="Upcoming in Pune" eyebrow="Venue calendar" />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.eventRail}
                >
                  {activeVenueEvents.map((event, index) => (
                    <MiniEventCard key={event.id} event={event} index={index} />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {activeVenueFilter !== 'bookable' && filteredVenues.length ? (
              <View style={styles.sectionBlock}>
                <SectionHeader title="Pune venue profiles" eyebrow="Live Pune index" />
                <View style={styles.cardList}>
                  {filteredVenues.map((venue, index) => (
                    <VenueSceneCard
                      key={venue.id}
                      venue={venue}
                      venueEvents={venueEventsMap.get(venue.id) ?? []}
                      index={index}
                      isFollowed={isFollowingVenue(venue.id)}
                      onFollow={() => followVenue(venue)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.sectionBlock}>
            <SectionHeader title="Pune host momentum" eyebrow="Past and upcoming" />
            {filteredHosts.length ? (
              <View style={styles.hostList}>
                {filteredHosts.map((host, index) => (
                  <HostCard key={host.id} host={host} index={index} />
                ))}
              </View>
            ) : (
              <EmptyState activeTab={activeTab} search={search} />
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PURE_BLACK,
  },
  scrollContent: {
    paddingBottom: 116,
  },
  header: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  locationBlock: {
    flex: 1,
    gap: 2,
  },
  greetingText: {
    color: colors.goldMuted,
    fontSize: typography.fontSize.sm,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cityName: {
    color: colors.goldLight,
    fontSize: typography.fontSize['3xl'],
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: 0,
  },
  resultLine: {
    color: colors.goldMuted,
    fontSize: typography.fontSize.sm,
    lineHeight: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  mapButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surfaceActive,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  searchBar: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceActive,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  searchInput: {
    flex: 1,
    color: colors.goldLight,
    fontSize: typography.fontSize.base,
    lineHeight: 19,
    fontWeight: '500',
    padding: 0,
  },
  segmentTrack: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: 2,
  },
  segmentPill: {
    flex: 1,
    height: 38,
    borderRadius: 19,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceActive,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  segmentPillActive: {
    backgroundColor: colors.iris,
    borderColor: colors.irisGlow,
    shadowColor: colors.iris,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
  },
  segmentText: {
    color: colors.goldMuted,
    fontSize: typography.fontSize.sm,
    lineHeight: 17,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: colors.goldLight,
    fontWeight: '900',
  },
  filterRail: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: 2,
    gap: spacing.sm,
  },
  filterChip: {
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  filterChipActive: {
    backgroundColor: colors.iris,
    borderColor: colors.irisGlow,
    shadowColor: colors.iris,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.34,
    shadowRadius: 10,
    elevation: 5,
  },
  filterChipText: {
    color: colors.goldMuted,
    fontSize: typography.fontSize.sm,
    lineHeight: 17,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: colors.goldLight,
    fontWeight: '900',
  },
  sectionBlock: {
    marginTop: spacing.xxl,
  },
  sectionHeader: {
    paddingHorizontal: spacing.base,
    marginBottom: spacing.base,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionGlowBar: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: colors.iris,
    shadowColor: colors.iris,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  sectionTextWrap: {
    flex: 1,
  },
  sectionEyebrow: {
    color: colors.goldMuted,
    fontSize: typography.fontSize.xs + 1,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  sectionTitle: {
    color: colors.goldLight,
    fontSize: typography.fontSize['2xl'],
    lineHeight: 26,
    fontWeight: '900',
    letterSpacing: 0,
  },
  sectionTitleAccent: {
    color: colors.iris,
    textShadowColor: 'rgba(244,74,34,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  sectionAction: {
    color: colors.iris,
    fontSize: typography.fontSize.sm,
    lineHeight: 16,
    fontWeight: '900',
  },
  featuredWrap: {
    marginTop: 30,
  },
  featuredCard: {
    width: CONTENT_W,
    alignSelf: 'center',
    borderRadius: radii.pill,
    overflow: 'hidden',
    backgroundColor: '#111111',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.05)',
    shadowColor: colors.iris,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 8,
  },
  featuredImagePress: {
    height: FEATURED_H,
    backgroundColor: colors.base[100],
  },
  featuredTopRow: {
    position: 'absolute',
    top: spacing.base,
    left: spacing.base,
    right: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  eyebrowPill: {
    minHeight: 30,
    borderRadius: radii.md,
    backgroundColor: 'rgba(0,0,0,0.58)',
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.20)',
  },
  eyebrowPillText: {
    color: colors.goldLight,
    fontSize: typography.fontSize.xs + 1,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(0,0,0,0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  iconButtonActive: {
    backgroundColor: 'rgba(244,74,34,0.18)',
    borderColor: 'rgba(244,74,34,0.45)',
  },
  featuredBody: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    bottom: 18,
  },
  featuredTitle: {
    color: colors.goldLight,
    fontSize: typography.fontSize['3xl'],
    lineHeight: 35,
    fontWeight: '900',
    letterSpacing: 0,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  featuredMeta: {
    color: colors.goldMuted,
    fontSize: typography.fontSize.base,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 6,
  },
  featuredTags: {
    color: colors.goldMuted,
    fontSize: typography.fontSize.sm,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  featuredStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.base,
  },
  glassStat: {
    minHeight: 30,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  glassStatText: {
    color: colors.goldLight,
    fontSize: typography.fontSize.sm,
    lineHeight: 15,
    fontWeight: '800',
  },
  featuredUtility: {
    minHeight: 86,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  nextEventBlock: {
    flex: 1,
    minWidth: 0,
  },
  utilityLabel: {
    color: colors.iris,
    fontSize: typography.fontSize.xs + 1,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  utilityTitle: {
    color: colors.goldLight,
    fontSize: typography.fontSize.base,
    lineHeight: 19,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  utilityMeta: {
    color: colors.goldMuted,
    fontSize: typography.fontSize.sm,
    lineHeight: 16,
    fontWeight: '600',
    marginTop: 3,
  },
  primaryCta: {
    minWidth: 86,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.iris,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
    shadowColor: colors.iris,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.36,
    shadowRadius: 12,
    elevation: 5,
  },
  primaryCtaText: {
    color: colors.goldLight,
    fontSize: typography.fontSize.sm,
    lineHeight: 17,
    fontWeight: '900',
  },
  cardList: {
    gap: spacing.lg,
    paddingHorizontal: spacing.base,
  },
  venueCard: {
    borderRadius: radii.xl,
    backgroundColor: '#111111',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  venueImageWrap: {
    height: VENUE_IMAGE_H,
    backgroundColor: colors.base[100],
  },
  cardTopRow: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  darkPill: {
    minHeight: 28,
    borderRadius: radii.md,
    backgroundColor: 'rgba(0,0,0,0.58)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 11,
  },
  darkPillText: {
    color: colors.goldLight,
    fontSize: typography.fontSize.xs + 1,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  imageNamePlate: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    bottom: spacing.base,
  },
  venueName: {
    color: colors.goldLight,
    fontSize: typography.fontSize['2xl'],
    lineHeight: 29,
    fontWeight: '900',
    letterSpacing: 0,
    textShadowColor: 'rgba(0,0,0,0.82)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  venueMeta: {
    color: colors.goldMuted,
    fontSize: typography.fontSize.sm,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  venueInfoPanel: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.base,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  venueUtility: {
    color: colors.goldMuted,
    fontSize: typography.fontSize.base,
    lineHeight: 18,
    fontWeight: '700',
  },
  venueDetailsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  detailCell: {
    flex: 1,
    minHeight: 54,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  detailLabel: {
    color: colors.goldMuted,
    fontSize: typography.fontSize.xs,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  detailValue: {
    color: colors.goldLight,
    fontSize: typography.fontSize.sm,
    lineHeight: 17,
    fontWeight: '900',
    marginTop: 3,
  },
  cardFooter: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  footerMeta: {
    flex: 1,
    color: colors.goldMuted,
    fontSize: typography.fontSize.sm,
    lineHeight: 16,
    fontWeight: '700',
  },
  smallCta: {
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(244,74,34,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(244,74,34,0.36)',
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallCtaText: {
    color: colors.iris,
    fontSize: typography.fontSize.sm,
    lineHeight: 16,
    fontWeight: '900',
  },
  hostRail: {
    paddingHorizontal: spacing.base,
    gap: spacing.md,
  },
  hostCompactFrame: {
    width: HOST_CARD_W,
  },
  hostList: {
    paddingHorizontal: spacing.base,
    gap: spacing.lg,
  },
  hostCard: {
    width: '100%',
    borderRadius: radii.xl,
    backgroundColor: '#111111',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  hostCardCompact: {
    width: '100%',
  },
  hostImageWrap: {
    height: HOST_IMAGE_H,
    backgroundColor: '#222222',
  },
  hostTopBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    height: 30,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(0,0,0,0.58)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  hostTopBadgeText: {
    color: colors.goldLight,
    fontSize: typography.fontSize.xs + 1,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  hostOverlay: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 80, // Moved up to make room for info panel
  },
  hostName: {
    color: colors.goldLight,
    fontSize: typography.fontSize['2xl'],
    lineHeight: 29,
    fontWeight: '900',
    letterSpacing: 0,
  },
  hostMeta: {
    color: colors.goldMuted,
    fontSize: typography.fontSize.sm,
    lineHeight: 17,
    fontWeight: '800',
    marginTop: 3,
  },
  hostInfoPanel: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    padding: 0,
  },
  hostCategories: {
    color: colors.iris,
    fontSize: typography.fontSize.xs + 1,
    lineHeight: 15,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  hostFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  hostEventLine: {
    flex: 1,
    color: colors.goldLight,
    fontSize: typography.fontSize.base,
    lineHeight: 19,
    fontWeight: '700',
  },
  hostCta: {
    height: 34,
    borderRadius: radii.pill,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceActive,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  hostCtaText: {
    color: colors.goldLight,
    fontSize: typography.fontSize.sm,
    lineHeight: 16,
    fontWeight: '900',
  },
  eventRail: {
    paddingHorizontal: spacing.base,
    gap: spacing.md,
  },
  eventCardFrame: {
    width: EVENT_CARD_W,
  },
  eventCard: {
    height: EVENT_CARD_H,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: '#111111',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  eventDatePill: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    height: 30,
    borderRadius: radii.lg,
    backgroundColor: colors.iris,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  eventDateText: {
    color: colors.goldLight,
    fontSize: typography.fontSize.xs + 1,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  eventCardBody: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    bottom: spacing.base,
  },
  eventTitle: {
    color: colors.goldLight,
    fontSize: typography.fontSize.lg,
    lineHeight: 22,
    fontWeight: '900',
    letterSpacing: 0,
  },
  eventVenue: {
    color: colors.goldMuted,
    fontSize: typography.fontSize.sm,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: 5,
  },
  loadingPanel: {
    marginHorizontal: spacing.base,
    borderRadius: radii.xl,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 40,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  loadingText: {
    color: colors.goldMuted,
    fontSize: typography.fontSize.base,
    lineHeight: 18,
    fontWeight: '600',
  },
  emptyState: {
    marginHorizontal: spacing.base,
    borderRadius: radii.xl,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 22,
    paddingVertical: 30,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  emptyTitle: {
    color: colors.goldLight,
    fontSize: typography.fontSize['2xl'],
    lineHeight: 25,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.goldMuted,
    fontSize: typography.fontSize.base,
    lineHeight: 20,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
