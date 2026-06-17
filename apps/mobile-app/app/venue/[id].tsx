import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Heart,
  ChevronLeft,
  Share2,
  Navigation,
  Clock,
  MapPin,
  Users,
  Calendar,
  Music,
  Phone,
  X,
  ChevronRight,
  Sparkles,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { colors, radii } from '@/lib/design/theme';
import { EventCard } from '@/components/ui/EventCard';
import { PremiumButton } from '@/components/ui/PremiumButton';
import { getFacilityEmoji, type VenueHighlight, useVenuePageStore } from '@/store/venuePageStore';
import { useFollowStore } from '@/store/followStore';
import { useAuth } from '@/hooks/useAuth';
import { formatCompactCount } from '@/lib/venueDiscovery';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_HEIGHT * 0.55;
const AnyFlatList = FlatList as any;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ── Section Header (matches explore page) ──────────────────────────────────────
function SectionHeader({
  title,
  onAction,
  actionLabel,
}: {
  title: string;
  onAction?: () => void;
  actionLabel?: string;
}) {
  const words = title.trim().split(' ');
  const lastWord = words.pop() || '';
  const firstPart = words.join(' ');

  return (
    <View style={styles.sectionHeader}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={styles.glowBar} />
        <Text style={styles.sectionTitle}>
          {firstPart}
          {firstPart ? ' ' : ''}
          <Text style={styles.sectionTitleAccent}>{lastWord}</Text>
        </Text>
      </View>
      {onAction && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.viewAllText}>{actionLabel || 'See All'}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Segmented Tab Control ───────────────────────────────────────────────────────
type TabId = 'events' | 'menu' | 'about';
const TABS: { id: TabId; label: string }[] = [
  { id: 'events', label: 'Events' },
  { id: 'menu', label: 'Menu' },
  { id: 'about', label: 'About' },
];

function SegmentedTabs({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  const tabWidth = (SCREEN_WIDTH - 40 - 8) / 3; // container padding 20*2, inner padding 4*2
  const slideX = useSharedValue(0);

  useEffect(() => {
    const idx = TABS.findIndex((t) => t.id === active);
    slideX.value = withSpring(idx * tabWidth, { damping: 18, stiffness: 280 });
  }, [active, tabWidth]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
    width: tabWidth,
  }));

  return (
    <View style={styles.segmentedContainer}>
      <Animated.View style={[styles.segmentedThumb, thumbStyle]} />
      {TABS.map((tab) => (
        <Pressable
          key={tab.id}
          onPress={() => {
            Haptics.selectionAsync();
            onChange(tab.id);
          }}
          style={[styles.segmentedTab, { width: tabWidth }]}
        >
          <Text
            style={[styles.segmentedTabText, active === tab.id && styles.segmentedTabTextActive]}
          >
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ── Gallery Modal ───────────────────────────────────────────────────────────────
function GalleryModal({
  visible,
  imageUrl,
  onClose,
}: {
  visible: boolean;
  imageUrl: string | null;
  onClose: () => void;
}) {
  if (!imageUrl) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View entering={FadeIn} style={styles.galleryModalCard}>
          <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} contentFit="contain" />
          <Pressable onPress={onClose} style={styles.modalCloseBtn}>
            <X color="#fff" size={20} />
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Story Modal ─────────────────────────────────────────────────────────────────
function StoryModal({
  visible,
  highlight,
  imageIndex,
  onClose,
  onPrev,
  onNext,
}: {
  visible: boolean;
  highlight: VenueHighlight | null;
  imageIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (!highlight) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View entering={FadeIn} style={styles.storyCard}>
          <Image
            source={{ uri: highlight.images[imageIndex] }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.7)']}
            style={StyleSheet.absoluteFill}
          />

          {/* Progress dots */}
          <View style={styles.storyProgressRow}>
            {highlight.images.map((_, i) => (
              <View key={i} style={[styles.storyDot, i === imageIndex && styles.storyDotActive]} />
            ))}
          </View>

          <View style={styles.storyHeader}>
            <Text style={styles.storyTitle}>{highlight.title}</Text>
            <Pressable onPress={onClose} style={styles.modalCloseBtn}>
              <X color="#fff" size={20} />
            </Pressable>
          </View>

          {highlight.images.length > 1 && (
            <View style={styles.storyFooter}>
              <Pressable onPress={onPrev} style={styles.storyNav}>
                <ChevronLeft color="#fff" size={18} />
              </Pressable>
              <Text style={styles.storyCount}>
                {imageIndex + 1}/{highlight.images.length}
              </Text>
              <Pressable onPress={onNext} style={styles.storyNav}>
                <ChevronRight color="#fff" size={18} />
              </Pressable>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────────────
export default function VenuePageScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const {
    venue,
    highlights,
    gallery,
    menu,
    facilities,
    upcomingEvents,
    loading,
    error,
    fetchVenuePage,
    clearVenuePage,
  } = useVenuePageStore();

  const [activeTab, setActiveTab] = useState<TabId>('events');
  const [storyModal, setStoryModal] = useState<{
    highlight: VenueHighlight;
    imageIndex: number;
  } | null>(null);
  const [menuModalIndex, setMenuModalIndex] = useState<number | null>(null);
  const [galleryImage, setGalleryImage] = useState<string | null>(null);

  const { user } = useAuth();
  const { isFollowingVenue, toggleVenueFollow, fetchFollows, loaded } = useFollowStore();
  const isFollowing = venue ? isFollowingVenue(venue.id) : false;

  useEffect(() => {
    if (user?.uid && !loaded) void fetchFollows(user.uid);
  }, [user?.uid, loaded, fetchFollows]);

  const handleFollow = useCallback(() => {
    if (!user?.uid || !venue) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const name = venue.displayName || venue.name || 'Venue';
    void toggleVenueFollow(venue.id, name, user.uid);
  }, [user?.uid, venue, toggleVenueFollow]);

  useEffect(() => {
    if (!id) return;
    void fetchVenuePage(id);
    return () => clearVenuePage();
  }, [clearVenuePage, fetchVenuePage, id]);

  const venueName = venue?.displayName || venue?.name || 'Venue';
  const bannerUrl = venue?.bannerImage || venue?.coverURL || venue?.photoURL;
  const logoUrl = venue?.logoImage || venue?.photoURL;
  const primaryLocation = venue?.neighborhood || venue?.city || venue?.address;
  const hasReservation = venue?.hasReservation || !!venue?.whatsapp || !!venue?.phone;

  const timingsEntries = useMemo(() => {
    if (!venue?.timings) return [];
    return Object.entries(venue.timings);
  }, [venue?.timings]);

  const handleReservation = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (venue?.whatsapp) {
      const digits = venue.whatsapp.replace(/\D/g, '');
      const message = encodeURIComponent(`Hi, I'd like to make a reservation at ${venueName}`);
      await Linking.openURL(`https://wa.me/${digits}?text=${message}`);
      return;
    }
    if (venue?.phone) {
      await Linking.openURL(`tel:${venue.phone}`);
    }
  }, [venue, venueName]);

  const handleDirections = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const coordinates = venue?.coordinates;
    const target = venue?.address || primaryLocation || venueName;
    if (coordinates) {
      await Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${coordinates.latitude},${coordinates.longitude}`,
      );
      return;
    }
    if (!target) return;
    await Linking.openURL(`maps://search?q=${encodeURIComponent(target)}`);
  }, [venue, primaryLocation, venueName]);

  const handleShare = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Share.share({
      message: `Check out ${venueName} on THE C1RCLE! https://thec1rcle.com/venue/${id}`,
    });
  }, [venueName, id]);

  // ── Loading State ──
  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.iris} />
      </View>
    );
  }

  // ── Error State ──
  if (error || !venue) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.errorTitle}>Venue unavailable</Text>
        <Text style={styles.errorText}>{error || 'This venue could not be loaded.'}</Text>
        <PremiumButton onPress={() => router.back()} style={{ marginTop: 20, minWidth: 180 }}>
          Go Back
        </PremiumButton>
      </View>
    );
  }

  // ── Masonry gallery layout ──
  const galleryLeft = gallery.filter((_, i) => i % 2 === 0).slice(0, 3);
  const galleryRight = gallery.filter((_, i) => i % 2 === 1).slice(0, 3);

  return (
    <View style={styles.container}>
      <ScrollView
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ═══════════════════════════════════════════════════════════════
                    SECTION 1: IMMERSIVE HERO
                ═══════════════════════════════════════════════════════════════ */}
        <View style={styles.hero}>
          {bannerUrl ? (
            <Image source={{ uri: bannerUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <LinearGradient colors={['#2C1B12', '#0A0A0A']} style={StyleSheet.absoluteFill} />
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.0)', 'rgba(0,0,0,0.85)', '#000000']}
            locations={[0, 0.3, 0.75, 1]}
            style={StyleSheet.absoluteFill}
          />

          {/* Floating Header */}
          <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.canGoBack() ? router.back() : router.push('/');
              }}
              style={styles.glassPill}
            >
              <ChevronLeft color="#fff" size={22} />
            </Pressable>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={handleShare} style={styles.glassPill}>
                <Share2 color="#fff" size={18} />
              </Pressable>
              <Pressable onPress={handleDirections} style={styles.glassPill}>
                <Navigation color="#fff" size={18} />
              </Pressable>
            </View>
          </View>

          {/* Identity Block */}
          <View style={styles.heroIdentity}>
            {logoUrl && (
              <Animated.View entering={FadeIn.delay(100)}>
                <View style={styles.logoRing}>
                  <Image source={{ uri: logoUrl }} style={styles.logoImage} contentFit="cover" />
                </View>
              </Animated.View>
            )}

            <Animated.View entering={FadeInDown.delay(150)}>
              <View style={styles.badgeRow}>
                {venue.isVerified && (
                  <View style={styles.verifiedBadge}>
                    <Sparkles size={11} color="#D4FF70" />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                )}
                {venue.venueType && (
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>{venue.venueType}</Text>
                  </View>
                )}
                {primaryLocation && (
                  <View style={styles.typeBadge}>
                    <MapPin size={11} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.typeBadgeText}>{primaryLocation}</Text>
                  </View>
                )}
              </View>

              <Text style={styles.venueName}>{venueName}</Text>
              {venue.tagline && <Text style={styles.tagline}>{venue.tagline}</Text>}
            </Animated.View>
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════════════════
                    SECTION 2: QUICK STATS BAR
                ═══════════════════════════════════════════════════════════════ */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.statsRow}>
          <View style={styles.statChip}>
            <Heart size={14} color={colors.iris} fill={colors.iris} />
            <Text style={styles.statValue}>{formatCompactCount(venue.followers)}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statChip}>
            <Calendar size={14} color={colors.iris} />
            <Text style={styles.statValue}>
              {venue.upcomingEventsCount || upcomingEvents.length || 0}
            </Text>
            <Text style={styles.statLabel}>Events</Text>
          </View>
          {timingsEntries.length > 0 && (
            <View style={styles.statChip}>
              <Clock size={14} color={colors.iris} />
              <Text style={styles.statValue} numberOfLines={1}>
                {timingsEntries[0][1]}
              </Text>
              <Text style={styles.statLabel}>{timingsEntries[0][0]}</Text>
            </View>
          )}
        </Animated.View>

        {/* ═══════════════════════════════════════════════════════════════
                    SECTION 3: ACTION BAR
                ═══════════════════════════════════════════════════════════════ */}
        <Animated.View entering={FadeInDown.delay(250)} style={styles.actionBar}>
          <Pressable
            onPress={handleFollow}
            style={[styles.followBtn, isFollowing && styles.followBtnActive]}
          >
            <Heart
              size={16}
              color={isFollowing ? colors.iris : 'rgba(255,255,255,0.85)'}
              fill={isFollowing ? colors.iris : 'none'}
              strokeWidth={2}
            />
            <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </Pressable>

          {hasReservation && (
            <Pressable onPress={handleReservation} style={styles.reserveBtn}>
              <LinearGradient
                colors={[colors.iris, colors.irisGlow]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <Phone size={15} color="#fff" />
              <Text style={styles.reserveBtnText}>{venue.primaryCta || 'Reserve'}</Text>
            </Pressable>
          )}

          <Pressable onPress={handleDirections} style={styles.directionBtn}>
            <Navigation size={18} color="#fff" />
          </Pressable>
        </Animated.View>

        {/* ═══════════════════════════════════════════════════════════════
                    SECTION 4: HIGHLIGHTS (Story Rings)
                ═══════════════════════════════════════════════════════════════ */}
        {highlights.length > 0 && (
          <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
            <SectionHeader title="Highlights" />
            <ScrollView
              bounces={false}
              overScrollMode="never"
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.highlightScroll}
            >
              {highlights.map((highlight, i) => (
                <Pressable
                  key={highlight.id}
                  onPress={() => {
                    if (!highlight.images?.length) return;
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setStoryModal({ highlight, imageIndex: 0 });
                  }}
                  style={styles.highlightItem}
                >
                  <LinearGradient colors={[colors.iris, '#7B4AE2']} style={styles.highlightRing}>
                    <Image
                      source={{ uri: highlight.coverImage || highlight.images[0] }}
                      style={styles.highlightImage}
                      contentFit="cover"
                    />
                  </LinearGradient>
                  <Text style={styles.highlightLabel} numberOfLines={1}>
                    {highlight.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* ═══════════════════════════════════════════════════════════════
                    SECTION 5: VIBE GALLERY (Masonry)
                ═══════════════════════════════════════════════════════════════ */}
        {gallery.length > 0 && (
          <Animated.View entering={FadeInDown.delay(350)} style={styles.section}>
            <SectionHeader
              title="The Vibe"
              onAction={gallery.length > 6 ? () => {} : undefined}
              actionLabel={`${gallery.length} photos`}
            />
            <View style={styles.masonryGrid}>
              {/* Left column */}
              <View style={styles.masonryCol}>
                {galleryLeft.map((item, i) => (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setGalleryImage(item.imageUrl);
                    }}
                  >
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={[styles.masonryImage, { aspectRatio: i % 2 === 0 ? 0.75 : 1.3 }]}
                      contentFit="cover"
                    />
                  </Pressable>
                ))}
              </View>
              {/* Right column */}
              <View style={styles.masonryCol}>
                {galleryRight.map((item, i) => (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setGalleryImage(item.imageUrl);
                    }}
                  >
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={[styles.masonryImage, { aspectRatio: i % 2 === 0 ? 1.3 : 0.75 }]}
                      contentFit="cover"
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          </Animated.View>
        )}

        {/* ═══════════════════════════════════════════════════════════════
                    SECTION 6: CONTENT TABS
                ═══════════════════════════════════════════════════════════════ */}
        <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
          <SegmentedTabs active={activeTab} onChange={setActiveTab} />

          {/* ── Events Tab ── */}
          {activeTab === 'events' && (
            <Animated.View entering={FadeIn.duration(250)}>
              {upcomingEvents.length > 0 ? (
                <View style={styles.eventsColumn}>
                  {upcomingEvents.map((event, index) => (
                    <EventCard
                      key={event.id}
                      id={event.id}
                      title={event.title || 'Event'}
                      venue={event.venue || venueName}
                      date={
                        event.startDate
                          ? new Date(event.startDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'TBA'
                      }
                      time={
                        event.startDate
                          ? new Date(event.startDate).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })
                          : undefined
                      }
                      imageUrl={
                        event.image ||
                        event.poster ||
                        bannerUrl ||
                        'https://thec1rcle.com/events/placeholder.svg'
                      }
                      category={event.category}
                      variant="compact"
                      animationDelay={index * 60}
                      onPress={() =>
                        router.push({
                          pathname: '/event/[id]',
                          params: { id: event.id },
                        })
                      }
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyEmoji}>📅</Text>
                  <Text style={styles.emptyTitle}>No upcoming events</Text>
                  <Text style={styles.emptySubtitle}>
                    Follow this venue to get notified when new events drop.
                  </Text>
                  {!isFollowing && (
                    <Pressable onPress={handleFollow} style={styles.emptyFollowBtn}>
                      <Heart size={14} color="#fff" />
                      <Text style={styles.emptyFollowText}>Follow</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </Animated.View>
          )}

          {/* ── Menu Tab ── */}
          {activeTab === 'menu' && (
            <Animated.View entering={FadeIn.duration(250)}>
              {menu.length > 0 ? (
                <View style={styles.menuGrid}>
                  {menu.map((item, index) => (
                    <Pressable
                      key={item.id}
                      onPress={() => setMenuModalIndex(index)}
                      style={styles.menuCard}
                    >
                      <Image
                        source={{ uri: item.imageUrl }}
                        style={styles.menuImage}
                        contentFit="cover"
                      />
                      {item.title && (
                        <Text style={styles.menuTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyEmoji}>📷</Text>
                  <Text style={styles.emptyTitle}>Menu coming soon</Text>
                  <Text style={styles.emptySubtitle}>
                    The venue hasn't uploaded their menu yet.
                  </Text>
                </View>
              )}
            </Animated.View>
          )}

          {/* ── About Tab ── */}
          {activeTab === 'about' && (
            <Animated.View entering={FadeIn.duration(250)}>
              {/* Description */}
              {venue.description && (
                <View style={styles.aboutSection}>
                  <Text style={styles.aboutLabel}>About</Text>
                  <Text style={styles.aboutBody}>{venue.description}</Text>
                </View>
              )}

              {/* Genres / Vibes / Tags */}
              {venue.genres?.length || venue.vibes?.length || venue.tags?.length ? (
                <View style={styles.aboutSection}>
                  <Text style={styles.aboutLabel}>Music & Vibes</Text>
                  <View style={styles.tagsRow}>
                    {[...(venue.genres || []), ...(venue.vibes || []), ...(venue.tags || [])].map(
                      (tag, i) => (
                        <View key={`${tag}-${i}`} style={styles.tagPill}>
                          <Text style={styles.tagPillText}>{tag}</Text>
                        </View>
                      ),
                    )}
                  </View>
                </View>
              ) : null}

              {/* Facilities */}
              {facilities.length > 0 && (
                <View style={styles.aboutSection}>
                  <Text style={styles.aboutLabel}>Facilities</Text>
                  <View style={styles.facilitiesGrid}>
                    {facilities.map((facility) => (
                      <View key={facility.id} style={styles.facilityCard}>
                        <Text style={styles.facilityEmoji}>{getFacilityEmoji(facility.icon)}</Text>
                        <Text style={styles.facilityText}>{facility.name}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Timings */}
              {timingsEntries.length > 0 && (
                <View style={styles.aboutSection}>
                  <Text style={styles.aboutLabel}>Timings</Text>
                  <View style={styles.timingsCard}>
                    {timingsEntries.map(([day, time]) => (
                      <View key={day} style={styles.timingRow}>
                        <Text style={styles.timingDay}>{day}</Text>
                        <Text style={styles.timingTime}>{time}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Contact */}
              {(venue.phone || venue.whatsapp) && (
                <View style={styles.aboutSection}>
                  <Text style={styles.aboutLabel}>Contact</Text>
                  <Pressable onPress={handleReservation} style={styles.contactRow}>
                    <Phone size={16} color={colors.iris} />
                    <Text style={styles.contactText}>{venue.whatsapp || venue.phone}</Text>
                    <ChevronRight size={16} color="rgba(255,255,255,0.4)" />
                  </Pressable>
                </View>
              )}
            </Animated.View>
          )}
        </Animated.View>
      </ScrollView>

      {/* ═══════════════════════════════════════════════════════════════
                MODALS
            ═══════════════════════════════════════════════════════════════ */}
      <StoryModal
        visible={!!storyModal}
        highlight={storyModal?.highlight ?? null}
        imageIndex={storyModal?.imageIndex ?? 0}
        onClose={() => setStoryModal(null)}
        onPrev={() =>
          setStoryModal((c) =>
            c
              ? {
                  ...c,
                  imageIndex:
                    (c.imageIndex - 1 + c.highlight.images.length) % c.highlight.images.length,
                }
              : c,
          )
        }
        onNext={() =>
          setStoryModal((c) =>
            c
              ? {
                  ...c,
                  imageIndex: (c.imageIndex + 1) % c.highlight.images.length,
                }
              : c,
          )
        }
      />

      {/* Menu Modal */}
      <Modal
        visible={menuModalIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuModalIndex(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuModalIndex(null)} />
          {menuModalIndex !== null && menu[menuModalIndex] && (
            <Animated.View entering={FadeIn} style={styles.galleryModalCard}>
              <Image
                source={{ uri: menu[menuModalIndex].imageUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
              />
              <Pressable onPress={() => setMenuModalIndex(null)} style={styles.modalCloseBtn}>
                <X color="#fff" size={20} />
              </Pressable>
            </Animated.View>
          )}
        </View>
      </Modal>

      {/* Gallery Modal */}
      <GalleryModal
        visible={!!galleryImage}
        imageUrl={galleryImage}
        onClose={() => setGalleryImage(null)}
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingBottom: 80,
  },

  // ── Hero ──
  hero: {
    height: HERO_HEIGHT,
    justifyContent: 'flex-end',
  },
  headerBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  glassPill: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  heroIdentity: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  logoRing: {
    width: 80,
    height: 80,
    borderRadius: 24,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(163,255,112,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(163,255,112,0.28)',
  },
  verifiedText: {
    color: '#E4FFC0',
    fontSize: 11,
    fontWeight: '700',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  typeBadgeText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontWeight: '600',
  },
  venueName: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  tagline: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
  },

  // ── Stats ──
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 16,
  },
  statChip: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  statValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // ── Action Bar ──
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  followBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  followBtnActive: {
    backgroundColor: 'rgba(244,74,34,0.12)',
    borderColor: 'rgba(244,74,34,0.4)',
  },
  followBtnText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '700',
  },
  followBtnTextActive: {
    color: colors.iris,
  },
  reserveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 16,
    overflow: 'hidden',
  },
  reserveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  directionBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  // ── Section Header ──
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  glowBar: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: colors.iris,
    shadowColor: colors.iris,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  sectionTitleAccent: {
    color: colors.iris,
  },
  viewAllText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Highlights ──
  highlightScroll: {
    paddingHorizontal: 20,
    gap: 14,
  },
  highlightItem: {
    width: 80,
    alignItems: 'center',
  },
  highlightRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    padding: 3,
    marginBottom: 8,
  },
  highlightImage: {
    width: '100%',
    height: '100%',
    borderRadius: 35,
  },
  highlightLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },

  // ── Masonry Gallery ──
  masonryGrid: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
  },
  masonryCol: {
    flex: 1,
    gap: 8,
  },
  masonryImage: {
    width: '100%',
    borderRadius: 14,
  },

  // ── Segmented Tabs ──
  segmentedContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 4,
    position: 'relative',
  },
  segmentedThumb: {
    position: 'absolute',
    top: 4,
    left: 4,
    height: '100%',
    borderRadius: 11,
    backgroundColor: 'rgba(244,74,34,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(244,74,34,0.4)',
  },
  segmentedTab: {
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  segmentedTabText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '700',
  },
  segmentedTabTextActive: {
    color: '#fff',
  },

  // ── Events Tab ──
  eventsColumn: {
    paddingHorizontal: 20,
    gap: 12,
  },

  // ── Empty States ──
  emptyState: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyFollowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(244,74,34,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(244,74,34,0.45)',
  },
  emptyFollowText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Menu Tab ──
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 10,
  },
  menuCard: {
    width: (SCREEN_WIDTH - 50) / 2,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  menuImage: {
    width: '100%',
    aspectRatio: 0.76,
  },
  menuTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    padding: 10,
  },

  // ── About Tab ──
  aboutSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  aboutLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  aboutBody: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 15,
    lineHeight: 23,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tagPillText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '600',
  },
  facilitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  facilityCard: {
    width: (SCREEN_WIDTH - 60) / 3,
    borderRadius: 16,
    padding: 14,
    minHeight: 86,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'space-between',
  },
  facilityEmoji: {
    fontSize: 20,
    marginBottom: 8,
  },
  facilityText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '600',
  },
  timingsCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: 10,
  },
  timingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timingDay: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '600',
  },
  timingTime: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  contactText: {
    flex: 1,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 15,
    fontWeight: '600',
  },

  // ── Modals ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  storyCard: {
    width: '100%',
    height: '72%',
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  storyProgressRow: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 4,
    zIndex: 10,
  },
  storyDot: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  storyDotActive: {
    backgroundColor: '#fff',
  },
  storyHeader: {
    position: 'absolute',
    top: 28,
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
    marginRight: 12,
  },
  storyFooter: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storyNav: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  storyCount: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  galleryModalCard: {
    width: '100%',
    height: '80%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Error ──
  errorTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  errorText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
});
