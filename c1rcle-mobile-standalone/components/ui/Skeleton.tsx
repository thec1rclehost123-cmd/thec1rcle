/**
 * Skeleton Loaders
 * Shimmer loading placeholders for better perceived performance
 */

import React, { useEffect } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    interpolate,
    Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radii } from "@/lib/design/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Base shimmer component
export function Shimmer({ style }: { style?: any }) {
    const shimmerX = useSharedValue(-1);

    useEffect(() => {
        shimmerX.value = withRepeat(
            withTiming(1, { duration: 1500, easing: Easing.ease }),
            -1,
            false
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            {
                translateX: interpolate(
                    shimmerX.value,
                    [-1, 1],
                    [-SCREEN_WIDTH, SCREEN_WIDTH]
                ),
            },
        ],
    }));

    return (
        <View style={[styles.shimmerContainer, style]}>
            <Animated.View style={[styles.shimmerGradient, animatedStyle]}>
                <LinearGradient
                    colors={[
                        "transparent",
                        "rgba(255, 255, 255, 0.08)",
                        "transparent",
                    ]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={StyleSheet.absoluteFill}
                />
            </Animated.View>
        </View>
    );
}

// Event Card Skeleton
export function EventCardSkeleton() {
    return (
        <View style={skeletonStyles.eventCard}>
            {/* Image */}
            <Shimmer style={skeletonStyles.eventImage} />

            {/* Content */}
            <View style={skeletonStyles.eventContent}>
                <Shimmer style={skeletonStyles.titleLine} />
                <Shimmer style={skeletonStyles.subtitleLine} />
                <View style={skeletonStyles.eventMeta}>
                    <Shimmer style={skeletonStyles.metaChip} />
                    <Shimmer style={skeletonStyles.metaChip} />
                </View>
            </View>
        </View>
    );
}

// Grid Card Skeleton (for 2-column explore grid)
export function GridCardSkeleton() {
    return (
        <View style={skeletonStyles.gridCard}>
            <Shimmer style={skeletonStyles.gridImage} />
            <View style={skeletonStyles.gridContent}>
                <Shimmer style={skeletonStyles.gridTitle} />
                <Shimmer style={skeletonStyles.gridVenue} />
                <View style={skeletonStyles.gridMeta}>
                    <Shimmer style={skeletonStyles.gridDate} />
                    <Shimmer style={skeletonStyles.gridPrice} />
                </View>
            </View>
        </View>
    );
}

// Hero Card Skeleton
export function HeroCardSkeleton() {
    return (
        <View style={skeletonStyles.heroCard}>
            <Shimmer style={skeletonStyles.heroImage} />
            <View style={skeletonStyles.heroOverlay}>
                <Shimmer style={skeletonStyles.heroTitle} />
                <Shimmer style={skeletonStyles.heroSubtitle} />
            </View>
        </View>
    );
}

// Ticket Card Skeleton
export function TicketCardSkeleton() {
    return (
        <View style={skeletonStyles.ticketCard}>
            <Shimmer style={skeletonStyles.ticketImage} />
            <View style={skeletonStyles.ticketContent}>
                <Shimmer style={skeletonStyles.titleLine} />
                <Shimmer style={skeletonStyles.subtitleLine} />
                <View style={skeletonStyles.ticketMeta}>
                    <Shimmer style={skeletonStyles.ticketDate} />
                    <Shimmer style={skeletonStyles.ticketBadge} />
                </View>
            </View>
        </View>
    );
}

// Chat/Message Skeleton
export function ChatSkeleton() {
    return (
        <View style={skeletonStyles.chatItem}>
            <Shimmer style={skeletonStyles.avatar} />
            <View style={skeletonStyles.chatContent}>
                <Shimmer style={skeletonStyles.chatName} />
                <Shimmer style={skeletonStyles.chatMessage} />
            </View>
            <Shimmer style={skeletonStyles.chatTime} />
        </View>
    );
}

// Notification Skeleton
export function NotificationSkeleton() {
    return (
        <View style={skeletonStyles.notificationItem}>
            <Shimmer style={skeletonStyles.notificationIcon} />
            <View style={skeletonStyles.notificationContent}>
                <Shimmer style={skeletonStyles.titleLine} />
                <Shimmer style={skeletonStyles.bodyLine} />
            </View>
        </View>
    );
}

// Profile Header Skeleton
export function ProfileHeaderSkeleton() {
    return (
        <View style={skeletonStyles.profileHeader}>
            <Shimmer style={skeletonStyles.profileAvatar} />
            <Shimmer style={skeletonStyles.profileName} />
            <Shimmer style={skeletonStyles.profileBio} />
            <View style={skeletonStyles.profileStats}>
                <Shimmer style={skeletonStyles.statBox} />
                <Shimmer style={skeletonStyles.statBox} />
                <Shimmer style={skeletonStyles.statBox} />
            </View>
        </View>
    );
}

// Search Result Skeleton
export function SearchResultSkeleton() {
    return (
        <View style={skeletonStyles.searchResult}>
            <Shimmer style={skeletonStyles.searchImage} />
            <View style={skeletonStyles.searchContent}>
                <Shimmer style={skeletonStyles.titleLine} />
                <Shimmer style={skeletonStyles.subtitleLine} />
            </View>
        </View>
    );
}

// List skeleton wrapper
export function SkeletonList({
    count = 5,
    type = "event",
}: {
    count?: number;
    type?: "event" | "hero" | "ticket" | "chat" | "notification" | "search";
}) {
    const SkeletonComponent = {
        event: EventCardSkeleton,
        hero: HeroCardSkeleton,
        ticket: TicketCardSkeleton,
        chat: ChatSkeleton,
        notification: NotificationSkeleton,
        search: SearchResultSkeleton,
    }[type];

    return (
        <View style={{ paddingHorizontal: 20 }}>
            {Array.from({ length: count }).map((_, index) => (
                <View key={index} style={{ marginBottom: 12 }}>
                    <SkeletonComponent />
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    shimmerContainer: {
        backgroundColor: colors.base[50],
        overflow: "hidden",
    },
    shimmerGradient: {
        ...StyleSheet.absoluteFillObject,
        width: SCREEN_WIDTH,
    },
});

const skeletonStyles = StyleSheet.create({
    // Event Card
    eventCard: {
        flexDirection: "row",
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        padding: 12,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
    },
    eventImage: {
        width: 80,
        height: 80,
        borderRadius: 12,
    },
    eventContent: {
        flex: 1,
        marginLeft: 14,
        justifyContent: "center",
    },
    titleLine: {
        height: 18,
        borderRadius: 6,
        marginBottom: 8,
        width: "80%",
    },
    subtitleLine: {
        height: 14,
        borderRadius: 6,
        marginBottom: 8,
        width: "60%",
    },
    bodyLine: {
        height: 12,
        borderRadius: 6,
        width: "90%",
    },
    eventMeta: {
        flexDirection: "row",
        gap: 8,
    },
    metaChip: {
        width: 60,
        height: 20,
        borderRadius: radii.pill,
    },

    // Hero Card
    heroCard: {
        width: SCREEN_WIDTH - 48,
        height: 200,
        borderRadius: radii["2xl"],
        overflow: "hidden",
    },
    heroImage: {
        ...StyleSheet.absoluteFillObject,
    },
    heroOverlay: {
        position: "absolute",
        bottom: 20,
        left: 20,
        right: 20,
    },
    heroTitle: {
        height: 24,
        borderRadius: 8,
        marginBottom: 8,
        width: "70%",
    },
    heroSubtitle: {
        height: 16,
        borderRadius: 6,
        width: "50%",
    },

    // Ticket Card
    ticketCard: {
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        overflow: "hidden",
    },
    ticketImage: {
        height: 140,
        width: "100%",
    },
    ticketContent: {
        padding: 16,
    },
    ticketMeta: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 8,
    },
    ticketDate: {
        height: 16,
        width: 100,
        borderRadius: 6,
    },
    ticketBadge: {
        width: 70,
        height: 24,
        borderRadius: radii.pill,
    },

    // Chat
    chatItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    chatContent: {
        flex: 1,
        marginLeft: 14,
    },
    chatName: {
        height: 16,
        borderRadius: 6,
        marginBottom: 6,
        width: 120,
    },
    chatMessage: {
        height: 14,
        borderRadius: 6,
        width: "70%",
    },
    chatTime: {
        width: 40,
        height: 12,
        borderRadius: 6,
    },

    // Notification
    notificationItem: {
        flexDirection: "row",
        alignItems: "flex-start",
        paddingVertical: 14,
        paddingHorizontal: 20,
    },
    notificationIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
    },
    notificationContent: {
        flex: 1,
        marginLeft: 14,
    },

    // Profile Header
    profileHeader: {
        alignItems: "center",
        paddingVertical: 24,
    },
    profileAvatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 16,
    },
    profileName: {
        height: 24,
        width: 150,
        borderRadius: 8,
        marginBottom: 8,
    },
    profileBio: {
        height: 14,
        width: 200,
        borderRadius: 6,
        marginBottom: 20,
    },
    profileStats: {
        flexDirection: "row",
        gap: 16,
    },
    statBox: {
        width: 80,
        height: 60,
        borderRadius: 12,
    },

    // Search Result
    searchResult: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.base[50],
        padding: 12,
        borderRadius: radii.xl,
    },
    searchImage: {
        width: 60,
        height: 60,
        borderRadius: 12,
    },
    searchContent: {
        flex: 1,
        marginLeft: 14,
    },

    // Grid Card (2-column explore grid)
    gridCard: {
        width: (SCREEN_WIDTH - 52) / 2,
        height: 200,
        borderRadius: radii.xl,
        overflow: "hidden",
        backgroundColor: colors.base[50],
    },
    gridImage: {
        width: "100%",
        height: 120,
    },
    gridContent: {
        padding: 10,
    },
    gridTitle: {
        height: 14,
        borderRadius: 4,
        width: "90%",
        marginBottom: 6,
    },
    gridVenue: {
        height: 12,
        borderRadius: 4,
        width: "70%",
        marginBottom: 8,
    },
    gridMeta: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    gridDate: {
        height: 10,
        width: 50,
        borderRadius: 4,
    },
    gridPrice: {
        height: 12,
        width: 40,
        borderRadius: 4,
    },
});
