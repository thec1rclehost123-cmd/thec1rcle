import { useEffect, useState, useRef, useMemo } from "react";
import {
    View,
    Text,
    Pressable,
    ActivityIndicator,
    StyleSheet,
    Dimensions,
    Platform,
    Linking,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { router, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import Animated, { SlideInUp } from "react-native-reanimated";
import { useEventsStore, Event } from "@/store/eventsStore";
import { colors, radii, gradients } from "@/lib/design/theme";



// Default region: India center (can be overridden by user location)
const DEFAULT_REGION = {
    latitude: 19.076,
    longitude: 72.8777,
    latitudeDelta: 0.15,
    longitudeDelta: 0.15,
};

// Known venue coordinates for common Indian venues (fallback geocoding)
const KNOWN_VENUES: Record<string, { latitude: number; longitude: number }> = {
    // Mumbai
    "antiSOCIAL": { latitude: 19.0176, longitude: 72.8292 },
    "blueFROG": { latitude: 19.0069, longitude: 72.8300 },
    "Hard Rock Cafe": { latitude: 18.9220, longitude: 72.8347 },
    "Phoenix Palladium": { latitude: 19.0001, longitude: 72.8315 },
    "High Street Phoenix": { latitude: 19.0001, longitude: 72.8318 },
    "Tote on the Turf": { latitude: 19.0315, longitude: 72.8476 },
    // Delhi
    "Hauz Khas": { latitude: 28.5494, longitude: 77.2001 },
    // Bangalore
    "Koramangala": { latitude: 12.9352, longitude: 77.6245 },
    // Pune
    "Koregaon Park": { latitude: 18.5362, longitude: 73.8920 },
    // Goa
    "Vagator": { latitude: 15.5965, longitude: 73.7442 },
    "Anjuna": { latitude: 15.5830, longitude: 73.7410 },
};

interface EventWithCoords extends Event {
    resolvedCoords?: { latitude: number; longitude: number };
}

/**
 * Attempt to geocode a venue name/location string.
 * Falls back to known venue lookup + expo-location geocoding.
 */
async function geocodeVenue(
    venue?: string,
    location?: string,
    city?: string
): Promise<{ latitude: number; longitude: number } | null> {
    const text = venue || location || "";

    // 1. Check known venues
    for (const [key, coords] of Object.entries(KNOWN_VENUES)) {
        if (text.toLowerCase().includes(key.toLowerCase())) {
            return coords;
        }
    }

    // 2. Use expo-location geocoding
    const searchText = [text, city].filter(Boolean).join(", ");
    if (!searchText) return null;

    try {
        const results = await Location.geocodeAsync(searchText);
        if (results.length > 0) {
            return {
                latitude: results[0].latitude,
                longitude: results[0].longitude,
            };
        }
    } catch (error) {
        // Geocoding might not be available on all devices
        console.warn("[Map] Geocoding failed:", error);
    }

    return null;
}

// Compact event card in map callout
function MapEventCard({
    event,
    onPress,
}: {
    event: Event;
    onPress: () => void;
}) {
    const formattedDate = new Date(event.startDate).toLocaleDateString("en-IN", {
        weekday: "short",
        month: "short",
        day: "numeric",
    });

    const lowestPrice =
        event.tickets?.reduce(
            (min, tier) => (tier.price < min ? tier.price : min),
            event.tickets[0]?.price || 0
        ) || 0;

    return (
        <Pressable onPress={onPress} style={mapStyles.eventCard}>
            {/* Cover Image */}
            {event.coverImage ? (
                <Image
                    source={{ uri: event.coverImage }}
                    style={mapStyles.eventCardImage}
                    contentFit="cover"
                />
            ) : (
                <LinearGradient
                    colors={gradients.primary as [string, string]}
                    style={mapStyles.eventCardImage}
                >
                    <Text style={{ fontSize: 24 }}>🎉</Text>
                </LinearGradient>
            )}

            <View style={mapStyles.eventCardContent}>
                <Text style={mapStyles.eventCardTitle} numberOfLines={1}>
                    {event.title}
                </Text>
                <Text style={mapStyles.eventCardVenue} numberOfLines={1}>
                    📍 {event.venue || event.location || "TBA"}
                </Text>
                <View style={mapStyles.eventCardFooter}>
                    <Text style={mapStyles.eventCardDate}>{formattedDate}</Text>
                    <Text style={mapStyles.eventCardPrice}>
                        {lowestPrice === 0 ? "Free" : `₹${lowestPrice}`}
                    </Text>
                </View>
            </View>
        </Pressable>
    );
}

export default function MapScreen() {
    const params = useLocalSearchParams<{ eventId?: string }>();
    const { events, fetchEvents } = useEventsStore();
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);

    const [userLocation, setUserLocation] = useState<{
        latitude: number;
        longitude: number;
    } | null>(null);
    const [eventsWithCoords, setEventsWithCoords] = useState<EventWithCoords[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<EventWithCoords | null>(null);
    const [loading, setLoading] = useState(true);
    const [mapReady, setMapReady] = useState(false);

    // Load events and geocode them — only on mount
    useEffect(() => {
        loadMapData();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    async function loadMapData() {
        setLoading(true);

        // Fetch events if not loaded
        if (events.length === 0) {
            await fetchEvents();
        }

        // Request location permission
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === "granted") {
                const loc = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });
                setUserLocation({
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                });
            }
        } catch (e) {
            console.warn("[Map] Location permission error:", e);
        }

        // Geocode events
        const resolved: EventWithCoords[] = [];
        const eventsToProcess = useEventsStore.getState().events;

        for (const event of eventsToProcess) {
            if (event.coordinates) {
                resolved.push({ ...event, resolvedCoords: event.coordinates });
            } else {
                const coords = await geocodeVenue(event.venue, event.location, event.city);
                if (coords) {
                    resolved.push({ ...event, resolvedCoords: coords });
                }
            }
        }

        setEventsWithCoords(resolved);
        setLoading(false);

        // If specific event requested, zoom to it
        if (params.eventId) {
            const target = resolved.find((e) => e.id === params.eventId);
            if (target?.resolvedCoords) {
                setSelectedEvent(target);
                setTimeout(() => {
                    mapRef.current?.animateToRegion(
                        {
                            ...target.resolvedCoords!,
                            latitudeDelta: 0.01,
                            longitudeDelta: 0.01,
                        },
                        800
                    );
                }, 500);
            }
        }
    }

    const initialRegion = useMemo(() => {
        if (userLocation) {
            return { ...userLocation, latitudeDelta: 0.1, longitudeDelta: 0.1 };
        }
        if (eventsWithCoords.length > 0 && eventsWithCoords[0].resolvedCoords) {
            return {
                ...eventsWithCoords[0].resolvedCoords,
                latitudeDelta: 0.15,
                longitudeDelta: 0.15,
            };
        }
        return DEFAULT_REGION;
    }, [userLocation, eventsWithCoords]);

    const handleGetDirections = (event: EventWithCoords) => {
        if (!event.resolvedCoords) return;

        const { latitude, longitude } = event.resolvedCoords;
        const label = encodeURIComponent(event.venue || event.title);

        const url = Platform.select({
            ios: `maps:0,0?q=${label}@${latitude},${longitude}`,
            android: `geo:0,0?q=${latitude},${longitude}(${label})`,
        });

        if (url) {
            Linking.openURL(url).catch(() => {
                // Fallback to Google Maps
                Linking.openURL(
                    `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=${label}`
                );
            });
        }
    };

    return (
        <View style={mapStyles.container}>
            {/* Map */}
            <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                provider={PROVIDER_DEFAULT}
                initialRegion={initialRegion}
                showsUserLocation={true}
                showsMyLocationButton={false}
                showsCompass={false}
                mapType="standard"
                customMapStyle={darkMapStyle}
                onMapReady={() => setMapReady(true)}
            >
                {mapReady &&
                    eventsWithCoords.map((event) =>
                        event.resolvedCoords ? (
                            <Marker
                                key={event.id}
                                coordinate={event.resolvedCoords}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setSelectedEvent(event);
                                }}
                            >
                                <View style={[
                                    mapStyles.markerContainer,
                                    selectedEvent?.id === event.id && mapStyles.markerSelected,
                                ]}>
                                    <LinearGradient
                                        colors={
                                            selectedEvent?.id === event.id
                                                ? (gradients.primary as [string, string])
                                                : ["rgba(244, 74, 34, 0.8)", "rgba(244, 74, 34, 0.5)"]
                                        }
                                        style={mapStyles.markerGradient}
                                    >
                                        <Text style={mapStyles.markerEmoji}>🎉</Text>
                                    </LinearGradient>
                                </View>
                                <View style={mapStyles.markerArrow} />
                            </Marker>
                        ) : null
                    )}
            </MapView>

            {/* Loading overlay */}
            {loading && (
                <View style={mapStyles.loadingOverlay}>
                    <BlurView intensity={60} tint="dark" style={mapStyles.loadingBlur}>
                        <ActivityIndicator size="large" color={colors.iris} />
                        <Text style={mapStyles.loadingText}>Finding events near you...</Text>
                    </BlurView>
                </View>
            )}

            {/* Top bar */}
            <SafeAreaView edges={["top"]} style={mapStyles.topBar}>
                <View style={mapStyles.topBarContent}>
                    <Pressable
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.back();
                        }}
                        style={mapStyles.backButton}
                    >
                        <BlurView intensity={40} tint="dark" style={mapStyles.backButtonBlur}>
                            <Text style={mapStyles.backButtonText}>←</Text>
                        </BlurView>
                    </Pressable>

                    <View style={mapStyles.titleContainer}>
                        <Text style={mapStyles.titleText}>Map View</Text>
                        {!loading && (
                            <Text style={mapStyles.subtitleText}>
                                {eventsWithCoords.length} events nearby
                            </Text>
                        )}
                    </View>

                    {/* My Location button */}
                    <Pressable
                        onPress={() => {
                            if (userLocation) {
                                mapRef.current?.animateToRegion(
                                    {
                                        ...userLocation,
                                        latitudeDelta: 0.05,
                                        longitudeDelta: 0.05,
                                    },
                                    600
                                );
                            }
                        }}
                        style={mapStyles.locationButton}
                    >
                        <BlurView intensity={40} tint="dark" style={mapStyles.backButtonBlur}>
                            <Text style={mapStyles.backButtonText}>📍</Text>
                        </BlurView>
                    </Pressable>
                </View>
            </SafeAreaView>

            {/* Bottom Event Card */}
            {selectedEvent && (
                <Animated.View
                    entering={SlideInUp.springify().damping(18)}
                    style={[mapStyles.bottomCard, { paddingBottom: insets.bottom + 8 }]}
                >
                    <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={mapStyles.bottomCardInner}>
                        <MapEventCard
                            event={selectedEvent}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                router.push({
                                    pathname: "/event/[id]",
                                    params: { id: selectedEvent.id },
                                });
                            }}
                        />

                        <View style={mapStyles.bottomActions}>
                            <Pressable
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    router.push({
                                        pathname: "/event/[id]",
                                        params: { id: selectedEvent.id },
                                    });
                                }}
                                style={mapStyles.viewButton}
                            >
                                <LinearGradient
                                    colors={gradients.primary as [string, string]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={mapStyles.viewButtonGradient}
                                >
                                    <Text style={mapStyles.viewButtonText}>
                                        View Event
                                    </Text>
                                </LinearGradient>
                            </Pressable>

                            <Pressable
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    handleGetDirections(selectedEvent);
                                }}
                                style={mapStyles.directionsButton}
                            >
                                <Text style={mapStyles.directionsButtonText}>
                                    🧭 Directions
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </Animated.View>
            )}
        </View>
    );
}

// Dark map style for premium feel
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
        featureType: "administrative.locality",
        elementType: "labels.text.fill",
        stylers: [{ color: "#bdbdbd" }],
    },
    {
        featureType: "poi",
        stylers: [{ visibility: "off" }],
    },
    {
        featureType: "poi.park",
        elementType: "geometry",
        stylers: [{ color: "#1a2e1a" }, { visibility: "simplified" }],
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

const mapStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#1d1d1d",
    },

    // Markers
    markerContainer: {
        alignItems: "center",
    },
    markerGradient: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.2)",
    },
    markerSelected: {
        transform: [{ scale: 1.2 }],
    },
    markerEmoji: {
        fontSize: 18,
    },
    markerArrow: {
        width: 0,
        height: 0,
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderTopWidth: 8,
        borderLeftColor: "transparent",
        borderRightColor: "transparent",
        borderTopColor: "rgba(244, 74, 34, 0.6)",
        marginTop: -2,
    },

    // Loading
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 50,
    },
    loadingBlur: {
        paddingHorizontal: 32,
        paddingVertical: 24,
        borderRadius: radii.xl,
        alignItems: "center",
        overflow: "hidden",
    },
    loadingText: {
        color: colors.gold,
        marginTop: 12,
        fontSize: 15,
        fontWeight: "500",
    },

    // Top bar
    topBar: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
    },
    topBarContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    backButton: {},
    backButtonBlur: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },
    backButtonText: {
        fontSize: 18,
        color: "#fff",
    },
    titleContainer: {
        flex: 1,
        alignItems: "center",
    },
    titleText: {
        color: colors.gold,
        fontSize: 18,
        fontWeight: "700",
    },
    subtitleText: {
        color: colors.goldMetallic,
        fontSize: 12,
        marginTop: 2,
    },
    locationButton: {},

    // Bottom Card
    bottomCard: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: radii["2xl"],
        borderTopRightRadius: radii["2xl"],
        overflow: "hidden",
    },
    bottomCardInner: {
        padding: 16,
    },
    bottomActions: {
        flexDirection: "row",
        gap: 12,
        marginTop: 12,
    },

    // Event card
    eventCard: {
        flexDirection: "row",
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: radii.xl,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    eventCardImage: {
        width: 90,
        height: 90,
        alignItems: "center",
        justifyContent: "center",
    },
    eventCardContent: {
        flex: 1,
        padding: 12,
        justifyContent: "center",
    },
    eventCardTitle: {
        color: colors.gold,
        fontSize: 16,
        fontWeight: "700",
        marginBottom: 4,
    },
    eventCardVenue: {
        color: colors.goldMetallic,
        fontSize: 13,
        marginBottom: 6,
    },
    eventCardFooter: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    eventCardDate: {
        color: colors.goldDark,
        fontSize: 12,
    },
    eventCardPrice: {
        color: colors.iris,
        fontSize: 13,
        fontWeight: "700",
    },

    // Buttons
    viewButton: {
        flex: 1,
    },
    viewButtonGradient: {
        paddingVertical: 14,
        borderRadius: radii.pill,
        alignItems: "center",
    },
    viewButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },
    directionsButton: {
        backgroundColor: "rgba(255,255,255,0.08)",
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
    },
    directionsButtonText: {
        color: colors.gold,
        fontSize: 14,
        fontWeight: "600",
    },
});
