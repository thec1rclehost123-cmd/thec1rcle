/**
 * THE C1RCLE - Orb-style Profile Screen
 * 
 * A cinematic, poster-like profile page with:
 * - Full-screen cover image
 * - Centered circular profile photo
 * - Event history sections (Upcoming/Attended + Past)
 * - All utility items moved to top-right settings menu
 */

import { useEffect, useCallback, useState, useMemo, useRef } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    StyleSheet,
    Dimensions,
    RefreshControl,
    Platform,
    Linking,
} from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/store/authStore";
import { useTicketsStore, Order } from "@/store/ticketsStore";
import { useProfileStore } from "@/store/profileStore";
import * as Haptics from "expo-haptics";
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withRepeat,
    withTiming,
    withSequence,
    interpolate,
    Easing,
    interpolateColor,
} from "react-native-reanimated";
import { colors, gradients, radii } from "@/lib/design/theme";
import { trackScreen } from "@/lib/analytics";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const COVER_HEIGHT = SCREEN_HEIGHT * 0.45;
const AVATAR_SIZE = 160;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ============================================
// SHIMMERING BADGE COMPONENT
// ============================================
function ShimmeringBadge({ children, colors: badgeColors }: { children: React.ReactNode, colors: [string, string] }) {
    const shimmerX = useSharedValue(-100);

    useEffect(() => {
        shimmerX.value = withRepeat(
            withTiming(200, { duration: 2000, easing: Easing.linear }),
            -1,
            false
        );
    }, []);

    const shimmerStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shimmerX.value }],
    }));

    return (
        <View style={styles.verifiedBadgeContainer}>
            <LinearGradient colors={badgeColors} style={styles.verifiedBadgeInner}>
                {children}
                <Animated.View style={[styles.shimmerOverlay, shimmerStyle]}>
                    <LinearGradient
                        colors={["transparent", "rgba(255, 255, 255, 0.4)", "transparent"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                    />
                </Animated.View>
            </LinearGradient>
        </View>
    );
}

// ============================================
// PROFILE EVENT CARD
// ============================================
function ProfileEventCard({
    order,
    isPast = false,
    animationDelay = 0,
}: {
    order: Order;
    isPast?: boolean;
    animationDelay?: number;
}) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.97, { damping: 25, stiffness: 300 });
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 25, stiffness: 300 });
    };

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: "/ticket/[id]", params: { id: order.id } });
    };

    // Format date nicely
    const formatEventDate = (order: Order) => {
        if (order.eventDate) return order.eventDate;
        if (order.eventStartDate) {
            const date = new Date(order.eventStartDate);
            return date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
            });
        }
        return "TBD";
    };

    return (
        <Animated.View
            entering={FadeInDown.delay(animationDelay).duration(400)}
            style={[animatedStyle, styles.eventCard]}
        >
            <Pressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handlePress}
                style={styles.eventCardInner}
            >
                {/* Event Poster */}
                <View style={[styles.eventPoster, isPast && styles.eventPosterPast]}>
                    {order.eventImage ? (
                        <Image
                            source={{ uri: order.eventImage }}
                            style={styles.eventPosterImage}
                            contentFit="cover"
                            transition={200}
                        />
                    ) : (
                        <LinearGradient
                            colors={[colors.base[100], colors.iris]}
                            style={styles.eventPosterImage}
                        />
                    )}
                    {/* Past overlay */}
                    {isPast && (
                        <View style={styles.pastOverlay}>
                            <Text style={styles.pastBadge}>PAST</Text>
                        </View>
                    )}
                </View>

                {/* Event Info */}
                <View style={styles.eventInfo}>
                    <View style={styles.eventInfoTop}>
                        <Text style={styles.eventTitle} numberOfLines={1}>
                            {order.eventTitle}
                        </Text>
                        {isPast ? (
                            <View style={styles.attendedBadge}>
                                <Text style={styles.attendedBadgeText}>ATTENDED</Text>
                            </View>
                        ) : (
                            <View style={styles.upcomingDateBadge}>
                                <Text style={styles.upcomingDateText}>{formatEventDate(order)}</Text>
                            </View>
                        )}
                    </View>

                    <Text style={styles.eventMeta} numberOfLines={1}>
                        {order.eventLocation || "Venue TBD"}
                    </Text>

                    <View style={styles.eventFooter}>
                        <View style={styles.ticketCount}>
                            <Ionicons name="ticket" size={14} color={colors.iris} />
                            <Text style={styles.ticketCountText}>
                                {order.tickets.reduce((sum, t) => sum + t.quantity, 0)} Ticket
                                {order.tickets.reduce((sum, t) => sum + t.quantity, 0) !== 1 ? "s" : ""}
                            </Text>
                            <View style={styles.privateSmallIcon}>
                                <Ionicons name="lock-closed" size={10} color="rgba(255, 255, 255, 0.4)" />
                            </View>
                        </View>
                        <View style={styles.goButton}>
                            <Ionicons name="chevron-forward" size={16} color={colors.gold} />
                        </View>
                    </View>
                </View>
            </Pressable>
        </Animated.View>
    );
}

// ============================================
// EMPTY STATE FOR EVENTS
// ============================================
function EventsEmptyState({
    title,
    subtitle,
    actionLabel,
    onAction,
}: {
    title: string;
    subtitle: string;
    actionLabel: string;
    onAction: () => void;
}) {
    return (
        <View style={styles.emptyState}>
            <View style={styles.emptyStateIcon}>
                <Ionicons name="calendar-outline" size={32} color={colors.goldMetallic} />
            </View>
            <Text style={styles.emptyStateTitle}>{title}</Text>
            <Text style={styles.emptyStateSubtitle}>{subtitle}</Text>
            <Pressable onPress={onAction} style={styles.emptyStateButton}>
                <Text style={styles.emptyActionText}>{actionLabel}</Text>
            </Pressable>
        </View>
    );
}

// ============================================
// STAT PILL
// ============================================
function StatPill({
    value,
    label,
}: {
    value: number | string;
    label: string;
}) {
    return (
        <View style={styles.statPill}>
            <Text style={styles.statPillValue}>{value}</Text>
            <Text style={styles.statPillLabel}>{label}</Text>
        </View>
    );
}

// ============================================
// TAB SWITCHER
// ============================================
function TabSwitcher({
    activeTab,
    onChange,
    upcomingCount,
    pastCount,
}: {
    activeTab: "upcoming" | "past";
    onChange: (tab: "upcoming" | "past") => void;
    upcomingCount: number;
    pastCount: number;
}) {
    return (
        <View style={styles.tabSwitcherContainer}>
            <Pressable
                onPress={() => onChange("upcoming")}
                style={[styles.tabButton, activeTab === "upcoming" && styles.tabButtonActive]}
            >
                <Text style={[styles.tabButtonText, activeTab === "upcoming" && styles.tabButtonTextActive]}>
                    UPCOMING
                </Text>
                {upcomingCount > 0 && (
                    <View style={[styles.tabBadge, activeTab === "upcoming" && styles.tabBadgeActive]}>
                        <Text style={[styles.tabBadgeText, activeTab === "upcoming" && styles.tabBadgeTextActive]}>
                            {upcomingCount}
                        </Text>
                    </View>
                )}
            </Pressable>
            <View style={styles.tabDivider} />
            <Pressable
                onPress={() => onChange("past")}
                style={[styles.tabButton, activeTab === "past" && styles.tabButtonActive]}
            >
                <Text style={[styles.tabButtonText, activeTab === "past" && styles.tabButtonTextActive]}>
                    ATTENDED
                </Text>
                {pastCount > 0 && (
                    <View style={[styles.tabBadge, activeTab === "past" && styles.tabBadgeActive]}>
                        <Text style={[styles.tabBadgeText, activeTab === "past" && styles.tabBadgeTextActive]}>
                            {pastCount}
                        </Text>
                    </View>
                )}
            </Pressable>

            {/* Indicator */}
            <Animated.View
                style={[
                    styles.tabIndicator,
                    {
                        left: activeTab === "upcoming" ? "2%" : "52%",
                        width: "46%",
                        backgroundColor: "#FFFFFF"
                    }
                ]}
            />
        </View>
    );
}

// ============================================
// SECTION HEADER
// ============================================
function SectionHeader({
    title,
    count,
    delay = 0,
}: {
    title: string;
    count?: number;
    delay?: number;
}) {
    return (
        <Animated.View
            entering={FadeIn.delay(delay)}
            style={styles.sectionHeader}
        >
            <Text style={styles.sectionTitle}>{title}</Text>
            {count !== undefined && count > 0 && (
                <View style={styles.sectionCount}>
                    <Text style={styles.sectionCountText}>{count}</Text>
                </View>
            )}
        </Animated.View>
    );
}

// ============================================
// MAIN PROFILE SCREEN
// ============================================
export default function OrbProfileScreen() {
    const { user } = useAuthStore();
    const { profile, loadProfile } = useProfileStore();
    const { orders, fetchUserOrders, loading: ticketsLoading } = useTicketsStore();
    const insets = useSafeAreaInsets();

    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
    const pagerRef = useRef<ScrollView>(null);

    const scrollToTab = (tab: "upcoming" | "past") => {
        const x = tab === "upcoming" ? 0 : SCREEN_WIDTH - 40;
        pagerRef.current?.scrollTo({ x, animated: true });
        setActiveTab(tab);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const scrollY = useSharedValue(0);
    const avatarScale = useSharedValue(0.5);
    const settingsScale = useSharedValue(1);

    const onScroll = (event: any) => {
        scrollY.value = event.nativeEvent.contentOffset.y;
    };

    const coverAnimatedStyle = useAnimatedStyle(() => {
        const scale = interpolate(
            scrollY.value,
            [-100, 0, COVER_HEIGHT],
            [1.2, 1, 1.1],
            "clamp"
        );
        const translateY = interpolate(
            scrollY.value,
            [0, COVER_HEIGHT],
            [0, COVER_HEIGHT * 0.5],
            "clamp"
        );
        return {
            transform: [{ scale }, { translateY }],
        };
    });

    const settingsAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: settingsScale.value }],
    }));

    useEffect(() => {
        trackScreen("Profile");

        avatarScale.value = withTiming(1, { duration: 800 });

        if (user?.uid) {
            loadProfile(user.uid);
            fetchUserOrders(user.uid);
        }
    }, [user?.uid]);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        if (user?.uid) {
            await Promise.all([
                loadProfile(user.uid),
                fetchUserOrders(user.uid),
            ]);
        }
        setRefreshing(false);
    }, [user?.uid]);

    // Separate orders into upcoming and past
    const { upcomingOrders, pastOrders } = useMemo(() => {
        const now = new Date();

        const upcoming: Order[] = [];
        const past: Order[] = [];

        orders.forEach(order => {
            // Try to determine if event is in the past
            let eventDate: Date | null = null;

            if (order.eventStartDate) {
                eventDate = new Date(order.eventStartDate);
            } else if (order.eventDate) {
                // Try to parse formatted date
                const parsed = Date.parse(order.eventDate);
                if (!isNaN(parsed)) {
                    eventDate = new Date(parsed);
                }
            }

            if (eventDate && eventDate < now) {
                past.push(order);
            } else {
                upcoming.push(order);
            }
        });

        return { upcomingOrders: upcoming, pastOrders: past };
    }, [orders]);

    // Get initials
    const displayName = user?.displayName || profile?.displayName || "Party Enthusiast";
    const initials = displayName
        .split(" ")
        .map(n => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    const username = user?.email?.split("@")[0] || "user";
    const bio = profile?.tagline || profile?.bio || "Living for the moments";
    const photoURL = profile?.photoURL || user?.photoURL;
    const coverPhotoUrl = profile?.coverPhotoUrl;

    // Stats
    const totalEvents = orders.length;
    const joinYear = profile?.createdAt ? new Date(profile.createdAt).getFullYear() : new Date().getFullYear();

    return (
        <View style={styles.container}>
            <Animated.ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 140 }}
                onScroll={onScroll}
                scrollEventThrottle={16}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.iris}
                        progressViewOffset={insets.top}
                    />
                }
            >
                {/* ============================================ */}
                {/* HERO COVER SECTION */}
                {/* ============================================ */}
                <View style={styles.heroSection}>
                    {/* Cover Image - Projects the profile photo but blurred */}
                    <Animated.View style={[styles.coverContainer, coverAnimatedStyle]}>
                        {photoURL ? (
                            <View style={styles.coverImageContainer}>
                                <Image
                                    source={{ uri: photoURL }}
                                    style={styles.coverImage}
                                    contentFit="cover"
                                    transition={300}
                                />
                                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                            </View>
                        ) : (
                            <View style={styles.coverImageContainer}>
                                <LinearGradient
                                    colors={["#2D1B1B", "#1A0808", colors.base.DEFAULT]}
                                    style={styles.coverImage}
                                />
                            </View>
                        )}
                        {/* Cover gradient overlay */}
                        <LinearGradient
                            colors={[
                                "rgba(0, 0, 0, 0.2)",
                                "transparent",
                                "rgba(0, 0, 0, 0.1)",
                                colors.base.DEFAULT,
                            ]}
                            locations={[0, 0.4, 0.9, 1]}
                            style={styles.coverGradient}
                        />
                    </Animated.View>

                    {/* Top Bar */}
                    <Animated.View
                        entering={FadeIn.delay(100)}
                        style={[styles.topBar, { paddingTop: insets.top + 8 }]}
                    >
                        {/* Username in center */}
                        <View style={styles.topBarCenter}>
                            <Text style={styles.topBarUsername}>@{username}</Text>
                        </View>

                        {/* Settings button on right */}
                        <AnimatedPressable
                            style={[styles.settingsButton, settingsAnimatedStyle]}
                            onPressIn={() => {
                                settingsScale.value = withSpring(0.9, { damping: 25, stiffness: 300 });
                            }}
                            onPressOut={() => {
                                settingsScale.value = withSpring(1, { damping: 25, stiffness: 300 });
                            }}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                router.push("/settings");
                            }}
                        >
                            <BlurView intensity={20} tint="dark" style={styles.settingsButtonBlur}>
                                <Ionicons name="settings-sharp" size={20} color={colors.gold} />
                            </BlurView>
                        </AnimatedPressable>
                    </Animated.View>

                    {/* Profile Avatar */}
                    <Animated.View
                        entering={FadeInDown.delay(200).duration(600)}
                        style={styles.avatarSection}
                    >
                        <Animated.View
                            style={[
                                styles.avatarContainer,
                                { transform: [{ scale: avatarScale }] }
                            ]}
                        >
                            <Pressable
                                onPressIn={() => avatarScale.value = withSpring(0.9, { damping: 25, stiffness: 200 })}
                                onPressOut={() => avatarScale.value = withSpring(1, { damping: 25, stiffness: 200 })}
                            >
                                <View style={styles.avatarBorder}>
                                    {photoURL ? (
                                        <Image
                                            source={{ uri: photoURL }}
                                            style={styles.avatarImage}
                                            contentFit="cover"
                                            transition={200}
                                        />
                                    ) : (
                                        <LinearGradient
                                            colors={gradients.primary as [string, string]}
                                            style={styles.avatarPlaceholder}
                                        >
                                            <Text style={styles.avatarInitials}>{initials}</Text>
                                        </LinearGradient>
                                    )}
                                </View>
                            </Pressable>

                            {/* Verified badge */}
                            {profile?.isVerified && (
                                <ShimmeringBadge colors={["#00A3FF", "#0066FF"]}>
                                    <Ionicons name="checkmark-sharp" size={16} color="#FFFFFF" />
                                </ShimmeringBadge>
                            )}
                        </Animated.View>
                    </Animated.View>

                    {/* User Info */}
                    <Animated.View
                        entering={FadeInDown.delay(300).duration(500)}
                        style={styles.userInfo}
                    >
                        <Text style={styles.userName}>{displayName}</Text>
                        <Text style={styles.userBio}>{bio}</Text>
                    </Animated.View>

                    {/* STATS ROW */}
                    {/* ============================================ */}
                    {(profile?.privacy?.showStats !== false) && (
                        <Animated.View
                            entering={FadeInDown.delay(400).duration(500)}
                            style={styles.statsRow}
                        >
                            <StatPill value={totalEvents} label="Events" />
                            <View style={styles.statsDivider} />

                            {/* Social Icons */}
                            <View style={styles.socialStatsIcons}>
                                {profile?.instagram && (
                                    <Pressable
                                        onPress={() => Linking.openURL(`https://instagram.com/${profile.instagram}`)}
                                        style={styles.socialIconStat}
                                    >
                                        <Ionicons name="logo-instagram" size={20} color={colors.gold} />
                                    </Pressable>
                                )}
                                {profile?.snapchat && (
                                    <Pressable
                                        onPress={() => Linking.openURL(`https://snapchat.com/add/${profile.snapchat}`)}
                                        style={styles.socialIconStat}
                                    >
                                        <Ionicons name="logo-snapchat" size={20} color={colors.gold} />
                                    </Pressable>
                                )}
                                {!profile?.instagram && !profile?.snapchat && (
                                    <View style={styles.socialIconStatPlaceholder} />
                                )}
                            </View>

                            <View style={styles.statsDivider} />
                            <StatPill value={joinYear} label="Joined" />
                        </Animated.View>
                    )}

                </View>

                {/* ============================================ */}
                {/* EVENTS SECTIONS */}
                {/* ============================================ */}
                {((activeTab === "upcoming" && (profile?.privacy?.showUpcomingEvents !== false)) ||
                    (activeTab === "past" && (profile?.privacy?.showAttendedEvents !== false))) ? (
                    <View style={styles.eventsContainer}>
                        <TabSwitcher
                            activeTab={activeTab}
                            onChange={scrollToTab}
                            upcomingCount={upcomingOrders.length}
                            pastCount={pastOrders.length}
                        />

                        {/* Horizontal Scroller for Swipe */}
                        <ScrollView
                            ref={pagerRef}
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            scrollEventThrottle={16}
                            onMomentumScrollEnd={(e) => {
                                const offset = e.nativeEvent.contentOffset.x;
                                const newTab = offset > SCREEN_WIDTH / 2 ? "past" : "upcoming";
                                if (newTab !== activeTab) {
                                    setActiveTab(newTab);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }
                            }}
                        // We need a ref or something if we want to programmatically scroll on tab click
                        // but for now, we'll keep it simple
                        >
                            {/* UPCOMING PAGE */}
                            <View style={{ width: SCREEN_WIDTH - 40 }}>
                                {profile?.privacy?.showUpcomingEvents !== false ? (
                                    upcomingOrders.length > 0 ? (
                                        <View style={styles.eventsList}>
                                            {upcomingOrders.map((order, index) => (
                                                <ProfileEventCard
                                                    key={order.id}
                                                    order={order}
                                                    animationDelay={index * 50}
                                                />
                                            ))}
                                        </View>
                                    ) : (
                                        <EventsEmptyState
                                            title="No upcoming events"
                                            subtitle="Find something in Explore"
                                            actionLabel="Discover Events"
                                            onAction={() => router.push("/(tabs)/explore")}
                                        />
                                    )
                                ) : (
                                    <View style={styles.privateMessage}>
                                        <Ionicons name="eye-off-outline" size={32} color="rgba(255,255,255,0.2)" />
                                        <Text style={styles.privateMessageText}>Upcoming events are hidden</Text>
                                    </View>
                                )}
                            </View>

                            {/* ATTENDED PAGE */}
                            <View style={{ width: SCREEN_WIDTH - 40 }}>
                                {profile?.privacy?.showAttendedEvents !== false ? (
                                    pastOrders.length > 0 ? (
                                        <View style={styles.eventsList}>
                                            {pastOrders.map((order, index) => (
                                                <ProfileEventCard
                                                    key={order.id}
                                                    order={order}
                                                    isPast
                                                    animationDelay={index * 50}
                                                />
                                            ))}
                                        </View>
                                    ) : (
                                        <EventsEmptyState
                                            title="No attended events"
                                            subtitle="Your adventure starts here"
                                            actionLabel="Find an Event"
                                            onAction={() => router.push("/(tabs)/explore")}
                                        />
                                    )
                                ) : (
                                    <View style={styles.privateMessage}>
                                        <Ionicons name="eye-off-outline" size={32} color="rgba(255,255,255,0.2)" />
                                        <Text style={styles.privateMessageText}>Attended events are hidden</Text>
                                    </View>
                                )}
                            </View>
                        </ScrollView>
                    </View>
                ) : (
                    <View style={styles.privateSection}>
                        <Ionicons name="lock-closed-outline" size={40} color="rgba(255,255,255,0.1)" />
                        <Text style={styles.privateSectionText}>This profile is private</Text>
                    </View>
                )}

                {/* Footer */}
                <Animated.View
                    entering={FadeIn.delay(1000)}
                    style={styles.footer}
                >
                    <View style={styles.footerLogo}>
                        <LinearGradient
                            colors={gradients.primary as [string, string]}
                            style={styles.footerLogoGradient}
                        >
                            <Text style={styles.footerLogoText}>C1</Text>
                        </LinearGradient>
                    </View>
                    <Text style={styles.footerText}>THE C1RCLE</Text>
                    <Text style={styles.footerSubtext}>Made in India</Text>
                </Animated.View>
            </Animated.ScrollView>
        </View>
    );
}

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.base.DEFAULT,
    },
    scrollView: {
        flex: 1,
    },

    // Hero Section
    heroSection: {
        paddingBottom: 20,
    },
    coverContainer: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: COVER_HEIGHT,
    },
    coverImageContainer: {
        width: "100%",
        height: "100%",
    },
    coverImage: {
        width: "100%",
        height: "100%",
    },
    coverGradient: {
        ...StyleSheet.absoluteFillObject,
    },

    // Top Bar
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    topBarCenter: {
        flex: 1,
        alignItems: "center",
    },
    topBarUsername: {
        color: colors.goldMetallic,
        fontSize: 14,
        fontWeight: "500",
    },
    settingsButton: {
        position: "absolute",
        right: 16,
        top: 0,
        bottom: 0,
        justifyContent: "center",
        paddingTop: 64,
    },
    settingsButtonBlur: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: "rgba(255, 255, 255, 0.08)",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
    },

    // Avatar
    avatarSection: {
        alignItems: "center",
        marginTop: COVER_HEIGHT * 0.45,
    },
    avatarContainer: {
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 40,
        elevation: 20,
    },
    avatarBorder: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        borderWidth: 0,
        overflow: "hidden",
    },
    avatarImage: {
        width: "100%",
        height: "100%",
    },
    avatarPlaceholder: {
        width: "100%",
        height: "100%",
        borderRadius: radii.pill,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarInitials: {
        color: "#FFFFFF",
        fontSize: 48,
        fontWeight: "700",
    },

    // Verified Badge & Shimmer
    verifiedBadgeContainer: {
        position: "absolute",
        bottom: 8,
        right: 8,
        width: 32,
        height: 32,
        borderRadius: 16,
        padding: 2,
        backgroundColor: colors.base.DEFAULT,
        overflow: "hidden",
    },
    verifiedBadgeInner: {
        width: "100%",
        height: "100%",
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },
    shimmerOverlay: {
        ...StyleSheet.absoluteFillObject,
        width: 100,
        height: "100%",
    },

    // User Info
    userInfo: {
        alignItems: "center",
        paddingHorizontal: 32,
        marginTop: 16,
    },
    userName: {
        color: colors.gold,
        fontSize: 26,
        fontWeight: "800",
        marginBottom: 6,
        letterSpacing: -0.5,
        textAlign: "center",
    },
    userBio: {
        color: colors.goldMetallic,
        fontSize: 14,
        textAlign: "center",
        lineHeight: 20,
    },

    // Stats Row
    statsRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 16,
        paddingHorizontal: 40,
        marginTop: 12,
        marginHorizontal: 20,
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
    },
    statPill: {
        flex: 1,
        alignItems: "center",
    },
    statPillValue: {
        color: colors.gold,
        fontSize: 24,
        fontWeight: "800",
        marginBottom: 2,
    },
    statPillLabel: {
        color: colors.goldMetallic,
        fontSize: 12,
        fontWeight: "500",
    },
    statsDivider: {
        width: 1,
        height: 24,
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        marginHorizontal: 16,
    },
    socialStatsIcons: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    socialIconStat: {
        padding: 4,
    },
    socialIconStatPlaceholder: {
        width: 20,
    },

    // Tab Switcher
    tabSwitcherContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.base[50],
        borderRadius: radii.pill,
        padding: 4,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
        position: "relative",
    },
    tabButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 12,
        gap: 8,
        zIndex: 2,
    },
    tabButtonActive: {
        // Handled by indicator
    },
    tabButtonText: {
        color: colors.goldMetallic,
        fontSize: 13,
        fontWeight: "600",
        letterSpacing: 1,
    },
    tabButtonTextActive: {
        color: "#000000",
    },
    tabBadge: {
        backgroundColor: "rgba(255, 255, 255, 0.08)",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    tabBadgeActive: {
        backgroundColor: "rgba(0, 0, 0, 0.15)",
    },
    tabBadgeText: {
        color: colors.goldMetallic,
        fontSize: 10,
        fontWeight: "700",
    },
    tabBadgeTextActive: {
        color: "#000000",
    },
    tabDivider: {
        width: 1,
        height: 20,
        backgroundColor: "rgba(255, 255, 255, 0.1)",
    },
    tabIndicator: {
        position: "absolute",
        top: 4,
        bottom: 4,
        borderRadius: radii.pill,
        zIndex: 1,
    },

    // Events Container
    eventsContainer: {
        paddingHorizontal: 20,
        marginTop: 12,
    },

    // Section Header
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 16,
        marginTop: 8,
    },
    sectionTitle: {
        color: colors.gold,
        fontSize: 18,
        fontWeight: "700",
    },
    sectionCount: {
        backgroundColor: "rgba(244, 74, 34, 0.15)",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radii.pill,
        marginLeft: 10,
    },
    sectionCountText: {
        color: colors.iris,
        fontSize: 12,
        fontWeight: "700",
    },

    // Events List
    eventsList: {
        gap: 12,
        marginBottom: 24,
    },

    // Event Card
    eventCard: {
        backgroundColor: "rgba(255, 255, 255, 0.03)",
        borderRadius: radii["2xl"],
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.08)",
        marginBottom: 8,
    },
    eventCardInner: {
        flexDirection: "row",
        padding: 16,
    },
    eventPoster: {
        width: 100,
        height: 100,
        borderRadius: radii.xl,
        overflow: "hidden",
        backgroundColor: colors.base[100],
    },
    eventPosterPast: {
        opacity: 0.6,
    },
    eventPosterImage: {
        width: "100%",
        height: "100%",
    },
    pastOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        alignItems: "center",
        justifyContent: "center",
    },
    pastBadge: {
        color: "#FFFFFF",
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 1.5,
    },
    eventInfo: {
        flex: 1,
        marginLeft: 16,
        justifyContent: "space-between",
    },
    eventInfoTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    eventTitle: {
        color: "#FFFFFF",
        fontSize: 17,
        fontWeight: "700",
        flex: 1,
        marginRight: 8,
    },
    upcomingDateBadge: {
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    upcomingDateText: {
        color: "#FFFFFF",
        fontSize: 11,
        fontWeight: "700",
    },
    attendedBadge: {
        backgroundColor: "rgba(255, 255, 255, 0.08)",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    attendedBadgeText: {
        color: "rgba(255, 255, 255, 0.6)",
        fontSize: 10,
        fontWeight: "700",
    },
    eventMeta: {
        color: "rgba(255, 255, 255, 0.5)",
        fontSize: 14,
        fontWeight: "500",
        marginTop: 2,
    },
    eventFooter: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 12,
    },
    ticketCount: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "rgba(255, 255, 255, 0.04)",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
    },
    privateSmallIcon: {
        marginLeft: 2,
        opacity: 0.8,
    },
    ticketCountText: {
        color: "#FFFFFF",
        fontSize: 12,
        fontWeight: "600",
    },
    goButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "rgba(255, 255, 255, 0.06)",
        alignItems: "center",
        justifyContent: "center",
    },

    // Empty State
    emptyState: {
        alignItems: "center",
        paddingVertical: 40,
        paddingHorizontal: 20,
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.04)",
        marginBottom: 24,
    },
    emptyStateIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: "rgba(255, 255, 255, 0.04)",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
    },
    emptyStateTitle: {
        color: colors.gold,
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 4,
    },
    emptyStateSubtitle: {
        color: colors.goldMetallic,
        fontSize: 14,
        marginBottom: 20,
    },
    emptyStateButton: {
        backgroundColor: colors.iris,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: radii.pill,
    },
    emptyActionText: {
        color: "#FFFFFF",
        fontSize: 14,
        fontWeight: "600",
    },

    // Privacy
    privateSection: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 60,
        opacity: 0.5,
    },
    privateSectionText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "500",
        marginTop: 12,
    },
    privateMessage: {
        alignItems: "center",
        paddingVertical: 50,
        opacity: 0.3,
    },
    privateMessageText: {
        color: "#FFFFFF",
        fontSize: 14,
        marginTop: 10,
    },

    // View All Button
    viewAllButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 12,
        gap: 8,
    },
    viewAllText: {
        color: colors.iris,
        fontSize: 14,
        fontWeight: "600",
    },

    // Footer
    footer: {
        alignItems: "center",
        paddingTop: 40,
        paddingBottom: 20,
    },
    footerLogo: {
        marginBottom: 12,
    },
    footerLogoGradient: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    footerLogoText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "900",
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
