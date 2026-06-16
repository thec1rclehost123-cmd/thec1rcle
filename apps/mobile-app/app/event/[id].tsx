import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import {
    View,
    Text,
    Modal,
    ScrollView,
    Pressable,
    Dimensions,
    ActivityIndicator,
    Alert,
    StyleSheet,
    Platform,
    Linking,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect, useLocalSearchParams, router } from "expo-router";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import { Stack } from "expo-router";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    interpolate,
    useAnimatedScrollHandler,
    withSpring,
    withTiming,
    withRepeat,
    withSequence,
    Easing,
    FadeIn,
    FadeInDown,
    runOnJS,
    SlideInRight,
} from "react-native-reanimated";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useEventsStore, Event, TicketTier } from "@/store/eventsStore";
import { getEventImage, EVENT_PLACEHOLDER } from "@/lib/utils/event";
import { useCartStore } from "@/store/cartStore";
import { colors, radii, gradients, typography } from "@/lib/design/theme";
import { safeDate, formatEventDate, formatEventTime } from "@/lib/utils/date";
import { trackScreen } from "@/lib/analytics";
import { VenueSheet } from "@/components/ui/VenueSheet";
import { GuestlistSheet } from "@/components/ui/GuestlistSheet";
import { HostSheet } from "@/components/ui/HostSheet";
import { useEventInterestStore } from "@/store/eventInterestStore";
import { useFollowStore } from "@/store/followStore";
import { useAuth } from "@/hooks/useAuth";
import { useProfileStore } from "@/store/profileStore";
import { shareEventLink } from "@/lib/deeplinks";
import { useTicketsStore } from "@/store/ticketsStore";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const HEADER_HEIGHT = 400;
const DETAIL_POSTER_WIDTH = Math.min(SCREEN_WIDTH - 48, 360);
const DETAIL_POSTER_HEIGHT = DETAIL_POSTER_WIDTH * 1.35;
const TICKET_TRANSITION_SIZE = Math.hypot(SCREEN_WIDTH, SCREEN_HEIGHT) * 2.1;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const eventFont = {
    regular: typography.fontFamily.body,
    medium: typography.fontFamily.medium,
    bold: typography.fontFamily.heading,
    black: typography.fontFamily.brandAccent,
};

const attendeeAvatarImages = {
    arya: require("../../assets/images/attendees/arya.png"),
    riya: require("../../assets/images/attendees/riya.png"),
    anaya: require("../../assets/images/attendees/anaya.png"),
    isha: require("../../assets/images/attendees/isha.png"),
    hira: require("../../assets/images/attendees/hira.png"),
    yash: require("../../assets/images/attendees/yash.png"),
    neil: require("../../assets/images/attendees/neil.png"),
    sam: require("../../assets/images/attendees/sam.png"),
};

function HeartBurst({
    accent,
    ringStyle,
    particleStyles,
}: {
    accent: string;
    ringStyle: any;
    particleStyles: any[];
}) {
    return (
        <View pointerEvents="none" style={styles.heartBurstLayer}>
            <Animated.View style={[styles.heartBurstRing, { borderColor: accent }, ringStyle]} />
            {particleStyles.map((particleStyle, index) => (
                <Animated.View
                    key={index}
                    style={[styles.heartBurstParticle, { backgroundColor: accent }, particleStyle]}
                />
            ))}
        </View>
    );
}

function normalizeHexColor(color?: string, fallback = "#D915A8") {
    if (!color) return fallback;
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) return color;
    return fallback;
}

function hexToRgba(color: string, alpha: number) {
    const hex = normalizeHexColor(color).replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatGoingDate(value?: string) {
    const date = safeDate(value);
    if (!date) return "Date TBA";
    const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
    const month = date.toLocaleDateString("en-US", { month: "short" });
    const day = date.getDate();
    const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(":00", "");
    return `${weekday}, ${month} ${day} at ${time}`;
}

function GoingMarquee({ accent }: { accent: string }) {
    const marqueeX = useSharedValue(0);

    useEffect(() => {
        marqueeX.value = 0;
        marqueeX.value = withRepeat(
            withTiming(-SCREEN_WIDTH, { duration: 9000, easing: Easing.linear }),
            -1,
            false
        );
    }, [marqueeX]);

    const marqueeStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: marqueeX.value }],
    }));

    return (
        <View style={[styles.goingMarquee, { backgroundColor: accent }]}>
            <Animated.View style={[styles.goingMarqueeTrack, marqueeStyle]}>
                {Array.from({ length: 12 }).map((_, index) => (
                    <Text key={index} style={styles.goingMarqueeText}>THEC1RCLE</Text>
                ))}
            </Animated.View>
        </View>
    );
}

function TicketOriginEventView({
    event,
    params,
    insets,
}: {
    event: Event;
    params: ReturnType<typeof useLocalSearchParams>;
    insets: ReturnType<typeof useSafeAreaInsets>;
}) {
    const eventId = String(params.id || event.id);
    const orderId = typeof params.orderId === "string" ? params.orderId : "";
    const paramAccent = typeof params.accentColor === "string" ? params.accentColor : undefined;
    const accent = colors.iris;
    const title = String(params.eventTitle || event.title || "THE C1RCLE EVENT");
    const poster = getEventImage(event) || (typeof params.eventCoverImage === "string" ? params.eventCoverImage : undefined);
    const address = String(
        params.venueLocation ||
        (event as any).address ||
        event.location ||
        event.venue ||
        "Address TBA"
    );
    const dateLabel = formatGoingDate(String(params.eventDate || event.startDate || ""));
    const [showShare, setShowShare] = useState(false);
    const handleShareGoing = () => {
        Haptics.selectionAsync();
        setShowShare(true);
    };

    const handleCopyLink = async () => {
        Haptics.selectionAsync();
        const eventLink = `https://thec1rcle.com/app/event?id=${encodeURIComponent(eventId)}`;
        await Clipboard.setStringAsync(eventLink);
        Alert.alert("Link Copied!", "The event link has been copied to your clipboard.");
        setShowShare(false);
    };

    const handleIgShare = async () => {
        Haptics.selectionAsync();
        const url = 'instagram-stories://share';
        try {
            const canOpen = await Linking.canOpenURL(url);
            if (canOpen) {
                await Linking.openURL(url);
            } else {
                await Linking.openURL('instagram://app');
            }
        } catch (e) {
            Alert.alert("Error", "Could not open Instagram.");
        }
    };

    const handleSystemShare = async () => {
        Haptics.selectionAsync();
        const eventLink = `https://thec1rcle.com/app/event?id=${encodeURIComponent(eventId)}`;
        await shareEventLink(eventId, title, `I'm going to ${title} on THE C1RCLE.\n\nJoin me there:\n${eventLink}`);
        setShowShare(false);
    };

    const handleViewTicket = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (orderId) {
            router.push({ pathname: "/(tabs)/tickets", params: { orderId } });
        } else if (router.canGoBack()) {
            router.back();
        } else {
            router.replace("/(tabs)/tickets");
        }
    };

    return (
        <View style={[styles.goingScreen, { backgroundColor: accent }]}>
            <SafeAreaView style={styles.goingSafeArea}>
                <GoingMarquee accent={accent} />
                <View style={styles.goingContent}>
                    <Animated.View entering={FadeInDown.duration(420)} style={styles.goingHeader}>
                        <Text style={styles.goingTitle} numberOfLines={3}>
                            {title.toUpperCase()}
                        </Text>
                        <Text style={styles.goingAddress} numberOfLines={2}>{address}</Text>
                        <Text style={styles.goingDate}>{dateLabel}</Text>
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(120).duration(460)} style={styles.goingPosterWrap}>
                        {poster ? (
                            <Image source={{ uri: poster }} style={styles.goingPoster} contentFit="cover" transition={250} />
                        ) : (
                            <LinearGradient colors={[hexToRgba(accent, 0.82), "rgba(0,0,0,0.22)"]} style={styles.goingPoster}>
                            </LinearGradient>
                        )}
                        <LinearGradient
                            colors={["rgba(0,0,0,0)", hexToRgba(accent, 0.28), hexToRgba(accent, 0.96)]}
                            locations={[0.46, 0.72, 1]}
                            style={StyleSheet.absoluteFill}
                        />
                    </Animated.View>
                </View>

                <View style={[styles.goingBottomActions, { paddingBottom: insets.bottom + 18 }]}>
                    <Pressable onPress={handleShareGoing} style={styles.goingCircleButton}>
                        <Ionicons name="share-outline" size={20} color="#161616" />
                    </Pressable>
                    <Pressable onPress={handleViewTicket} style={styles.goingTicketButton}>
                        <Text style={styles.goingTicketButtonText}>View Ticket</Text>
                    </Pressable>
                    <Pressable onPress={() => {
                        if (router.canGoBack()) {
                            router.back();
                        } else {
                            router.setParams({ source: undefined });
                        }
                    }} style={styles.goingCircleButton}>
                        <Ionicons name="close" size={24} color="#161616" />
                    </Pressable>
                </View>

                {/* Share Sheet Modal */}
                <Modal visible={showShare} animationType="slide" transparent>
                    <View style={styles.shareSheetOverlay}>
                        <Pressable style={styles.shareSheetBackdrop} onPress={() => setShowShare(false)} />
                        <View style={styles.shareSheetContent}>
                            <View style={styles.shareSheetHeader}>
                                <Pressable onPress={() => setShowShare(false)} style={{ padding: 10 }}>
                                    <Text style={styles.shareSheetCancelText}>Cancel</Text>
                                </Pressable>
                                <Text style={styles.shareSheetTitleText}>Share With Friends</Text>
                                <Pressable onPress={() => setShowShare(false)} style={{ padding: 10 }}>
                                    <Text style={styles.shareSheetDoneText}>Done</Text>
                                </Pressable>
                            </View>

                            <View style={styles.sharePreviewContainer}>
                                <View style={[styles.sharePreviewCard, { backgroundColor: accent }]}>
                                    <GoingMarquee accent={accent} />
                                    <View style={styles.sharePreviewInfo}>
                                        <Text style={styles.sharePreviewTitle} numberOfLines={2}>{title.toUpperCase()}</Text>
                                        <Text style={styles.sharePreviewAddress}>{address}</Text>
                                        <Text style={styles.sharePreviewDate}>{dateLabel}</Text>
                                    </View>
                                    {poster ? (
                                        <Image source={{ uri: poster }} style={styles.sharePreviewPoster} contentFit="cover" />
                                    ) : (
                                        <View style={styles.sharePreviewPoster} />
                                    )}
                                </View>
                            </View>

                            <View style={styles.shareSheetTextInfo}>
                                <Text style={styles.shareSheetBottomTitle}>{title.toUpperCase()}</Text>
                                <Text style={styles.shareSheetBottomHost}>THE C1RCLE</Text>
                            </View>

                            <View style={styles.shareSheetActionRow}>
                                <Pressable onPress={handleCopyLink} style={styles.shareSheetIconBtn}>
                                    <View style={[styles.shareSheetIconCircle, { backgroundColor: "#2A2A2A" }]}>
                                        <Ionicons name="link" size={24} color="#fff" />
                                    </View>
                                </Pressable>
                                <Pressable onPress={handleIgShare} style={styles.shareSheetIconBtn}>
                                    <View style={[styles.shareSheetIconCircle, { backgroundColor: "#E1306C" }]}>
                                        <Ionicons name="logo-instagram" size={24} color="#fff" />
                                    </View>
                                </Pressable>
                                <Pressable onPress={handleSystemShare} style={styles.shareSheetIconBtn}>
                                    <View style={[styles.shareSheetIconCircle, { backgroundColor: "#2A2A2A" }]}>
                                        <Ionicons name="share-outline" size={24} color="#fff" />
                                    </View>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </Modal>
            </SafeAreaView>
        </View>
    );
}

// Premium Ticket Tier Card
function TicketTierCard({
    tier,
    event,
    promoterCode,
    isPopular,
    index,
}: {
    tier: TicketTier;
    event: Event;
    promoterCode?: string;
    isPopular?: boolean;
    index: number;
}) {
    const [quantity, setQuantity] = useState(1);
    const [added, setAdded] = useState(false);
    const isAvailable = tier.remaining > 0;
    const { addItem } = useCartStore();

    // Compute sold percentage for progress bar
    const soldPercent = tier.soldPercent ?? 0;

    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handleQuantityChange = (delta: number) => {
        Haptics.selectionAsync();
        if (delta > 0) {
            setQuantity(quantity + 1);
        } else {
            setQuantity(Math.max(1, quantity - 1));
        }
    };

    const handleAddToCart = () => {
        const result = addItem({
            eventId: event.id,
            eventTitle: event.title,
            eventDate: event.startDate,
            eventVenue: event.venue || event.location || "TBA",
            eventCoverImage: getEventImage(event) ?? undefined,
            tier,
            quantity,
            promoterCode,
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setAdded(true);
        scale.value = withSpring(1.02, { damping: 10 });

        if (result?.replacedEventTitle) {
            Alert.alert(
                "Started A New Booking",
                `${result.replacedEventTitle} was removed from your cart. Checkout supports one event at a time, just like the guest portal.`
            );
        }

        setTimeout(() => {
            scale.value = withSpring(1);
            setAdded(false);
        }, 2000);
    };

    return (
        <Animated.View
            entering={FadeInDown.delay(index * 80).springify()}
            style={[animatedStyle, styles.tierCard, isPopular && styles.tierCardPopular, !isAvailable && styles.tierCardSoldOut]}
        >
            {/* Popular badge */}
            {isPopular && (
                <View style={styles.popularBadge}>
                    <LinearGradient
                        colors={gradients.primary as [string, string]}
                        style={styles.popularBadgeGradient}
                    >
                        <Text style={styles.popularBadgeText}>⭐ POPULAR</Text>
                    </LinearGradient>
                </View>
            )}

            <View style={styles.tierHeader}>
                <View style={styles.tierInfo}>
                    <Text style={styles.tierName}>{tier.name}</Text>
                    {tier.description && (
                        <Text style={styles.tierDescription}>{tier.description}</Text>
                    )}
                </View>
                <View style={styles.tierPricing}>
                    <Text style={styles.tierPrice}>
                        {tier.price === 0 ? "Free" : `₹${tier.price}`}
                    </Text>
                    <Text style={styles.tierRemaining}>
                        {tier.remaining} left
                    </Text>
                </View>
            </View>

            {/* Sold progress bar */}
            {tier.quantity > 0 && soldPercent > 0 && (
                <View style={styles.inventoryBar}>
                    <View style={[styles.inventoryFill, { width: `${soldPercent}%` as any }]} />
                </View>
            )}

            {/* Quantity & Add Button */}
            {isAvailable ? (
                <View style={styles.tierActions}>
                    <View style={styles.quantitySelector}>
                        <Pressable
                            onPress={() => handleQuantityChange(-1)}
                            style={styles.quantityButton}
                        >
                            <Text style={styles.quantityButtonText}>−</Text>
                        </Pressable>
                        <Text style={styles.quantityValue}>{quantity}</Text>
                        <Pressable
                            onPress={() => handleQuantityChange(1)}
                            style={styles.quantityButton}
                        >
                            <Text style={styles.quantityButtonText}>+</Text>
                        </Pressable>
                    </View>

                    <Pressable onPress={handleAddToCart}>
                        <LinearGradient
                            colors={added ? ["#00D68F", "#00B377"] : gradients.primary as [string, string]}
                            style={styles.addButton}
                        >
                            <Text style={styles.addButtonText}>
                                {added ? "✓ Added!" : "Add to Cart"}
                            </Text>
                        </LinearGradient>
                    </Pressable>
                </View>
            ) : (
                <Pressable
                    onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push(`/waitlist/${event.id}` as never);
                    }}
                    style={styles.soldOutButton}
                >
                    <Text style={styles.soldOutText}>Join Waitlist</Text>
                </Pressable>
            )}
        </Animated.View>
    );
}

// Floating Header Button
function HeaderButton({
    icon,
    onPress,
    badge,
}: {
    icon: React.ReactNode;
    onPress: () => void;
    badge?: number;
}) {
    return (
        <Pressable onPress={onPress} style={styles.headerButton}>
            <BlurView intensity={28} tint="dark" style={styles.headerButtonBlur}>
                {icon}
            </BlurView>
            {badge !== undefined && badge > 0 && (
                <View style={styles.headerButtonBadge}>
                    <Text style={styles.headerButtonBadgeText}>{badge}</Text>
                </View>
            )}
        </Pressable>
    );
}

export default function EventDetailScreen() {
    const params = useLocalSearchParams<{
        id: string;
        ref?: string;
        source?: string;
        orderId?: string;
        eventTitle?: string;
        eventDate?: string;
        eventCoverImage?: string;
        venueLocation?: string;
        hostName?: string;
        accentColor?: string;
        posterTransitionTag?: string;
    }>();
    const { id, ref, source } = params;
    const { getEventById, events, featuredEvents } = useEventsStore();
    const cartItems = useCartStore((s) => s.items);
    const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const profile = useProfileStore((s) => s.profile);
    const { likedEventIds, toggleInterest, fetchInterestedUsers, interestedUsers } = useEventInterestStore();
    const {
        followedVenueIds,
        followedHostIds,
        fetchFollows,
        toggleVenueFollow,
        toggleHostFollow,
    } = useFollowStore();
    const { orders, fetchUserOrders } = useTicketsStore();

    const initialEvent = useMemo(() => {
        return events.find(e => e.id === id) || featuredEvents.find(e => e.id === id) || null;
    }, [id, events, featuredEvents]);

    const [event, setEvent] = useState<Event | null>(initialEvent);
    const [loading, setLoading] = useState(!initialEvent);
    const [venueCoords, setVenueCoords] = useState<{ latitude: number; longitude: number } | null>(null);
    const [descriptionExpanded, setDescriptionExpanded] = useState(false);
    const [showVenueSheet, setShowVenueSheet] = useState(false);
    const [showHostSheet, setShowHostSheet] = useState(false);
    const [showGuestlistSheet, setShowGuestlistSheet] = useState(false);
    const [showTicketSheet, setShowTicketSheet] = useState(false);
    const [heartBurstTarget, setHeartBurstTarget] = useState<"top" | "title">("title");
    const [localLikedEventIds, setLocalLikedEventIds] = useState<Set<string>>(new Set());
    const miniMapRef = useRef<MapView>(null);
    const ticketTransitionLocked = useRef(false);

    const isLiked = id ? likedEventIds.has(id) || localLikedEventIds.has(id) : false;
    const eventInterested = id ? (interestedUsers[id] ?? []) : [];

    const scrollY = useSharedValue(0);
    const ticketTransition = useSharedValue(0);
    const ticketButtonScale = useSharedValue(1);
    const ticketButtonMorph = useSharedValue(0);
    const heartBurst = useSharedValue(0);
    const heartPop = useSharedValue(1);

    useEffect(() => {
        trackScreen("EventDetail");
    }, []);

    useEffect(() => {
        if (user?.uid) {
            void fetchUserOrders(user.uid);
            void fetchFollows(user.uid);
        }
    }, [user?.uid]);

    const confirmedOrder = useMemo(() => {
        if (!id || !orders) return null;
        return orders.find(o => o.eventId === id && (o.status === "confirmed" || o.status === "checked_in"));
    }, [orders, id]);

    const hasOrderForThisEvent = !!confirmedOrder;

    const handleViewOrderConfirmation = () => {
        if (!confirmedOrder || !event) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const accentColor = colors.iris;

        router.push({
            pathname: "/event/[id]",
            params: {
                id: event.id,
                source: "ticketShelf",
                orderId: confirmedOrder.id,
                eventTitle: event.title || "",
                eventDate: event.startDate || "",
                eventCoverImage: getEventImage(event) || "",
                venueLocation: event.venue || event.location || "",
                hostName: event.hostName || "",
                accentColor,
            },
        });
    };

    useEffect(() => {
        async function loadEvent() {
            if (!id) return;
            setLoading(true);
            const eventData = await getEventById(id);
            setEvent(eventData);
            setLoading(false);
            void fetchInterestedUsers(id);

            // Geocode venue
            if (eventData) {
                if (eventData.coordinates) {
                    setVenueCoords(eventData.coordinates);
                } else {
                    const searchText = [eventData.venue, eventData.location, eventData.city]
                        .filter(Boolean)
                        .join(", ");
                    if (searchText) {
                        try {
                            const results = await Location.geocodeAsync(searchText);
                            if (results.length > 0) {
                                setVenueCoords({
                                    latitude: results[0].latitude,
                                    longitude: results[0].longitude,
                                });
                            }
                        } catch (e) {
                            console.warn("[EventDetail] Geocode failed:", e);
                        }
                    }
                }
            }
        }
        loadEvent();
    }, [id]);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    const posterStageAnimatedStyle = useAnimatedStyle(() => ({
        opacity: interpolate(scrollY.value, [0, 150], [1, 0.3]),
        transform: [
            { translateY: interpolate(scrollY.value, [0, 220], [0, -34]) },
            { scale: interpolate(scrollY.value, [0, 220], [1, 0.96]) },
        ],
    }));

    const compactHeaderStyle = useAnimatedStyle(() => ({
        opacity: interpolate(scrollY.value, [150, 240], [0, 1]),
    }));

    const compactHeaderBackdropStyle = useAnimatedStyle(() => ({
        opacity: interpolate(scrollY.value, [105, 220], [0, 1]),
    }));

    const ticketTransitionStyle = useAnimatedStyle(() => ({
        opacity: interpolate(ticketTransition.value, [0, 0.02, 1], [0, 1, 1]),
        transform: [
            { scale: interpolate(ticketTransition.value, [0, 1], [52 / TICKET_TRANSITION_SIZE, 1]) },
        ],
    }));

    const ticketButtonAnimatedStyle = useAnimatedStyle(() => ({
        width: interpolate(ticketButtonMorph.value, [0, 1], [SCREEN_WIDTH * 0.84, 52]),
        height: interpolate(ticketButtonMorph.value, [0, 1], [40, 52]),
        borderRadius: interpolate(ticketButtonMorph.value, [0, 1], [20, 26]),
        opacity: interpolate(ticketTransition.value, [0, 0.12], [1, 0]),
        transform: [{ scale: ticketButtonScale.value }],
    }));

    const ticketButtonTextStyle = useAnimatedStyle(() => ({
        opacity: interpolate(ticketButtonMorph.value, [0, 0.72, 1], [1, 0.3, 0]),
    }));

    useFocusEffect(
        useCallback(() => {
            ticketTransitionLocked.current = false;
            ticketTransition.value = 0;
            ticketButtonScale.value = 1;
            ticketButtonMorph.value = 0;
        }, [ticketButtonMorph, ticketButtonScale, ticketTransition])
    );

    const heartBurstRingStyle = useAnimatedStyle(() => ({
        opacity: interpolate(heartBurst.value, [0, 0.14, 1], [0, 0.78, 0]),
        transform: [{ scale: interpolate(heartBurst.value, [0, 1], [0.45, 1.9]) }],
    }));

    const heartButtonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: heartPop.value }],
    }));

    const heartParticleStyleA = useAnimatedStyle(() => ({
        opacity: interpolate(heartBurst.value, [0, 0.18, 1], [0, 1, 0]),
        transform: [
            { translateX: interpolate(heartBurst.value, [0, 1], [0, -18]) },
            { translateY: interpolate(heartBurst.value, [0, 1], [0, -16]) },
            { scale: interpolate(heartBurst.value, [0, 1], [0.8, 0.15]) },
        ],
    }));

    const heartParticleStyleB = useAnimatedStyle(() => ({
        opacity: interpolate(heartBurst.value, [0, 0.18, 1], [0, 1, 0]),
        transform: [
            { translateX: interpolate(heartBurst.value, [0, 1], [0, 17]) },
            { translateY: interpolate(heartBurst.value, [0, 1], [0, -19]) },
            { scale: interpolate(heartBurst.value, [0, 1], [0.8, 0.15]) },
        ],
    }));

    const heartParticleStyleC = useAnimatedStyle(() => ({
        opacity: interpolate(heartBurst.value, [0, 0.18, 1], [0, 1, 0]),
        transform: [
            { translateX: interpolate(heartBurst.value, [0, 1], [0, -14]) },
            { translateY: interpolate(heartBurst.value, [0, 1], [0, 14]) },
            { scale: interpolate(heartBurst.value, [0, 1], [0.8, 0.15]) },
        ],
    }));

    const heartParticleStyleD = useAnimatedStyle(() => ({
        opacity: interpolate(heartBurst.value, [0, 0.18, 1], [0, 1, 0]),
        transform: [
            { translateX: interpolate(heartBurst.value, [0, 1], [0, 18]) },
            { translateY: interpolate(heartBurst.value, [0, 1], [0, 13]) },
            { scale: interpolate(heartBurst.value, [0, 1], [0.8, 0.15]) },
        ],
    }));

    const heartParticleStyles = [
        heartParticleStyleA,
        heartParticleStyleB,
        heartParticleStyleC,
        heartParticleStyleD,
    ];

    const handleLike = (target: "top" | "title" = "title") => {
        if (!id) return;
        setHeartBurstTarget(target);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        heartBurst.value = 0;
        heartPop.value = withSequence(
            withTiming(0.88, { duration: 60, easing: Easing.out(Easing.quad) }),
            withSpring(1, { damping: 8, stiffness: 360 })
        );
        heartBurst.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
        if (!user?.uid) {
            setLocalLikedEventIds((current) => {
                const next = new Set(current);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
            });
            return;
        }
        toggleInterest(id, user.uid, {
            displayName: profile?.displayName ?? "",
            photoURL: profile?.photoURL ?? null,
        });
    };

    const handleShare = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (!event || !id) return;
        const eventLink = `https://thec1rcle.com/app/event?id=${encodeURIComponent(id)}`;
        void shareEventLink(id, event.title, `${event.title}\n\n${event.venue || event.location || ""}\n${eventLink}`);
    };

    const handleGetDirections = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const query = [event?.venue, (event as any)?.address, event?.location, event?.city]
            .filter(Boolean)
            .join(", ");
        if (!venueCoords) {
            if (query) {
                void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
            }
            return;
        }

        const { latitude, longitude } = venueCoords;
        const label = encodeURIComponent(event?.venue || event?.title || "Event");

        const url = Platform.select({
            ios: `maps:0,0?q=${label}@${latitude},${longitude}`,
            android: `geo:0,0?q=${latitude},${longitude}(${label})`,
        });

        if (url) {
            Linking.openURL(url).catch(() => {
                Linking.openURL(
                    `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
                );
            });
        }
    };

    const navigateToTickets = () => {
        if (cartCount > 0) {
            router.push("/checkout");
        } else if (!event?.tickets?.some((tier) => tier.remaining > 0)) {
            router.push(`/waitlist/${event?.id || id}` as never);
        } else {
            router.push({
                pathname: "/checkout/[eventId]",
                params: {
                    eventId: event?.id || id,
                    ref: typeof ref === "string" ? ref : "",
                },
            });
        }
    };

    const handleGetTickets = () => {
        if (ticketTransitionLocked.current) return;
        ticketTransitionLocked.current = true;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        ticketTransition.value = 0;
        ticketButtonMorph.value = 0;
        ticketButtonScale.value = withTiming(0.96, { duration: 70, easing: Easing.out(Easing.quad) }, () => {
            ticketButtonScale.value = withTiming(1, { duration: 110, easing: Easing.out(Easing.cubic) });
        });
        ticketButtonMorph.value = withTiming(1, { duration: 170, easing: Easing.out(Easing.cubic) }, (morphed) => {
            if (!morphed) return;
            ticketTransition.value = withTiming(1, { duration: 560, easing: Easing.inOut(Easing.cubic) }, (finished) => {
                if (finished) {
                    runOnJS(navigateToTickets)();
                }
            });
        });
    };

    // Loading State
    if (loading) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <ActivityIndicator size="large" color={colors.iris} />
                <Text style={styles.loadingText}>Loading event...</Text>
            </View>
        );
    }

    // Not Found State
    if (!event) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <Text style={styles.errorEmoji}>😕</Text>
                <Text style={styles.errorTitle}>Event Not Found</Text>
                <Text style={styles.errorText}>
                    This event may have been removed or is no longer available.
                </Text>
                <Pressable onPress={() => {
                    if (router.canGoBack()) {
                        router.back();
                    } else {
                        router.replace("/");
                    }
                }}>
                    <LinearGradient
                        colors={gradients.primary as [string, string]}
                        style={styles.errorButton}
                    >
                        <Text style={styles.errorButtonText}>Go Back</Text>
                    </LinearGradient>
                </Pressable>
            </View>
        );
    }

    const formattedDate = (() => {
        const d = safeDate(event.startDate);
        if (!d) return "TBD";
        return d.toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" });
    })();
    const formattedTime = formatEventTime(event.startDate);

    const availableTicketPrices = (event.tickets ?? [])
        .filter((tier) => tier.remaining > 0)
        .map((tier) => tier.price ?? 0);
    const lowestPrice = availableTicketPrices.length > 0
        ? Math.min(...availableTicketPrices)
        : event.minPrice || 0;
    const hasAvailableTickets = availableTicketPrices.length > 0;
    const floatingTicketLabel = cartCount > 0
        ? `Checkout (${cartCount})`
        : hasAvailableTickets
            ? lowestPrice > 0
                ? `Buy ticket from ₹${lowestPrice}`
                : "RSVP"
            : "Sold Out";

    if (source === "ticketShelf") {
        return <TicketOriginEventView event={event} params={params} insets={insets} />;
    }

    const accent = colors.iris;
    const posterUri = getEventImage(event);
    const posterTransitionTag =
        typeof params.posterTransitionTag === "string"
            ? params.posterTransitionTag
            : `poster-${event.id}`;
    const venueId = (event as any).venueId ? String((event as any).venueId) : "";
    const hostId = (event as any).hostId ? String((event as any).hostId) : "";
    const venueProfileName = event.venue || event.hostName || "Venue TBA";
    const venueOrHostLabel = event.hostName || event.venue || "Host TBA";
    const addressLabel = (event as any).address || event.location || event.city || "Address TBA";
    const timeLabel = `${formattedDate} at ${formattedTime}`;
    const interestedFallbackUsers = [
        { userId: "fallback-arya", displayName: "Arya", photoURL: null, photoSource: attendeeAvatarImages.arya, likedAt: "" },
        { userId: "fallback-riya", displayName: "Riya", photoURL: null, photoSource: attendeeAvatarImages.riya, likedAt: "" },
        { userId: "fallback-anaya", displayName: "Anaya", photoURL: null, photoSource: attendeeAvatarImages.anaya, likedAt: "" },
        { userId: "fallback-isha", displayName: "Isha", photoURL: null, photoSource: attendeeAvatarImages.isha, likedAt: "" },
        { userId: "fallback-hira", displayName: "Hira", photoURL: null, photoSource: attendeeAvatarImages.hira, likedAt: "" },
        { userId: "fallback-yash", displayName: "Yash", photoURL: null, photoSource: attendeeAvatarImages.yash, likedAt: "" },
        { userId: "fallback-neil", displayName: "Neil", photoURL: null, photoSource: attendeeAvatarImages.neil, likedAt: "" },
        { userId: "fallback-sam", displayName: "Sam", photoURL: null, photoSource: attendeeAvatarImages.sam, likedAt: "" },
    ];
    const guestlistUsers = eventInterested.length > 0 ? eventInterested : interestedFallbackUsers;
    const interestedLeadName = "Arya";
    const interestedOthersCount = 60;
    const instagramHandle =
        (event as any).venueInstagram ||
        (event as any).hostInstagram ||
        (event as any).instagram ||
        (event as any).igHandle ||
        "";
    const venueProfileBio =
        (event as any).venueDescription ||
        (event as any).hostDescription ||
        (event as any).venueBio ||
        (event as any).hostBio ||
        "Updates, table reservations, giveaways, and more.";
    const isFollowingProfile = venueId
        ? followedVenueIds.has(venueId)
        : hostId
            ? followedHostIds.has(hostId)
            : false;

    const handleFollowProfile = () => {
        if (!user?.uid) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (venueId) {
            void toggleVenueFollow(venueId, venueProfileName, user.uid);
        } else if (hostId) {
            void toggleHostFollow(hostId, venueProfileName, user.uid);
        } else {
            setShowVenueSheet(true);
        }
    };

    const handleOpenInstagram = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const cleanHandle = String(instagramHandle).replace(/^@/, "");
        const instagramUrl = cleanHandle ? `instagram://user?username=${cleanHandle}` : "instagram://app";
        const webUrl = cleanHandle ? `https://www.instagram.com/${cleanHandle}` : "https://www.instagram.com";
        Linking.openURL(instagramUrl).catch(() => Linking.openURL(webUrl));
    };

    const handleContactProfile = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const phone = (event as any).venuePhone || (event as any).hostPhone || (event as any).phone;
        const contactUrl = (event as any).contactUrl || (event as any).venueContactUrl || (event as any).hostContactUrl;
        if (contactUrl) {
            void Linking.openURL(String(contactUrl));
        } else if (phone) {
            void Linking.openURL(`tel:${String(phone).replace(/[^\d+]/g, "")}`);
        } else if (event.venue) {
            setShowVenueSheet(true);
        } else {
            setShowHostSheet(true);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: "#050505" }]}>
            <Stack.Screen options={{ animation: "fade", headerShown: false }} />

            <VenueSheet
                visible={showVenueSheet}
                onClose={() => setShowVenueSheet(false)}
                venueName={event.venue || event.location || "Venue"}
                venueLocation={event.location}
                venueCoords={venueCoords}
                venueId={(event as any).venueId}
            />
            <HostSheet
                visible={showHostSheet}
                onClose={() => setShowHostSheet(false)}
                hostName={event.hostName || "Host"}
                hostId={(event as any).hostId}
            />
            <GuestlistSheet
                visible={showGuestlistSheet}
                onClose={() => setShowGuestlistSheet(false)}
                users={guestlistUsers}
                eventId={event.id}
            />

            <Animated.View
                pointerEvents="none"
                style={[
                    styles.compactHeaderBackdrop,
                    { height: Math.max(insets.top - 7, 11) + 56 },
                    compactHeaderBackdropStyle,
                ]}
            />

            <View
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 100,
                    paddingTop: Math.max(insets.top - 7, 11),
                    paddingHorizontal: 18,
                    paddingBottom: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <Pressable
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        if (router.canGoBack()) {
                            router.back();
                        } else {
                            router.replace("/");
                        }
                    }}
                    style={[styles.detailControlButton, { zIndex: 10 }]}
                >
                    <Ionicons name="chevron-back" size={26} color="#fff" />
                </Pressable>
                <Animated.View pointerEvents="none" style={[styles.compactTitle, compactHeaderStyle]}>
                    <Text style={styles.compactTitleText} numberOfLines={1}>{event.title}</Text>
                    <Text style={styles.compactVenueText} numberOfLines={1}>{addressLabel}</Text>
                </Animated.View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Pressable onPress={handleShare} style={styles.detailControlButton}>
                        <Ionicons name="share-outline" size={21} color="#fff" />
                    </Pressable>
                    <AnimatedPressable
                        onPress={() => handleLike("top")}
                        style={[styles.detailControlButton, heartButtonAnimatedStyle]}
                    >
                        {heartBurstTarget === "top" ? (
                            <HeartBurst
                                accent={accent}
                                ringStyle={heartBurstRingStyle}
                                particleStyles={heartParticleStyles}
                            />
                        ) : null}
                        <Ionicons name={isLiked ? "heart" : "heart-outline"} size={22} color={isLiked ? accent : "#fff"} />
                    </AnimatedPressable>
                </View>
            </View>

            <Animated.ScrollView
                bounces={false}
                overScrollMode="never"
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
            >
                <Animated.View style={[styles.posterStage, posterStageAnimatedStyle]}>
                    <View
                        pointerEvents="none"
                        style={[
                            styles.posterDominantGlow,
                            {
                                backgroundColor: hexToRgba(accent, 0.48),
                                shadowColor: accent,
                            },
                        ]}
                    />
                    <View
                        pointerEvents="none"
                        style={[
                            styles.posterSideGlow,
                            {
                                borderColor: hexToRgba(accent, 0.38),
                                shadowColor: accent,
                            },
                        ]}
                    />
                    {posterUri ? (
                        <Image
                            source={{ uri: posterUri }}
                            style={styles.posterBlurBackdrop}
                            contentFit="cover"
                            blurRadius={16}
                            transition={250}
                            cachePolicy="memory-disk"
                        />
                    ) : (
                        <LinearGradient
                            colors={[hexToRgba(accent, 0.78), "#070707"]}
                            style={styles.posterBlurBackdrop}
                        />
                    )}
                    <LinearGradient
                        colors={[hexToRgba(accent, 0.20), "rgba(0,0,0,0.58)", "#050505"]}
                        locations={[0, 0.58, 1]}
                        style={StyleSheet.absoluteFill}
                    />
                    <Animated.View
                        entering={FadeInDown.delay(80).springify()}
                        style={[styles.posterFrame, { borderColor: hexToRgba(accent, 0.42) }]}
                    >
                        {posterUri ? (
                            <Animated.Image
                                sharedTransitionTag={posterTransitionTag}
                                source={{ uri: posterUri }}
                                style={styles.detailPosterImage}
                                resizeMode="cover"
                            />
                        ) : (
                            <LinearGradient
                                colors={["#242424", "#101010"]}
                                style={[styles.detailPosterImage, styles.posterFallback]}
                            >
                                <Ionicons name="musical-notes" size={46} color={accent} />
                            </LinearGradient>
                        )}
                        <LinearGradient
                            pointerEvents="none"
                            colors={["rgba(5,5,5,0)", "rgba(5,5,5,0.45)", "#050505"]}
                            locations={[0, 0.62, 1]}
                            style={styles.posterImageFade}
                        />
                    </Animated.View>
                    <LinearGradient
                        pointerEvents="none"
                        colors={["rgba(5,5,5,0)", "rgba(5,5,5,0.76)", "#050505"]}
                        locations={[0, 0.58, 1]}
                        style={styles.posterStageFade}
                    />
                </Animated.View>

                <View style={styles.detailContent}>
                    <Animated.View
                        entering={FadeInDown.delay(160).springify()}
                        style={styles.detailTitleRow}
                    >
                        <Text
                            style={[styles.detailEventTitle, { color: "#fff" }]}
                            numberOfLines={2}
                            ellipsizeMode="tail"
                        >
                            {event.title}
                        </Text>
                        <AnimatedPressable
                            onPress={() => handleLike("title")}
                            style={[
                                styles.detailTitleLikeButton,
                                isLiked && { borderColor: hexToRgba(accent, 0.5), backgroundColor: hexToRgba(accent, 0.14) },
                                heartButtonAnimatedStyle,
                            ]}
                            hitSlop={8}
                        >
                            {heartBurstTarget === "title" ? (
                                <HeartBurst
                                    accent={accent}
                                    ringStyle={heartBurstRingStyle}
                                    particleStyles={heartParticleStyles}
                                />
                            ) : null}
                            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={23} color={isLiked ? accent : "#fff"} />
                        </AnimatedPressable>
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(180).springify()} style={styles.detailFacts}>
                        <View style={styles.detailFactRow}>
                            <Ionicons name="location-outline" size={18} color="rgba(255,255,255,0.66)" />
                            <Text style={[styles.detailFactText, { color: "rgba(255,255,255,0.78)" }]} numberOfLines={2}>{addressLabel}</Text>
                        </View>
                        <View style={styles.detailFactRow}>
                            <Ionicons name="time-outline" size={18} color="rgba(255,255,255,0.66)" />
                            <Text style={[styles.detailFactText, { color: "rgba(255,255,255,0.78)" }]}>{timeLabel}</Text>
                        </View>
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(195).springify()}>
                        <Pressable
                            style={styles.interestedBar}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setShowGuestlistSheet(true);
                            }}
                        >
                            <View style={styles.interestedAvatars}>
                                {guestlistUsers.slice(0, 6).map((userInfo, index) => {
                                    const initial = (userInfo.displayName?.[0] ?? "?").toUpperCase();
                                    const avatarSource = (userInfo as any).photoSource
                                        ? (userInfo as any).photoSource
                                        : (typeof userInfo?.photoURL === "string" && userInfo.photoURL.length > 0 && (userInfo.photoURL.startsWith("http") || userInfo.photoURL.startsWith("https")))
                                            ? { uri: userInfo.photoURL }
                                            : null;
                                    return (
                                        <View
                                            key={userInfo.userId || `${initial}-${index}`}
                                            style={[
                                                styles.interestedAvatar,
                                                { marginLeft: index > 0 ? -18 : 0, zIndex: 10 - index },
                                            ]}
                                        >
                                            {avatarSource ? (
                                                <Image
                                                    source={avatarSource}
                                                    style={StyleSheet.absoluteFill}
                                                    contentFit="cover"
                                                    contentPosition="center"
                                                />
                                            ) : (
                                                <Text style={styles.interestedAvatarText}>{initial}</Text>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                            <View style={styles.interestedCopyRow}>
                                <Text style={styles.interestedText} numberOfLines={1}>
                                    {interestedLeadName} and {interestedOthersCount} others interested
                                </Text>
                            </View>
                        </Pressable>
                    </Animated.View>

                    {event.description && (
                        <Animated.View entering={FadeInDown.delay(210).springify()} style={styles.detailSection}>
                            <Text style={[styles.detailSectionLabel, { color: "#fff" }]}>Details</Text>
                            <Text
                                style={[styles.detailDescription, { color: "rgba(255,255,255,0.72)" }]}
                                numberOfLines={descriptionExpanded ? undefined : 4}
                            >
                                {event.description}
                            </Text>
                            <Pressable
                                onPress={() => setDescriptionExpanded(!descriptionExpanded)}
                                style={styles.seeMorePressable}
                            >
                                <Text style={[styles.seeMoreText, { color: accent }]}>
                                    {descriptionExpanded ? "see less" : "see more"}
                                </Text>
                            </Pressable>
                        </Animated.View>
                    )}

                    <Animated.View entering={FadeInDown.delay(240).springify()} style={styles.locationSection}>
                        <Text style={styles.locationTitle}>Location</Text>
                        <Text style={styles.locationAddress} numberOfLines={2}>{addressLabel}</Text>
                        <Pressable
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                if (venueCoords) {
                                    router.push({
                                        pathname: "/map" as any,
                                        params: { eventId: id },
                                    });
                                } else {
                                    handleGetDirections();
                                }
                            }}
                            style={styles.detailMapShell}
                        >
                            {venueCoords ? (
                                <MapView
                                    ref={miniMapRef}
                                    style={styles.detailMap}
                                    provider={PROVIDER_DEFAULT}
                                    initialRegion={{
                                        ...venueCoords,
                                        latitudeDelta: 0.008,
                                        longitudeDelta: 0.008,
                                    }}
                                    scrollEnabled={false}
                                    zoomEnabled={false}
                                    rotateEnabled={false}
                                    pitchEnabled={false}
                                    customMapStyle={darkMapStyle}
                                >
                                    <Marker coordinate={venueCoords}>
                                        <View style={styles.mapMarker}>
                                            <Ionicons name="location" size={32} color={accent} />
                                        </View>
                                    </Marker>
                                </MapView>
                            ) : (
                                <LinearGradient colors={["#151515", "#0B0B0B"]} style={styles.mapFallback}>
                                    <Ionicons name="map-outline" size={32} color={accent} />
                                    <Text style={styles.mapFallbackText} numberOfLines={2}>{addressLabel}</Text>
                                </LinearGradient>
                            )}
                            <Pressable onPress={handleGetDirections} style={styles.mapDirectionsButton}>
                                <Ionicons name="navigate-outline" size={16} color="#fff" />
                            </Pressable>
                        </Pressable>
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(270).springify()} style={styles.venueProfileHero}>
                        <Pressable
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                if (event.venue) setShowVenueSheet(true);
                                else setShowHostSheet(true);
                            }}
                            style={[styles.venueProfileLogo, { borderColor: hexToRgba(accent, 0.45) }]}
                        >
                            <Text style={styles.venueProfileLogoText}>{venueProfileName.charAt(0).toUpperCase()}</Text>
                        </Pressable>
                        <View style={styles.venueProfileHeroNameRow}>
                            <Text style={styles.venueProfileHeroName} numberOfLines={2}>{venueProfileName.toUpperCase()}</Text>
                            <Ionicons name="checkmark-circle" size={24} color="#F7C948" />
                        </View>
                        <Text style={styles.venueProfileHeroBio} numberOfLines={3}>
                            {venueProfileBio}
                        </Text>
                        <Pressable onPress={handleFollowProfile} style={styles.venueProfileWideButton}>
                            <Text style={styles.venueProfileWideButtonText}>
                                {isFollowingProfile ? "Following" : "Follow"}
                            </Text>
                        </Pressable>
                        <Pressable onPress={handleContactProfile} style={styles.venueProfileWideButton}>
                            <Text style={styles.venueProfileWideButtonText}>Contact</Text>
                        </Pressable>
                        <Pressable onPress={handleOpenInstagram} style={styles.venueProfileInstagram}>
                            <Ionicons name="logo-instagram" size={30} color="#fff" />
                        </Pressable>
                    </Animated.View>
                </View>
            </Animated.ScrollView>

            <Modal visible={showTicketSheet} animationType="slide" transparent>
                <View style={styles.ticketSheetOverlay}>
                    <Pressable style={styles.ticketSheetBackdrop} onPress={() => setShowTicketSheet(false)} />
                    <View style={[styles.ticketSheet, { paddingBottom: insets.bottom + 18 }]}>
                        <View style={styles.ticketSheetHeader}>
                            <View>
                                <Text style={styles.ticketSheetTitle}>Buy tickets</Text>
                                <Text style={styles.ticketSheetSubtitle} numberOfLines={1}>{event.title}</Text>
                            </View>
                            <Pressable onPress={() => setShowTicketSheet(false)} style={styles.ticketSheetClose}>
                                <Ionicons name="close" size={22} color="#fff" />
                            </Pressable>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} style={styles.ticketSheetList}>
                            {event.tickets?.map((tier, index) => (
                                <TicketTierCard
                                    key={tier.id}
                                    tier={tier}
                                    event={event}
                                    promoterCode={typeof ref === "string" ? ref : undefined}
                                    isPopular={index === 0}
                                    index={index}
                                />
                            ))}
                        </ScrollView>
                        {cartCount > 0 && (
                            <Pressable onPress={() => router.push("/checkout")} style={[styles.ticketSheetCheckout, { backgroundColor: accent }]}>
                                <Text style={styles.ticketSheetCheckoutText}>Checkout ({cartCount})</Text>
                            </Pressable>
                        )}
                    </View>
                </View>
            </Modal>

            <View style={[styles.floatingBottomBar, { paddingBottom: Math.max(insets.bottom - 14, 10) }]} pointerEvents="box-none">
                <AnimatedPressable
                    onPress={handleGetTickets}
                    style={[styles.floatingPill, { backgroundColor: accent }, ticketButtonAnimatedStyle]}
                >
                    <Animated.Text style={[styles.floatingPillText, ticketButtonTextStyle]}>{floatingTicketLabel}</Animated.Text>
                </AnimatedPressable>
            </View>

            <Animated.View
                pointerEvents="none"
                style={[
                    styles.ticketTransitionOverlay,
                    { backgroundColor: accent },
                    ticketTransitionStyle,
                ]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.base.DEFAULT,
    },
    centerContent: {
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },

    // Ticket-origin "you're going" confirmation page
    goingScreen: {
        flex: 1,
    },
    goingSafeArea: {
        flex: 1,
    },
    goingMarquee: {
        height: 34,
        overflow: "hidden",
        justifyContent: "center",
    },
    goingMarqueeTrack: {
        flexDirection: "row",
        alignItems: "center",
        width: SCREEN_WIDTH * 3,
    },
    goingMarqueeText: {
        color: "#161616",
        fontFamily: eventFont.black,
        fontSize: 14,
        fontWeight: "900",
        letterSpacing: 0.5,
        marginRight: 20,
    },
    goingContent: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 96,
    },
    goingHeader: {
        alignItems: "center",
        marginBottom: 16,
    },
    goingMark: {
        color: "#161616",
        fontFamily: eventFont.black,
        fontSize: 22,
        fontWeight: "900",
        fontStyle: "italic",
        marginBottom: 14,
        letterSpacing: 1,
    },
    goingTitle: {
        color: "#161616",
        fontFamily: eventFont.black,
        fontSize: 28,
        fontWeight: "900",
        lineHeight: 30,
        letterSpacing: 0,
        textAlign: "center",
        marginBottom: 16,
    },
    goingAddress: {
        color: "rgba(0, 0, 0, 0.85)",
        fontFamily: eventFont.bold,
        fontSize: 14,
        fontWeight: "800",
        lineHeight: 18,
        textAlign: "center",
        marginHorizontal: 10,
        marginBottom: 4,
    },
    goingDate: {
        color: "rgba(0, 0, 0, 0.75)",
        fontFamily: eventFont.medium,
        fontSize: 14,
        lineHeight: 18,
        textAlign: "center",
    },
    goingPosterWrap: {
        width: "100%",
        aspectRatio: 0.85,
        alignSelf: "center",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        overflow: "hidden",
        backgroundColor: "rgba(0,0,0,0.05)",
    },
    goingPoster: {
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
    },
    goingPosterFallback: {
        color: "#FFFFFF",
        fontFamily: eventFont.black,
        fontSize: 54,
        fontWeight: "900",
    },
    goingDetails: {
        display: "none",
        alignItems: "center",
        marginTop: 18,
        opacity: 0.78,
    },
    goingDetailsLabel: {
        color: "rgba(255,255,255,0.72)",
        fontFamily: eventFont.medium,
        fontSize: 12,
        fontWeight: "600",
        textTransform: "uppercase",
    },
    goingDetailsValue: {
        color: "#FFFFFF",
        fontFamily: eventFont.bold,
        fontSize: 16,
        fontWeight: "700",
        marginTop: 4,
    },
    goingBottomActions: {
        position: "absolute",
        left: 20,
        right: 20,
        bottom: 0,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
    },
    goingCircleButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(0,0,0,0.05)",
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.08)",
        alignItems: "center",
        justifyContent: "center",
    },
    goingTicketButton: {
        flex: 1,
        height: 48,
        borderRadius: 24,
        backgroundColor: "rgba(0,0,0,0.12)",
        alignItems: "center",
        justifyContent: "center",
    },
    goingTicketButtonText: {
        color: "#161616",
        fontFamily: eventFont.bold,
        fontSize: 15,
        fontWeight: "800",
    },

    // Loading & Error
    loadingText: {
        color: colors.goldMetallic,
        marginTop: 16,
    },
    errorEmoji: {
        fontSize: 64,
        marginBottom: 16,
    },
    errorTitle: {
        color: colors.gold,
        fontSize: 22,
        fontWeight: "700",
        marginBottom: 8,
    },
    errorText: {
        color: colors.goldMetallic,
        fontSize: 15,
        textAlign: "center",
        marginBottom: 24,
    },
    errorButton: {
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: radii.pill,
    },
    errorButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },

    // Floating Header
    floatingHeader: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
    },
    floatingHeaderContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    floatingHeaderActions: {
        flexDirection: "row",
        gap: 8,
    },
    headerButton: {
        position: "relative",
    },
    headerButtonBlur: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        backgroundColor: "rgba(0,0,0,0.3)",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.2)",
    },
    headerButtonIcon: {
        fontSize: 18,
        color: "#fff",
    },
    headerButtonBadge: {
        position: "absolute",
        top: -4,
        right: -4,
        backgroundColor: colors.iris,
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: colors.base.DEFAULT,
    },
    headerButtonBadgeText: {
        color: "#fff",
        fontSize: 10,
        fontWeight: "700",
    },
    detailControlButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.5)",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.24)",
        flexShrink: 0,
        position: "relative",
        overflow: "visible",
    },
    compactHeaderBackdrop: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99,
        backgroundColor: "#050505",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "rgba(255,255,255,0.1)",
    },
    compactTitle: {
        position: "absolute",
        bottom: 10,
        height: 38,
        left: 60,
        right: 90,
        justifyContent: "center",
        alignItems: "center",
        minWidth: 0,
    },
    compactTitleText: {
        color: colors.gold,
        fontFamily: eventFont.black,
        fontSize: 15,
        fontWeight: "900",
        textAlign: "center",
    },
    compactVenueText: {
        color: "rgba(255,255,255,0.48)",
        fontFamily: eventFont.medium,
        fontSize: 10,
        marginTop: 1,
        textAlign: "center",
    },
    heartBurstLayer: {
        position: "absolute",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
        overflow: "visible",
    },
    heartBurstRing: {
        position: "absolute",
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 1.4,
    },
    heartBurstParticle: {
        position: "absolute",
        width: 5,
        height: 5,
        borderRadius: 2.5,
    },

    // Hero
    heroContainer: {
        height: HEADER_HEIGHT,
    },
    heroImage: {
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
    },
    heroPlaceholder: {
        fontSize: 64,
    },
    heroGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    categoryBadge: {
        position: "absolute",
        left: 16,
    },
    categoryBadgeGradient: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: radii.pill,
    },
    categoryBadgeText: {
        color: "#fff",
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 1,
    },

    // Content
    content: {
        paddingHorizontal: 20,
        marginTop: 0,
    },
    heroTitleContainer: {
        position: "absolute",
        bottom: 24,
        left: 20,
        right: 20,
    },
    heroTitleText: {
        color: "#fff",
        fontFamily: eventFont.black,
        fontSize: 38,
        fontWeight: "900",
        letterSpacing: 0,
        lineHeight: 42,
    },

    // Info Card
    infoCard: {
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        borderRadius: radii.xl,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.08)",
    },
    infoRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    infoIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: "rgba(244, 74, 34, 0.1)",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
    },
    infoIconText: {
        fontSize: 20,
    },
    infoContent: {
        flex: 1,
    },
    infoLabel: {
        color: colors.goldMetallic,
        fontSize: 12,
        marginBottom: 2,
    },
    infoValue: {
        color: colors.gold,
        fontSize: 15,
        fontWeight: "500",
    },
    infoDivider: {
        height: 1,
        backgroundColor: "rgba(255, 255, 255, 0.06)",
        marginVertical: 12,
        marginLeft: 58,
    },

    // Attendees
    attendeesCard: {
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        borderRadius: radii.xl,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.08)",
    },
    attendeesHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    attendeesTitle: {
        color: colors.gold,
        fontSize: 16,
        fontWeight: "600",
    },
    interestedBadge: {
        backgroundColor: "rgba(244,74,34,0.12)",
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: "rgba(244,74,34,0.25)",
    },
    interestedBadgeText: {
        color: "#F44A22",
        fontSize: 11,
        fontWeight: "700",
    },
    attendeesRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    attendeesAvatars: {
        flexDirection: "row",
        marginRight: 12,
    },
    attendeeAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 3,
        borderColor: colors.base[50],
        overflow: "hidden",
    },
    attendeeAvatarImg: {
        width: "100%",
        height: "100%",
    },
    attendeeAvatarGradient: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    attendeeAvatarEmoji: {
        fontSize: 16,
    },
    attendeeAvatarInitial: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "700",
    },
    attendeesCount: {
        color: colors.goldMetallic,
        fontSize: 14,
    },
    interestedHint: {
        color: "rgba(255,255,255,0.25)",
        fontSize: 12,
        marginTop: 10,
        textAlign: "center",
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
    description: {
        color: colors.goldDark,
        fontSize: 15,
        lineHeight: 24,
    },
    readMoreText: {
        color: colors.iris,
        fontSize: 14,
        fontWeight: "600",
        marginTop: 6,
    },

    // Host
    hostCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        borderRadius: radii.xl,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.08)",
    },
    hostAvatar: {
        marginRight: 14,
    },
    hostAvatarGradient: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: "center",
        justifyContent: "center",
    },
    hostAvatarEmoji: {
        fontSize: 24,
    },
    hostInfo: {
        flex: 1,
    },
    hostNameRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    hostName: {
        color: colors.gold,
        fontSize: 16,
        fontWeight: "600",
    },
    hostVerified: {
        color: colors.iris,
        marginLeft: 6,
    },
    hostRole: {
        color: colors.goldMetallic,
        fontSize: 13,
        marginTop: 2,
    },
    followButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: radii.pill,
        borderWidth: 1.5,
        borderColor: colors.iris,
    },
    followButtonText: {
        color: colors.iris,
        fontSize: 14,
        fontWeight: "600",
    },

    // Ticket Tier
    tierCard: {
        backgroundColor: "rgba(255, 255, 255, 0.04)",
        borderRadius: radii.xl,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.08)",
    },
    tierCardPopular: {
        borderColor: colors.iris,
        borderWidth: 1.5,
    },
    tierCardSoldOut: {
        opacity: 0.5,
    },
    popularBadge: {
        position: "absolute",
        top: -12,
        right: 16,
    },
    popularBadgeGradient: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: radii.pill,
    },
    popularBadgeText: {
        color: "#fff",
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 0.5,
    },
    tierHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 16,
    },
    tierInfo: {
        flex: 1,
        marginRight: 16,
    },
    tierName: {
        color: colors.gold,
        fontSize: 18,
        fontWeight: "700",
    },
    tierDescription: {
        color: colors.goldMetallic,
        fontSize: 13,
        marginTop: 4,
    },
    tierPricing: {
        alignItems: "flex-end",
    },
    tierPrice: {
        color: colors.iris,
        fontSize: 22,
        fontWeight: "800",
    },
    tierRemaining: {
        color: colors.goldMetallic,
        fontSize: 12,
        marginTop: 2,
    },
    tierActions: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    quantitySelector: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.base[100],
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: colors.base[200],
    },
    quantityButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    quantityButtonText: {
        color: colors.gold,
        fontSize: 18,
        fontWeight: "500",
    },
    quantityValue: {
        color: colors.gold,
        fontSize: 16,
        fontWeight: "600",
        paddingHorizontal: 12,
    },
    addButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: radii.pill,
    },
    addButtonText: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "600",
    },
    soldOutButton: {
        backgroundColor: colors.base[100],
        paddingVertical: 14,
        borderRadius: radii.pill,
        alignItems: "center",
    },
    soldOutText: {
        color: colors.goldMetallic,
        fontSize: 15,
        fontWeight: "600",
    },
    inventoryBar: {
        height: 3,
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 2,
        marginBottom: 12,
        overflow: "hidden",
    },
    inventoryFill: {
        height: "100%",
        backgroundColor: colors.iris,
        borderRadius: 2,
    },

    // Safety
    safetyCard: {
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        borderRadius: radii.xl,
        padding: 16,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.08)",
    },
    safetyTitle: {
        color: colors.gold,
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 8,
    },
    safetyText: {
        color: colors.goldMetallic,
        fontSize: 14,
        lineHeight: 20,
    },

    // Bottom Bar
    bottomBar: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        paddingTop: 16,
        paddingHorizontal: 20,
        borderTopWidth: 1,
        borderTopColor: "rgba(255, 255, 255, 0.08)",
    },
    bottomBarContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    bottomBarPricing: {},
    bottomBarLabel: {
        color: colors.goldMetallic,
        fontSize: 13,
    },
    bottomBarPrice: {
        color: colors.gold,
        fontSize: 24,
        fontWeight: "800",
    },
    bottomBarButton: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: radii.pill,
    },
    bottomBarButtonText: {
        color: "#fff",
        fontSize: 17,
        fontWeight: "600",
    },
    bottomBarButtonArrow: {
        color: "#fff",
        fontSize: 18,
        marginLeft: 8,
    },

    // Confirmation Banner
    confirmationBanner: {
        borderRadius: radii.xl,
        overflow: "hidden",
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.08)",
    },
    confirmationBannerGradient: {
        padding: 16,
    },
    confirmationBannerContent: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
    },
    confirmationBannerEmoji: {
        fontSize: 28,
        marginRight: 12,
    },
    confirmationBannerTextContainer: {
        flex: 1,
    },
    confirmationBannerTitle: {
        color: "#fff",
        fontFamily: eventFont.bold,
        fontSize: 16,
        fontWeight: "700",
    },
    confirmationBannerSubtitle: {
        color: "rgba(255, 255, 255, 0.72)",
        fontFamily: eventFont.regular,
        fontSize: 13,
        marginTop: 2,
    },
    confirmationBannerButton: {
        backgroundColor: "rgba(255, 255, 255, 0.16)",
        borderRadius: radii.pill,
        paddingVertical: 10,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.2)",
    },
    confirmationBannerButtonText: {
        color: "#fff",
        fontFamily: eventFont.bold,
        fontSize: 14,
        fontWeight: "700",
    },

    // Venue Map
    mapSection: {
        marginBottom: 24,
    },
    mapContainer: {
        borderRadius: radii.xl,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
    },
    miniMap: {
        width: "100%",
        height: 180,
    },
    mapMarker: {
        alignItems: "center",
    },
    mapMarkerGradient: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.3)",
    },
    mapActions: {
        flexDirection: "row",
        gap: 10,
        padding: 12,
        backgroundColor: "rgba(255,255,255,0.02)",
    },
    mapActionButton: {
        flex: 1,
    },
    mapActionGradient: {
        paddingVertical: 12,
        borderRadius: radii.pill,
        alignItems: "center",
    },
    mapActionText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "700",
    },
    mapActionButtonOutline: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
        backgroundColor: "rgba(255,255,255,0.04)",
    },
    mapActionOutlineText: {
        color: colors.gold,
        fontSize: 14,
        fontWeight: "600",
    },
    shareSheetOverlay: {
        flex: 1,
        justifyContent: "flex-end",
    },
    shareSheetBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.6)",
    },
    shareSheetContent: {
        backgroundColor: "#161616",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 40,
        paddingTop: 16,
    },
    shareSheetHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
        marginBottom: 24,
    },
    shareSheetCancelText: {
        color: "#888",
        fontSize: 16,
    },
    shareSheetDoneText: {
        color: "#888",
        fontSize: 16,
    },
    shareSheetTitleText: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
    },
    sharePreviewContainer: {
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 24,
    },
    sharePreviewCard: {
        width: 180,
        height: 320,
        borderRadius: 16,
        overflow: "hidden",
    },
    sharePreviewInfo: {
        padding: 12,
        alignItems: "center",
        flex: 1,
        justifyContent: "center",
    },
    sharePreviewHost: {
        color: "#161616",
        fontSize: 12,
        fontWeight: "800",
        marginBottom: 4,
    },
    sharePreviewTitle: {
        color: "#161616",
        fontSize: 16,
        fontWeight: "900",
        textAlign: "center",
        marginBottom: 4,
    },
    sharePreviewAddress: {
        color: "rgba(0,0,0,0.7)",
        fontSize: 10,
        textAlign: "center",
    },
    sharePreviewDate: {
        color: "rgba(0,0,0,0.7)",
        fontSize: 10,
        textAlign: "center",
    },
    sharePreviewPoster: {
        width: "100%",
        height: 160,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
    },
    shareSheetTextInfo: {
        alignItems: "center",
        marginBottom: 24,
    },
    shareSheetBottomTitle: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "800",
        marginBottom: 4,
    },
    shareSheetBottomHost: {
        color: "#888",
        fontSize: 14,
    },
    detailTopStrip: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        paddingHorizontal: 18,
        paddingBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    detailTopActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    detailCompactTitle: {
        flex: 1,
        marginHorizontal: 12,
    },
    detailCompactTitleText: {
        color: "#fff",
        fontFamily: eventFont.bold,
        fontSize: 14,
        fontWeight: "800",
        textAlign: "center",
    },
    posterStage: {
        height: DETAIL_POSTER_HEIGHT + 116,
        paddingTop: 106,
        paddingHorizontal: 24,
        alignItems: "center",
        justifyContent: "flex-start",
        overflow: "hidden",
        backgroundColor: "#050505",
    },
    posterDominantGlow: {
        position: "absolute",
        top: 64,
        width: DETAIL_POSTER_WIDTH + 84,
        height: DETAIL_POSTER_HEIGHT + 92,
        borderRadius: 46,
        opacity: 0.74,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.72,
        shadowRadius: 70,
        elevation: 16,
        transform: [{ scaleX: 0.94 }],
    },
    posterSideGlow: {
        position: "absolute",
        top: 124,
        left: -82,
        width: 188,
        height: 188,
        borderRadius: 94,
        borderWidth: 1,
        opacity: 0.78,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.72,
        shadowRadius: 38,
        elevation: 12,
    },
    posterBlurBackdrop: {
        position: "absolute",
        top: -70,
        left: -64,
        right: -64,
        height: DETAIL_POSTER_HEIGHT + 250,
        opacity: 0.9,
        transform: [{ scale: 1.2 }],
    },
    posterFrame: {
        width: DETAIL_POSTER_WIDTH,
        height: DETAIL_POSTER_HEIGHT,
        borderRadius: 10,
        overflow: "hidden",
        backgroundColor: "#1A1A1A",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.26)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 24 },
        shadowOpacity: 0.52,
        shadowRadius: 36,
        elevation: 12,
        zIndex: 2,
    },
    posterImageFade: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 128,
    },
    posterStageFade: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 190,
        zIndex: 3,
    },
    detailPosterImage: {
        width: "100%",
        height: "100%",
    },
    posterFallback: {
        alignItems: "center",
        justifyContent: "center",
    },
    posterHostName: {
        color: "#FFFFFF",
        fontFamily: eventFont.bold,
        fontSize: 15,
        fontWeight: "800",
        marginTop: 18,
        maxWidth: DETAIL_POSTER_WIDTH,
        textAlign: "center",
        textTransform: "uppercase",
        zIndex: 2,
    },
    detailContent: {
        paddingHorizontal: 22,
        marginTop: -58,
    },
    detailTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginBottom: 10,
    },
    detailEventTitle: {
        flex: 1,
        minWidth: 0,
        color: "#fff",
        fontFamily: eventFont.black,
        fontSize: 34,
        fontWeight: "900",
        lineHeight: 38,
        letterSpacing: 0,
        textAlign: "left",
    },
    detailTitleLikeButton: {
        width: 46,
        height: 46,
        flexShrink: 0,
        borderRadius: 23,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.18)",
        backgroundColor: "rgba(255,255,255,0.06)",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "visible",
    },
    detailFacts: {
        gap: 8,
        marginBottom: 18,
    },
    detailFactRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
    },
    detailFactText: {
        flex: 1,
        color: "rgba(255,255,255,0.74)",
        fontFamily: eventFont.medium,
        fontSize: 15,
        lineHeight: 21,
    },
    interestedBar: {
        minHeight: 118,
        borderRadius: 24,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.12)",
        justifyContent: "center",
        paddingHorizontal: 22,
        paddingVertical: 16,
        marginHorizontal: -8,
        marginBottom: 26,
    },
    interestedAvatars: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        alignSelf: "stretch",
        marginBottom: 12,
    },
    interestedAvatar: {
        width: 73,
        height: 73,
        borderRadius: 36.5,
        borderWidth: 2,
        borderColor: "#050505",
        backgroundColor: "rgba(255,255,255,0.16)",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },
    interestedAvatarText: {
        color: "#fff",
        fontFamily: eventFont.bold,
        fontSize: 18,
        fontWeight: "900",
    },
    interestedCopyRow: {
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
    },
    interestedText: {
        flex: 1,
        color: "rgba(255,255,255,0.84)",
        fontFamily: eventFont.bold,
        fontSize: 15,
        lineHeight: 19,
        fontWeight: "900",
        textAlign: "center",
    },
    detailSection: {
        marginBottom: 30,
    },
    locationSection: {
        marginBottom: 64,
    },
    locationTitle: {
        color: "#fff",
        fontFamily: eventFont.black,
        fontSize: 17,
        fontWeight: "900",
        letterSpacing: 0,
        marginBottom: 4,
    },
    locationAddress: {
        color: "rgba(255,255,255,0.52)",
        fontFamily: eventFont.medium,
        fontSize: 14,
        lineHeight: 18,
        marginBottom: 20,
    },
    detailSectionLabel: {
        color: "#fff",
        fontFamily: eventFont.black,
        fontSize: 18,
        fontWeight: "900",
        letterSpacing: 0,
        marginBottom: 12,
    },
    detailDescription: {
        color: "rgba(255,255,255,0.68)",
        fontFamily: eventFont.medium,
        fontSize: 15,
        lineHeight: 23,
    },
    seeMorePressable: {
        alignSelf: "flex-start",
        marginTop: 8,
        paddingVertical: 6,
    },
    seeMoreText: {
        fontFamily: eventFont.bold,
        fontSize: 14,
        fontWeight: "800",
        textTransform: "lowercase",
    },
    detailMapShell: {
        height: 240,
        borderRadius: 8,
        overflow: "hidden",
        backgroundColor: "#111",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.16)",
    },
    detailMap: {
        width: "100%",
        height: "100%",
    },
    mapFallback: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 22,
        gap: 10,
    },
    mapFallbackText: {
        color: "rgba(255,255,255,0.72)",
        fontFamily: eventFont.medium,
        fontSize: 14,
        lineHeight: 20,
        textAlign: "center",
    },
    mapDirectionsButton: {
        position: "absolute",
        right: 12,
        bottom: 12,
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: "rgba(0,0,0,0.68)",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.2)",
        alignItems: "center",
        justifyContent: "center",
    },
    venueProfileRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        width: "100%",
        minHeight: 68,
        paddingVertical: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.12)",
    },
    venueProfileAvatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        flexGrow: 0,
        flexShrink: 0,
    },
    venueProfileInitial: {
        color: "#fff",
        fontFamily: eventFont.black,
        fontSize: 18,
        fontWeight: "900",
    },
    venueProfileInfo: {
        flex: 1,
        minWidth: 0,
    },
    venueProfileName: {
        color: "#fff",
        fontFamily: eventFont.bold,
        fontSize: 16,
        fontWeight: "800",
    },
    venueProfileMeta: {
        color: "rgba(255,255,255,0.5)",
        fontFamily: eventFont.medium,
        fontSize: 12,
        marginTop: 3,
    },
    venueProfileButton: {
        height: 34,
        paddingHorizontal: 14,
        borderRadius: 17,
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
    },
    venueProfileButtonActive: {
        backgroundColor: "rgba(255,255,255,0.14)",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.28)",
    },
    venueProfileButtonText: {
        color: "#050505",
        fontFamily: eventFont.bold,
        fontSize: 13,
        fontWeight: "900",
    },
    venueProfileButtonTextActive: {
        color: "#fff",
    },
    venueProfileIconButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: "rgba(255,255,255,0.12)",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.18)",
        alignItems: "center",
        justifyContent: "center",
    },
    venueProfileHero: {
        alignItems: "center",
        paddingHorizontal: 4,
        paddingBottom: 12,
        marginBottom: 8,
    },
    venueProfileLogo: {
        width: 52,
        height: 52,
        borderRadius: 26,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#050505",
        marginBottom: 10,
    },
    venueProfileLogoText: {
        color: "#fff",
        fontFamily: eventFont.black,
        fontSize: 17,
        fontWeight: "900",
    },
    venueProfileHeroNameRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        marginBottom: 6,
        paddingHorizontal: 10,
    },
    venueProfileHeroName: {
        color: "#fff",
        fontFamily: eventFont.black,
        fontSize: 19,
        lineHeight: 23,
        fontWeight: "900",
        textAlign: "center",
        flexShrink: 1,
    },
    venueProfileHeroBio: {
        color: "rgba(255,255,255,0.76)",
        fontFamily: eventFont.medium,
        fontSize: 11,
        lineHeight: 14,
        textAlign: "center",
        textTransform: "uppercase",
        marginBottom: 12,
    },
    venueProfileWideButton: {
        width: "56%",
        minWidth: 164,
        height: 34,
        borderRadius: 10,
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8,
    },
    venueProfileWideButtonText: {
        color: "#111",
        fontFamily: eventFont.bold,
        fontSize: 13,
        fontWeight: "900",
    },
    venueProfileInstagram: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 0,
    },
    ticketSheetOverlay: {
        flex: 1,
        justifyContent: "flex-end",
    },
    ticketSheetBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.62)",
    },
    ticketSheet: {
        maxHeight: SCREEN_HEIGHT * 0.78,
        backgroundColor: "#090909",
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        paddingTop: 18,
        paddingHorizontal: 18,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.16)",
    },
    ticketSheetHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 14,
    },
    ticketSheetTitle: {
        color: "#fff",
        fontFamily: eventFont.black,
        fontSize: 22,
        fontWeight: "900",
    },
    ticketSheetSubtitle: {
        color: "rgba(255,255,255,0.58)",
        fontFamily: eventFont.medium,
        fontSize: 13,
        marginTop: 3,
        maxWidth: SCREEN_WIDTH - 112,
    },
    ticketSheetClose: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: "rgba(255,255,255,0.1)",
        alignItems: "center",
        justifyContent: "center",
    },
    ticketSheetList: {
        maxHeight: SCREEN_HEIGHT * 0.52,
    },
    ticketSheetCheckout: {
        height: 52,
        borderRadius: 26,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 8,
    },
    ticketSheetCheckoutText: {
        color: "#fff",
        fontFamily: eventFont.black,
        fontSize: 17,
        fontWeight: "900",
    },
    // Modern Redesign Styles
    heroHostRow: {
        marginBottom: 8,
    },
    heroHostText: {
        color: "#fff",
        fontFamily: eventFont.bold,
        fontSize: 14,
        letterSpacing: 0.5,
    },
    eventTitleModern: {
        color: "#fff",
        fontFamily: eventFont.black,
        fontSize: 34,
        lineHeight: 38,
        letterSpacing: 0,
        marginBottom: 16,
    },
    modernInfoBlock: {
        marginBottom: 32,
    },
    modernInfoPrimary: {
        color: "#fff",
        fontFamily: eventFont.bold,
        fontSize: 18,
        marginBottom: 4,
    },
    modernInfoSecondary: {
        color: "rgba(255,255,255,0.6)",
        fontFamily: eventFont.medium,
        fontSize: 15,
    },
    sectionTitleModern: {
        color: "#fff",
        fontFamily: eventFont.black,
        fontSize: 22,
        marginBottom: 16,
    },
    descriptionModern: {
        color: "rgba(255,255,255,0.7)",
        fontFamily: eventFont.medium,
        fontSize: 16,
        lineHeight: 24,
    },
    showMoreButton: {
        marginTop: 16,
        alignSelf: "flex-start",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.3)",
    },
    showMoreButtonText: {
        color: "#fff",
        fontFamily: eventFont.bold,
        fontSize: 14,
    },
    mapContainerModern: {
        height: 180,
        borderRadius: 16,
        overflow: "hidden",
        opacity: 0.8,
    },
    floatingBottomBar: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 20,
    },
    floatingPill: {
        width: "84%",
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    floatingPillText: {
        color: "#fff",
        fontFamily: eventFont.black,
        fontSize: 14,
        fontWeight: "900",
    },
    ticketTransitionOverlay: {
        position: "absolute",
        width: TICKET_TRANSITION_SIZE,
        height: TICKET_TRANSITION_SIZE,
        left: (SCREEN_WIDTH - TICKET_TRANSITION_SIZE) / 2,
        bottom: -TICKET_TRANSITION_SIZE / 2 + 38,
        borderRadius: TICKET_TRANSITION_SIZE / 2,
        zIndex: 90,
        elevation: 90,
    },
    guestlistPreviewContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 16,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        marginBottom: 32,
    },
    guestlistAvatars: {
        flexDirection: "row",
        marginRight: 12,
    },
    guestlistAvatarSmall: {
        width: 32,
        height: 32,
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 2,
        borderColor: "#000000",
    },
    guestlistPreviewText: {
        color: "#fff",
        fontFamily: eventFont.bold,
        fontSize: 16,
    },
    shareSheetActionRow: {
        flexDirection: "row",
        justifyContent: "space-evenly",
        paddingHorizontal: 20,
    },
    shareSheetIconBtn: {
        alignItems: "center",
    },
    shareSheetIconCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: "center",
        justifyContent: "center",
    },
});

// Dark map style matching the app theme
const darkMapStyle = [
    { elementType: "geometry", stylers: [{ color: "#1d1d1d" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#1d1d1d" }] },
    {
        featureType: "administrative",
        elementType: "geometry",
        stylers: [{ visibility: "off" }],
    },
    {
        featureType: "poi",
        stylers: [{ visibility: "off" }],
    },
    {
        featureType: "road",
        elementType: "geometry.fill",
        stylers: [{ color: "#2c2c2c" }],
    },
    {
        featureType: "road",
        elementType: "geometry.stroke",
        stylers: [{ color: "#212121" }],
    },
    {
        featureType: "road.highway",
        elementType: "geometry.fill",
        stylers: [{ color: "#3c3c3c" }],
    },
    {
        featureType: "transit",
        stylers: [{ visibility: "off" }],
    },
    {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#0e1626" }],
    },
];
