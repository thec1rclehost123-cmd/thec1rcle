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
    Linking,
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
import { EventCard } from "@/components/ui/EventCard";

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

        // Load upcoming events for this venue (Fetch from DB to ensure data availability)
        if (data) {
            // Check store first
            let venueEventsList = events.filter(e => e.venueId === data.id);

            // If store is empty or didn't have them, we could fetch. 
            // For now, let's try to fetch if local is empty or just simply rely on what we have + a quick fetch
            // But to avoid complexity, let's just trigger a fetchEvents if we have none
            if (venueEventsList.length === 0) {
                await fetchEvents(); // Refresh global events
                venueEventsList = useEventsStore.getState().events.filter(e => e.venueId === data.id);
            }
            setVenueEvents(venueEventsList);
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
            {/* Header Actions */}
            <View style={[styles.headerActions, { top: insets.top + 8 }]}>
                <Pressable onPress={() => router.back()} style={styles.circleButton}>
                    <Ionicons name="chevron-back" size={24} color="#FFF" />
                </Pressable>
            </View>

            <Animated.ScrollView
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
            >
                {/* 1. POSTER HERO - Inspired by Image 0 & 3 */}
                <View style={styles.hero}>
                    <Animated.View style={[styles.heroImageWrapper, heroImageStyle]}>
                        <Image
                            source={{ uri: venue.image || "https://thec1rcle.com/events/placeholder.svg" }}
                            style={styles.heroImage}
                            contentFit="cover"
                        />
                    </Animated.View>
                    <LinearGradient
                        colors={["transparent", "rgba(0,0,0,0.4)", "#000"]}
                        style={styles.heroGradient}
                    />

                    {/* Marquee Band (Static for performance, or animated if library available) */}
                    <View style={styles.marqueeBand}>
                        <Text style={styles.marqueeText}>{venue.name.toUpperCase()} • LIVE • {venue.city?.toUpperCase() || 'HOST'} • {venue.name.toUpperCase()} • </Text>
                    </View>

                    <View style={styles.heroContent}>
                        <Animated.View entering={FadeIn.delay(200)} style={styles.heroBadgeRow}>
                            <Badge variant="iris" size="sm">{venue.neighborhood || venue.area}</Badge>
                            {venue.isVerified && (
                                <View style={styles.verifiedBadge}>
                                    <Ionicons name="checkmark-circle-outline" size={14} color="#F44A22" />
                                    <Text style={styles.verifiedText}>OFFICIAL</Text>
                                </View>
                            )}
                        </Animated.View>
                        <Text style={styles.venueName}>{venue.name.toUpperCase()}</Text>
                        <Text style={styles.taglineText}>"{venue.tagline || 'Experience the Extraordinary'}"</Text>
                    </View>
                </View>

                {/* 2. ACCESS TICKETS - Inspired by Image 1 */}
                <View style={styles.content}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>SELECT ACCESS</Text>
                    </View>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.ticketsScroll}
                    >
                        {/* Ticket 1 */}
                        <View style={[styles.ticketCard, { backgroundColor: '#161616' }]}>
                            <View style={styles.ticketMain}>
                                <Text style={styles.ticketType}>GENERAL ENTRY</Text>
                                <Text style={styles.ticketPrice}>₹1,000</Text>
                            </View>
                            <View style={styles.ticketPerforation}>
                                {[...Array(6)].map((_, i) => <View key={i} style={styles.perfPoint} />)}
                            </View>
                            <Pressable style={styles.ticketAction}>
                                <Text style={styles.ticketActionText}>GET</Text>
                            </Pressable>
                        </View>

                        {/* Ticket 2 - Featured */}
                        <View style={[styles.ticketCard, { backgroundColor: '#A3E635' }]}>
                            <View style={styles.ticketMain}>
                                <Text style={[styles.ticketType, { color: '#000' }]}>VIP PASS</Text>
                                <Text style={[styles.ticketPrice, { color: '#000' }]}>₹3,500</Text>
                            </View>
                            <View style={[styles.ticketPerforation, { backgroundColor: 'rgba(0,0,0,0.1)' }]}>
                                {[...Array(6)].map((_, i) => <View key={i} style={[styles.perfPoint, { backgroundColor: '#000' }]} />)}
                            </View>
                            <Pressable style={[styles.ticketAction, { backgroundColor: '#000' }]}>
                                <Text style={[styles.ticketActionText, { color: '#A3E635' }]}>VIP</Text>
                            </Pressable>
                        </View>
                    </ScrollView>

                    {/* Follow Action */}
                    <View style={styles.followRow}>
                        <PremiumButton
                            variant="primary"
                            style={styles.followButton}
                            onPress={handleFollow}
                        >
                            {isFollowing ? "FOLLOWING" : "FOLLOW VENUE"}
                        </PremiumButton>
                        <Pressable style={styles.shareIconButton}>
                            <Ionicons name="share-outline" size={20} color="#FFF" />
                        </Pressable>
                    </View>

                    {/* Vibe Section */}
                    {venue.tags && venue.tags.length > 0 && (
                        <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
                            <Text style={styles.sectionTitle}>THE VIBE</Text>
                            <View style={styles.tagsContainer}>
                                {venue.tags.map((tag, i) => (
                                    <View key={i} style={styles.tag}>
                                        <Text style={styles.tagText}>{tag.toUpperCase()}</Text>
                                    </View>
                                ))}
                            </View>
                        </Animated.View>
                    )}

                    {/* Timings & Rules Grid */}
                    <Animated.View entering={FadeInDown.delay(450)} style={styles.gridRow}>
                        <View style={styles.gridCard}>
                            <Text style={styles.gridCardTitle}>Timings</Text>
                            {venue.timings ? (
                                Object.entries(venue.timings).slice(0, 3).map(([day, time]) => (
                                    <View key={day} style={styles.timingRow}>
                                        <Text style={styles.timingDay}>{day.toUpperCase()}</Text>
                                        <Text style={styles.timingTime}>{time as string}</Text>
                                    </View>
                                ))
                            ) : (
                                <Text style={styles.emptyText}>Check schedule</Text>
                            )}
                        </View>
                        <View style={styles.gridCard}>
                            <Text style={styles.gridCardTitle}>House Rules</Text>
                            {venue.rules ? (
                                venue.rules.slice(0, 2).map((rule, i) => (
                                    <View key={i} style={styles.ruleRow}>
                                        <Ionicons name="shield-checkmark" size={14} color={colors.iris} />
                                        <Text style={styles.ruleText} numberOfLines={1}>{rule}</Text>
                                    </View>
                                ))
                            ) : (
                                <Text style={styles.emptyText}>Standard rules apply</Text>
                            )}
                        </View>
                    </Animated.View>

                    {/* Upcoming Events */}
                    <Animated.View entering={FadeInDown.delay(500)} style={styles.section}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>UPCOMING EVENTS</Text>
                            {venueEvents.length > 0 && <Text style={styles.seeAll}>See All</Text>}
                        </View>
                        {venueEvents.length > 0 ? (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}
                            >
                                {venueEvents.map((event, i) => (
                                    <View key={event.id} style={{ width: 160 }}>
                                        <EventCard
                                            id={event.id}
                                            title={event.title}
                                            venue={event.venue || venue?.name || "Venue"}
                                            date={new Date(event.startDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                            imageUrl={event.posterUrl || event.coverImage || ""}
                                            price={event.priceDisplay}
                                            category={event.category}
                                            isTonight={event.isTonight}
                                            isSoldOut={false}
                                            variant="grid"
                                            width="100%"
                                        />
                                    </View>
                                ))}
                            </ScrollView>
                        ) : (
                            <View style={styles.emptyEvents}>
                                <Ionicons name="calendar-outline" size={32} color="rgba(255,255,255,0.2)" />
                                <Text style={styles.emptyText}>No upcoming events scheduled.</Text>
                            </View>
                        )}
                    </Animated.View>
                </View >
            </Animated.ScrollView >
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#000",
    },
    errorContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 40,
    },
    errorText: {
        color: "#FFF",
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
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
    },
    hero: {
        height: SCREEN_HEIGHT * 0.55,
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
    marqueeBand: {
        position: "absolute",
        top: '40%',
        backgroundColor: "#F44A22",
        paddingVertical: 12,
        width: '150%',
        transform: [{ rotate: '-10deg' }, { translateX: -50 }],
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    marqueeText: {
        color: "#FFF",
        fontSize: 12,
        fontWeight: "900",
        letterSpacing: 4,
    },
    heroContent: {
        padding: 24,
        paddingBottom: 32,
    },
    heroBadgeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
    },
    verifiedBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: "rgba(244, 74, 34, 0.1)",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: "rgba(244, 74, 34, 0.2)",
    },
    verifiedText: {
        color: "#F44A22",
        fontSize: 10,
        fontWeight: "900",
        letterSpacing: 1,
    },
    venueName: {
        color: "#FFF",
        fontSize: 52,
        fontWeight: "900",
        letterSpacing: -2,
        lineHeight: 48,
    },
    taglineText: {
        color: "rgba(255,255,255,0.6)",
        fontSize: 14,
        fontWeight: "600",
        marginTop: 12,
        fontStyle: "italic",
    },
    content: {
        paddingTop: 24,
    },
    section: {
        paddingHorizontal: 24,
        marginBottom: 32,
    },
    sectionTitle: {
        color: "#F44A22",
        fontSize: 12,
        fontWeight: "900",
        letterSpacing: 3,
        marginBottom: 16,
        paddingHorizontal: 24,
    },
    ticketsScroll: {
        paddingHorizontal: 24,
        gap: 16,
        paddingBottom: 8,
    },
    ticketCard: {
        width: 280,
        height: 120,
        borderRadius: 20,
        flexDirection: "row",
        overflow: "hidden",
    },
    ticketMain: {
        flex: 1,
        padding: 20,
        justifyContent: "space-between",
    },
    ticketType: {
        color: "#FFF",
        fontSize: 16,
        fontWeight: "900",
    },
    ticketPrice: {
        color: "#A3E635",
        fontSize: 24,
        fontWeight: "900",
    },
    ticketPerforation: {
        width: 20,
        height: "100%",
        backgroundColor: "rgba(255,255,255,0.05)",
        justifyContent: "center",
        alignItems: "center",
        gap: 4,
    },
    perfPoint: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: "#000",
    },
    ticketAction: {
        width: 60,
        height: "100%",
        backgroundColor: "#A3E635",
        justifyContent: "center",
        alignItems: "center",
    },
    ticketActionText: {
        color: "#000",
        fontSize: 14,
        fontWeight: "900",
        transform: [{ rotate: '90deg' }],
    },
    followRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 24,
        marginVertical: 32,
    },
    followButton: {
        flex: 1,
    },
    shareIconButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: "#161616",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
    },
    tagsContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    tag: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
    },
    tagText: {
        color: "#FFF",
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 1,
    },
    gridRow: {
        flexDirection: "row",
        gap: 12,
        paddingHorizontal: 24,
        marginBottom: 32,
    },
    gridCard: {
        flex: 1,
        backgroundColor: "rgba(255,255,255,0.05)",
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
    },
    gridCardTitle: {
        color: "rgba(255,255,255,0.4)",
        fontSize: 10,
        fontWeight: "900",
        marginBottom: 12,
        textTransform: "uppercase",
        letterSpacing: 1.5,
    },
    timingRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 6,
    },
    timingDay: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 11,
        fontWeight: "600",
    },
    timingTime: {
        color: "#FFF",
        fontSize: 11,
        fontWeight: "900",
    },
    ruleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
    },
    ruleText: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 12,
        fontWeight: "500",
    },
    sectionHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    seeAll: {
        color: "#F44A22",
        fontSize: 12,
        fontWeight: "800",
        paddingRight: 24,
    },
    eventItem: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#111",
        padding: 12,
        borderRadius: 16,
        marginBottom: 12,
        marginHorizontal: 24,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.05)",
    },
    eventThumb: {
        width: 60,
        height: 60,
        borderRadius: 12,
    },
    eventInfo: {
        flex: 1,
        marginLeft: 16,
    },
    eventTitle: {
        color: "#FFF",
        fontSize: 16,
        fontWeight: "700",
        marginBottom: 4,
    },
    eventDate: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 13,
    },
    emptyText: {
        color: "rgba(255,255,255,0.4)",
        fontSize: 14,
        fontStyle: "italic",
        paddingHorizontal: 24,
    },
    emptyEvents: {
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundColor: "rgba(255,255,255,0.02)",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.05)",
    },
});
