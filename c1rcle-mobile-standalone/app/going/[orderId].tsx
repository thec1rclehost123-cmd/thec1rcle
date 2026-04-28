/**
 * THE C1RCLE — "You're Going" Post-Purchase Celebration Screen
 * 
 * A full-screen, vibrant confirmation experience that appears after checkout.
 * Features: Dynamic event-colored background, large poster, share flow.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Dimensions,
    Platform,
    Share,
    Alert,
    Image as RNImage,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import ViewShot from "react-native-view-shot";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInUp,
    FadeOut,
    SlideInDown,
    SlideOutDown,
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withRepeat,
    withSequence,
    withDelay,
    Easing,
    withTiming,
    interpolate,
} from "react-native-reanimated";



import { colors, gradients, radii, shadows } from "@/lib/design/theme";
import { useTicketsStore, Order } from "@/store/ticketsStore";
import { useEventsStore, Event } from "@/store/eventsStore";
import { buildDeepLink, copyToClipboard } from "@/lib/deeplinks";
import { trackEvent } from "@/lib/analytics";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const POSTER_WIDTH = SCREEN_WIDTH - 64;
const POSTER_HEIGHT = POSTER_WIDTH * 1.4;
const DEFAULT_ACCENT = "#F44A22";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function YoureGoingScreen() {
    const { orderId } = useLocalSearchParams<{ orderId: string }>();
    const insets = useSafeAreaInsets();

    const { getOrderById, enrichOrderWithEvent } = useTicketsStore();
    const { getEventById } = useEventsStore();

    const [order, setOrder] = useState<Order | null>(null);
    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);
    const [showShareSheet, setShowShareSheet] = useState(false);

    const shareCardRef = useRef<ViewShot>(null);

    // Animations
    const posterScale = useSharedValue(0.85);
    const posterOpacity = useSharedValue(0);
    const marqueeOffset = useSharedValue(0);

    useEffect(() => {
        loadData();

        // Haptic celebration
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Animate poster in
        posterOpacity.value = withDelay(200, withSpring(1));
        posterScale.value = withDelay(200, withSpring(1, { damping: 12, stiffness: 100 }));

        // Marquee animation
        marqueeOffset.value = withRepeat(
            withTiming(-SCREEN_WIDTH, { duration: 8000, easing: Easing.linear }),
            -1,
            false
        );

        // Track screen view
        if (orderId) {
            trackEvent("going_screen_viewed", { orderId });
        }
    }, [orderId]);

    const loadData = async () => {
        if (!orderId) return;

        setLoading(true);
        try {
            // Get order
            let orderData = await getOrderById(orderId);
            if (!orderData) {
                setLoading(false);
                return;
            }

            // Enrich with event data
            orderData = await enrichOrderWithEvent(orderData);
            setOrder(orderData);

            // Get full event for additional details
            if (orderData.eventId) {
                const eventData = await getEventById(orderData.eventId);
                setEvent(eventData);

                // Track with eventId
                trackEvent("going_screen_viewed", { orderId, eventId: orderData.eventId });
            }

            // Extract accent color from poster
            updateColors(orderData.eventImage);
        } catch (error) {
            console.error("Error loading going screen data:", error);
        } finally {
            setLoading(false);
        }
    };

    const updateColors = async (image?: string) => {
        if (!image) return;

        // Robust check for Expo Go (storeClient)
        // If we are in Expo Go, we cannot use react-native-image-colors
        if (Constants.executionEnvironment === "storeClient" || Constants.appOwnership === 'expo') {
            setAccentColor(DEFAULT_ACCENT);
            return;
        }

        try {
            // Only attempt import if we're not in Expo Go
            const mod = await import("react-native-image-colors");
            const getColors = mod.default?.getColors || (mod as any).getColors;

            if (typeof getColors !== "function") {
                setAccentColor(DEFAULT_ACCENT);
                return;
            }

            const result = await getColors(image, {
                fallback: DEFAULT_ACCENT,
                cache: true,
                key: image,
            });

            if (result.platform === "ios") {
                setAccentColor((result as any).primary || DEFAULT_ACCENT);
            } else if (result.platform === "android") {
                setAccentColor((result as any).dominant || DEFAULT_ACCENT);
            }
        } catch (e) {
            console.warn("ImageColors failed in Going screen:", e);
            setAccentColor(DEFAULT_ACCENT);
        }
    };

    // ========================================================================
    // ANIMATED STYLES
    // ========================================================================

    const posterAnimStyle = useAnimatedStyle(() => ({
        transform: [{ scale: posterScale.value }],
        opacity: posterOpacity.value,
    }));

    const marqueeStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: marqueeOffset.value }],
    }));

    // ========================================================================
    // ACTIONS
    // ========================================================================

    const handleViewTicket = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (order) {
            router.push({ pathname: "/ticket/[id]", params: { id: order.id } });
        }
    };

    const handleOpenShare = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        trackEvent("going_share_opened", { orderId, eventId: order?.eventId });
        setShowShareSheet(true);
    };

    const handleClose = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // If coming from checkout -> go to tickets tab
        // Otherwise -> go back
        router.replace("/(tabs)/tickets");
    };

    // ========================================================================
    // SHARE ACTIONS
    // ========================================================================

    const getShareLink = () => {
        if (!event?.id) return "";
        return buildDeepLink("event", { id: event.id });
    };

    const getShareMessage = () => {
        const eventTitle = order?.eventTitle || event?.title || "an event";
        return `I'm going to ${eventTitle} on THE C1RCLE – join me: ${getShareLink()}`;
    };

    const handleCopyLink = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const link = getShareLink();
        await copyToClipboard(link);
        trackEvent("going_share_link_copied", { orderId, eventId: order?.eventId });
        Alert.alert("Link Copied!", "Event link copied to clipboard.");
    };

    const handleInstagramShare = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        trackEvent("going_share_instagram", { orderId, eventId: order?.eventId });

        try {
            // Capture share card as image
            if (shareCardRef.current?.capture) {
                const uri = await shareCardRef.current.capture();

                // Check if sharing is available
                const isAvailable = await Sharing.isAvailableAsync();
                if (isAvailable) {
                    await Sharing.shareAsync(uri, {
                        mimeType: "image/png",
                        dialogTitle: "Share to Instagram",
                    });
                } else {
                    Alert.alert("Sharing Unavailable", "Sharing is not available on this device.");
                }
            }
        } catch (error) {
            console.error("Instagram share error:", error);
            Alert.alert("Error", "Failed to share. Please try again.");
        }
    };

    const handleSystemShare = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        trackEvent("going_share_system", { orderId, eventId: order?.eventId });

        try {
            // Capture share card
            let imageUri: string | undefined;
            if (shareCardRef.current?.capture) {
                imageUri = await shareCardRef.current.capture();
            }

            const result = await Share.share({
                message: getShareMessage(),
                url: Platform.OS === "ios" ? getShareLink() : undefined,
            });

            if (result.action === Share.sharedAction) {
                console.log("Shared successfully");
            }
        } catch (error) {
            console.error("System share error:", error);
        }
    };

    // ========================================================================
    // RENDER HELPERS
    // ========================================================================

    const formatEventDate = () => {
        const dateStr = order?.eventDate || event?.startDate;
        if (!dateStr) return "Date TBA";

        const date = new Date(dateStr);
        const options: Intl.DateTimeFormatOptions = {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        };
        return date.toLocaleDateString("en-US", options);
    };

    const eventTitle = order?.eventTitle || event?.title || "Event";
    const eventVenue = order?.eventLocation || event?.venue || event?.location || "";
    const posterUrl = order?.eventImage || event?.posterUrl;
    const hostName = event?.hostName || "THE C1RCLE";

    // Loading state
    if (loading) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <LinearGradient
                    colors={[accentColor, "#000"]}
                    style={StyleSheet.absoluteFill}
                />
                <Text style={styles.loadingText}>Loading...</Text>
            </View>
        );
    }

    // Error state
    if (!order) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <Ionicons name="ticket-outline" size={64} color="rgba(255,255,255,0.3)" />
                <Text style={styles.errorText}>Order not found</Text>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>Go Back</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* BACKGROUND GRADIENT / BLURRED POSTER */}
            <View style={StyleSheet.absoluteFill}>
                {posterUrl ? (
                    <View style={StyleSheet.absoluteFill}>
                        <Image
                            source={{ uri: posterUrl }}
                            style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.2 }] }]}
                            contentFit="cover"
                            transition={1000}
                        />
                        <BlurView
                            intensity={80}
                            tint="dark"
                            style={StyleSheet.absoluteFill}
                        />
                        <LinearGradient
                            colors={["rgba(0,0,0,0.3)", "rgba(0,0,0,0.7)", "#000"]}
                            locations={[0, 0.5, 1]}
                            style={StyleSheet.absoluteFill}
                        />
                    </View>
                ) : (
                    <LinearGradient
                        colors={[accentColor, darkenColor(accentColor, 0.6), "#000"]}
                        locations={[0, 0.4, 1]}
                        style={StyleSheet.absoluteFill}
                    />
                )}
            </View>

            {/* MARQUEE TEXT "YOU'RE GOING" */}
            <View style={styles.marqueeContainer}>
                <Animated.View style={[styles.marqueeTrack, marqueeStyle]}>
                    {[...Array(6)].map((_, i) => (
                        <Text key={i} style={styles.marqueeText}>
                            YOU'RE GOING • YOU'RE GOING •
                        </Text>
                    ))}
                </Animated.View>
            </View>

            {/* MAIN CONTENT */}
            <View style={[styles.content, { paddingTop: insets.top + 60 }]}>
                {/* PARTNER BADGE (if applicable) */}
                {event?.type === "host" && (
                    <Animated.View entering={FadeInDown.delay(100)} style={styles.partnerBadge}>
                        <Text style={styles.partnerBadgeText}>P</Text>
                        <Text style={styles.partnerLabel}>Partner Event</Text>
                    </Animated.View>
                )}

                {/* EVENT TITLE */}
                <Animated.Text
                    entering={FadeInDown.delay(150).springify()}
                    style={styles.eventTitle}
                    numberOfLines={2}
                >
                    {eventTitle.toUpperCase()}
                </Animated.Text>

                {/* VENUE */}
                {eventVenue && (
                    <Animated.Text
                        entering={FadeInDown.delay(200)}
                        style={styles.eventVenue}
                        numberOfLines={2}
                    >
                        {eventVenue}
                    </Animated.Text>
                )}

                {/* DATE/TIME */}
                <Animated.Text entering={FadeInDown.delay(250)} style={styles.eventDate}>
                    {formatEventDate()}
                </Animated.Text>

                {/* POSTER CARD */}
                <Animated.View style={[styles.posterWrapper, posterAnimStyle]}>
                    <View style={[styles.posterCard, { shadowColor: accentColor }]}>
                        {posterUrl ? (
                            <Image
                                source={{ uri: posterUrl }}
                                style={styles.posterImage}
                                contentFit="cover"
                                transition={300}
                            />
                        ) : (
                            <LinearGradient
                                colors={[accentColor, darkenColor(accentColor, 0.4)]}
                                style={styles.posterImage}
                            />
                        )}

                        {/* Bottom fade overlay */}
                        <LinearGradient
                            colors={["transparent", "rgba(0,0,0,0.6)"]}
                            style={styles.posterFade}
                        />
                    </View>
                </Animated.View>
            </View>

            {/* BOTTOM ACTIONS */}
            <View style={[styles.actionsBar, { paddingBottom: insets.bottom + 16 }]}>
                {/* Share Button (Left) */}
                <Pressable onPress={handleOpenShare} style={styles.circleButton}>
                    <Ionicons name="share-outline" size={24} color="#fff" />
                </Pressable>

                {/* View Ticket Button (Center) */}
                <Animated.View entering={FadeInUp.delay(400)}>
                    <Pressable
                        onPress={handleViewTicket}
                        style={[styles.viewTicketBtn, { backgroundColor: DEFAULT_ACCENT }]}
                    >
                        <Text style={styles.viewTicketText}>View Ticket</Text>
                    </Pressable>
                </Animated.View>

                {/* Close Button (Right) */}
                <Pressable onPress={handleClose} style={styles.circleButton}>
                    <Ionicons name="close" size={24} color="#fff" />
                </Pressable>
            </View>

            {/* SHARE SHEET OVERLAY */}
            {showShareSheet && (
                <ShareWithFriendsSheet
                    visible={showShareSheet}
                    onClose={() => setShowShareSheet(false)}
                    order={order}
                    event={event}
                    accentColor={accentColor}
                    posterUrl={posterUrl}
                    onCopyLink={handleCopyLink}
                    onInstagramShare={handleInstagramShare}
                    onSystemShare={handleSystemShare}
                    shareCardRef={shareCardRef}
                />
            )}
        </View>
    );
}

// ============================================================================
// SHARE WITH FRIENDS SHEET
// ============================================================================

interface ShareSheetProps {
    visible: boolean;
    onClose: () => void;
    order: Order | null;
    event: Event | null;
    accentColor: string;
    posterUrl?: string;
    onCopyLink: () => void;
    onInstagramShare: () => void;
    onSystemShare: () => void;
    shareCardRef: React.RefObject<ViewShot | null>;
}

function ShareWithFriendsSheet({
    visible,
    onClose,
    order,
    event,
    accentColor,
    posterUrl,
    onCopyLink,
    onInstagramShare,
    onSystemShare,
    shareCardRef,
}: ShareSheetProps) {
    if (!visible) return null;

    const eventTitle = order?.eventTitle || event?.title || "Event";
    const hostHandle = event?.hostName ? `@${event.hostName.toLowerCase().replace(/\s+/g, "")}` : "@thec1rcle";

    return (
        <View style={StyleSheet.absoluteFill}>
            {/* Backdrop with blur */}
            <Animated.View
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(150)}
                style={StyleSheet.absoluteFill}
            >
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
                    <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill}>
                        <View style={styles.overlayDark} />
                    </BlurView>
                </Pressable>
            </Animated.View>

            {/* Sheet Content */}
            <Animated.View
                entering={SlideInDown.springify().damping(15)}
                exiting={SlideOutDown.duration(200)}
                style={styles.shareSheet}
            >
                {/* Header */}
                <View style={styles.shareSheetHeader}>
                    <Pressable onPress={onClose}>
                        <Text style={styles.sheetCancelText}>Cancel</Text>
                    </Pressable>
                    <Text style={styles.sheetTitle}>Share With Friends</Text>
                    <Pressable onPress={onClose}>
                        <Text style={styles.sheetDoneText}>Done</Text>
                    </Pressable>
                </View>

                {/* Share Card Preview (Capturable) */}
                <ViewShot
                    ref={shareCardRef}
                    options={{ format: "png", quality: 1 }}
                    style={styles.shareCardContainer}
                >
                    <View style={[styles.shareCard, { backgroundColor: accentColor }]}>
                        {/* "YOU'RE GOING" Header */}
                        <Text style={styles.shareCardBadge}>YOU'RE GOING</Text>

                        {/* Poster - Using RN Image for ViewShot compatibility */}
                        <View style={styles.shareCardPoster}>
                            {posterUrl ? (
                                <RNImage
                                    source={{ uri: posterUrl }}
                                    style={styles.shareCardImage}
                                    resizeMode="cover"
                                />
                            ) : (
                                <LinearGradient
                                    colors={[accentColor, darkenColor(accentColor, 0.5)]}
                                    style={styles.shareCardImage}
                                />
                            )}
                        </View>

                        {/* Event Info */}
                        <Text style={styles.shareCardTitle} numberOfLines={2}>
                            {eventTitle.toUpperCase()}
                        </Text>

                        {/* C1RCLE Branding */}
                        <View style={styles.shareCardBranding}>
                            <Text style={styles.shareCardLogo}>♣</Text>
                            <Text style={styles.shareCardBrand}>THE C1RCLE</Text>
                        </View>
                    </View>
                </ViewShot>

                {/* Event Info Below Preview */}
                <View style={styles.shareEventInfo}>
                    <Text style={styles.shareEventTitle}>{eventTitle}</Text>
                    <Text style={styles.shareEventHost}>{hostHandle}</Text>
                </View>

                {/* Share Action Buttons */}
                <View style={styles.shareActionsRow}>
                    {/* Copy Link */}
                    <Pressable onPress={onCopyLink} style={styles.shareActionBtn}>
                        <View style={[styles.shareActionCircle, { backgroundColor: "#333" }]}>
                            <Ionicons name="link" size={24} color="#fff" />
                        </View>
                        <Text style={styles.shareActionLabel}>Copy Link</Text>
                    </Pressable>

                    {/* Instagram */}
                    <Pressable onPress={onInstagramShare} style={styles.shareActionBtn}>
                        <LinearGradient
                            colors={["#833AB4", "#C13584", "#E1306C", "#FD1D1D", "#F77737"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.shareActionCircle}
                        >
                            <Ionicons name="logo-instagram" size={28} color="#fff" />
                        </LinearGradient>
                        <Text style={styles.shareActionLabel}>Instagram</Text>
                    </Pressable>

                    {/* System Share */}
                    <Pressable onPress={onSystemShare} style={styles.shareActionBtn}>
                        <View style={[styles.shareActionCircle, { backgroundColor: "#333" }]}>
                            <Ionicons name="share-social" size={24} color="#fff" />
                        </View>
                        <Text style={styles.shareActionLabel}>More</Text>
                    </Pressable>
                </View>
            </Animated.View>
        </View>
    );
}

// ============================================================================
// HELPERS
// ============================================================================

function darkenColor(hex: string, amount: number): string {
    // Simple darken function
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.max(0, Math.floor((num >> 16) * (1 - amount)));
    const g = Math.max(0, Math.floor(((num >> 8) & 0x00ff) * (1 - amount)));
    const b = Math.max(0, Math.floor((num & 0x0000ff) * (1 - amount)));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
    },
    centerContent: {
        justifyContent: "center",
        alignItems: "center",
    },
    loadingText: {
        color: "rgba(255,255,255,0.6)",
        fontSize: 16,
        marginTop: 12,
    },
    errorText: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 16,
        marginTop: 16,
    },
    backBtn: {
        marginTop: 24,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 20,
        backgroundColor: "rgba(255,255,255,0.1)",
    },
    backBtnText: {
        color: "#fff",
        fontWeight: "600",
    },

    // Marquee
    marqueeContainer: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 60,
        overflow: "hidden",
        justifyContent: "center",
        zIndex: 10,
    },
    marqueeTrack: {
        flexDirection: "row",
        position: "absolute",
    },
    marqueeText: {
        fontSize: 14,
        fontWeight: "900",
        color: "rgba(255,255,255,0.15)",
        letterSpacing: 3,
        textTransform: "uppercase",
    },

    // Content
    content: {
        flex: 1,
        alignItems: "center",
        paddingHorizontal: 24,
    },
    partnerBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.15)",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 16,
    },
    partnerBadgeText: {
        color: "#fff",
        fontWeight: "900",
        fontSize: 12,
        marginRight: 6,
    },
    partnerLabel: {
        color: "rgba(255,255,255,0.8)",
        fontSize: 12,
        fontWeight: "600",
    },
    eventTitle: {
        color: "#fff",
        fontSize: 24,
        fontWeight: "900",
        textAlign: "center",
        letterSpacing: 1,
        lineHeight: 30,
        marginBottom: 8,
    },
    eventVenue: {
        color: "rgba(255,255,255,0.8)",
        fontSize: 14,
        textAlign: "center",
        marginBottom: 4,
    },
    eventDate: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 14,
        marginBottom: 24,
    },

    // Poster
    posterWrapper: {
        width: POSTER_WIDTH,
        height: POSTER_HEIGHT,
    },
    posterCard: {
        flex: 1,
        borderRadius: 24,
        overflow: "hidden",
        backgroundColor: "#1a1a1a",
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.5,
        shadowRadius: 40,
        elevation: 15,
    },
    posterImage: {
        width: "100%",
        height: "100%",
    },
    posterFade: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 100,
    },

    // Actions Bar
    actionsBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 32,
        paddingTop: 20,
    },
    circleButton: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: "rgba(255,255,255,0.15)",
        justifyContent: "center",
        alignItems: "center",
    },
    viewTicketBtn: {
        paddingHorizontal: 40,
        paddingVertical: 16,
        borderRadius: 30,
    },
    viewTicketText: {
        color: "#fff",
        fontSize: 17,
        fontWeight: "700",
    },

    // Share Sheet Overlay
    overlayDark: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.5)",
    },
    shareSheet: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "#1A1A1A",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: Platform.OS === "ios" ? 40 : 24,
    },
    shareSheetHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "rgba(255,255,255,0.1)",
    },
    sheetCancelText: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 16,
        fontWeight: "500",
    },
    sheetTitle: {
        color: "#fff",
        fontSize: 17,
        fontWeight: "700",
    },
    sheetDoneText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },

    // Share Card Preview
    shareCardContainer: {
        alignSelf: "center",
        marginVertical: 24,
    },
    shareCard: {
        width: 200,
        paddingTop: 16,
        paddingBottom: 16,
        borderRadius: 16,
        alignItems: "center",
        overflow: "hidden",
    },
    shareCardBadge: {
        color: "#fff",
        fontSize: 10,
        fontWeight: "900",
        letterSpacing: 2,
        marginBottom: 12,
    },
    shareCardPoster: {
        width: 160,
        height: 200,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: "#333",
        marginBottom: 12,
    },
    shareCardImage: {
        width: "100%",
        height: "100%",
    },
    shareCardTitle: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "800",
        textAlign: "center",
        paddingHorizontal: 12,
        letterSpacing: 0.5,
    },
    shareCardBranding: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 12,
    },
    shareCardLogo: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "900",
        marginRight: 4,
    },
    shareCardBrand: {
        color: "rgba(255,255,255,0.8)",
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 1,
    },

    // Share Event Info
    shareEventInfo: {
        alignItems: "center",
        marginBottom: 24,
    },
    shareEventTitle: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },
    shareEventHost: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 14,
        marginTop: 4,
    },

    // Share Actions Row
    shareActionsRow: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 40,
        paddingHorizontal: 24,
    },
    shareActionBtn: {
        alignItems: "center",
    },
    shareActionCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 8,
    },
    shareActionLabel: {
        color: "rgba(255,255,255,0.8)",
        fontSize: 12,
        fontWeight: "600",
    },
});
