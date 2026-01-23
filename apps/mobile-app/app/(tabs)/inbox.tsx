import { useEffect, useState, useCallback } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    RefreshControl,
    ActivityIndicator,
    StyleSheet,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { useTicketsStore } from "@/store/ticketsStore";
import { useEventsStore } from "@/store/eventsStore";
import {
    getEventPhase,
    getPhaseInfo,
    EventPhase,
    getPendingDMRequests,
    getAttendeeCount,
} from "@/lib/social";
import * as Haptics from "expo-haptics";
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInRight,
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from "react-native-reanimated";
import { colors, radii, gradients } from "@/lib/design/theme";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { EmptyState, ErrorState, NetworkError } from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Premium Event Chat Card
function EventChatCard({
    event,
    phase,
    attendeeCount,
    hasUnread,
    index
}: {
    event: {
        id: string;
        title: string;
        date: string;
        coverImage?: string;
    };
    phase: EventPhase;
    attendeeCount: number;
    hasUnread?: boolean;
    index: number;
}) {
    const phaseInfo = getPhaseInfo(phase);
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
        router.push({
            pathname: "/social/group/[eventId]",
            params: { eventId: event.id, eventTitle: event.title }
        });
    };

    if (phase === "expired") {
        return (
            <Animated.View
                entering={FadeInDown.delay(index * 50).springify()}
                style={styles.archivedCard}
            >
                <Text style={styles.archivedTitle}>{event.title}</Text>
                <Text style={styles.archivedSubtitle}>Chat archived</Text>
            </Animated.View>
        );
    }

    return (
        <AnimatedPressable
            entering={FadeInDown.delay(index * 60).springify()}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            style={[animatedStyle, styles.chatCard]}
        >
            <View style={styles.chatCardHeader}>
                <Text style={styles.chatCardTitle} numberOfLines={1}>
                    {event.title}
                </Text>

                {/* Phase badge */}
                <View style={[styles.phaseBadge, { backgroundColor: `${phaseInfo.color}20` }]}>
                    <Text style={styles.phaseBadgeIcon}>{phaseInfo.icon}</Text>
                    <Text style={[styles.phaseBadgeText, { color: phaseInfo.color }]}>
                        {phaseInfo.label}
                    </Text>
                </View>
            </View>

            <View style={styles.chatCardFooter}>
                <View style={styles.attendeesPreview}>
                    {/* Attendee avatars */}
                    <View style={styles.attendeeAvatars}>
                        {[0, 1, 2].map((i) => (
                            <View
                                key={i}
                                style={[
                                    styles.attendeeAvatar,
                                    { marginLeft: i > 0 ? -6 : 0, zIndex: 3 - i }
                                ]}
                            >
                                <LinearGradient
                                    colors={["rgba(244, 74, 34, 0.3)", "rgba(244, 74, 34, 0.1)"]}
                                    style={styles.attendeeAvatarGradient}
                                >
                                    <Text style={styles.attendeeAvatarEmoji}>👤</Text>
                                </LinearGradient>
                            </View>
                        ))}
                    </View>
                    <Text style={styles.attendeeCount}>{attendeeCount} in chat</Text>
                </View>

                <View style={styles.chatCardActions}>
                    {hasUnread && <View style={styles.unreadDot} />}
                    <Text style={styles.chatCardArrow}>›</Text>
                </View>
            </View>
        </AnimatedPressable>
    );
}

// Premium DM Request Card
function DMRequestCard({ count, onPress }: { count: number; onPress: () => void }) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <AnimatedPressable
            entering={FadeInDown.delay(100).springify()}
            onPressIn={() => {
                scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
            }}
            onPressOut={() => {
                scale.value = withSpring(1, { damping: 15, stiffness: 400 });
            }}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPress();
            }}
            style={[animatedStyle, styles.dmRequestCard]}
        >
            <LinearGradient
                colors={["rgba(244, 74, 34, 0.15)", "rgba(244, 74, 34, 0.05)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.dmRequestGradient}
            >
                <View style={styles.dmRequestIcon}>
                    <Text style={styles.dmRequestIconText}>📨</Text>
                </View>
                <View style={styles.dmRequestContent}>
                    <Text style={styles.dmRequestTitle}>
                        {count} Message Request{count > 1 ? "s" : ""}
                    </Text>
                    <Text style={styles.dmRequestSubtitle}>
                        People want to connect with you
                    </Text>
                </View>
                <Text style={styles.dmRequestArrow}>→</Text>
            </LinearGradient>
        </AnimatedPressable>
    );
}

// Quick Action Button
function QuickActionButton({
    icon,
    label,
    onPress,
    delay,
}: {
    icon: string;
    label: string;
    onPress: () => void;
    delay: number;
}) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <AnimatedPressable
            entering={FadeInRight.delay(delay).springify()}
            onPressIn={() => {
                scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
            }}
            onPressOut={() => {
                scale.value = withSpring(1, { damping: 15, stiffness: 400 });
            }}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPress();
            }}
            style={[animatedStyle, styles.quickActionButton]}
        >
            <Text style={styles.quickActionIcon}>{icon}</Text>
            <Text style={styles.quickActionLabel}>{label}</Text>
        </AnimatedPressable>
    );
}

export default function InboxScreen() {
    const { user } = useAuthStore();
    const { orders, fetchUserOrders } = useTicketsStore();
    const insets = useSafeAreaInsets();

    const [eventChats, setEventChats] = useState<Array<{
        id: string;
        title: string;
        date: string;
        phase: EventPhase;
        attendeeCount: number;
    }>>([]);
    const [dmRequestCount, setDmRequestCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadData();
    }, [user?.uid]);

    const loadData = async () => {
        if (!user?.uid) return;

        setLoading(true);

        try {
            await fetchUserOrders(user.uid);
            const requests = await getPendingDMRequests(user.uid);
            setDmRequestCount(requests.length);
        } catch (error) {
            console.error("Error loading inbox:", error);
        }

        setLoading(false);
    };

    // Process orders into event chats
    useEffect(() => {
        const processChats = async () => {
            const chats = await Promise.all(
                orders.map(async (order) => {
                    const eventDate = order.eventDate
                        ? new Date(order.eventDate)
                        : new Date();
                    const phase = getEventPhase(eventDate);
                    const attendeeCount = await getAttendeeCount(order.eventId || "");

                    return {
                        id: order.eventId || order.id,
                        title: order.eventTitle || "Event",
                        date: order.eventDate || "",
                        phase,
                        attendeeCount,
                    };
                })
            );

            const phasePriority: Record<EventPhase, number> = {
                "during": 0,
                "pre-event": 1,
                "post-event": 2,
                "expired": 3,
            };

            chats.sort((a, b) => phasePriority[a.phase] - phasePriority[b.phase]);
            setEventChats(chats);
        };

        if (orders.length > 0) {
            processChats();
        } else {
            setEventChats([]);
        }
    }, [orders]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await loadData();
        setRefreshing(false);
    }, [user?.uid]);

    const activeChats = eventChats.filter(c => c.phase !== "expired");
    const archivedChats = eventChats.filter(c => c.phase === "expired");

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={{ paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.iris}
                    />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.headerTitle}>Social</Text>
                        <Text style={styles.headerSubtitle}>Connect with other attendees</Text>
                    </View>
                    <NotificationBell variant="solid" />
                </View>

                {/* Quick Actions */}
                <View style={styles.quickActions}>
                    <QuickActionButton
                        icon="💾"
                        label="Saved"
                        onPress={() => router.push("/social/contacts")}
                        delay={100}
                    />
                    <QuickActionButton
                        icon="📭"
                        label="Requests"
                        onPress={() => router.push("/social/requests")}
                        delay={150}
                    />
                    <QuickActionButton
                        icon="👥"
                        label="Friends"
                        onPress={() => router.push("/social/contacts")}
                        delay={200}
                    />
                </View>

                {/* DM Requests */}
                {dmRequestCount > 0 && (
                    <DMRequestCard
                        count={dmRequestCount}
                        onPress={() => router.push("/social/requests")}
                    />
                )}

                {/* Loading */}
                {loading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.iris} />
                        <Text style={styles.loadingText}>Loading your event chats...</Text>
                    </View>
                )}

                {/* Active Event Chats */}
                {!loading && activeChats.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Event Chats</Text>
                        {activeChats.map((chat, index) => (
                            <EventChatCard
                                key={chat.id}
                                event={chat}
                                phase={chat.phase}
                                attendeeCount={chat.attendeeCount}
                                index={index}
                            />
                        ))}
                    </View>
                )}

                {/* Empty State */}
                {!loading && activeChats.length === 0 && archivedChats.length === 0 && (
                    <Animated.View
                        entering={FadeIn.delay(200)}
                        style={styles.emptyContainer}
                    >
                        <Text style={styles.emptyEmoji}>💬</Text>
                        <Text style={styles.emptyTitle}>No Event Chats Yet</Text>
                        <Text style={styles.emptyText}>
                            When you get tickets to events, you'll be able to chat with other attendees!
                        </Text>
                        <Pressable
                            onPress={() => router.push("/(tabs)/explore")}
                        >
                            <LinearGradient
                                colors={gradients.primary as [string, string]}
                                style={styles.emptyButton}
                            >
                                <Text style={styles.emptyButtonText}>Find Events</Text>
                            </LinearGradient>
                        </Pressable>
                    </Animated.View>
                )}

                {/* Archived Chats */}
                {!loading && archivedChats.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitleMuted}>
                            Archived ({archivedChats.length})
                        </Text>
                        {archivedChats.slice(0, 3).map((chat, index) => (
                            <EventChatCard
                                key={chat.id}
                                event={chat}
                                phase={chat.phase}
                                attendeeCount={chat.attendeeCount}
                                index={index}
                            />
                        ))}
                        {archivedChats.length > 3 && (
                            <Text style={styles.moreArchived}>
                                +{archivedChats.length - 3} more archived
                            </Text>
                        )}
                    </View>
                )}

                {/* Privacy Info */}
                <Animated.View
                    entering={FadeInDown.delay(300)}
                    style={styles.privacyCard}
                >
                    <Text style={styles.privacyIcon}>🔒</Text>
                    <View style={styles.privacyContent}>
                        <Text style={styles.privacyTitle}>Your privacy matters</Text>
                        <Text style={styles.privacyText}>
                            Only ticket holders can see and chat with each other. Private messages require acceptance, and you can block anyone at any time.
                        </Text>
                    </View>
                </Animated.View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.base.DEFAULT,
    },
    scrollView: {
        flex: 1,
        paddingHorizontal: 20,
    },

    // Header
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: 16,
        paddingBottom: 20,
    },
    headerTitle: {
        color: colors.gold,
        fontSize: 34,
        fontWeight: "800",
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        color: colors.goldMetallic,
        fontSize: 15,
        marginTop: 4,
    },

    // Quick Actions
    quickActions: {
        flexDirection: "row",
        gap: 12,
        marginBottom: 20,
    },
    quickActionButton: {
        flex: 1,
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        padding: 16,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
    },
    quickActionIcon: {
        fontSize: 24,
        marginBottom: 8,
    },
    quickActionLabel: {
        color: colors.gold,
        fontSize: 13,
        fontWeight: "500",
    },

    // DM Request Card
    dmRequestCard: {
        marginBottom: 20,
    },
    dmRequestGradient: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: radii.xl,
        padding: 16,
        borderWidth: 1,
        borderColor: "rgba(244, 74, 34, 0.2)",
    },
    dmRequestIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(244, 74, 34, 0.2)",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
    },
    dmRequestIconText: {
        fontSize: 20,
    },
    dmRequestContent: {
        flex: 1,
    },
    dmRequestTitle: {
        color: colors.iris,
        fontSize: 16,
        fontWeight: "600",
    },
    dmRequestSubtitle: {
        color: colors.goldMetallic,
        fontSize: 13,
        marginTop: 2,
    },
    dmRequestArrow: {
        color: colors.iris,
        fontSize: 20,
        fontWeight: "600",
    },

    // Section
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        color: colors.gold,
        fontSize: 20,
        fontWeight: "700",
        marginBottom: 16,
    },
    sectionTitleMuted: {
        color: colors.goldMetallic,
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 12,
    },

    // Chat Card
    chatCard: {
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
    },
    chatCardHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    chatCardTitle: {
        color: colors.gold,
        fontSize: 16,
        fontWeight: "600",
        flex: 1,
        marginRight: 12,
    },
    phaseBadge: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radii.pill,
    },
    phaseBadgeIcon: {
        fontSize: 12,
        marginRight: 4,
    },
    phaseBadgeText: {
        fontSize: 11,
        fontWeight: "600",
    },
    chatCardFooter: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    attendeesPreview: {
        flexDirection: "row",
        alignItems: "center",
    },
    attendeeAvatars: {
        flexDirection: "row",
        marginRight: 10,
    },
    attendeeAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.base[50],
        overflow: "hidden",
    },
    attendeeAvatarGradient: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    attendeeAvatarEmoji: {
        fontSize: 10,
    },
    attendeeCount: {
        color: colors.goldMetallic,
        fontSize: 13,
    },
    chatCardActions: {
        flexDirection: "row",
        alignItems: "center",
    },
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.iris,
        marginRight: 8,
    },
    chatCardArrow: {
        color: colors.goldMetallic,
        fontSize: 24,
        fontWeight: "300",
    },

    // Archived Card
    archivedCard: {
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        padding: 16,
        marginBottom: 12,
        opacity: 0.5,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
    },
    archivedTitle: {
        color: colors.goldMetallic,
        fontSize: 15,
        fontWeight: "500",
    },
    archivedSubtitle: {
        color: colors.goldMetallic,
        fontSize: 12,
        marginTop: 4,
        opacity: 0.7,
    },
    moreArchived: {
        color: colors.goldMetallic,
        fontSize: 13,
        textAlign: "center",
        marginTop: 8,
    },

    // Loading
    loadingContainer: {
        alignItems: "center",
        paddingVertical: 60,
    },
    loadingText: {
        color: colors.goldMetallic,
        marginTop: 16,
    },

    // Empty
    emptyContainer: {
        alignItems: "center",
        paddingVertical: 60,
        paddingHorizontal: 20,
    },
    emptyEmoji: {
        fontSize: 56,
        marginBottom: 16,
    },
    emptyTitle: {
        color: colors.gold,
        fontSize: 22,
        fontWeight: "700",
        marginBottom: 8,
    },
    emptyText: {
        color: colors.goldMetallic,
        fontSize: 15,
        textAlign: "center",
        marginBottom: 24,
        lineHeight: 22,
    },
    emptyButton: {
        paddingVertical: 14,
        paddingHorizontal: 28,
        borderRadius: radii.pill,
    },
    emptyButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },

    // Privacy
    privacyCard: {
        flexDirection: "row",
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        padding: 16,
        marginTop: 8,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
    },
    privacyIcon: {
        fontSize: 20,
        marginRight: 12,
    },
    privacyContent: {
        flex: 1,
    },
    privacyTitle: {
        color: colors.gold,
        fontSize: 14,
        fontWeight: "600",
        marginBottom: 4,
    },
    privacyText: {
        color: colors.goldMetallic,
        fontSize: 13,
        lineHeight: 18,
    },
});
