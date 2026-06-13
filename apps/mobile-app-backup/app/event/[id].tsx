import { useEffect, useState, useRef, useMemo } from "react";
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
import { useLocalSearchParams, router } from "expo-router";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    interpolate,
    useAnimatedScrollHandler,
    withSpring,
    withTiming,
    withRepeat,
    Easing,
    FadeIn,
    FadeInDown,
    SlideInRight,
} from "react-native-reanimated";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useEventsStore, Event, TicketTier } from "@/store/eventsStore";
import { getEventImage, EVENT_PLACEHOLDER } from "@/lib/utils/event";
import { useCartStore } from "@/store/cartStore";
import { colors, radii, gradients } from "@/lib/design/theme";
import { safeDate, formatEventDate, formatEventTime } from "@/lib/utils/date";
import { trackScreen } from "@/lib/analytics";
import { VenueSheet } from "@/components/ui/VenueSheet";
import { GuestlistSheet } from "@/components/ui/GuestlistSheet";
import { HostSheet } from "@/components/ui/HostSheet";
import { useEventInterestStore } from "@/store/eventInterestStore";
import { useAuth } from "@/hooks/useAuth";
import { useProfileStore } from "@/store/profileStore";
import { shareEventLink } from "@/lib/deeplinks";
import { useTicketsStore } from "@/store/ticketsStore";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const HEADER_HEIGHT = 400;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const eventFont = {
    regular: "SatoshiRegular",
    medium: "SatoshiMedium",
    bold: "SatoshiBold",
    black: "SatoshiBlack",
};

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
                    <Text key={index} style={styles.goingMarqueeText}>YOU'RE GOING</Text>
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
    const accent = normalizeHexColor(
        (event as any).posterAccentColor ||
        (event as any).dominantColor ||
        (event as any).eventAccentColor ||
        ((event as any).accentColor && String((event as any).accentColor).toUpperCase() !== colors.iris.toUpperCase()
            ? (event as any).accentColor
            : undefined) ||
        paramAccent ||
        "#D915A8"
    );
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
                        <Ionicons name="share-outline" size={26} color="#fff" />
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
                        <Ionicons name="close" size={30} color="#fff" />
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
                                        <Text style={styles.sharePreviewHost}>(P)</Text>
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
            {icon}
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
    }>();
    const { id, ref, source } = params;
    const { getEventById } = useEventsStore();
    const cartCount = 0; // Handled by backend/cart-status
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const profile = useProfileStore((s) => s.profile);
    const { likedEventIds, toggleInterest, fetchInterestedUsers, interestedUsers } = useEventInterestStore();
    const { orders, fetchUserOrders } = useTicketsStore();

    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [venueCoords, setVenueCoords] = useState<{ latitude: number; longitude: number } | null>(null);
    const [descriptionExpanded, setDescriptionExpanded] = useState(false);
    const [showVenueSheet, setShowVenueSheet] = useState(false);
    const [showHostSheet, setShowHostSheet] = useState(false);
    const [showGuestlistSheet, setShowGuestlistSheet] = useState(false);
    const miniMapRef = useRef<MapView>(null);

    const isLiked = id ? likedEventIds.has(id) : false;
    const eventInterested = id ? (interestedUsers[id] ?? []) : [];

    const scrollY = useSharedValue(0);

    useEffect(() => {
        trackScreen("EventDetail");
    }, []);

    useEffect(() => {
        if (user?.uid) {
            void fetchUserOrders(user.uid);
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
        
        const accentColor =
            (event as any).posterAccentColor ||
            (event as any).dominantColor ||
            (event as any).eventAccentColor ||
            ((event as any).accentColor && String((event as any).accentColor).toUpperCase() !== colors.iris.toUpperCase()
                ? (event as any).accentColor
                : undefined) ||
            "#D915A8";

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

    const headerAnimatedStyle = useAnimatedStyle(() => ({
        opacity: interpolate(scrollY.value, [0, 150], [1, 0.3]),
        transform: [
            { translateY: interpolate(scrollY.value, [0, 200], [0, -50]) },
            { scale: interpolate(scrollY.value, [0, 200], [1, 1.1]) },
        ],
    }));

    const compactHeaderStyle = useAnimatedStyle(() => ({
        opacity: interpolate(scrollY.value, [200, 280], [0, 1]),
    }));

    const handleLike = () => {
        if (!user?.uid || !id) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        toggleInterest(id, user.uid, {
            displayName: profile?.displayName ?? "",
            photoURL: profile?.photoURL ?? null,
        });
    };

    const handleShare = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // Share implementation
    };

    const handleGetDirections = () => {
        if (!venueCoords) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

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

    const handleGetTickets = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (cartCount > 0) {
            router.push("/checkout");
        } else if (!event?.tickets?.some((tier) => tier.remaining > 0)) {
            router.push(`/waitlist/${event?.id || id}` as never);
        } else {
            Alert.alert("Select Tickets", "Add at least one ticket to your cart first");
        }
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

    const lowestPrice = event.minPrice || 0;
    const hasAvailableTickets = event.tickets?.some((tier) => tier.remaining > 0) ?? false;

    if (source === "ticketShelf") {
        return <TicketOriginEventView event={event} params={params} insets={insets} />;
    }

    const accent = normalizeHexColor(
        (event as any).posterAccentColor ||
        (event as any).dominantColor ||
        (event as any).eventAccentColor ||
        ((event as any).accentColor && String((event as any).accentColor).toUpperCase() !== colors.iris.toUpperCase()
            ? (event as any).accentColor
            : undefined) ||
        params.accentColor ||
        "#D915A8"
    );

    return (
        <View style={[styles.container, { backgroundColor: "#000000" }]}>
            {/* Venue + Host sheets */}
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
                users={eventInterested}
            />

            {/* Floating Header */}
            <View style={[styles.floatingHeader, { paddingTop: insets.top }]}>
                <View style={styles.floatingHeaderContent}>
                    <HeaderButton
                        icon={<Ionicons name="chevron-back" size={28} color="#fff" />}
                        onPress={() => {
                            if (router.canGoBack()) {
                                router.back();
                            } else {
                                router.replace("/");
                            }
                        }}
                    />

                    {/* Compact title (appears on scroll) */}
                    <Animated.View style={[styles.compactTitle, compactHeaderStyle]}>
                        <Text style={styles.compactTitleText} numberOfLines={1}>
                            {event.title}
                        </Text>
                    </Animated.View>

                    <View style={styles.floatingHeaderActions}>
                        <HeaderButton
                            icon={<Ionicons name={isLiked ? "heart" : "heart-outline"} size={26} color={isLiked ? colors.iris : "#fff"} />}
                            onPress={handleLike}
                        />
                        <HeaderButton
                            icon={<Ionicons name="share-outline" size={26} color="#fff" />}
                            onPress={handleShare}
                        />
                        <HeaderButton
                            icon={<Ionicons name="cart-outline" size={26} color="#fff" />}
                            onPress={() => router.push("/checkout")}
                            badge={cartCount}
                        />
                    </View>
                </View>
            </View>

            <Animated.ScrollView bounces={false} overScrollMode="never"
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 140 }}
            >
                {/* Hero Image with Parallax */}
                <Animated.View style={[styles.heroContainer, headerAnimatedStyle]}>
                    {getEventImage(event) ? (
                        <Image
                            source={{ uri: getEventImage(event)! }}
                            style={styles.heroImage}
                            contentFit="cover"
                            transition={300}
                        />
                    ) : (
                        <LinearGradient
                            colors={["#292929", "#1F1F1F", "#161616"]}
                            style={styles.heroImage}
                        >
                            <Text style={styles.heroPlaceholder}>🎉</Text>
                        </LinearGradient>
                    )}

                    {/* Gradient Overlay removed to match the solid black bleed */}
                </Animated.View>

                {/* Content */}
                <View style={styles.content}>
                    {/* Top Row: Host/Venue and Share */}
                    <View style={styles.heroHostRow}>
                        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                            <Ionicons name="pin" size={16} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={styles.heroHostText} numberOfLines={1}>
                                {(event.hostName || event.venue || "VENUE TBA").toUpperCase()}
                            </Text>
                        </View>
                    </View>

                    {/* Event Title */}
                    <Animated.Text entering={FadeInDown.delay(100).springify()} style={styles.eventTitleModern}>
                        {event.title}
                    </Animated.Text>
                    
                    {/* Location & Date */}
                    <Animated.View entering={FadeInDown.delay(120).springify()} style={styles.modernInfoBlock}>
                        <Text style={styles.modernInfoPrimary}>
                            {event.venue || event.location || "Location TBA"}
                        </Text>
                        <Text style={styles.modernInfoSecondary}>
                            {formattedDate} at {formattedTime}
                        </Text>
                    </Animated.View>

                    {/* Order Confirmation Banner */}
                    {hasOrderForThisEvent && confirmedOrder && (
                        <Animated.View
                            entering={FadeInDown.delay(120).springify()}
                            style={styles.confirmationBanner}
                        >
                            <LinearGradient
                                colors={gradients.primary as [string, string]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.confirmationBannerGradient}
                            >
                                <View style={styles.confirmationBannerContent}>
                                    <Text style={styles.confirmationBannerEmoji}>🎉</Text>
                                    <View style={styles.confirmationBannerTextContainer}>
                                        <Text style={styles.confirmationBannerTitle}>You have tickets!</Text>
                                        <Text style={styles.confirmationBannerSubtitle}>Tap below to view your order confirmation</Text>
                                    </View>
                                </View>
                                <Pressable
                                    onPress={handleViewOrderConfirmation}
                                    style={styles.confirmationBannerButton}
                                >
                                    <Text style={styles.confirmationBannerButtonText}>View Order Confirmation</Text>
                                </Pressable>
                            </LinearGradient>
                        </Animated.View>
                    )}

                    {/* Removed old Date & Time card */}

                    {/* Venue Map */}
                    {venueCoords && (
                        <Animated.View
                            entering={FadeInDown.delay(180).springify()}
                            style={styles.mapSection}
                        >
                            <Text style={styles.sectionTitleModern}>Location</Text>
                            <Text style={[styles.modernInfoPrimary, { marginBottom: 16 }]}>
                                {event.venue || event.location || "Location TBA"}
                            </Text>
                            <Pressable 
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    router.push({
                                        pathname: "/map" as any,
                                        params: { eventId: id },
                                    });
                                }}
                                style={styles.mapContainerModern}
                            >
                                <MapView
                                    ref={miniMapRef}
                                    style={styles.miniMap}
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
                            </Pressable>
                        </Animated.View>
                    )}

                    {/* Guestlist Preview */}
                    {eventInterested.length > 0 && (
                        <Animated.View entering={FadeInDown.delay(200).springify()}>
                            <Pressable 
                                style={styles.guestlistPreviewContainer}
                                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowGuestlistSheet(true); }}
                            >
                                <View style={{ flexDirection: "row", alignItems: "center" }}>
                                    <View style={styles.guestlistAvatars}>
                                        {eventInterested.slice(0, 3).map((u, i) => (
                                            <View key={u.userId} style={[styles.guestlistAvatarSmall, { zIndex: 3 - i, marginLeft: i > 0 ? -12 : 0 }]}>
                                                {u.photoURL ? (
                                                    <Image source={{ uri: u.photoURL }} style={StyleSheet.absoluteFill} contentFit="cover" />
                                                ) : (
                                                    <View style={{ flex: 1, backgroundColor: "#222" }} />
                                                )}
                                            </View>
                                        ))}
                                    </View>
                                    <Text style={styles.guestlistPreviewText}>
                                        {eventInterested.length} Guests
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
                            </Pressable>
                        </Animated.View>
                    )}

                    {/* Details Section */}
                    {event.description && (
                        <Animated.View
                            entering={FadeInDown.delay(250).springify()}
                            style={styles.section}
                        >
                            <Text style={styles.sectionTitleModern}>Details</Text>
                            <Text
                                style={styles.descriptionModern}
                                numberOfLines={descriptionExpanded ? undefined : 3}
                            >
                                {event.description}
                            </Text>
                            <Pressable 
                                onPress={() => setDescriptionExpanded(!descriptionExpanded)}
                                style={styles.showMoreButton}
                            >
                                <Text style={styles.showMoreButtonText}>
                                    {descriptionExpanded ? "Show Less" : "Show More"}
                                </Text>
                            </Pressable>
                        </Animated.View>
                    )}

                    {/* Host Section */}
                    {event.hostName && (
                        <Animated.View
                            entering={FadeInDown.delay(300).springify()}
                        >
                            <Pressable
                            style={styles.hostCard}
                            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowHostSheet(true); }}
                        >
                                <View style={styles.hostAvatar}>
                                    <LinearGradient
                                        colors={gradients.primary as [string, string]}
                                        style={styles.hostAvatarGradient}
                                    >
                                        <Text style={styles.hostAvatarEmoji}>🎧</Text>
                                    </LinearGradient>
                                </View>
                                <View style={styles.hostInfo}>
                                    <View style={styles.hostNameRow}>
                                        <Text style={styles.hostName}>{event.hostName}</Text>
                                        <Text style={styles.hostVerified}>✓</Text>
                                    </View>
                                    <Text style={styles.hostRole}>Event Host</Text>
                                </View>
                                <Pressable style={styles.followButton}>
                                    <Text style={styles.followButtonText}>Follow</Text>
                                </Pressable>
                            </Pressable>
                        </Animated.View>
                    )}

                    {/* Tickets Section */}
                    {event.tickets && event.tickets.length > 0 && (
                        <Animated.View
                            entering={FadeInDown.delay(350).springify()}
                            style={styles.section}
                        >
                            <Text style={styles.sectionTitle}>🎟️ Select Tickets</Text>
                            {event.tickets.map((tier, index) => (
                            <TicketTierCard
                                key={tier.id}
                                tier={tier}
                                event={event}
                                promoterCode={typeof ref === "string" ? ref : undefined}
                                isPopular={index === 0}
                                index={index}
                            />
                            ))}
                        </Animated.View>
                    )}

                    {/* Safety Notice */}
                    <Animated.View
                        entering={FadeInDown.delay(400).springify()}
                        style={styles.safetyCard}
                    >
                        <Text style={styles.safetyTitle}>🛡️ Safety First</Text>
                        <Text style={styles.safetyText}>
                            Share your location with friends using our Party Buddy feature.
                        </Text>
                    </Animated.View>
                </View>
            </Animated.ScrollView>

            {/* Fixed Floating Bottom Bar */}
            <View style={[styles.floatingBottomBar, { paddingBottom: insets.bottom || 24 }]} pointerEvents="box-none">
                {hasOrderForThisEvent ? (
                    <Pressable 
                        onPress={handleViewOrderConfirmation}
                        style={[styles.floatingPill, { backgroundColor: accent }]}
                    >
                        <Text style={styles.floatingPillText}>Order Confirmation</Text>
                    </Pressable>
                ) : (
                    <Pressable 
                        onPress={handleGetTickets}
                        style={[styles.floatingPill, { backgroundColor: accent }]}
                    >
                        <Text style={styles.floatingPillText}>
                            {cartCount > 0 
                                ? `Checkout (${cartCount})` 
                                : hasAvailableTickets 
                                    ? `Buy tickets from $${lowestPrice.toFixed(2)}` 
                                    : "Sold Out"}
                        </Text>
                    </Pressable>
                )}
            </View>
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
        color: "#FFFFFF",
        fontFamily: eventFont.black,
        fontSize: 16,
        fontWeight: "900",
        letterSpacing: 0,
        marginRight: 24,
    },
    goingContent: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 14,
        paddingBottom: 96,
    },
    goingHeader: {
        alignItems: "center",
        marginBottom: 12,
    },
    goingMark: {
        color: "#FFFFFF",
        fontFamily: eventFont.black,
        fontSize: 24,
        fontWeight: "900",
        marginBottom: 12,
        letterSpacing: 0,
    },
    goingTitle: {
        color: "#FFFFFF",
        fontFamily: eventFont.black,
        fontSize: 26,
        fontWeight: "900",
        lineHeight: 30,
        letterSpacing: 0,
        textAlign: "center",
        marginBottom: 8,
    },
    goingAddress: {
        color: "rgba(255, 255, 255, 0.8)",
        fontFamily: eventFont.bold,
        fontSize: 13,
        fontWeight: "700",
        lineHeight: 18,
        textAlign: "center",
        marginHorizontal: 10,
        marginBottom: 4,
    },
    goingDate: {
        color: "rgba(255, 255, 255, 0.7)",
        fontFamily: eventFont.regular,
        fontSize: 13,
        lineHeight: 18,
        textAlign: "center",
    },
    goingPosterWrap: {
        width: "95%",
        aspectRatio: 0.85,
        alignSelf: "center",
        borderRadius: 28,
        overflow: "hidden",
        backgroundColor: "rgba(255,255,255,0.12)",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(0,0,0,0.14)",
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
        gap: 18,
    },
    goingCircleButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: "rgba(255,255,255,0.14)",
        alignItems: "center",
        justifyContent: "center",
    },
    goingCircleIcon: {
        color: "#FFFFFF",
        fontFamily: eventFont.bold,
        fontSize: 29,
        lineHeight: 31,
        marginTop: -5,
    },
    goingCloseIcon: {
        color: "#FFFFFF",
        fontFamily: eventFont.regular,
        fontSize: 40,
        lineHeight: 42,
        marginTop: -3,
    },
    goingTicketButton: {
        flex: 1,
        height: 48,
        borderRadius: 24,
        backgroundColor: "rgba(255,255,255,0.16)",
        alignItems: "center",
        justifyContent: "center",
    },
    goingTicketButtonText: {
        color: "#FFFFFF",
        fontFamily: eventFont.bold,
        fontSize: 16,
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
    compactTitle: {
        flex: 1,
        marginHorizontal: 12,
    },
    compactTitleText: {
        color: colors.gold,
        fontSize: 16,
        fontWeight: "600",
        textAlign: "center",
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
        letterSpacing: -1,
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
        letterSpacing: -1,
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
        width: "100%",
        height: 56,
        borderRadius: 28,
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
        fontSize: 18,
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
