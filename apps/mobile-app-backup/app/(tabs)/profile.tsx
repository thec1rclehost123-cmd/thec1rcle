import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Switch,
  StyleSheet,
  Dimensions,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { useTicketsStore } from '@/store/ticketsStore';
import { useSocialProfileStore } from '@/store/socialProfileStore';
import { registerPushToken } from '@/lib/notifications';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, radii, gradients } from '@/lib/design/theme';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { safeDate } from '@/lib/utils/date';
import { trackScreen } from '@/lib/analytics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Premium Menu Item
function MenuItem({
  icon,
  label,
  sublabel,
  onPress,
  rightElement,
  danger = false,
  delay = 0,
}: {
  icon: string;
  label: string;
  sublabel?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  danger?: boolean;
  delay?: number;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  return (
    <Animated.View entering={FadeInDown.delay(delay).springify().damping(15)} style={animatedStyle}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={styles.menuItem}
      >
        <View style={styles.menuItemIcon}>
          <Text style={styles.menuItemIconText}>{icon}</Text>
        </View>
        <View style={styles.menuItemContent}>
          <Text style={[styles.menuItemLabel, danger && styles.menuItemLabelDanger]}>{label}</Text>
          {sublabel && <Text style={styles.menuItemSublabel}>{sublabel}</Text>}
        </View>
        {rightElement || <Text style={styles.menuItemArrow}>›</Text>}
      </Pressable>
    </Animated.View>
  );
}

// Stats Card
function StatsCard({
  value,
  label,
  accent = false,
  delay = 0,
}: {
  value: number;
  label: string;
  accent?: boolean;
  delay?: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.statCard}>
      <Text style={[styles.statValue, accent && styles.statValueAccent]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

// Section Header
function SectionHeader({ title, delay = 0 }: { title: string; delay?: number }) {
  return (
    <Animated.Text entering={FadeIn.delay(delay)} style={styles.sectionHeader}>
      {title}
    </Animated.Text>
  );
}

export default function ProfileScreen() {
  const { user } = useAuthStore();
  const { signOut, loading: authLoading } = useAuth();
  const { orders, fetchUserOrders } = useTicketsStore();
  const { socialState, loadSocialProfile } = useSocialProfileStore();
  const profile = useProfileStore((state) => state.profile);
  const profileLoading = useProfileStore((state) => state.loading);
  const loadProfile = useProfileStore((state) => state.loadProfile);
  const subscribeToProfile = useProfileStore((state) => state.subscribeToProfile);
  const insets = useSafeAreaInsets();

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  // Avatar animation
  const avatarScale = useSharedValue(1);
  const avatarGlow = useSharedValue(0);

  useEffect(() => {
    trackScreen('Profile');
    // Subtle pulse animation for avatar
    avatarGlow.value = withRepeat(withTiming(1, { duration: 2000 }), -1, true);
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setNotificationsEnabled(false);
      return;
    }

    let isMounted = true;

    const syncScreenState = async () => {
      await Promise.allSettled([
        fetchUserOrders(user.uid),
        loadProfile(user.uid),
        loadSocialProfile(user.uid),
      ]);

      const permissions = await Notifications.getPermissionsAsync();
      if (!isMounted) return;

      setNotificationsEnabled(
        permissions.granted ||
          permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL,
      );
    };

    void syncScreenState();

    const unsubscribe = subscribeToProfile(user.uid);

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [user?.uid, fetchUserOrders, loadProfile, subscribeToProfile]);

  const avatarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: avatarScale.value }],
  }));

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const promptNotificationSettings = () => {
    Alert.alert(
      'Manage Notifications',
      'Notification permissions are controlled in your device settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            void Linking.openSettings();
          },
        },
      ],
    );
  };

  const toggleNotifications = async (nextValue: boolean) => {
    if (!user?.uid) return;

    if (!nextValue) {
      promptNotificationSettings();
      return;
    }

    setLoadingNotifs(true);
    const success = await registerPushToken(user.uid);
    const permissions = await Notifications.getPermissionsAsync();
    setNotificationsEnabled(
      success &&
        (permissions.granted ||
          permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL),
    );
    setLoadingNotifs(false);

    if (!success) {
      promptNotificationSettings();
    }
  };

  const nowMs = Date.now();
  const thisYear = new Date().getFullYear();
  const pastOrders = [...orders]
    .filter((o) => o.eventDate && (safeDate(o.eventDate)?.getTime() ?? 0) < nowMs)
    .sort(
      (a, b) => (safeDate(b.eventDate)?.getTime() ?? 0) - (safeDate(a.eventDate)?.getTime() ?? 0),
    );
  const upcomingEvents = orders.filter(
    (o) => o.eventDate && (safeDate(o.eventDate)?.getTime() ?? 0) > nowMs,
  ).length;
  const thisYearEvents = orders.filter((o) => {
    const d = safeDate(o.eventDate);
    return d && d.getFullYear() === thisYear && d.getTime() < nowMs;
  }).length;

  // Activity feed — past events newest first, 3 shown by default
  const [storyExpanded, setStoryExpanded] = useState(false);
  const storyItems = storyExpanded ? pastOrders : pastOrders.slice(0, 3);
  const displayName = profile?.displayName?.trim() || user?.displayName || 'Party Enthusiast';
  const displayEmail = profile?.email || user?.email || 'No email connected';
  const displayPhoto = profile?.photoURL || user?.photoURL || '';
  const displayCity = profile?.city?.trim() || '';
  const displayBio = profile?.bio?.trim() || '';
  const connectionsCount = profile?.connections ?? 0;

  // Get initials
  const initials = displayName
    ? displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Background gradient */}
      <LinearGradient
        colors={['rgba(244, 74, 34, 0.15)', 'transparent']}
        style={styles.backgroundGradient}
      />

      {/* Top Actions */}
      <Animated.View
        entering={FadeIn}
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 8,
          gap: 8,
        }}
      >
        <NotificationBell variant="solid" />
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/settings');
          }}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.base[50],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 20 }}>⚙️</Text>
        </Pressable>
      </Animated.View>

      <ScrollView
        bounces={false}
        overScrollMode="never"
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Profile Header */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.profileHeader}>
          {/* Avatar */}
          <Animated.View style={[styles.avatarContainer, avatarAnimatedStyle]}>
            <Pressable onPress={() => router.push('/profile/edit')}>
              <LinearGradient
                colors={gradients.primary as [string, string]}
                style={styles.avatarGradient}
              >
                {displayPhoto ? (
                  <Image
                    source={{ uri: displayPhoto }}
                    style={styles.avatarPhoto}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.avatarInner}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                )}
              </LinearGradient>

              {/* Edit badge */}
              <View style={styles.avatarEditBadge}>
                <Text style={styles.avatarEditIcon}>✏️</Text>
              </View>
            </Pressable>
          </Animated.View>

          {/* User Info */}
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userEmail}>{displayEmail}</Text>
          {(displayCity || displayBio || profileLoading) && (
            <Text style={styles.userMeta}>
              {profileLoading && !displayCity && !displayBio
                ? 'Syncing your profile...'
                : [displayCity, displayBio].filter(Boolean).join(' • ')}
            </Text>
          )}

          {/* Member badge */}
          <View style={styles.memberBadge}>
            <LinearGradient
              colors={['rgba(244, 74, 34, 0.15)', 'rgba(244, 74, 34, 0.05)']}
              style={styles.memberBadgeGradient}
            >
              <Text style={styles.memberBadgeText}>✨ C1RCLE MEMBER</Text>
            </LinearGradient>
          </View>
        </Animated.View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatsCard value={pastOrders.length} label="Attended" delay={200} />
          <View style={styles.statsDivider} />
          <StatsCard value={thisYearEvents} label="This Year" accent delay={240} />
          <View style={styles.statsDivider} />
          <StatsCard value={connectionsCount} label="Friends" delay={280} />
          <View style={styles.statsDivider} />
          <StatsCard value={upcomingEvents} label="Upcoming" delay={320} />
        </View>

        {/* Social Profile Card */}
        <Animated.View
          entering={FadeInDown.delay(360).springify().damping(15)}
          style={styles.socialCard}
        >
          <View style={styles.socialCardLeft}>
            <View
              style={[
                styles.socialDot,
                socialState === 'verified' && styles.socialDotVerified,
                socialState === 'complete' && styles.socialDotComplete,
              ]}
            />
            <View style={styles.socialCardText}>
              <Text style={styles.socialCardTitle}>
                {socialState === 'verified'
                  ? '✅ Social Profile — Verified'
                  : socialState === 'complete'
                    ? 'Social Profile — Active'
                    : 'Set Up Social Profile'}
              </Text>
              <Text style={styles.socialCardSub}>
                {socialState === 'verified'
                  ? 'Dating, messaging & event likes unlocked'
                  : socialState === 'complete'
                    ? 'Verify your profile to unlock dating & chat'
                    : 'Unlock event likes, dating & connections'}
              </Text>
            </View>
          </View>
          <Pressable
            style={styles.socialCardBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (socialState === 'complete') {
                router.push('/verification' as any);
              } else {
                router.push('/social-setup' as any);
              }
            }}
          >
            <Text style={styles.socialCardBtnText}>
              {socialState === 'verified'
                ? 'Edit'
                : socialState === 'complete'
                  ? 'Verify'
                  : 'Setup'}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Your Story — activity feed */}
        {pastOrders.length > 0 && (
          <View style={styles.storySection}>
            <View style={styles.storySectionHeader}>
              <Text style={styles.storySectionTitle}>YOUR STORY</Text>
              {pastOrders.length > 3 && (
                <Pressable onPress={() => setStoryExpanded((v) => !v)}>
                  <Text style={styles.storyShowAll}>
                    {storyExpanded ? 'Show less' : `Show all ${pastOrders.length}`}
                  </Text>
                </Pressable>
              )}
            </View>
            {storyItems.map((order, i) => (
              <Animated.View
                key={order.id}
                entering={FadeInDown.delay(i * 40).springify()}
                style={styles.storyItem}
              >
                {order.eventCoverImage ? (
                  <Image
                    source={{ uri: order.eventCoverImage }}
                    style={styles.storyThumb}
                    contentFit="cover"
                  />
                ) : (
                  <LinearGradient colors={['#2a1a0e', '#161616']} style={styles.storyThumb} />
                )}
                <View style={styles.storyContent}>
                  <Text style={styles.storyEventTitle} numberOfLines={1}>
                    {order.eventTitle || 'Event'}
                  </Text>
                  <Text style={styles.storyEventDate}>
                    {safeDate(order.eventDate)?.toLocaleDateString('en-IN', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    }) ?? ''}
                  </Text>
                </View>
                <View style={styles.storyBadge}>
                  <Text style={styles.storyBadgeText}>Attended</Text>
                </View>
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
  },
  scrollView: {
    flex: 1,
  },

  // Profile Header
  profileHeader: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatarGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    padding: 3,
  },
  avatarInner: {
    flex: 1,
    backgroundColor: colors.base.DEFAULT,
    borderRadius: 47,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.iris,
    fontSize: 36,
    fontWeight: '800',
  },
  avatarPhoto: {
    width: 94,
    height: 94,
    borderRadius: 47,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.base[50],
    borderWidth: 3,
    borderColor: colors.base.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditIcon: {
    fontSize: 14,
  },
  userName: {
    color: colors.gold,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 4,
  },
  userEmail: {
    color: colors.goldMetallic,
    fontSize: 15,
    marginBottom: 6,
  },
  userMeta: {
    color: colors.goldMetallic,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  memberBadge: {},
  memberBadgeGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(244, 74, 34, 0.2)',
  },
  memberBadgeText: {
    color: colors.iris,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.base[50],
    marginHorizontal: 20,
    borderRadius: radii.xl,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: colors.gold,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  statValueAccent: {
    color: colors.iris,
  },
  statLabel: {
    color: colors.goldMetallic,
    fontSize: 12,
  },
  statsDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },

  // Your Story activity feed
  storySection: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  storySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  storySectionTitle: {
    color: colors.goldMetallic,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  storyShowAll: {
    color: colors.iris,
    fontSize: 13,
    fontWeight: '500',
  },
  storyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.base[50],
    borderRadius: radii.xl,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  storyThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    marginRight: 12,
  },
  storyContent: {
    flex: 1,
  },
  storyEventTitle: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  storyEventDate: {
    color: colors.goldMetallic,
    fontSize: 12,
  },
  storyBadge: {
    backgroundColor: 'rgba(244,74,34,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(244,74,34,0.2)',
  },
  storyBadgeText: {
    color: colors.iris,
    fontSize: 11,
    fontWeight: '600',
  },

  // Menu
  // Social Profile Card
  socialCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: 'rgba(244,74,34,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(244,74,34,0.18)',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  socialCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  socialDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    flexShrink: 0,
  },
  socialDotComplete: {
    backgroundColor: '#FFAA00',
  },
  socialDotVerified: {
    backgroundColor: colors.success,
  },
  socialCardText: { flex: 1 },
  socialCardTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  socialCardSub: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    lineHeight: 15,
  },
  socialCardBtn: {
    backgroundColor: colors.iris,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  socialCardBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  menuContainer: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    color: colors.goldMetallic,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 8,
  },
  menuSection: {
    backgroundColor: colors.base[50],
    borderRadius: radii.xl,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuItemIconText: {
    fontSize: 18,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemLabel: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: '500',
  },
  menuItemLabelDanger: {
    color: colors.error,
  },
  menuItemSublabel: {
    color: colors.goldMetallic,
    fontSize: 13,
    marginTop: 2,
  },
  menuItemArrow: {
    color: colors.goldMetallic,
    fontSize: 24,
    fontWeight: '300',
  },
  menuItemArrowDanger: {
    color: colors.error,
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginLeft: 70,
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
  },
  footerLogo: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  footerLogoText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  footerText: {
    color: colors.goldMetallic,
    fontSize: 13,
    marginBottom: 4,
  },
  footerSubtext: {
    color: colors.goldMetallic,
    fontSize: 12,
    opacity: 0.6,
  },
});
