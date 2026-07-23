import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { ArrowLeft, MessageCircle, Heart, Lock, Sparkles } from 'lucide-react-native';
import { Image } from 'expo-image';
import { colors } from '@/lib/design/theme';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useDatingStore, type Match } from '@/store/datingStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { PremiumBadgeDot } from '@/components/ui/PremiumBadge';
import { formatTimeAgo } from '@/lib/social';

type ReceivedLike = {
  id: string;
  profile?: {
    id?: string;
    userId?: string;
    displayName?: string;
    photoURL?: string | null;
  };
};

type LikesSummary = {
  likes: ReceivedLike[];
  total: number;
  visibleCount: number;
  lockedCount: number;
  isPremium: boolean;
};

function WhoLikedMeCard({
  summary,
  onAcceptLike,
}: {
  summary: LikesSummary | null;
  onAcceptLike: (like: ReceivedLike) => void;
}) {
  const openPaywall = useSubscriptionStore((state) => state.openPaywall);
  const lockedCount = summary?.lockedCount ?? 0;
  const total = summary?.total ?? 0;
  const visibleLike = summary?.likes?.[0];
  const locked = summary ? !summary.isPremium && lockedCount > 0 : true;

  const handlePress = () => {
    if (locked) {
      openPaywall('whoLikedMe');
    }
  };

  return (
    <Pressable style={styles.likesCard} onPress={handlePress}>
      <View style={styles.likesTopRow}>
        <View style={styles.likesIconWrap}>
          {visibleLike?.profile?.photoURL && !locked ? (
            <Image source={{ uri: visibleLike.profile.photoURL }} style={styles.likesAvatar} />
          ) : (
            <Heart size={22} color="#F6C55B" fill="#F6C55B" />
          )}
          {locked ? (
            <BlurView
              blurMethod="dimezisBlurView"
              intensity={34}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : null}
        </View>
        <View style={styles.likesCopy}>
          <View style={styles.likesTitleRow}>
            <Text style={styles.likesTitle}>Who liked me</Text>
            {locked ? <Lock size={14} color="#F6C55B" strokeWidth={2.4} /> : null}
          </View>
          <Text style={styles.likesBody}>
            {locked
              ? `${(lockedCount ?? 0) > 0 ? lockedCount : (total ?? 0) > 0 ? total : 'New'} hidden ${lockedCount === 1 ? 'like' : 'likes'}`
              : total > 0
                ? `${total} ${total === 1 ? 'person likes' : 'people like'} you`
                : 'No incoming likes yet'}
          </Text>
        </View>
        {locked ? (
          <View style={styles.likesCta}>
            <Sparkles size={13} color="#2B1600" />
            <Text style={styles.likesCtaText}>Premium</Text>
          </View>
        ) : null}
      </View>
      {!locked && summary?.likes?.length ? (
        <View style={styles.visibleLikes}>
          {summary.likes.slice(0, 3).map((like) => (
            <View key={like.id} style={styles.visibleLikeRow}>
              {like.profile?.photoURL ? (
                <Image source={{ uri: like.profile.photoURL }} style={styles.visibleLikeAvatar} />
              ) : (
                <View style={styles.visibleLikeAvatarFallback}>
                  <Heart size={14} color="#F6C55B" fill="#F6C55B" />
                </View>
              )}
              <Text style={styles.visibleLikeName} numberOfLines={1}>
                {like.profile?.displayName || 'C1RCLE member'}
              </Text>
              <Pressable style={styles.matchNowButton} onPress={() => onAcceptLike(like)}>
                <Heart size={14} color="#fff" fill="#fff" />
                <Text style={styles.matchNowText}>Accept</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

function MatchCard({ match }: { match: Match }) {
  const initials = match.displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleMessage = () => {
    if (match.conversationId) {
      router.push(`/social/dm/${match.conversationId}` as any);
    } else {
      // No DM yet — navigate to their profile to initiate
      router.push(`/social/profile/${match.otherUserId}` as any);
    }
  };

  return (
    <Pressable style={styles.matchCard} onPress={handleMessage}>
      {/* Avatar */}
      <View style={styles.avatarWrap}>
        {match.photoURL ? (
          <Image
            source={typeof match.photoURL === 'string' ? { uri: match.photoURL } : match.photoURL}
            style={styles.avatar}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.matchInfo}>
        <View style={styles.matchNameRow}>
          <Text style={styles.matchName}>{match.displayName}</Text>
          <PremiumBadgeDot visible={match.isPremium === true} />
        </View>
        <Text style={styles.matchEvent} numberOfLines={1}>
          🎟 {match.sharedEventTitle}
        </Text>
        <Text style={styles.matchTime}>Matched {formatTimeAgo(new Date(match.matchedAt))}</Text>
      </View>

      {/* Message button */}
      <Pressable style={styles.msgBtn} onPress={handleMessage}>
        <MessageCircle size={18} color={colors.iris} strokeWidth={2} />
      </Pressable>
    </Pressable>
  );
}

export default function MatchesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { ownerUserId, matchesOwnerUserId, matches, matchesLoading, fetchMatches } =
    useDatingStore();
  const currentUserId = user?.uid?.trim() || null;
  const ownsCurrentMatches =
    currentUserId !== null && ownerUserId === currentUserId && matchesOwnerUserId === currentUserId;
  const scopedMatches = ownsCurrentMatches
    ? matches.filter((match) => match.otherUserId !== currentUserId)
    : [];
  const openPaywall = useSubscriptionStore((state) => state.openPaywall);
  const [likesSummary, setLikesSummary] = useState<LikesSummary | null>(null);
  const [likesOwnerUserId, setLikesOwnerUserId] = useState<string | null>(null);
  const scopedLikesSummary =
    currentUserId && likesOwnerUserId === currentUserId ? likesSummary : null;
  const fetchMatchesRef = useRef(fetchMatches);
  fetchMatchesRef.current = fetchMatches;
  const renderMatch = useCallback(({ item }: { item: Match }) => <MatchCard match={item} />, []);

  const handleAcceptLike = useCallback(
    async (like: ReceivedLike) => {
      const targetUserId = like.profile?.userId || like.profile?.id;
      if (
        !like.id ||
        !currentUserId ||
        likesOwnerUserId !== currentUserId ||
        targetUserId === currentUserId
      ) {
        return;
      }
      try {
        await apiFetch(`/api/v1/social/likes/${encodeURIComponent(like.id)}/respond`, {
          method: 'POST',
          body: JSON.stringify({ action: 'accept' }),
        });
        setLikesSummary((current) =>
          current
            ? {
                ...current,
                likes: current.likes.filter((entry) => entry.id !== like.id),
                visibleCount: Math.max(0, current.visibleCount - 1),
                total: Math.max(0, current.total - 1),
              }
            : current,
        );
        void fetchMatches(currentUserId);
      } catch (error: any) {
        if (error.code === 'PREMIUM_REQUIRED') {
          openPaywall('whoLikedMe', error.message);
        } else {
          console.error('[MatchesScreen] accept like:', error);
        }
      }
    },
    [currentUserId, fetchMatches, likesOwnerUserId, openPaywall],
  );

  useEffect(() => {
    if (currentUserId) {
      fetchMatchesRef.current(currentUserId).catch((e: any) => {
        console.error('[MatchesScreen] fetchMatches failed:', e);
      });
    }
  }, [currentUserId]);

  useEffect(() => {
    setLikesSummary(null);
    setLikesOwnerUserId(null);
    if (!currentUserId) return;
    let active = true;
    apiFetch<{ data?: LikesSummary; likes?: ReceivedLike[]; total?: number }>(
      '/api/v1/social/likes/received',
    )
      .then((response: any) => {
        if (!active) return;
        setLikesSummary(response.data || response);
        setLikesOwnerUserId(currentUserId);
      })
      .catch(() => {
        if (active) setLikesSummary(null);
      });
    return () => {
      active = false;
    };
  }, [currentUserId]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Your Matches</Text>
        <View style={{ width: 38 }} />
      </View>

      {currentUserId && (!ownsCurrentMatches || matchesLoading) ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.iris} size="large" />
        </View>
      ) : (
        <FlatList
          bounces={false}
          overScrollMode="never"
          data={scopedMatches}
          keyExtractor={(item) => item.id}
          renderItem={renderMatch}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              <WhoLikedMeCard summary={scopedLikesSummary} onAcceptLike={handleAcceptLike} />
              <Text style={styles.matchCount}>
                {scopedMatches.length} {scopedMatches.length === 1 ? 'match' : 'matches'}
              </Text>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyList}>
              <View style={styles.emptyIconWrap}>
                <Heart size={36} color={colors.iris} />
              </View>
              <Text style={styles.emptyTitle}>No nightlife matches yet</Text>
              <Text style={styles.emptyBody}>
                When you and someone both like each other, you'll see them here.
              </Text>
              <Pressable style={styles.discoverBtn} onPress={() => router.back()}>
                <Text style={styles.discoverBtnText}>Start Exploring</Text>
              </Pressable>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(244,74,34,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  emptyBody: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  discoverBtn: {
    backgroundColor: colors.iris,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 24,
  },
  discoverBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 12,
  },
  matchCount: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarFallback: {
    backgroundColor: 'rgba(244,74,34,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: colors.iris,
    fontSize: 20,
    fontWeight: '700',
  },
  matchInfo: {
    flex: 1,
    gap: 3,
  },
  matchNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  matchName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  matchEvent: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
  },
  matchTime: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
  },
  msgBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(244,74,34,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244,74,34,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyList: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 58,
  },
  likesCard: {
    gap: 12,
    borderRadius: 8,
    padding: 13,
    marginBottom: 14,
    backgroundColor: 'rgba(246,197,91,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(246,197,91,0.2)',
  },
  likesTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  likesIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(246,197,91,0.16)',
  },
  likesAvatar: {
    width: '100%',
    height: '100%',
  },
  likesCopy: {
    flex: 1,
  },
  likesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  likesTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  likesBody: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  likesCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 7,
    backgroundColor: '#F6C55B',
  },
  likesCtaText: {
    color: '#2B1600',
    fontSize: 11,
    fontWeight: '900',
  },
  visibleLikes: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(246,197,91,0.16)',
    paddingTop: 10,
  },
  visibleLikeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  visibleLikeAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  visibleLikeAvatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(246,197,91,0.12)',
  },
  visibleLikeName: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  matchNowButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.iris,
  },
  matchNowText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
});
