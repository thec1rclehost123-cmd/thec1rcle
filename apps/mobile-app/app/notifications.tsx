/**
 * Notifications Screen
 * Activity center showing all app-wide notifications
 */

import { useEffect, useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Bell } from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  SlideOutRight,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  Layout,
} from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/store/authStore';
import {
  useNotificationsStore,
  Notification,
  getNotificationIcon,
  getNotificationDeepLink,
} from '@/store/notificationsStore';
import { ErrorState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { colors, radii } from '@/lib/design/theme';
import { trackScreen } from '@/lib/analytics';
import { formatRelativeTime } from '@/lib/utils/date';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Notification Item Component
function NotificationItem({
  notification,
  index,
  onPress,
  onClear,
}: {
  notification: Notification;
  index: number;
  onPress: () => void;
  onClear: () => void;
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
    onPress();
  };

  const timeAgo = formatRelativeTime(notification.createdAt);
  const icon = getNotificationIcon(notification.type);

  const renderRightActions = () => (
    <Pressable onPress={onClear} style={styles.swipeAction}>
      <Text style={styles.swipeActionText}>Clear</Text>
    </Pressable>
  );

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify()}
      exiting={SlideOutRight.springify()}
      layout={Layout.springify()}
    >
      <View>
        <Swipeable renderRightActions={renderRightActions}>
          <View collapsable={false}>
            <AnimatedPressable
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              onPress={handlePress}
              style={[
                animatedStyle,
                styles.notificationItem,
                !notification.read && styles.notificationUnread,
              ]}
            >
              {/* Icon */}
              <View
                style={[styles.iconContainer, !notification.read && styles.iconContainerUnread]}
              >
                <Text style={styles.icon}>{icon}</Text>
              </View>

              {/* Content */}
              <View style={styles.content}>
                <Text
                  style={[styles.title, !notification.read && styles.titleUnread]}
                  numberOfLines={1}
                >
                  {notification.title}
                </Text>
                <Text style={styles.body} numberOfLines={2}>
                  {notification.body}
                </Text>
                <Text style={styles.time}>{timeAgo}</Text>
              </View>

              {/* Unread indicator */}
              {!notification.read && <View style={styles.unreadDot} />}

              {/* Arrow */}
              <Text style={styles.arrow}>›</Text>
            </AnimatedPressable>
          </View>
        </Swipeable>
      </View>
    </Animated.View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function DittoNotificationEmptyState() {
  return (
    <Animated.View entering={FadeIn.delay(120)} style={styles.emptyState}>
      <Animated.View entering={FadeInDown.delay(180)} style={styles.emptyIllustration}>
        <View style={styles.phoneFrame}>
          {/* Mock Row 1 */}
          <View style={styles.listRow}>
            <View
              style={[
                styles.avatarOrb,
                { borderRadius: 12, backgroundColor: '#8B5CF6', overflow: 'hidden' },
              ]}
            >
              <Image
                source={require('../assets/images/attendees/riya.png')}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            </View>
            <View style={styles.rowCopy}>
              <View style={styles.copyLineWide} />
              <View style={styles.copyLineShort} />
            </View>
          </View>

          {/* Mock Row 2 */}
          <View style={styles.listRow}>
            <View style={[styles.avatarOrb, { borderRadius: 22, backgroundColor: '#F59E0B' }]}>
              <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }}>
                <Image
                  source={require('../assets/images/attendees/sam.png')}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              </View>
            </View>
            <View style={styles.rowCopy}>
              <View style={styles.copyLineWide} />
              <View style={[styles.copyLineShort, { width: '80%' }]} />
            </View>
          </View>

          {/* Mock Row 3 */}
          <View style={styles.listRow}>
            <View
              style={[
                styles.avatarOrb,
                { borderRadius: 22, backgroundColor: '#EAB308', overflow: 'hidden' },
              ]}
            >
              <Image
                source={require('../assets/images/attendees/neil.png')}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            </View>
            <View style={styles.rowCopy}>
              <View style={styles.copyLineWide} />
              <View style={[styles.copyLineShort, { width: '60%' }]} />
            </View>
          </View>

          <LinearGradient
            pointerEvents="none"
            colors={['rgba(10,10,10,0)', 'rgba(0,0,0,1)']}
            style={styles.illustrationFade}
          />
        </View>
      </Animated.View>

      <Animated.Text entering={FadeInDown.delay(260)} style={styles.emptyTitle}>
        No Notifications
      </Animated.Text>
      <Animated.Text entering={FadeInDown.delay(320)} style={styles.emptyBody}>
        Notifications about your events and friends{'\n'}will show up here.
      </Animated.Text>
    </Animated.View>
  );
}

export default function NotificationsScreen() {
  const { user } = useAuthStore();
  const {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    subscribeToNotifications,
    markAsRead,
    markAllAsRead,
    clearNotification,
  } = useNotificationsStore();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  // Hooks must precede any early return to satisfy rules-of-hooks
  useEffect(() => {
    trackScreen('Notifications');
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    fetchNotifications(user.uid);
    const unsubscribe = subscribeToNotifications(user.uid);
    return () => unsubscribe();
  }, [user?.uid]);

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    if (user?.uid) {
      await fetchNotifications(user.uid);
    }
    setRefreshing(false);
  }, [user?.uid]);

  const handleNotificationPress = (notification: Notification) => {
    markAsRead(notification.id);
    const deepLink = getNotificationDeepLink(notification);
    router.push(deepLink as any);
  };

  const handleMarkAllRead = () => {
    if (user?.uid && unreadCount > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      markAllAsRead(user.uid);
    }
  };

  // Group notifications by date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groupedNotifications = {
    today: notifications.filter((n) => n.createdAt >= today),
    yesterday: notifications.filter((n) => n.createdAt >= yesterday && n.createdAt < today),
    earlier: notifications.filter((n) => n.createdAt < yesterday),
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <Animated.View entering={FadeIn} style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/');
              }
            }}
            style={styles.backButton}
          >
            <ChevronLeft size={24} color="#FFFFFF" strokeWidth={2} />
          </Pressable>
        </View>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerRight}>
          {unreadCount > 0 && (
            <Pressable onPress={handleMarkAllRead}>
              <Text style={styles.markAllRead}>Mark all read</Text>
            </Pressable>
          )}
        </View>
      </Animated.View>

      <ScrollView
        bounces={false}
        overScrollMode="never"
        style={styles.scrollView}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.iris} />
        }
      >
        {/* Loading skeleton */}
        {loading && notifications.length === 0 && <SkeletonList count={5} />}

        {/* Error state */}
        {error && !loading && notifications.length === 0 && (
          <ErrorState
            message="Failed to load notifications"
            onRetry={() => user?.uid && fetchNotifications(user.uid)}
          />
        )}

        {/* Unread count badge */}
        {!loading && unreadCount > 0 && (
          <Animated.View entering={FadeInDown} style={styles.unreadBanner}>
            <LinearGradient
              colors={['rgba(244, 74, 34, 0.15)', 'rgba(244, 74, 34, 0.05)']}
              style={styles.unreadBannerGradient}
            >
              <Text style={styles.unreadBannerText}>
                {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
              </Text>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Today */}
        {groupedNotifications.today.length > 0 && (
          <View>
            <SectionHeader title="Today" />
            {groupedNotifications.today.map((notification, index) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                index={index}
                onPress={() => handleNotificationPress(notification)}
                onClear={() => clearNotification(notification.id)}
              />
            ))}
          </View>
        )}

        {/* Yesterday */}
        {groupedNotifications.yesterday.length > 0 && (
          <View>
            <SectionHeader title="Yesterday" />
            {groupedNotifications.yesterday.map((notification, index) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                index={index}
                onPress={() => handleNotificationPress(notification)}
                onClear={() => clearNotification(notification.id)}
              />
            ))}
          </View>
        )}

        {/* Earlier */}
        {groupedNotifications.earlier.length > 0 && (
          <View>
            <SectionHeader title="Earlier" />
            {groupedNotifications.earlier.map((notification, index) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                index={index}
                onPress={() => handleNotificationPress(notification)}
                onClear={() => clearNotification(notification.id)}
              />
            ))}
          </View>
        )}

        {/* Empty State */}
        {!loading && !error && notifications.length === 0 && <DittoNotificationEmptyState />}
      </ScrollView>
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
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerLeft: {
    width: 64,
  },
  headerRight: {
    width: 64,
    alignItems: 'flex-end',
  },
  headerTitle: {
    color: '#F8F8F8',
    fontSize: 20,
    fontWeight: '600',
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  markAllRead: {
    color: colors.iris,
    fontSize: 14,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyIllustration: {
    width: 380,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -40,
    position: 'relative',
  },
  phoneFrame: {
    position: 'absolute',
    bottom: 0,
    width: 220,
    height: 240,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#0A0A0A',
    paddingTop: 32,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  avatarOrb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  copyLineWide: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    width: 60,
  },
  copyLineShort: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    width: 100,
  },
  illustrationFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    zIndex: 10,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyBody: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 40,
  },
  unreadBanner: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  unreadBannerGradient: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(244, 74, 34, 0.2)',
  },
  unreadBannerText: {
    color: colors.iris,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sectionTitle: {
    color: colors.goldMetallic,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionAction: {
    color: colors.iris,
    fontSize: 13,
    fontWeight: '500',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.base[50],
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 16,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  notificationUnread: {
    backgroundColor: 'rgba(244, 74, 34, 0.08)',
    borderColor: 'rgba(244, 74, 34, 0.15)',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconContainerUnread: {
    backgroundColor: 'rgba(244, 74, 34, 0.15)',
  },
  icon: {
    fontSize: 20,
  },
  content: {
    flex: 1,
  },
  title: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  titleUnread: {
    fontWeight: '600',
  },
  body: {
    color: colors.goldMetallic,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  time: {
    color: colors.goldMetallic,
    fontSize: 11,
    opacity: 0.7,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.iris,
    marginRight: 8,
  },
  arrow: {
    color: colors.goldMetallic,
    fontSize: 22,
    fontWeight: '300',
  },
  swipeAction: {
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    marginBottom: 8,
    borderRadius: radii.xl,
    marginLeft: 8,
  },
  swipeActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
