import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Linking,
  Share,
  Dimensions,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ticket, Lock } from 'lucide-react-native';
import { apiFetch } from '@/lib/api';
import { trackScreen } from '@/lib/analytics';
import { colors, gradients, radii } from '@/lib/design/theme';
import { safeDate } from '@/lib/utils/date';
import { useProfileStore } from '@/store/profileStore';

type ProfileImage = string | ImageSourcePropType;

interface ProfileEvent {
  id: string;
  eventId?: string;
  eventTitle: string;
  eventDate?: string;
  eventTime?: string;
  eventCoverImage?: ProfileImage;
  venueLocation?: string;
  hostName?: string;
  ticketLabel?: string;
}

interface UserProfile {
  displayName: string;
  photoURL?: string;
  photoSource?: ImageSourcePropType;
  instagram?: string;
  createdAt?: string;
  upcomingEvent?: ProfileEvent;
  pastEvents?: ProfileEvent[];
  hasDatingProfile?: boolean;
}

const upcomingEvent: ProfileEvent = {
  id: 'aqua-sundays-next',
  eventId: 'aqua-sundays',
  eventTitle: 'Aqua Sundays',
  eventDate: '2026-06-21T10:00:00.000Z',
  eventTime: '10:00 AM',
  eventCoverImage: require('../../../assets/posters/aqua-sundays.jpg'),
  venueLocation: 'The Bund, Pune',
  hostName: 'The Bund',
  ticketLabel: 'Guestlist',
};

const pastEvents: ProfileEvent[] = [
  {
    id: 'eclipse-history',
    eventId: 'eclipse',
    eventTitle: 'Eclipse',
    eventDate: '2026-05-10T20:00:00.000Z',
    eventCoverImage: require('../../../assets/posters/eclipse.jpg'),
    venueLocation: 'Anjuna Beach, North Goa',
    hostName: 'THE C1RCLE',
    ticketLabel: '1x VIP Zone',
  },
  {
    id: 'red-room-history',
    eventId: 'red-room',
    eventTitle: 'Red Room',
    eventDate: '2026-05-03T22:00:00.000Z',
    eventCoverImage: require('../../../assets/posters/red-room.jpg'),
    venueLocation: 'NSCI Dome, Worli, Mumbai',
    hostName: 'THE C1RCLE',
    ticketLabel: '1x GA',
  },
  {
    id: 'neon-district-history',
    eventId: 'neon-district',
    eventTitle: 'Neon District',
    eventDate: '2026-04-26T21:00:00.000Z',
    eventCoverImage: require('../../../assets/posters/neon-district.jpg'),
    venueLocation: 'Ishanya Mall, Pune',
    hostName: 'District Club',
    ticketLabel: '1x GA',
  },
];

const fallbackProfiles: Record<string, UserProfile> = {
  'fallback-arya': {
    displayName: 'Arya',
    photoSource: require('../../../assets/images/attendees/arya.png'),
    instagram: 'arya.nights',
    createdAt: '2026-03-14T12:00:00.000Z',
    upcomingEvent,
    pastEvents,
  },
  'fallback-riya': {
    displayName: 'Riya',
    photoSource: require('../../../assets/images/attendees/riya.png'),
    instagram: 'riya.afterdark',
    createdAt: '2026-02-22T12:00:00.000Z',
    upcomingEvent: {
      ...upcomingEvent,
      eventTitle: 'House of Afro',
      eventCoverImage: require('../../../assets/posters/house-of-afro.jpg'),
    },
    pastEvents,
    hasDatingProfile: true,
  },
  'fallback-anaya': {
    displayName: 'Anaya',
    photoSource: require('../../../assets/images/attendees/anaya.png'),
    instagram: 'anaya.wave',
    createdAt: '2026-04-05T12:00:00.000Z',
    upcomingEvent,
    pastEvents,
  },
  'fallback-isha': {
    displayName: 'Isha',
    photoSource: require('../../../assets/images/attendees/isha.png'),
    instagram: 'isha.sound',
    createdAt: '2026-01-28T12:00:00.000Z',
    upcomingEvent: {
      ...upcomingEvent,
      eventTitle: 'Velvet Nights',
      eventCoverImage: require('../../../assets/posters/velvet-nights.jpg'),
    },
    pastEvents,
  },
  'fallback-hira': {
    displayName: 'Hira',
    photoSource: require('../../../assets/images/attendees/hira.png'),
    instagram: 'hira.c1rcle',
    createdAt: '2026-03-02T12:00:00.000Z',
    upcomingEvent,
    pastEvents,
  },
  'fallback-yash': {
    displayName: 'Yash',
    photoSource: require('../../../assets/images/attendees/yash.png'),
    instagram: 'yash.live',
    createdAt: '2026-02-08T12:00:00.000Z',
    upcomingEvent: {
      ...upcomingEvent,
      eventTitle: 'Afterhours',
      eventCoverImage: require('../../../assets/posters/afterhours.jpg'),
    },
    pastEvents,
  },
  'fallback-neil': {
    displayName: 'Neil',
    photoSource: require('../../../assets/images/attendees/neil.png'),
    instagram: 'neil.tables',
    createdAt: '2026-04-18T12:00:00.000Z',
    upcomingEvent,
    pastEvents,
  },
  'fallback-sam': {
    displayName: 'Sam',
    photoSource: require('../../../assets/images/attendees/sam.png'),
    instagram: 'sam.sundown',
    createdAt: '2026-03-26T12:00:00.000Z',
    upcomingEvent: {
      ...upcomingEvent,
      eventTitle: 'Midnight Club',
      eventCoverImage: require('../../../assets/posters/midnight-club.jpg'),
    },
    pastEvents,
  },
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedExpoImage = Animated.createAnimatedComponent(Image);
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PROFILE_AVATAR_SIZE = 136;
const PROFILE_AVATAR_TOP = Math.max(160, SCREEN_HEIGHT * 0.3 - PROFILE_AVATAR_SIZE / 2);

function getImageSource(source?: ProfileImage): ImageSourcePropType | { uri: string } | undefined {
  if (!source) return undefined;
  return typeof source === 'string' ? { uri: source } : source;
}

function getProfileImageSource(profile: UserProfile): ImageSourcePropType | { uri: string } {
  return (
    profile.photoSource ||
    (profile.photoURL
      ? { uri: profile.photoURL }
      : require('../../../assets/images/user_avatar.jpg'))
  );
}

function formatEventDate(event?: ProfileEvent) {
  const d = safeDate(event?.eventDate);
  if (!d) return event?.eventTime || 'Date TBA';
  const date = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return event?.eventTime ? `${date} at ${event.eventTime}` : date;
}

function formatJoinedDate(value: unknown) {
  const d = safeDate(value);
  if (!d) return '';
  return `Joined ${d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
}

function formatTimelineDate(event: ProfileEvent) {
  const d = safeDate(event.eventDate);
  if (!d) return '';
  const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const dayPart = d.toLocaleDateString('en-US', { weekday: 'long' });
  return `${datePart} ${dayPart}`;
}

function openInstagramProfile(handle?: string) {
  const cleanHandle = handle?.trim().replace(/^@+/, '');
  if (!cleanHandle) return;

  const instagramUrl = `instagram://user?username=${encodeURIComponent(cleanHandle)}`;
  const webUrl = `https://www.instagram.com/${encodeURIComponent(cleanHandle)}`;
  Linking.openURL(instagramUrl).catch(() => Linking.openURL(webUrl));
}

function normalizeEvent(raw: any, fallbackId: string): ProfileEvent | undefined {
  if (!raw) return undefined;

  return {
    id: String(raw.id || raw.orderId || raw.eventId || fallbackId),
    eventId: raw.eventId || raw.id,
    eventTitle: raw.eventTitle || raw.title || raw.name || 'Event',
    eventDate: raw.eventDate || raw.date || raw.startsAt || raw.startTime,
    eventTime: raw.eventTime || raw.time,
    eventCoverImage: raw.eventCoverImage || raw.poster || raw.image || raw.coverImage,
    venueLocation: raw.venueLocation || raw.venueName || raw.location,
    hostName: raw.hostName || raw.organizerName || raw.partnerName,
    ticketLabel: raw.ticketLabel || raw.ticketTier || raw.ticketsInfo,
  };
}

function ViewedProfileTimelineItem({ event }: { event: ProfileEvent }) {
  const imageSource = getImageSource(event.eventCoverImage);
  const dateStr = formatTimelineDate(event);
  const hostVenueLabel = event.hostName
    ? `Hosted by ${event.hostName}`
    : event.venueLocation
      ? `Hosted at ${event.venueLocation}`
      : 'Hosted by THE C1RCLE';

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (event.eventId) {
      router.push({
        pathname: '/event/[id]',
        params: { id: event.eventId },
      });
    }
  };

  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineDot} />
      <Text style={styles.timelineDateText}>{dateStr}</Text>

      <Pressable onPress={handlePress} style={styles.historyCard}>
        <View style={styles.historyCardInner} collapsable={false}>
          {imageSource ? (
            <Image
              source={imageSource}
              style={styles.historyPoster}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <LinearGradient colors={['#2a1a0e', '#161616']} style={styles.historyPoster} />
          )}

          <View style={styles.historyDetailsColumn}>
            <View style={styles.historyInfo}>
              <Text style={styles.historyTitle} numberOfLines={2}>
                {event.eventTitle}
              </Text>
              <Text style={styles.historyTimeVenue} numberOfLines={2}>
                {hostVenueLabel}
              </Text>
            </View>

            <View style={styles.historyBottomRow}>
              <View style={styles.historyBottomLeft}>
                <Ticket size={14} color="rgba(255,255,255,0.42)" strokeWidth={2.2} />
                <Text style={styles.historyYourTickets}>Attended</Text>
              </View>
              <Text style={styles.historyTicketQty}>{event.ticketLabel || 'Guestlist'}</Text>
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

export default function ProfileViewScreen() {
  const { id } = useLocalSearchParams<{ id: string; eventId?: string }>();
  const insets = useSafeAreaInsets();
  const viewerProfile = useProfileStore((s) => s.profile);
  const viewerHasDating = viewerProfile?.datingActive === true;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [loadKey, setLoadKey] = useState(0);

  useEffect(() => {
    trackScreen('SocialProfile');
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setFetchError(false);

      const fallbackProfile = fallbackProfiles[id];
      if (fallbackProfile) {
        if (isMounted) {
          setProfile(fallbackProfile);
          setLoading(false);
        }
        return;
      }

      try {
        const data = await apiFetch<any>(`/api/v1/profiles/${id}`, { requireAuth: false });
        const hasDating = data?.hasDatingProfile || data?.datingActive;
        const normalizedUpcoming = normalizeEvent(
          data?.upcomingEvent || data?.upcomingEvents?.[0] || data?.nextEvent,
          'upcoming',
        );
        const normalizedPast = (data?.pastEvents || data?.attendedEvents || data?.orders || [])
          .map((event: any, index: number) => normalizeEvent(event, `past-${index}`))
          .filter(Boolean);

        if (isMounted && data) {
          setProfile({
            displayName: data.displayName || 'Guest',
            photoURL: data.photoURL,
            instagram: data.instagram,
            createdAt: data.createdAt || data.joinedAt || data.memberSince,
            upcomingEvent: normalizedUpcoming,
            pastEvents: normalizedPast,
            hasDatingProfile: hasDating,
          });
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        if (isMounted) setFetchError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [id, loadKey]);

  // MUTUAL OPT-IN ROUTING:
  // If target has dating profile and viewer has dating profile, route directly to Dating UI.
  useEffect(() => {
    if (profile?.hasDatingProfile && viewerHasDating && id) {
      router.replace({
        pathname: '/dating/[id]',
        params: { id },
      });
    }
  }, [profile, viewerHasDating, id]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#F44A22" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        {fetchError ? (
          <>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
              style={[styles.backButton, { top: insets.top - 2, left: 20 }]}
            >
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </Pressable>
            <Text style={styles.emptyTitle}>Something went wrong</Text>
            <Text
              style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: 14,
                marginTop: 8,
                marginBottom: 24,
                textAlign: 'center',
                paddingHorizontal: 32,
              }}
            >
              Unable to load this profile. Check your connection and try again.
            </Text>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setLoadKey((k) => k + 1);
              }}
              style={{
                backgroundColor: colors.iris,
                paddingHorizontal: 28,
                paddingVertical: 13,
                borderRadius: 24,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
              style={[styles.backButton, { top: insets.top - 2, left: 20 }]}
            >
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </Pressable>
            <Text style={styles.emptyTitle}>User Not Found</Text>
          </>
        )}
      </View>
    );
  }

  const imageSource = getProfileImageSource(profile);
  const avatarTransitionTag = id ? `avatar-${id}` : undefined;
  const instagramHandle = profile.instagram?.trim().replace(/^@+/, '') || '';
  const attendedCount = profile.pastEvents?.length || 0;
  const joinedDateText = formatJoinedDate(profile.createdAt);
  const handleShareProfile = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Share.share({
      message: `Check out ${profile.displayName} on THE C1RCLE.`,
    });
  };

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeIn} style={[styles.topActions, { top: insets.top - 2 }]}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.topActionButton}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </Pressable>

        <Pressable
          onPress={() => void handleShareProfile()}
          style={styles.topActionButton}
          hitSlop={8}
        >
          <Ionicons name="share-outline" size={24} color="#fff" />
        </Pressable>
      </Animated.View>

      <ScrollView
        bounces={false}
        overScrollMode="never"
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 148 }}
      >
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.profileHeader}>
          <Image
            source={imageSource}
            style={styles.profileHeroImage}
            contentFit="cover"
            contentPosition="top center"
            blurRadius={14}
            cachePolicy="memory-disk"
          />
          <LinearGradient
            colors={['rgba(0, 0, 0, 0.22)', 'rgba(0, 0, 0, 0.5)', colors.base.DEFAULT]}
            locations={[0, 0.56, 1]}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={gradients.primary as [string, string]}
              style={styles.avatarGradient}
            >
              <AnimatedExpoImage
                {...(avatarTransitionTag ? { sharedTransitionTag: avatarTransitionTag } : {})}
                source={imageSource}
                style={styles.avatarPhoto}
                contentFit="cover"
                contentPosition="top center"
                cachePolicy="memory-disk"
              />
            </LinearGradient>
          </View>

          <Text style={styles.userName}>{profile.displayName}</Text>

          <Text style={styles.profileStatText}>
            {attendedCount} {attendedCount === 1 ? 'event' : 'events'} attended
          </Text>

          {joinedDateText ? <Text style={styles.profileJoinedText}>{joinedDateText}</Text> : null}

          {instagramHandle ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                openInstagramProfile(instagramHandle);
              }}
              style={styles.instagramProfileButton}
              hitSlop={10}
            >
              <Ionicons name="logo-instagram" size={19} color="#fff" />
            </Pressable>
          ) : null}
        </Animated.View>

        <View style={styles.nightsContent}>
          {profile.hasDatingProfile && !viewerHasDating ? (
            <AnimatedPressable
              entering={FadeInDown.delay(120).springify()}
              style={styles.upsellCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/social-setup');
              }}
            >
              <View style={styles.upsellIconBox}>
                <Lock size={20} color={colors.iris} strokeWidth={2.5} />
              </View>
              <View style={styles.upsellInfo}>
                <Text style={styles.upsellTitle}>
                  Unlock {profile.displayName}'s Dating Profile
                </Text>
                <Text style={styles.upsellSub}>
                  Set up your Nightlife Profile to view and send an Ask Out!
                </Text>
              </View>
            </AnimatedPressable>
          ) : null}

          {profile.upcomingEvent ? (
            <AnimatedPressable
              entering={FadeInDown.delay(140).springify()}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (profile.upcomingEvent?.eventId) {
                  router.push({
                    pathname: '/event/[id]',
                    params: { id: profile.upcomingEvent.eventId },
                  });
                }
              }}
              style={styles.upcomingCard}
            >
              {getImageSource(profile.upcomingEvent.eventCoverImage) ? (
                <Image
                  source={getImageSource(profile.upcomingEvent.eventCoverImage)}
                  style={styles.upcomingPoster}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <LinearGradient colors={['#2a1a0e', '#161616']} style={styles.upcomingPoster} />
              )}

              <View style={styles.upcomingInfo}>
                <Text style={styles.upcomingEyebrow}>{profile.displayName}'s Next Event</Text>
                <Text style={styles.upcomingTitle} numberOfLines={2}>
                  {profile.upcomingEvent.eventTitle || 'Upcoming Event'}
                </Text>
                <Text style={styles.upcomingDate} numberOfLines={1}>
                  {formatEventDate(profile.upcomingEvent)}
                </Text>
                <Text style={styles.upcomingAction}>Get Tickets</Text>
              </View>
            </AnimatedPressable>
          ) : null}

          {profile.pastEvents?.length ? (
            <View style={styles.timelineContainer}>
              <View style={styles.timelineAxis} />

              {profile.pastEvents.map((event) => (
                <ViewedProfileTimelineItem key={event.id} event={event} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyHistoryContainer}>
              <Text style={styles.emptyHistoryText}>No past events attended yet</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  topActions: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  topActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(25, 25, 25, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(25, 25, 25, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: PROFILE_AVATAR_TOP + 270,
    paddingTop: PROFILE_AVATAR_TOP,
    paddingBottom: 22,
    paddingHorizontal: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  profileHeroImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.42,
  },
  avatarContainer: {
    width: 136,
    height: 136,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  avatarGradient: {
    width: 128,
    height: 128,
    borderRadius: 64,
    padding: 3,
  },
  avatarPhoto: {
    width: 122,
    height: 122,
    borderRadius: 61,
  },
  userName: {
    color: colors.gold,
    fontSize: 38,
    fontWeight: '900',
    textAlign: 'center',
  },
  profileStatText: {
    color: 'rgba(255, 250, 238, 0.68)',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginTop: 8,
    textAlign: 'center',
  },
  profileJoinedText: {
    color: 'rgba(255, 250, 238, 0.46)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginTop: 4,
    textAlign: 'center',
  },
  instagramProfileButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  nightsContent: {
    paddingHorizontal: 20,
    gap: 20,
  },
  upsellCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244,74,34,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(244,74,34,0.18)',
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  upsellIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(244,74,34,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upsellInfo: {
    flex: 1,
    gap: 3,
  },
  upsellTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  upsellSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  upcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.base[50],
    borderRadius: 12,
    padding: 10,
    gap: 11,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    shadowColor: colors.iris,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  upcomingPoster: {
    width: 88,
    height: 88,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  upcomingInfo: {
    flex: 1,
    minHeight: 88,
    justifyContent: 'center',
  },
  upcomingEyebrow: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  upcomingTitle: {
    color: '#fff',
    fontSize: 19,
    lineHeight: 21,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  upcomingDate: {
    color: 'rgba(255, 255, 255, 0.46)',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  upcomingAction: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 10,
  },
  timelineContainer: {
    paddingLeft: 16,
    position: 'relative',
    marginTop: 8,
  },
  timelineAxis: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 24,
    width: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 1,
  },
  timelineItem: {
    position: 'relative',
    marginBottom: 18,
    zIndex: 2,
  },
  timelineDot: {
    position: 'absolute',
    left: -20,
    top: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderWidth: 1.5,
    borderColor: colors.base.DEFAULT,
    zIndex: 3,
  },
  timelineDateText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  historyCard: {
    marginTop: 6,
    minHeight: 98,
    position: 'relative',
  },
  historyCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingRight: 4,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  historyPoster: {
    width: 68,
    height: 90,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  historyDetailsColumn: {
    flex: 1,
    minHeight: 90,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  historyInfo: {
    gap: 5,
  },
  historyTitle: {
    color: '#fff',
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  historyTimeVenue: {
    color: 'rgba(255, 255, 255, 0.58)',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 15,
  },
  historyBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  historyBottomLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyYourTickets: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 10,
    fontWeight: '700',
  },
  historyTicketQty: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  emptyHistoryContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyHistoryText: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyTitle: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: '800',
  },
});
