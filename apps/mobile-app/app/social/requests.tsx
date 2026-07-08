import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import {
  getPendingDMRequests,
  acceptDMRequest,
  declineDMRequest,
  PrivateConversation,
} from '@/lib/social';
import { apiFetch } from '@/lib/api';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, radii, spacing, typography } from '@/lib/design/theme';

// Request card
function RequestCard({
  request,
  senderName,
  eventTitle,
  onAccept,
  onDecline,
  isLoading,
  index,
}: {
  request: PrivateConversation;
  senderName: string;
  eventTitle: string;
  onAccept: () => void;
  onDecline: () => void;
  isLoading: boolean;
  index: number;
}) {
  const timeAgo =
    request.createdAt && typeof request.createdAt === 'string'
      ? formatTimeAgo(new Date(request.createdAt))
      : '';

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          {/* Avatar */}
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>👤</Text>
          </View>

          {/* Info */}
          <View style={styles.infoContainer}>
            <Text style={styles.senderName}>{senderName}</Text>
            <Text style={styles.metaText}>
              from {eventTitle} • {timeAgo}
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionsContainer}>
          <Pressable
            onPress={onDecline}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.declineButton,
              pressed && styles.buttonPressed,
              isLoading && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.declineText}>Decline</Text>
          </Pressable>
          <Pressable
            onPress={onAccept}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.acceptButton,
              pressed && styles.buttonPressed,
              isLoading && styles.buttonDisabled,
            ]}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.acceptText}>Accept</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function DMRequestsScreen() {
  const { user } = useAuthStore();

  const [requests, setRequests] = useState<
    Array<{
      request: PrivateConversation;
      senderName: string;
      eventTitle: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, [user?.uid]);

  const loadRequests = async () => {
    if (!user?.uid) return;
    setLoading(true);

    try {
      const pendingRequests = await getPendingDMRequests(user.uid);

      const enrichedRequests = await Promise.all(
        pendingRequests.map(async (request) => {
          const senderId = request.initiatedBy;
          try {
            const [sender, event] = await Promise.all([
              apiFetch<any>(`/api/v1/profiles/${senderId}`, { requireAuth: false }),
              request.eventId
                ? apiFetch<any>(`/api/v1/events/${request.eventId}`, { requireAuth: false })
                : Promise.resolve({ title: 'Event' }),
            ]);
            return {
              request,
              senderName: sender?.displayName || 'Guest',
              eventTitle: event?.title || 'Event',
            };
          } catch (e) {
            return { request, senderName: 'Guest', eventTitle: 'Event' };
          }
        }),
      );
      setRequests(enrichedRequests);
    } catch (error) {
      console.error('Error loading requests:', error);
      setError('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (request: PrivateConversation) => {
    if (!user?.uid) return;
    setActionLoading(request.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result = await acceptDMRequest(request.id, user.uid);
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRequests((prev) => prev.filter((r) => r.request.id !== request.id));
      router.push({
        pathname: '/social/dm/[id]',
        params: { id: request.id },
      } as any);
    } else {
      Alert.alert('Error', result.error || 'Failed to accept request');
    }
    setActionLoading(null);
  };

  const handleDecline = async (request: PrivateConversation) => {
    if (!user?.uid) return;

    Alert.alert('Decline Request', "This person won't be able to message you for this event.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          await declineDMRequest(request.id, user.uid);
          setRequests((prev) => prev.filter((r) => r.request.id !== request.id));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Message Requests</Text>
          <Text style={styles.headerSubtitle}>{requests.length} pending</Text>
        </View>
      </View>

      <ScrollView
        bounces={false}
        overScrollMode="never"
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading && (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.iris} />
            <Text style={styles.loadingText}>Loading requests...</Text>
          </View>
        )}

        {error && (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyEmoji}>⚠️</Text>
            <Text style={styles.emptyTitle}>Couldn't load requests</Text>
            <Text style={styles.emptyText}>{error}</Text>
            <Pressable
              onPress={() => {
                setError(null);
                loadRequests();
              }}
              style={{
                backgroundColor: colors.iris,
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 24,
                marginTop: 16,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>Retry</Text>
            </Pressable>
          </View>
        )}

        {!loading && !error && requests.length === 0 && (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyTitle}>No Requests</Text>
            <Text style={styles.emptyText}>You don't have any pending message requests</Text>
          </View>
        )}

        {!loading &&
          !error &&
          requests.map(({ request, senderName, eventTitle }, index) => (
            <RequestCard
              key={request.id}
              request={request}
              senderName={senderName}
              eventTitle={eventTitle}
              onAccept={() => handleAccept(request)}
              onDecline={() => handleDecline(request)}
              isLoading={actionLoading === request.id}
              index={index}
            />
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    marginRight: spacing.base,
  },
  backButtonText: {
    color: colors.gold,
    fontSize: typography.fontSize.lg,
  },
  headerTitle: {
    color: colors.gold,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: colors.goldStone,
    fontSize: typography.fontSize.sm,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: spacing.base,
  },
  scrollContent: {
    paddingVertical: spacing.base,
  },
  centerContainer: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  loadingText: {
    color: colors.goldStone,
    marginTop: spacing.base,
  },
  emptyEmoji: {
    fontSize: 60,
    marginBottom: spacing.base,
  },
  emptyTitle: {
    color: colors.gold,
    fontWeight: '600',
    fontSize: typography.fontSize.lg,
    marginBottom: spacing.xs,
  },
  emptyText: {
    color: colors.goldStone,
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: radii.xl,
    padding: spacing.base,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.base,
  },
  avatarEmoji: {
    fontSize: 24,
  },
  infoContainer: {
    flex: 1,
  },
  senderName: {
    color: colors.gold,
    fontWeight: '600',
    fontSize: typography.fontSize.base,
  },
  metaText: {
    color: colors.goldStone,
    fontSize: typography.fontSize.sm,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  declineButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    alignItems: 'center',
  },
  declineText: {
    color: colors.goldStone,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: colors.iris,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    alignItems: 'center',
  },
  acceptText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
