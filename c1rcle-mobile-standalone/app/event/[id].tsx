/**
 * THE C1RCLE — Event Detail Screen
 * 
 * Premium event details page with:
 * - Parallax hero image
 * - Animated content sections
 * - Ticket tiers with reservation
 * - Social proof (attendees, likes)
 * - Share functionality
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    Dimensions,
    Share,
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
    FadeInUp,
    SlideInDown,
    useSharedValue,
    useAnimatedStyle,
    useAnimatedScrollHandler,
    interpolate,
    Extrapolation,
} from "react-native-reanimated";

import { colors, gradients, radii, shadows } from "../../lib/design/theme";
import { useEventsStore, Event } from "../../store/eventsStore";
import { useAuthStore } from "../../store/authStore";
import { useProfileStore } from "../../store/profileStore";
import { Badge } from "../../components/ui/Primitives";
import { PremiumButton } from "../../components/ui/PremiumButton";
import { formatEventDate } from "../../lib/utils/formatters";
import { GuestlistBottomSheet, GuestItem } from "../../components/social/GuestlistBottomSheet";
import { resolveImageUrl } from "../../store/eventsStore";
import { trackEvent, ANALYTICS_EVENTS } from "../../lib/analytics";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const HERO_HEIGHT = SCREEN_HEIGHT * 0.45;

export default function EventDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const insets = useSafeAreaInsets();
    const { getEventById, currentEvent, getEventInterested, getEventAttendees, clearCurrentEvent } = useEventsStore();
    const { user } = useAuthStore();
    const { profile } = useProfileStore();

    const AnimatedScrollView = useMemo(() => Animated.createAnimatedComponent(ScrollView), []);

    const [loading, setLoading] = useState(true);
    const [isSaved, setIsSaved] = useState(false);
    const [isGuestlistVisible, setIsGuestlistVisible] = useState(false);

    // Animation values
    const scrollY = useSharedValue(0);

    // Scroll handler
    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    // Load event
    useEffect(() => {
        loadEvent();
        return () => clearCurrentEvent();
    }, [id]);

    const loadEvent = async () => {
        if (!id) return;
        setLoading(true);
        await getEventById(id);
        setLoading(false);
    };

    useEffect(() => {
        if (currentEvent?.id) {
            getEventInterested(currentEvent.id);
            getEventAttendees(currentEvent.id);

            // Analytics: Log event view
            trackEvent(ANALYTICS_EVENTS.EVENT_VIEWED, {
                eventId: currentEvent.id,
                title: currentEvent.title,
                category: currentEvent.category
            });
        }
    }, [currentEvent?.id]);

    // Normalize guest data for bottom sheet
    const { going, interested } = useMemo(() => {
        if (!currentEvent) return { going: [], interested: [] };

        const currentUserId = user?.uid;

        // Process Attendees (Going)
        const allAttendees = (currentEvent.attendees || [])
            .map(a => {
                const isMe = a.userId === currentUserId;
                const url = isMe ? (profile?.photoURL || a.avatar) : a.avatar;
                const resolvedUrl = resolveImageUrl(url);
                return {
                    id: a.userId,
                    name: isMe ? "You" : (a.name || "Guest"),
                    avatarUrl: (resolvedUrl && resolvedUrl.length > 10) ? resolvedUrl : null,
                    initials: (a.name || "G").charAt(0).toUpperCase(),
                    type: 'going'
                } as GuestItem;
            });

        // Dedup set for fast lookup
        const attendeeIds = new Set(allAttendees.map(a => a.id));

        // Process Interested
        const allInterested = (currentEvent.interestedUsers || [])
            .filter(u => !attendeeIds.has(u.id)) // Filter out existing attendees
            .map(u => {
                const isMe = u.id === currentUserId;
                const url = isMe ? (profile?.photoURL || u.photoURL) : u.photoURL;
                const resolvedUrl = resolveImageUrl(url);
                return {
                    id: u.id,
                    name: isMe ? "You" : (u.name || "User"),
                    avatarUrl: (resolvedUrl && resolvedUrl.length > 10) ? resolvedUrl : null,
                    initials: u.initials || (u.name || "U").charAt(0).toUpperCase(),
                    type: 'interested'
                } as GuestItem;
            });

        return {
            going: allAttendees,
            interested: allInterested
        };
    }, [currentEvent?.attendees, currentEvent?.interestedUsers, user?.uid]);

    // Animated header style
    const headerStyle = useAnimatedStyle(() => {
        const opacity = interpolate(
            scrollY.value,
            [HERO_HEIGHT - 150, HERO_HEIGHT - 100],
            [0, 1],
            Extrapolation.CLAMP
        );
        return { opacity };
    });

    // Parallax hero style
    const heroStyle = useAnimatedStyle(() => {
        const translateY = interpolate(
            scrollY.value,
            [-100, 0, HERO_HEIGHT],
            [-50, 0, HERO_HEIGHT * 0.5],
            Extrapolation.CLAMP
        );
        const scale = interpolate(
            scrollY.value,
            [-100, 0],
            [1.3, 1],
            Extrapolation.CLAMP
        );
        return {
            transform: [{ translateY }, { scale }],
        };
    });

    // Handle share
    const handleShare = async () => {
        if (!currentEvent) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            await Share.share({
                message: `Check out ${currentEvent.title} on THE C1RCLE!\n\nhttps://thec1rcle.com/event/${currentEvent.slug || currentEvent.id}`,
                url: `https://thec1rcle.com/event/${currentEvent.slug || currentEvent.id}`,
            });
            trackEvent("share_clicked", { eventId: currentEvent.id });
        } catch (error) {
            console.error("Error sharing:", error);
        }
    };

    // Handle save
    const handleSave = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsSaved(!isSaved);
        trackEvent(isSaved ? "unsave_clicked" : "save_clicked", { eventId: currentEvent?.id });
    };

    const handleGetTickets = () => {
        if (!currentEvent) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        trackEvent("checkout_started", { eventId: currentEvent.id });
        router.push({
            pathname: "/checkout/[eventId]",
            params: { eventId: currentEvent.id },
        });
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.loadingContainer]}>
                <ActivityIndicator size="large" color={colors?.iris || "#F44A22"} />
                <Text style={styles.loadingText}>Loading event...</Text>
            </View>
        );
    }

    if (!currentEvent) {
        return (
            <View style={[styles.container, styles.errorContainer]}>
                <Ionicons name="search-outline" size={64} color="rgba(255,255,255,0.2)" />
                <Text style={styles.errorTitle}>Event Not Found</Text>
                <Text style={styles.errorText}>
                    Could not find event with ID "{id}". It may have been removed.
                </Text>
                <PremiumButton variant="primary" onPress={() => router.back()}>
                    Go Back
                </PremiumButton>
            </View>
        );
    }

    const formattedDate = formatEventDate(currentEvent.startDate, "short");
    const timeDisplay = currentEvent.time || "";
    const priceDisplay = currentEvent.priceRange?.min > 0
        ? `₹${currentEvent.priceRange.min}${currentEvent.priceRange.max > currentEvent.priceRange.min ? '+' : ''}`
        : currentEvent.isRSVP ? "RSVP" : "Free";

    return (
        <View style={styles.container}>
            {/* Fixed Header (appears on scroll) */}
            <Animated.View style={[styles.fixedHeader, { paddingTop: insets.top }, headerStyle]}>
                <View style={styles.fixedHeaderBg} />
                <Pressable onPress={() => router.back()} style={styles.headerButton}>
                    <Ionicons name="chevron-back" size={24} color={colors?.gold || "#FFF"} />
                </Pressable>
                <Text style={styles.fixedHeaderTitle} numberOfLines={1}>
                    {currentEvent.title}
                </Text>
                <Pressable onPress={handleShare} style={styles.headerButton}>
                    <Ionicons name="share-outline" size={22} color={colors?.gold || "#FFF"} />
                </Pressable>
            </Animated.View>

            <AnimatedScrollView
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120 }}
            >
                {/* Hero Section */}
                <View style={styles.heroContainer}>
                    <Animated.View style={[styles.heroImageWrapper, heroStyle]}>
                        {currentEvent.posterUrl ? (
                            <Image
                                source={{ uri: currentEvent.posterUrl }}
                                style={styles.heroImage}
                                contentFit="cover"
                                transition={300}
                            />
                        ) : (
                            <LinearGradient
                                colors={["#18181b", "#F44A22"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.heroImage}
                            />
                        )}
                    </Animated.View>

                    {/* Gradient Overlay */}
                    <LinearGradient
                        colors={["transparent", "rgba(10,10,10,0.3)", "rgba(10,10,10,0.85)", "#0A0A0A"]}
                        style={styles.heroGradient}
                    />

                    {/* Back Button (floating) */}
                    <Pressable
                        onPress={() => router.back()}
                        style={[styles.floatingBackButton, { top: insets.top + 8 }]}
                    >
                        <View style={styles.floatingButtonInner}>
                            <Ionicons name="chevron-back" size={24} color={colors?.gold || "#FFF"} />
                        </View>
                    </Pressable>

                    {/* Action Buttons */}
                    <View style={[styles.floatingActions, { top: insets.top + 8 }]}>
                        <Pressable onPress={handleSave} style={styles.floatingActionButton}>
                            <Ionicons
                                name={isSaved ? "heart" : "heart-outline"}
                                size={22}
                                color={isSaved ? colors?.iris || "#F44A22" : colors?.gold || "#FFF"}
                            />
                        </Pressable>
                        <Pressable onPress={handleShare} style={styles.floatingActionButton}>
                            <Ionicons name="share-outline" size={22} color={colors?.gold || "#FFF"} />
                        </Pressable>
                    </View>

                    {/* Hero Content */}
                    <Animated.View
                        entering={FadeInUp.delay(200).springify()}
                        style={styles.heroContent}
                    >
                        <View style={styles.badgesRow}>
                            {currentEvent.lifecycle === "live" && (
                                <Badge variant="error" size="sm" animated>
                                    <Ionicons name="radio-button-on" size={10} color="#fff" style={{ marginRight: 4 }} />
                                    LIVE
                                </Badge>
                            )}
                            {currentEvent.isTonight && (
                                <Badge variant="iris" size="sm">
                                    <Ionicons name="moon" size={10} color="#fff" style={{ marginRight: 4 }} />
                                    TONIGHT
                                </Badge>
                            )}
                            {currentEvent.category && (
                                <Badge variant="default" size="sm">{currentEvent.category}</Badge>
                            )}
                            {currentEvent.isHighDemand && !currentEvent.isSoldOut && (
                                <Badge variant="warning" size="sm" animated>
                                    <Ionicons name="flame" size={10} color="#fff" style={{ marginRight: 4 }} />
                                    SELLING FAST
                                </Badge>
                            )}
                        </View>

                        <Text style={styles.heroTitle}>{currentEvent.title}</Text>

                        <View style={styles.quickInfo}>
                            <View style={styles.quickInfoItem}>
                                <Ionicons name="calendar-outline" size={16} color={colors?.goldMetallic || "#888"} />
                                <Text style={styles.quickInfoText}>{formattedDate}</Text>
                            </View>
                            <View style={styles.quickInfoItem}>
                                <Ionicons name="location-outline" size={16} color={colors?.goldMetallic || "#888"} />
                                <Text style={styles.quickInfoText}>
                                    {currentEvent.venue || currentEvent.location || currentEvent.city}
                                </Text>
                            </View>
                            {currentEvent.rating && (
                                <View style={styles.quickInfoItem}>
                                    <Ionicons name="star" size={14} color={colors?.goldMetallic || "#888"} />
                                    <Text style={styles.quickInfoText}>{currentEvent.rating}</Text>
                                </View>
                            )}
                        </View>
                    </Animated.View>
                </View>

                {/* Event Highlights Section (Urgency/Social) */}
                {(!currentEvent.isSoldOut || currentEvent.isTonight) && (
                    <Animated.View
                        entering={FadeInDown.delay(250)}
                        style={styles.highlightsBar}
                    >
                        <View style={styles.highlightItem}>
                            <View style={[styles.highlightIcon, { backgroundColor: 'rgba(244, 74, 34, 0.1)' }]}>
                                <Ionicons name="flash" size={16} color={colors?.iris || "#F44A22"} />
                            </View>
                            <View>
                                <Text style={styles.highlightTitle}>
                                    {currentEvent.isTonight ? "Happening Tonight" : "High Demand"}
                                </Text>
                                <Text style={styles.highlightSub}>{currentEvent.isTonight ? "Doors open soon" : "Secure your spot"}</Text>
                            </View>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.highlightItem}>
                            <View style={[styles.highlightIcon, { backgroundColor: 'rgba(168, 85, 247, 0.1)' }]}>
                                <Ionicons name="people" size={16} color="#A855F7" />
                            </View>
                            <View>
                                <Text style={styles.highlightTitle}>{going.length + interested.length}+ Active</Text>
                                <Text style={styles.highlightSub}>In community</Text>
                            </View>
                        </View>
                    </Animated.View>
                )}

                <View style={styles.content}>
                    {currentEvent.hostName && (
                        <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
                            <Text style={styles.sectionTitle}>Hosted by</Text>
                            <Pressable style={styles.hostCard}>
                                <LinearGradient
                                    colors={["rgba(244, 74, 34, 0.2)", "rgba(244, 74, 34, 0.05)"]}
                                    style={styles.hostAvatar}
                                >
                                    <Text style={styles.hostInitials}>
                                        {currentEvent.hostName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                                    </Text>
                                </LinearGradient>
                                <View style={styles.hostInfo}>
                                    <Text style={styles.hostName}>{currentEvent.hostName}</Text>
                                    <Text style={styles.hostRole}>Event Host</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={colors?.goldMetallic || "#888"} />
                            </Pressable>
                        </Animated.View>
                    )}

                    {currentEvent.description && (
                        <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
                            <Text style={styles.sectionTitle}>About</Text>
                            <Text style={styles.description}>{currentEvent.description}</Text>

                            <View style={styles.metaDetailsGrid}>
                                {currentEvent.ageLimit && (
                                    <View style={styles.metaDetailItem}>
                                        <Ionicons name="calendar" size={14} color={colors?.goldMetallic || "#888"} />
                                        <Text style={styles.metaDetailText}>Entry: {currentEvent.ageLimit}</Text>
                                    </View>
                                )}
                                {currentEvent.dressCode && (
                                    <View style={styles.metaDetailItem}>
                                        <Ionicons name="shirt" size={14} color={colors?.goldMetallic || "#888"} />
                                        <Text style={styles.metaDetailText}>{currentEvent.dressCode}</Text>
                                    </View>
                                )}
                                {(currentEvent.capacity ?? 0) > 0 && (
                                    <View style={styles.metaDetailItem}>
                                        <Ionicons name="business" size={14} color={colors?.goldMetallic || "#888"} />
                                        <Text style={styles.metaDetailText}>Cap: {currentEvent.capacity}</Text>
                                    </View>
                                )}
                            </View>
                        </Animated.View>
                    )}

                    {((currentEvent.interestedUsers && currentEvent.interestedUsers.length > 0) || (currentEvent.attendees && currentEvent.attendees.length > 0)) && (
                        <Animated.View entering={FadeInDown.delay(500)} style={styles.section}>
                            <Pressable
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    setIsGuestlistVisible(true);
                                }}
                                style={({ pressed }) => [
                                    styles.whoGoingTrigger,
                                    pressed && { opacity: 0.7 }
                                ]}
                            >
                                <View style={styles.sectionHeader}>
                                    <Text style={styles.sectionTitle}>Who's Going</Text>
                                    <View style={styles.viewGuestlistBtn}>
                                        <Text style={styles.viewGuestlistText}>View Guestlist</Text>
                                        <Ionicons name="chevron-forward" size={14} color={colors?.gold || "#FFF"} />
                                    </View>
                                </View>
                                <View style={styles.attendeesPreview}>
                                    <View style={styles.avatarStack}>
                                        {going.length > 0 ? (
                                            going.slice(0, 4).map((att, idx) => (
                                                <View
                                                    key={att.id}
                                                    style={[styles.stackAvatar, { marginLeft: idx === 0 ? 0 : -12, zIndex: 10 - idx }]}
                                                >
                                                    <LinearGradient
                                                        colors={["rgba(244, 74, 34, 0.3)", "rgba(244, 74, 34, 0.1)"]}
                                                        style={styles.stackAvatarInner}
                                                    >
                                                        <Text style={styles.stackInitials}>{att.initials}</Text>
                                                    </LinearGradient>
                                                </View>
                                            ))
                                        ) : (
                                            interested.slice(0, 4).map((u, idx) => (
                                                <View
                                                    key={u.id}
                                                    style={[styles.stackAvatar, { marginLeft: idx === 0 ? 0 : -12, zIndex: 10 - idx }]}
                                                >
                                                    <LinearGradient
                                                        colors={["rgba(168, 85, 247, 0.3)", "rgba(168, 85, 247, 0.1)"]}
                                                        style={styles.stackAvatarInner}
                                                    >
                                                        <Text style={styles.stackInitials}>{u.initials}</Text>
                                                    </LinearGradient>
                                                </View>
                                            ))
                                        )}
                                    </View>
                                    <Text style={styles.attendeesText}>
                                        {(currentEvent.attendees?.length || currentEvent.interestedUsers?.length || 0)}+ people interested
                                    </Text>
                                </View>
                            </Pressable>
                        </Animated.View>
                    )}

                    <Animated.View entering={FadeInDown.delay(600)} style={styles.section}>
                        <Text style={styles.sectionTitle}>Location</Text>
                        <Pressable
                            onPress={() => {
                                if (currentEvent.venueId) {
                                    router.push({
                                        pathname: "/venue/[id]",
                                        params: { id: currentEvent.venueId }
                                    });
                                }
                            }}
                            style={styles.venueCard}
                        >
                            <View style={styles.venueIcon}>
                                <Ionicons name="location" size={24} color={colors?.iris || "#F44A22"} />
                            </View>
                            <View style={styles.venueInfo}>
                                <Text style={styles.venueName}>{currentEvent.venue || "Venue"}</Text>
                                <Text style={styles.venueAddress}>
                                    {currentEvent.location || currentEvent.city || "Location TBA"}
                                </Text>
                            </View>
                            <View style={styles.mapButton}>
                                <Text style={styles.mapButtonText}>View</Text>
                            </View>
                        </Pressable>
                    </Animated.View>

                    {currentEvent.tags && currentEvent.tags.length > 0 && (
                        <Animated.View entering={FadeInDown.delay(700)} style={styles.section}>
                            <Text style={styles.sectionTitle}>Tags</Text>
                            <View style={styles.tagsContainer}>
                                {currentEvent.tags.map((tag, index) => (
                                    <View key={index} style={styles.tag}>
                                        <Text style={styles.tagText}>#{tag}</Text>
                                    </View>
                                ))}
                            </View>
                        </Animated.View>
                    )}
                </View>
            </AnimatedScrollView>

            <Animated.View
                entering={FadeIn.delay(800)}
                style={[styles.bottomCTA, { paddingBottom: insets.bottom + 12 }]}
            >
                <View style={styles.ctaContent}>
                    <View style={styles.ctaPrice}>
                        <Text style={styles.ctaPriceLabel}>From</Text>
                        <Text style={styles.ctaPriceValue}>{priceDisplay}</Text>
                    </View>
                    <PremiumButton
                        variant="primary"
                        size="lg"
                        onPress={handleGetTickets}
                        style={styles.ctaButton}
                        disabled={currentEvent.isSoldOut}
                        fullWidth
                    >
                        {currentEvent.isSoldOut ? "Sold Out" : "Get Tickets"}
                    </PremiumButton>
                </View>
            </Animated.View>

            <GuestlistBottomSheet
                isVisible={isGuestlistVisible}
                onClose={() => setIsGuestlistVisible(false)}
                going={going}
                interested={interested}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors?.base?.DEFAULT || "#0A0A0A",
    },
    loadingContainer: {
        justifyContent: "center",
        alignItems: "center",
    },
    loadingText: {
        color: colors?.goldMetallic || "#888",
        marginTop: 16,
        fontSize: 14,
    },
    errorContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 40,
    },
    errorEmoji: {
        fontSize: 64,
        marginBottom: 16,
    },
    errorTitle: {
        color: colors?.gold || "#FFF",
        fontSize: 24,
        fontWeight: "700",
        marginBottom: 8,
    },
    errorText: {
        color: colors?.goldMetallic || "#888",
        fontSize: 16,
        textAlign: "center",
        marginBottom: 24,
    },

    // Fixed Header
    fixedHeader: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingBottom: 12,
    },
    fixedHeaderBg: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors?.base?.DEFAULT || "#0A0A0A",
        opacity: 0.95,
    },
    fixedHeaderTitle: {
        flex: 1,
        color: colors?.gold || "#FFF",
        fontSize: 17,
        fontWeight: "600",
        textAlign: "center",
        marginHorizontal: 8,
    },
    headerButton: {
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
    },

    // Hero Section
    heroContainer: {
        height: HERO_HEIGHT,
        position: "relative",
    },
    heroImageWrapper: {
        ...StyleSheet.absoluteFillObject,
    },
    heroImage: {
        width: "100%",
        height: "100%",
    },
    heroGradient: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: "80%",
    },
    floatingBackButton: {
        position: "absolute",
        left: 16,
        zIndex: 10,
    },
    floatingActions: {
        position: "absolute",
        right: 16,
        zIndex: 10,
        flexDirection: "row",
        gap: 8,
    },
    floatingButtonInner: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(0,0,0,0.5)",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
    },
    floatingActionButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(0,0,0,0.5)",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
    },
    heroContent: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: 24,
        paddingBottom: 40,
    },
    heroTitle: {
        color: colors?.gold || "#FFF",
        fontSize: 34,
        fontWeight: "900",
        marginBottom: 12,
        textTransform: "uppercase",
        letterSpacing: -1,
    },
    badgesRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 12,
    },
    quickInfo: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 16,
    },
    quickInfoItem: {
        flexDirection: "row",
        alignItems: "center",
    },
    quickInfoText: {
        color: colors?.goldMetallic || "#888",
        fontSize: 14,
        marginLeft: 6,
    },

    // Content
    content: {
        paddingTop: 16,
        paddingHorizontal: 16,
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        color: colors?.gold || "#FFF",
        fontSize: 13,
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 2,
        marginBottom: 16,
        opacity: 0.6,
    },
    description: {
        color: colors?.goldMetallic || "#888",
        fontSize: 16,
        lineHeight: 24,
    },

    // Host
    hostCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.base[50],
        borderRadius: radii?.xl || 24,
        padding: 12,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
    },
    hostAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
    },
    hostInitials: {
        color: colors?.iris || "#F44A22",
        fontSize: 18,
        fontWeight: "700",
    },
    hostInfo: {
        flex: 1,
        marginLeft: 14,
    },
    hostName: {
        color: colors?.gold || "#FFF",
        fontSize: 16,
        fontWeight: "600",
    },
    hostRole: {
        color: colors?.goldMetallic || "#888",
        fontSize: 13,
        marginTop: 2,
    },

    // Social Proof
    attendeesPreview: {
        flexDirection: "row",
        alignItems: "center",
    },
    avatarStack: {
        flexDirection: "row",
        marginRight: 12,
    },
    stackAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: colors?.base?.DEFAULT || "#0A0A0A",
        overflow: "hidden",
    },
    stackAvatarInner: {
        width: "100%",
        height: "100%",
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    stackInitials: {
        color: colors?.iris || "#F44A22",
        fontSize: 14,
        fontWeight: "600",
    },
    attendeesText: {
        color: colors?.goldMetallic || "#888",
        fontSize: 14,
    },
    whoGoingTrigger: {
        borderRadius: radii?.xl || 24,
        overflow: 'hidden',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    viewGuestlistBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radii?.pill || 999,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    viewGuestlistText: {
        color: colors?.gold || "#FFF",
        fontSize: 12,
        fontWeight: '600',
        marginRight: 2,
    },

    // Venue
    venueCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.base[50],
        borderRadius: radii?.xl || 24,
        padding: 16,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
    },
    venueIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: "rgba(244, 74, 34, 0.12)",
        alignItems: "center",
        justifyContent: "center",
    },
    venueInfo: {
        flex: 1,
        marginLeft: 14,
    },
    venueName: {
        color: colors?.gold || "#FFF",
        fontSize: 16,
        fontWeight: "600",
    },
    venueAddress: {
        color: colors?.goldMetallic || "#888",
        fontSize: 13,
        marginTop: 2,
    },
    mapButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: colors.base[100],
        borderRadius: radii?.md || 12,
    },
    mapButtonText: {
        color: colors?.iris || "#F44A22",
        fontSize: 13,
        fontWeight: "600",
    },

    // Tags
    tagsContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    tag: {
        backgroundColor: colors.base[50],
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: radii?.pill || 999,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
    },
    tagText: {
        color: colors?.goldMetallic || "#888",
        fontSize: 13,
    },

    // Bottom CTA
    bottomCTA: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors?.base?.DEFAULT || "#0A0A0A",
        borderTopWidth: 1,
        borderTopColor: "rgba(255, 255, 255, 0.06)",
        paddingTop: 14,
        paddingHorizontal: 20,
    },
    ctaContent: {
        flexDirection: "row",
        alignItems: "center",
    },
    ctaPrice: {
        marginRight: 16,
    },
    ctaPriceLabel: {
        color: colors?.goldMetallic || "#888",
        fontSize: 12,
    },
    ctaPriceValue: {
        color: colors?.gold || "#FFF",
        fontSize: 22,
        fontWeight: "800",
    },
    ctaButton: {
        flex: 1,
    },
    // Highlights Bar
    highlightsBar: {
        flexDirection: 'row',
        backgroundColor: colors.base[50],
        marginHorizontal: 20,
        marginTop: -30,
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
        zIndex: 10,
    },
    highlightItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    highlightIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    highlightTitle: {
        color: colors?.gold || "#FFF",
        fontSize: 13,
        fontWeight: '700',
    },
    highlightSub: {
        color: colors?.goldMetallic || "#888",
        fontSize: 10,
        marginTop: 1,
    },
    divider: {
        width: 1,
        height: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginHorizontal: 12,
    },
    // Meta Details
    metaDetailsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.05)',
    },
    metaDetailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
    },
    metaDetailText: {
        color: colors?.gold || "#FFF",
        fontSize: 12,
        fontWeight: '500',
    },
});
