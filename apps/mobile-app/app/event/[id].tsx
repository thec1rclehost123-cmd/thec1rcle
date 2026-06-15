import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useState, useRef } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    Dimensions,
    ActivityIndicator,
    Alert,
    StyleSheet,
    Platform,
    Linking,
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    interpolate,
    useAnimatedScrollHandler,
    withSpring,
    withTiming,
    FadeIn,
    FadeInDown,
    SlideInRight,
} from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { HostSheet } from "@/components/ui/HostSheet";
import { VenueSheet } from "@/components/ui/VenueSheet";
import { useAuth } from "@/hooks/useAuth";
import { trackScreen } from "@/lib/analytics";
import { colors, radii, gradients } from "@/lib/design/theme";
import { safeDate, formatEventDate, formatEventTime } from "@/lib/utils/date";
import { getEventImage, EVENT_PLACEHOLDER } from "@/lib/utils/event";
import { useCartStore } from "@/store/cartStore";
import { useEventInterestStore } from "@/store/eventInterestStore";
import { useEventsStore, Event, TicketTier } from "@/store/eventsStore";
import { useProfileStore } from "@/store/profileStore";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const HEADER_HEIGHT = 400;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
    icon: string;
    onPress: () => void;
    badge?: number;
}) {
    return (
        <Pressable onPress={onPress} style={styles.headerButton}>
            <BlurView intensity={40} tint="dark" style={styles.headerButtonBlur}>
                <Text style={styles.headerButtonIcon}>{icon}</Text>
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
    const { id, ref } = useLocalSearchParams<{ id: string; ref?: string }>();
    const { getEventById } = useEventsStore();
    const cartCount = 0; // Handled by backend/cart-status
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const profile = useProfileStore((s) => s.profile);
    const { likedEventIds, toggleInterest, fetchInterestedUsers, interestedUsers } = useEventInterestStore();

    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [venueCoords, setVenueCoords] = useState<{ latitude: number; longitude: number } | null>(null);
    const [descriptionExpanded, setDescriptionExpanded] = useState(false);
    const [showVenueSheet, setShowVenueSheet] = useState(false);
    const [showHostSheet, setShowHostSheet] = useState(false);
    const miniMapRef = useRef<MapView>(null);

    const isLiked = id ? likedEventIds.has(id) : false;
    const eventInterested = id ? (interestedUsers[id] ?? []) : [];

    const scrollY = useSharedValue(0);

    useEffect(() => {
        trackScreen("EventDetail");
    }, []);

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
                <Pressable onPress={() => router.back()}>
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

    return (
        <View style={styles.container}>
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

            {/* Floating Header */}
            <View style={[styles.floatingHeader, { paddingTop: insets.top }]}>
                <View style={styles.floatingHeaderContent}>
                    <HeaderButton
                        icon="←"
                        onPress={() => router.back()}
                    />

                    {/* Compact title (appears on scroll) */}
                    <Animated.View style={[styles.compactTitle, compactHeaderStyle]}>
                        <Text style={styles.compactTitleText} numberOfLines={1}>
                            {event.title}
                        </Text>
                    </Animated.View>

                    <View style={styles.floatingHeaderActions}>
                        <HeaderButton
                            icon={isLiked ? "❤️" : "♡"}
                            onPress={handleLike}
                        />
                        <HeaderButton
                            icon="↗️"
                            onPress={handleShare}
                        />
                        <HeaderButton
                            icon="🛒"
                            onPress={() => router.push("/checkout")}
                            badge={cartCount}
                        />
                    </View>
                </View>
            </View>

            <Animated.ScrollView
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

                    {/* Gradient Overlay */}
                    <LinearGradient
                        colors={["transparent", "rgba(22, 22, 22, 0.6)", colors.base.DEFAULT]}
                        locations={[0.3, 0.7, 1]}
                        style={styles.heroGradient}
                    />

                    {/* Category Badge */}
                    {event.category && (
                        <View style={[styles.categoryBadge, { top: insets.top + 60 }]}>
                            <LinearGradient
                                colors={gradients.primary as [string, string]}
                                style={styles.categoryBadgeGradient}
                            >
                                <Text style={styles.categoryBadgeText}>
                                    {event.category.toUpperCase()}
                                </Text>
                            </LinearGradient>
                        </View>
                    )}
                </Animated.View>

                {/* Content */}
                <View style={styles.content}>
                    {/* Event Title */}
                    <Animated.Text
                        entering={FadeInDown.delay(100).springify()}
                        style={styles.eventTitle}
                    >
                        {event.title}
                    </Animated.Text>

                    {/* Date & Time */}
                    <Animated.View
                        entering={FadeInDown.delay(150).springify()}
                        style={styles.infoCard}
                    >
                        <View style={styles.infoRow}>
                            <View style={styles.infoIcon}>
                                <Text style={styles.infoIconText}>📅</Text>
                            </View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>Date & Time</Text>
                                <Text style={styles.infoValue}>
                                    {formattedDate} • {formattedTime}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.infoDivider} />
                        <Pressable
                            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowVenueSheet(true); }}
                            style={styles.infoRow}
                        >
                            <View style={styles.infoIcon}>
                                <Text style={styles.infoIconText}>📍</Text>
                            </View>
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>Location</Text>
                                <Text style={styles.infoValue} numberOfLines={2}>
                                    {event.venue || event.location || "Location TBA"}
                                </Text>
                            </View>
                            <Text style={{ color: colors.goldMetallic, fontSize: 18 }}>›</Text>
                        </Pressable>
                    </Animated.View>

                    {/* Venue Map */}
                    {venueCoords && (
                        <Animated.View
                            entering={FadeInDown.delay(180).springify()}
                            style={styles.mapSection}
                        >
                            <Text style={styles.sectionTitle}>📍 Venue Location</Text>
                            <View style={styles.mapContainer}>
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
                                            <LinearGradient
                                                colors={gradients.primary as [string, string]}
                                                style={styles.mapMarkerGradient}
                                            >
                                                <Text style={{ fontSize: 16 }}>📍</Text>
                                            </LinearGradient>
                                        </View>
                                    </Marker>
                                </MapView>

                                {/* Map overlay buttons */}
                                <View style={styles.mapActions}>
                                    <Pressable
                                        onPress={handleGetDirections}
                                        style={styles.mapActionButton}
                                    >
                                        <LinearGradient
                                            colors={gradients.primary as [string, string]}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.mapActionGradient}
                                        >
                                            <Text style={styles.mapActionText}>🧭 Get Directions</Text>
                                        </LinearGradient>
                                    </Pressable>
                                    <Pressable
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            router.push({
                                                pathname: "/map" as any,
                                                params: { eventId: id },
                                            });
                                        }}
                                        style={styles.mapActionButtonOutline}
                                    >
                                        <Text style={styles.mapActionOutlineText}>🗺️ Open Map</Text>
                                    </Pressable>
                                </View>
                            </View>
                        </Animated.View>
                    )}

                    {/* Attendees / Interested Preview */}
                    <Animated.View
                        entering={FadeInDown.delay(200).springify()}
                        style={styles.attendeesCard}
                    >
                        <View style={styles.attendeesHeaderRow}>
                            <Text style={styles.attendeesTitle}>👥 Who's Going</Text>
                            {eventInterested.length > 0 && (
                                <View style={styles.interestedBadge}>
                                    <Text style={styles.interestedBadgeText}>
                                        ❤️ {eventInterested.length} interested
                                    </Text>
                                </View>
                            )}
                        </View>
                        <View style={styles.attendeesRow}>
                            <View style={styles.attendeesAvatars}>
                                {eventInterested.length > 0
                                    ? eventInterested.slice(0, 5).map((u, i) => (
                                        <View
                                            key={u.userId}
                                            style={[
                                                styles.attendeeAvatar,
                                                { marginLeft: i > 0 ? -10 : 0, zIndex: 5 - i }
                                            ]}
                                        >
                                            {u.photoURL ? (
                                                <Image
                                                    source={{ uri: u.photoURL }}
                                                    style={styles.attendeeAvatarImg}
                                                    contentFit="cover"
                                                />
                                            ) : (
                                                <LinearGradient
                                                    colors={["rgba(244, 74, 34, 0.4)", "rgba(244, 74, 34, 0.15)"]}
                                                    style={styles.attendeeAvatarGradient}
                                                >
                                                    <Text style={styles.attendeeAvatarInitial}>
                                                        {(u.displayName?.[0] ?? "?").toUpperCase()}
                                                    </Text>
                                                </LinearGradient>
                                            )}
                                        </View>
                                    ))
                                    : [0, 1, 2, 3, 4].map((i) => (
                                        <View
                                            key={i}
                                            style={[
                                                styles.attendeeAvatar,
                                                { marginLeft: i > 0 ? -10 : 0, zIndex: 5 - i }
                                            ]}
                                        >
                                            <LinearGradient
                                                colors={["rgba(244, 74, 34, 0.3)", "rgba(244, 74, 34, 0.1)"]}
                                                style={styles.attendeeAvatarGradient}
                                            >
                                                <Text style={styles.attendeeAvatarEmoji}>👤</Text>
                                            </LinearGradient>
                                        </View>
                                    ))
                                }
                            </View>
                            <Text style={styles.attendeesCount}>
                                {eventInterested.length > 0
                                    ? `+${eventInterested.length} interested`
                                    : `+${event.stats?.rsvps || 0} attending`
                                }
                            </Text>
                        </View>
                        {eventInterested.length === 0 && (
                            <Text style={styles.interestedHint}>
                                ❤️ Tap the heart to show interest
                            </Text>
                        )}
                    </Animated.View>

                    {/* About Section */}
                    {event.description && (
                        <Animated.View
                            entering={FadeInDown.delay(250).springify()}
                            style={styles.section}
                        >
                            <Text style={styles.sectionTitle}>About</Text>
                            <Text
                                style={styles.description}
                                numberOfLines={descriptionExpanded ? undefined : 3}
                            >
                                {event.description}
                            </Text>
                            <Pressable onPress={() => setDescriptionExpanded(!descriptionExpanded)}>
                                <Text style={styles.readMoreText}>
                                    {descriptionExpanded ? "Show less" : "Read more"}
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

            {/* Fixed Bottom Bar */}
            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
                <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={styles.bottomBarContent}>
                    <View style={styles.bottomBarPricing}>
                        <Text style={styles.bottomBarLabel}>
                            {cartCount > 0
                                ? `${cartCount} in cart`
                                : hasAvailableTickets
                                    ? "Starting from"
                                    : "Sold out"}
                        </Text>
                        <Text style={styles.bottomBarPrice}>
                            {lowestPrice === 0 ? "Free" : `₹${lowestPrice}`}
                        </Text>
                    </View>

                    <Pressable onPress={handleGetTickets}>
                        <LinearGradient
                            colors={
                                cartCount > 0 || !hasAvailableTickets
                                    ? gradients.primary as [string, string]
                                    : ["rgba(244, 74, 34, 0.7)", "rgba(244, 74, 34, 0.5)"]
                            }
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.bottomBarButton}
                        >
                            <Text style={styles.bottomBarButtonText}>
                                {cartCount > 0 ? "Checkout" : hasAvailableTickets ? "Get Tickets" : "Join Waitlist"}
                            </Text>
                            <Text style={styles.bottomBarButtonArrow}>→</Text>
                        </LinearGradient>
                    </Pressable>
                </View>
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
        marginTop: -60,
    },
    eventTitle: {
        color: colors.gold,
        fontSize: 32,
        fontWeight: "800",
        marginBottom: 20,
        lineHeight: 38,
    },

    // Info Card
    infoCard: {
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
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
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
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
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
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
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
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
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        padding: 16,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
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
        backgroundColor: colors.base[50],
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
