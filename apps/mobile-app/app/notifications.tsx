/**
 * Notifications Screen
 * Activity center showing all app-wide notifications
 */

import { useEffect, useCallback, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    RefreshControl,
    StyleSheet,
    Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
    FadeIn,
    FadeInDown,
    FadeOut,
    SlideOutRight,
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    Layout,
} from "react-native-reanimated";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "@/store/authStore";
import {
    useNotificationsStore,
    Notification,
    getNotificationIcon,
    getNotificationDeepLink,
} from "@/store/notificationsStore";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { colors, radii, gradients } from "@/lib/design/theme";
import { trackScreen } from "@/lib/analytics";

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

    const timeAgo = getTimeAgo(notification.createdAt);
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
            <Swipeable renderRightActions={renderRightActions}>
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
                    <View style={[
                        styles.iconContainer,
                        !notification.read && styles.iconContainerUnread,
                    ]}>
                        <Text style={styles.icon}>{icon}</Text>
                    </View>

                    {/* Content */}
                    <View style={styles.content}>
                        <Text style={[
                            styles.title,
                            !notification.read && styles.titleUnread,
                        ]} numberOfLines={1}>
                            {notification.title}
                        </Text>
                        <Text style={styles.body} numberOfLines={2}>
                            {notification.body}
                        </Text>
                        <Text style={styles.time}>{timeAgo}</Text>
                    </View>

                    {/* Unread indicator */}
                    {!notification.read && (
                        <View style={styles.unreadDot} />
                    )}

                    {/* Arrow */}
                    <Text style={styles.arrow}>›</Text>
                </AnimatedPressable>
            </Swipeable>
        </Animated.View>
    );
}

// Section header
function SectionHeader({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
    return (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {action && (
                <Pressable onPress={action.onPress}>
                    <Text style={styles.sectionAction}>{action.label}</Text>
                </Pressable>
            )}
        </View>
    );
}

export default function NotificationsScreen() {
    const { user } = useAuthStore();
    const {
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        clearNotification,
    } = useNotificationsStore();
    const insets = useSafeAreaInsets();
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        trackScreen("Notifications");
        if (user?.uid) {
            fetchNotifications(user.uid);
        }
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
        today: notifications.filter(n => n.createdAt >= today),
        yesterday: notifications.filter(n => n.createdAt >= yesterday && n.createdAt < today),
        earlier: notifications.filter(n => n.createdAt < yesterday),
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <Animated.View entering={FadeIn} style={styles.header}>
                <View style={styles.headerLeft}>
                    <Pressable onPress={() => router.back()} style={styles.backButton}>
                        <Text style={styles.backIcon}>←</Text>
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
                style={styles.scrollView}
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.iris}
                    />
                }
            >
                {/* Loading skeleton */}
                {loading && notifications.length === 0 && (
                    <SkeletonList type="notification" count={5} />
                )}

                {/* Unread count badge */}
                {!loading && unreadCount > 0 && (
                    <Animated.View entering={FadeInDown} style={styles.unreadBanner}>
                        <LinearGradient
                            colors={["rgba(244, 74, 34, 0.15)", "rgba(244, 74, 34, 0.05)"]}
                            style={styles.unreadBannerGradient}
                        >
                            <Text style={styles.unreadBannerText}>
                                {unreadCount} unread notification{unreadCount > 1 ? "s" : ""}
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
                {!loading && notifications.length === 0 && (
                    <EmptyState
                        type="no-notifications"
                        actionLabel="Explore Events"
                        onAction={() => router.push("/(tabs)/explore")}
                    />
                )}
            </ScrollView>
        </View>
    );
}

// Helper function
function getTimeAgo(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.base.DEFAULT,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255, 255, 255, 0.06)",
    },
    headerLeft: {
        width: 70,
    },
    headerRight: {
        width: 70,
        alignItems: "flex-end",
    },
    headerTitle: {
        color: colors.gold,
        fontSize: 17,
        fontWeight: "600",
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.base[50],
        alignItems: "center",
        justifyContent: "center",
    },
    backIcon: {
        color: colors.gold,
        fontSize: 20,
    },
    markAllRead: {
        color: colors.iris,
        fontSize: 14,
        fontWeight: "500",
    },
    scrollView: {
        flex: 1,
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
        borderColor: "rgba(244, 74, 34, 0.2)",
    },
    unreadBannerText: {
        color: colors.iris,
        fontSize: 14,
        fontWeight: "600",
        textAlign: "center",
    },
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 12,
    },
    sectionTitle: {
        color: colors.goldMetallic,
        fontSize: 13,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    sectionAction: {
        color: colors.iris,
        fontSize: 13,
        fontWeight: "500",
    },
    notificationItem: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.base[50],
        marginHorizontal: 20,
        marginBottom: 8,
        padding: 16,
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
    },
    notificationUnread: {
        backgroundColor: "rgba(244, 74, 34, 0.08)",
        borderColor: "rgba(244, 74, 34, 0.15)",
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: "rgba(255, 255, 255, 0.06)",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
    },
    iconContainerUnread: {
        backgroundColor: "rgba(244, 74, 34, 0.15)",
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
        fontWeight: "500",
        marginBottom: 4,
    },
    titleUnread: {
        fontWeight: "600",
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
        fontWeight: "300",
    },
    swipeAction: {
        backgroundColor: colors.error,
        justifyContent: "center",
        alignItems: "flex-end",
        paddingHorizontal: 20,
        marginBottom: 8,
        borderRadius: radii.xl,
        marginLeft: 8,
    },
    swipeActionText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "600",
    },
});
