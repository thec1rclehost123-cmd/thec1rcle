import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDays, ChevronLeft, MapPin, UsersRound } from 'lucide-react-native';
import { colors, radii } from '@/lib/design/theme';
import {
  fetchPublicHostPage,
  type PublicHostEvent,
  type PublicHostPageResponse,
  type PublicHostProfile,
} from '@/lib/publicDetailRequests';
import { createLatestRequestGuard } from '@/lib/requestGuard';

function formatEventDate(value?: string) {
  if (!value) return 'Date coming soon';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date coming soon';
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

export default function HostProfileScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const requestGuardRef = useRef(createLatestRequestGuard());
  const [host, setHost] = useState<PublicHostProfile | null>(null);
  const [events, setEvents] = useState<PublicHostEvent[]>([]);
  const [stats, setStats] = useState<PublicHostPageResponse['stats'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHost = useCallback(
    async (refresh = false) => {
      if (!id) {
        requestGuardRef.current.invalidate();
        setError('Host not found.');
        setLoading(false);
        return;
      }

      const requestToken = requestGuardRef.current.begin(id);
      refresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      try {
        const response = await fetchPublicHostPage(id, { bypassCache: refresh });
        if (!requestGuardRef.current.isCurrent(requestToken)) return;
        if (!response.host) throw new Error('Host not found.');
        setHost(response.host);
        setStats(response.stats || null);
        setEvents(Array.isArray(response.upcomingEvents) ? response.upcomingEvents : []);
      } catch (requestError: any) {
        if (!requestGuardRef.current.isCurrent(requestToken)) return;
        setError(requestError?.message || 'Unable to load this host right now.');
      } finally {
        if (requestGuardRef.current.isCurrent(requestToken)) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [id],
  );

  useEffect(() => {
    void loadHost();
    return () => requestGuardRef.current.invalidate();
  }, [loadHost]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/search'));

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.gold} size="large" />
        <Text style={styles.loadingText}>Loading host…</Text>
      </View>
    );
  }

  if (error || !host) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errorTitle}>Couldn’t load this host</Text>
        <Text style={styles.errorText}>{error || 'Host not found.'}</Text>
        <Pressable style={styles.retryButton} onPress={() => void loadHost()}>
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>
        <Pressable style={styles.backLink} onPress={goBack}>
          <Text style={styles.backLinkText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const name = host.displayName || host.name || 'Host';
  const heroImage =
    host.coverURL ||
    host.coverUrl ||
    host.cover ||
    host.avatarUrl ||
    host.avatar ||
    host.photoURL ||
    host.image;
  const followerCount = stats?.followersCount ?? host.followersCount ?? 0;
  const upcomingCount = stats?.upcomingEventsCount ?? host.upcomingEventsCount ?? events.length;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) + 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadHost(true)}
            tintColor={colors.gold}
          />
        }
      >
        <View style={styles.hero}>
          {heroImage ? (
            <Image source={{ uri: heroImage }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <View style={styles.heroPlaceholder} />
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0.08)', 'rgba(8,8,10,0.25)', colors.base.DEFAULT]}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={goBack}
            style={[styles.backButton, { top: insets.top + 10 }]}
          >
            <ChevronLeft color="#fff" size={24} />
          </Pressable>
        </View>

        <View style={styles.content}>
          <Text style={styles.name}>{name}</Text>
          {!!host.handle && <Text style={styles.handle}>{host.handle}</Text>}
          {!!(host.location || host.city) && (
            <View style={styles.locationRow}>
              <MapPin color={colors.goldMetallic} size={16} />
              <Text style={styles.locationText}>{host.location || host.city}</Text>
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <UsersRound color={colors.gold} size={20} />
              <Text style={styles.statValue}>{followerCount.toLocaleString('en-IN')}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statCard}>
              <CalendarDays color={colors.gold} size={20} />
              <Text style={styles.statValue}>{upcomingCount}</Text>
              <Text style={styles.statLabel}>Upcoming</Text>
            </View>
          </View>

          {!!(host.bio || host.description) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.bio}>{host.bio || host.description}</Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Events</Text>
            {events.length === 0 ? (
              <Text style={styles.emptyText}>No upcoming events announced yet.</Text>
            ) : (
              events.map((event) => {
                const eventId = event.id || event.eventId;
                const eventImage = event.posterUrl || event.poster || event.image;
                return (
                  <Pressable
                    key={eventId || event.title}
                    disabled={!eventId}
                    onPress={() =>
                      eventId && router.push({ pathname: '/event/[id]', params: { id: eventId } })
                    }
                    style={styles.eventCard}
                  >
                    {eventImage ? (
                      <Image
                        source={{ uri: eventImage }}
                        style={styles.eventImage}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.eventImage, styles.eventPlaceholder]} />
                    )}
                    <View style={styles.eventContent}>
                      <Text style={styles.eventTitle} numberOfLines={2}>
                        {event.title || 'Untitled event'}
                      </Text>
                      <Text style={styles.eventMeta} numberOfLines={1}>
                        {event.venueName || event.venue || 'Venue coming soon'}
                      </Text>
                      <Text style={styles.eventDate} numberOfLines={1}>
                        {formatEventDate(event.startAt || event.startDate)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.base.DEFAULT },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: colors.base.DEFAULT,
  },
  loadingText: { color: colors.goldMetallic, marginTop: 14, fontSize: 15 },
  errorTitle: { color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  errorText: { color: colors.goldMetallic, fontSize: 15, textAlign: 'center', marginTop: 10 },
  retryButton: {
    marginTop: 24,
    backgroundColor: colors.iris,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: radii.pill,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  backLink: { marginTop: 18, padding: 8 },
  backLinkText: { color: colors.gold, fontWeight: '600' },
  hero: { height: 360, position: 'relative', backgroundColor: colors.base[50] },
  heroPlaceholder: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.base[100] },
  backButton: {
    position: 'absolute',
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.56)',
  },
  content: { paddingHorizontal: 20, marginTop: -42 },
  name: { color: '#fff', fontSize: 34, fontWeight: '800', letterSpacing: -0.8 },
  handle: { color: colors.gold, fontSize: 15, marginTop: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  locationText: { color: colors.goldMetallic, fontSize: 15 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  statCard: {
    flex: 1,
    minHeight: 112,
    borderRadius: radii.xl,
    padding: 16,
    backgroundColor: colors.base[50],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statValue: { color: '#fff', fontSize: 23, fontWeight: '800', marginTop: 10 },
  statLabel: { color: colors.goldMetallic, fontSize: 13, marginTop: 2 },
  section: { marginTop: 30 },
  sectionTitle: { color: '#fff', fontSize: 21, fontWeight: '800', marginBottom: 14 },
  bio: { color: '#d4d0c9', fontSize: 15, lineHeight: 23 },
  emptyText: { color: colors.goldMetallic, fontSize: 15, lineHeight: 22 },
  eventCard: {
    flexDirection: 'row',
    minHeight: 116,
    marginBottom: 12,
    overflow: 'hidden',
    borderRadius: radii.xl,
    backgroundColor: colors.base[50],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  eventImage: { width: 108, minHeight: 116 },
  eventPlaceholder: { backgroundColor: colors.base[100] },
  eventContent: { flex: 1, padding: 14, justifyContent: 'center' },
  eventTitle: { color: '#fff', fontSize: 16, fontWeight: '700', lineHeight: 21 },
  eventMeta: { color: colors.goldMetallic, fontSize: 13, marginTop: 6 },
  eventDate: { color: colors.gold, fontSize: 12, marginTop: 5, fontWeight: '600' },
});
