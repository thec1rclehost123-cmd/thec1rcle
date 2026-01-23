/**
 * THE C1RCLE — Venue Profile Screen
 * 
 * Premium venue profile with:
 * - Parallax cover image
 * - Bio & Tags
 * - "Follow" pulse functionality
 * - Upcoming events at this venue
 */

import { useEffect, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
    FadeIn,
    FadeInDown,
    useSharedValue,
    useAnimatedStyle,
    useAnimatedScrollHandler,
    interpolate,
    Extrapolation,
} from "react-native-reanimated";

import { colors, radii, shadows } from "@/lib/design/theme";
import { useAuthStore } from "@/store/authStore";
import { useProfileStore } from "@/store/profileStore";
import { useEventsStore, Event } from "@/store/eventsStore";
import { getVenue, Venue } from "@/lib/api/venues";
import { PremiumButton } from "@/components/ui/PremiumButton";
import { Badge } from "@/components/ui/Primitives";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const HERO_HEIGHT = SCREEN_HEIGHT * 0.35;

export default function VenueProfileScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const insets = useSafeAreaInsets();

    const { user } = useAuthStore();
    const { profile, toggleFollowVenue } = useProfileStore();
    const { events, fetchEvents } = useEventsStore();

    const [venue, setVenue] = useState<Venue | null>(null);
    const [loading, setLoading] = useState(true);
    const [venueEvents, setVenueEvents] = useState<Event[]>([]);

    const scrollY = useSharedValue(0);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    useEffect(() => {
        loadVenueData();
    }, [id]);

    const loadVenueData = async () => {
        if (!id) return;
        setLoading(true);
        const data = await getVenue(id);
        setVenue(data);

        // Load upcoming events for this venue
        if (data) {
            const filtered = events.filter(e => e.venueId === id);
            setVenueEvents(filtered);
        }
        setLoading(false);
    };

    const isFollowing = profile?.followingVenues?.includes(id || "");

    const handleFollow = async () => {
        if (!user || !id) {
            router.push("/(auth)/login");
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await toggleFollowVenue(user.uid, id);
    };

    const heroImageStyle = useAnimatedStyle(() => {
        const translateY = interpolate(
            scrollY.value,
            [-100, 0, HERO_HEIGHT],
            [-50, 0, HERO_HEIGHT * 0.5],
            Extrapolation.CLAMP
        );
        const scale = interpolate(
            scrollY.value,
            [-100, 0],
            [1.2, 1],
            Extrapolation.CLAMP
        );
        return {
            transform: [{ translateY }, { scale }],
        };
    });

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.iris} />
            </View>
        );
    }

    if (!venue) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Venue not found</Text>
                <PremiumButton onPress={() => router.back()}>Go Back</PremiumButton>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header Buttons */}
            <View style={[styles.headerActions, { top: insets.top + 8 }]}>
                <Pressable onPress={() => router.back()} style={styles.circleButton}>
                    <Ionicons name="chevron-back" size={24} color={colors.gold} />
                </Pressable>
            </View>

            <Animated.ScrollView
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
            >
                {/* Hero Section */}
                <View style={styles.hero}>
                    <Animated.View style={[styles.heroImageWrapper, heroImageStyle]}>
                        <Image
                            source={{ uri: venue.image || "https://thec1rcle.com/events/placeholder.svg" }}
                            style={styles.heroImage}
                            contentFit="cover"
                        />
                    </Animated.View>
                    <LinearGradient
                        colors={["transparent", "rgba(10,10,10,0.8)", "#0A0A0A"]}
                        style={styles.heroGradient}
                    />

                    <View style={styles.heroContent}>
                        <Badge variant="iris" size="sm">{venue.area}</Badge>
                        <Text style={styles.venueName}>{venue.name}</Text>
                        <View style={styles.statsRow}>
                            <Text style={styles.statsText}>
                                <Text style={styles.statsValue}>{venue.followers.toLocaleString()}</Text> Followers
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Actions Section */}
                <View style={styles.content}>
                    <View style={styles.actionRow}>
                        <PremiumButton
                            variant={isFollowing ? "glass" : "primary"}
                            style={styles.followButton}
                            onPress={handleFollow}
                        >
                            {isFollowing ? "Following" : "Follow"}
                        </PremiumButton>
                        <Pressable style={styles.iconButton}>
                            <Ionicons name="share-outline" size={22} color={colors.gold} />
                        </Pressable>
                    </View>

                    {/* Bio Section */}
                    {venue.description && (
                        <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
                            <Text style={styles.sectionTitle}>About</Text>
                            <Text style={styles.description}>{venue.description}</Text>
                        </Animated.View>
                    )}

                    {/* Vibe Section */}
                    {venue.tags && venue.tags.length > 0 && (
                        <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
                            <Text style={styles.sectionTitle}>The Vibe</Text>
                            <View style={styles.tagsContainer}>
                                {venue.tags.map((tag, i) => (
                                    <View key={i} style={styles.tag}>
                                        <Text style={styles.tagText}>{tag}</Text>
                                    </View>
                                ))}
                            </View>
                        </Animated.View>
                    )}

                    {/* Info Grid */}
                    <Animated.View entering={FadeInDown.delay(400)} style={styles.infoGrid}>
                        <View style={styles.infoCard}>
                            <Ionicons name="shirt-outline" size={20} color={colors.iris} />
                            <Text style={styles.infoLabel}>Dress Code</Text>
                            <Text style={styles.infoValue}>{venue.dressCode || "Casual"}</Text>
                        </View>
                        <View style={styles.infoCard}>
                            <Ionicons name="wine-outline" size={20} color={colors.iris} />
                            <Text style={styles.infoLabel}>Tables</Text>
                            <Text style={styles.infoValue}>{venue.tablesAvailable ? "Available" : "No Tables"}</Text>
                        </View>
                    </Animated.View>

                    {/* Upcoming Events */}
                    <Animated.View entering={FadeInDown.delay(500)} style={styles.section}>
                        <Text style={styles.sectionTitle}>Upcoming Events</Text>
                        {venueEvents.length > 0 ? (
                            venueEvents.map((event, i) => (
                                <Pressable
                                    key={event.id}
                                    onPress={() => router.push(`/event/${event.id}`)}
                                    style={styles.eventItem}
                                >
                                    <Image source={{ uri: event.coverImage }} style={styles.eventThumb} />
                                    <View style={styles.eventInfo}>
                                        <Text style={styles.eventTitle}>{event.title}</Text>
                                        <Text style={styles.eventDate}>{new Date(event.startDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={colors.goldMetallic} />
                                </Pressable>
                            ))
                        ) : (
                            <Text style={styles.emptyText}>No upcoming events scheduled.</Text>
                        )}
                    </Animated.View>
                </View>
            </Animated.ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.base.DEFAULT,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.base.DEFAULT,
    },
    errorContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 40,
    },
    errorText: {
        color: colors.gold,
        fontSize: 18,
        marginBottom: 20,
    },
    headerActions: {
        position: "absolute",
        left: 16,
        zIndex: 10,
    },
    circleButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(10,10,10,0.6)",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
    },
    hero: {
        height: HERO_HEIGHT,
        overflow: "hidden",
        justifyContent: "flex-end",
    },
    heroImageWrapper: {
        ...StyleSheet.absoluteFillObject,
    },
    heroImage: {
        width: "100%",
        height: "100%",
    },
    heroGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    heroContent: {
        padding: 20,
        paddingBottom: 24,
    },
    venueName: {
        color: colors.gold,
        fontSize: 32,
        fontWeight: "900",
        marginTop: 8,
    },
    statsRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 4,
    },
    statsText: {
        color: colors.goldMetallic,
        fontSize: 14,
    },
    statsValue: {
        color: colors.gold,
        fontWeight: "700",
    },
    content: {
        padding: 20,
    },
    actionRow: {
        flexDirection: "row",
        gap: 12,
        marginBottom: 32,
    },
    followButton: {
        flex: 1,
    },
    iconButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.base[100],
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        color: colors.gold,
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 16,
    },
    description: {
        color: colors.goldMetallic,
        fontSize: 15,
        lineHeight: 24,
    },
    tagsContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    tag: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: radii.md,
        backgroundColor: "rgba(244, 74, 34, 0.1)",
        borderWidth: 1,
        borderColor: "rgba(244, 74, 34, 0.2)",
    },
    tagText: {
        color: colors.iris,
        fontSize: 13,
        fontWeight: "600",
    },
    infoGrid: {
        flexDirection: "row",
        gap: 12,
        marginBottom: 32,
    },
    infoCard: {
        flex: 1,
        backgroundColor: colors.base[50],
        padding: 16,
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
    },
    infoLabel: {
        color: colors.goldMetallic,
        fontSize: 12,
        marginTop: 8,
    },
    infoValue: {
        color: colors.gold,
        fontSize: 15,
        fontWeight: "600",
        marginTop: 2,
    },
    eventItem: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.base[50],
        padding: 12,
        borderRadius: radii.lg,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
    },
    eventThumb: {
        width: 50,
        height: 50,
        borderRadius: radii.md,
    },
    eventInfo: {
        flex: 1,
        marginLeft: 12,
    },
    eventTitle: {
        color: colors.gold,
        fontSize: 15,
        fontWeight: "600",
    },
    eventDate: {
        color: colors.goldMetallic,
        fontSize: 13,
        marginTop: 2,
    },
    emptyText: {
        color: colors.goldMetallic,
        fontSize: 14,
        fontStyle: "italic",
    },
});
