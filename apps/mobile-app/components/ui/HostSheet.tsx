/**
 * HostSheet — slide-up sheet showing host/promoter detail
 * Opened from event detail when user taps the host card.
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { apiFetch } from '@/lib/api';
import { colors, radii, gradients } from '@/lib/design/theme';
import { safeDate } from '@/lib/utils/date';
import { fetchPublicHostPage } from '@/lib/publicDetailRequests';

interface HostEvent {
  id: string;
  title: string;
  startDate?: string;
  coverImage?: string;
}

interface HostInfo {
  id?: string;
  name: string;
  bio?: string;
  photoURL?: string;
  coverImage?: string;
  isVerified?: boolean;
  followerCount?: number;
  eventsHosted?: number;
  city?: string;
  upcomingEvents?: HostEvent[];
  pastEvents?: HostEvent[];
}

interface HostSheetProps {
  visible: boolean;
  onClose: () => void;
  hostName: string;
  hostId?: string;
  hostAvatar?: string;
}

export function HostSheet({ visible, onClose, hostName, hostId, hostAvatar }: HostSheetProps) {
  const [host, setHost] = useState<HostInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    if (!visible || !hostId) return;
    let active = true;
    setLoading(true);
    setError(null);
    Promise.allSettled([
      fetchPublicHostPage(hostId, { bypassCache: true }),
      apiFetch(`/api/v1/follow?targetId=${encodeURIComponent(hostId)}`),
    ])
      .then(([profileResult, followResult]) => {
        if (!active) return;
        if (profileResult.status === 'rejected') throw profileResult.reason;
        const profile: any = profileResult.value;
        const publicHost = profile?.host || {};
        setHost({
          id: publicHost.id || publicHost.hostId || hostId,
          name: publicHost.displayName || publicHost.name || hostName,
          bio: publicHost.bio || publicHost.description,
          photoURL:
            publicHost.avatarUrl || publicHost.avatar || publicHost.photoURL || publicHost.image,
          coverImage: publicHost.coverUrl || publicHost.coverURL || publicHost.cover,
          followerCount: profile?.stats?.followersCount ?? publicHost.followersCount ?? 0,
          eventsHosted: profile?.stats?.upcomingEventsCount ?? publicHost.upcomingEventsCount ?? 0,
          city: publicHost.city || publicHost.location,
          upcomingEvents: (profile?.upcomingEvents || []).map((event: any) => ({
            id: event.id || event.eventId,
            title: event.title || 'Event',
            startDate: event.startDate || event.startAt,
            coverImage: event.image || event.poster || event.posterUrl,
          })),
        });
        if (followResult.status === 'fulfilled') {
          const follow: any = followResult.value;
          setFollowing(Boolean(follow?.data?.isFollowing ?? follow?.isFollowing));
        } else {
          setError('Host loaded, but follow status could not be refreshed.');
        }
      })
      .catch((cause) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Unable to load this host.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [visible, hostId, hostName, reloadNonce]);

  const displayName = host?.name ?? hostName;
  const followerCount = host?.followerCount ?? 0;
  const eventsHosted = host?.eventsHosted ?? 0;

  const handleFollow = async () => {
    if (!hostId || followBusy) return;
    const previous = following;
    setFollowBusy(true);
    setError(null);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFollowing(!previous);
    try {
      if (previous) {
        await apiFetch(`/api/v1/follow?targetId=${encodeURIComponent(hostId)}&targetType=host`, {
          method: 'DELETE',
        });
      } else {
        await apiFetch('/api/v1/follow', {
          method: 'POST',
          body: JSON.stringify({ targetId: hostId, targetType: 'host' }),
        });
      }
    } catch (cause) {
      setFollowing(previous);
      setError(cause instanceof Error ? cause.message : 'Unable to update follow status.');
    } finally {
      setFollowBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.headerBtn}>
              <Text style={styles.headerBtnText}>Done</Text>
            </Pressable>
            <View style={styles.headerHandle} />
            <View style={{ width: 56 }} />
          </View>

          <ScrollView
            bounces={false}
            overScrollMode="never"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            {/* Cover + Avatar hero */}
            <Animated.View entering={FadeInDown} style={styles.hero}>
              {host?.coverImage ? (
                <Image
                  source={{ uri: host.coverImage }}
                  style={styles.coverImage}
                  contentFit="cover"
                />
              ) : (
                <LinearGradient
                  colors={['rgba(244,74,34,0.3)', 'rgba(22,22,22,0)']}
                  style={styles.coverImage}
                />
              )}

              {/* Avatar */}
              <View style={styles.avatarWrapper}>
                {(host?.photoURL ?? hostAvatar) ? (
                  <Image
                    source={{ uri: host?.photoURL ?? hostAvatar }}
                    style={styles.avatar}
                    contentFit="cover"
                  />
                ) : (
                  <LinearGradient
                    colors={gradients.primary as [string, string]}
                    style={styles.avatar}
                  >
                    <Text style={styles.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
                  </LinearGradient>
                )}
              </View>
            </Animated.View>

            {/* Name + verified */}
            <Animated.View entering={FadeInDown.delay(80)} style={styles.nameRow}>
              <View style={styles.nameBlock}>
                <Text style={styles.hostName}>{displayName}</Text>
                {(host?.isVerified ?? true) && (
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedText}>✓ Verified</Text>
                  </View>
                )}
              </View>
              <Pressable
                onPress={handleFollow}
                disabled={!hostId || followBusy}
                style={[styles.followBtn, following && styles.followBtnActive]}
              >
                <Text style={[styles.followBtnText, following && styles.followBtnTextActive]}>
                  {followBusy ? 'Saving…' : following ? 'Following' : 'Follow'}
                </Text>
              </Pressable>
            </Animated.View>

            {loading ? <ActivityIndicator color={colors.iris} style={styles.feedback} /> : null}
            {error ? (
              <View style={styles.feedback}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable onPress={() => setReloadNonce((value) => value + 1)}>
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
            ) : null}

            {/* Stats */}
            <Animated.View entering={FadeInDown.delay(100)} style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{eventsHosted}</Text>
                <Text style={styles.statLabel}>Events</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>
                  {followerCount > 999 ? `${(followerCount / 1000).toFixed(1)}k` : followerCount}
                </Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              {host?.city && (
                <>
                  <View style={styles.statDivider} />
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>{host.city}</Text>
                    <Text style={styles.statLabel}>City</Text>
                  </View>
                </>
              )}
            </Animated.View>

            {/* Bio */}
            {host?.bio && (
              <Animated.View entering={FadeInDown.delay(120)} style={styles.section}>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.bioText}>{host.bio}</Text>
              </Animated.View>
            )}

            {/* Upcoming events */}
            {(host?.upcomingEvents?.length ?? 0) > 0 && (
              <Animated.View entering={FadeInDown.delay(160)} style={styles.section}>
                <Text style={styles.sectionTitle}>Upcoming Events</Text>
                {host!.upcomingEvents!.map((ev) => (
                  <View key={ev.id} style={styles.eventRow}>
                    {ev.coverImage ? (
                      <Image
                        source={{ uri: ev.coverImage }}
                        style={styles.eventThumb}
                        contentFit="cover"
                      />
                    ) : (
                      <LinearGradient colors={['#2a1a0e', '#161616']} style={styles.eventThumb} />
                    )}
                    <View style={styles.eventInfo}>
                      <Text style={styles.eventTitle} numberOfLines={1}>
                        {ev.title}
                      </Text>
                      {ev.startDate && (
                        <Text style={styles.eventDate}>
                          {safeDate(ev.startDate)?.toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                          }) ?? ''}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </Animated.View>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerBtn: {
    minWidth: 56,
    alignItems: 'flex-end',
  },
  headerBtnText: {
    color: colors.iris,
    fontSize: 16,
    fontWeight: '600',
  },
  headerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  content: {
    paddingBottom: 60,
  },
  hero: {
    height: 180,
    position: 'relative',
    marginBottom: 56,
  },
  coverImage: {
    width: '100%',
    height: 140,
  },
  avatarWrapper: {
    position: 'absolute',
    bottom: -44,
    left: 20,
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: colors.base.DEFAULT,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  nameBlock: {
    flex: 1,
    gap: 6,
  },
  hostName: {
    color: colors.gold,
    fontSize: 22,
    fontWeight: '800',
  },
  verifiedBadge: {
    backgroundColor: 'rgba(244,74,34,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(244,74,34,0.2)',
  },
  verifiedText: {
    color: colors.iris,
    fontSize: 11,
    fontWeight: '700',
  },
  followBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.iris,
  },
  followBtnActive: {
    backgroundColor: 'rgba(244,74,34,0.15)',
  },
  followBtnText: {
    color: colors.iris,
    fontSize: 14,
    fontWeight: '700',
  },
  followBtnTextActive: {
    color: colors.iris,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.base[50],
    marginHorizontal: 20,
    borderRadius: radii.xl,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  feedback: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  errorText: {
    color: '#ff8a70',
    fontSize: 13,
    lineHeight: 18,
  },
  retryText: {
    color: colors.iris,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: colors.gold,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  statLabel: {
    color: colors.goldMetallic,
    fontSize: 11,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    color: colors.goldMetallic,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  bioText: {
    color: colors.gold,
    fontSize: 15,
    lineHeight: 22,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.base[50],
    borderRadius: radii.xl,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  eventThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    marginRight: 12,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  eventDate: {
    color: colors.goldMetallic,
    fontSize: 12,
  },
});
