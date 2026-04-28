
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Dimensions,
    StatusBar,
    ActivityIndicator,
    Platform,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Region } from "react-native-maps";
import ClusteredMapView from "react-native-map-clustering";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import Animated, {
    FadeIn,
    FadeOut,
    SlideInDown,
    SlideOutDown,
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from "react-native-reanimated";

import { colors, radii, spacing, shadows } from "../../lib/design/theme";
import { useEventsStore, Event } from "../../store/eventsStore";
import { formatEventDate } from "../../lib/utils/formatters";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Premium Night Mode Map Style
const MAP_STYLE = [
    { "elementType": "geometry", "stylers": [{ "color": "#1a1a1a" }] },
    { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
    { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
    { "elementType": "labels.text.stroke", "stylers": [{ "color": "#1a1a1a" }] },
    { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#333333" }] },
    { "featureType": "administrative.country", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
    { "featureType": "administrative.land_parcel", "stylers": [{ "visibility": "off" }] },
    { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] },
    { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
    { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#121212" }] },
    { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
    { "featureType": "poi.park", "elementType": "labels.text.stroke", "stylers": [{ "color": "#1b1b1b" }] },
    { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
    { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#8a8a8a" }] },
    { "featureType": "road.arterial", "elementType": "geometry", "stylers": [{ "color": "#373737" }] },
    { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#3c3c3c" }] },
    { "featureType": "road.highway.controlled_access", "elementType": "geometry", "stylers": [{ "color": "#4e4e4e" }] },
    { "featureType": "road.local", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
    { "featureType": "transit", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] },
    { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#3d3d3d" }] }
];

export default function MapScreen() {
    const insets = useSafeAreaInsets();
    const mapRef = useRef<any>(null);
    const { events } = useEventsStore();

    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [filter, setFilter] = useState<"trending" | "tonight">("trending");
    const [loading, setLoading] = useState(true);

    // Initial region (defaults to center of Pune/Mumbai if location not found)
    const [region, setRegion] = useState<Region>({
        latitude: 18.5204,
        longitude: 73.8567,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
    });

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== "granted") {
                console.log("Permission to access location was denied");
                setLoading(false);
                return;
            }

            let loc = await Location.getCurrentPositionAsync({});
            setLocation(loc);
            setRegion({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
            });
            setLoading(false);
        })();
    }, []);

    const filteredEvents = useMemo(() => {
        // Only include events with valid coordinates
        const eventsWithCoords = events.filter(e => e.coordinates && e.coordinates.latitude && e.coordinates.longitude);

        if (filter === "tonight") {
            // Tonight: deterministic sort by startTime
            return eventsWithCoords
                .filter(e => e.isTonight)
                .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        } else {
            // Trending: Primary = heatScore, Secondary = startDate
            return [...eventsWithCoords].sort((a, b) => {
                const heatA = a.heatScore || 0;
                const heatB = b.heatScore || 0;
                if (heatB !== heatA) return heatB - heatA;
                return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
            });
        }
    }, [events, filter]);

    const handleMarkerPress = (event: Event) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // If tapping the same marker, we might want to toggle but here we just update
        setSelectedEvent(event);

        // Center map on marker with a consistent offset to account for the bottom sheet
        if (event.coordinates) {
            mapRef.current?.animateCamera({
                center: {
                    latitude: event.coordinates.latitude - 0.008,
                    longitude: event.coordinates.longitude,
                },
                pitch: 45,
                heading: 0,
                altitude: 3000,
                zoom: 15
            }, { duration: 800 });
        }
    };

    const handleBack = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.back();
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.iris} />
                </View>
            ) : (
                <ClusteredMapView
                    ref={mapRef}
                    style={styles.map}
                    provider={PROVIDER_GOOGLE}
                    initialRegion={region}
                    customMapStyle={MAP_STYLE}
                    clusterColor={colors.iris}
                    clusterTextColor="#fff"
                    onPress={() => setSelectedEvent(null)}
                >
                    {filteredEvents.map((event) => (
                        event.coordinates && (
                            <Marker
                                key={event.id}
                                coordinate={{
                                    latitude: event.coordinates.latitude,
                                    longitude: event.coordinates.longitude,
                                }}
                                onPress={() => handleMarkerPress(event)}
                            >
                                <View style={[
                                    styles.markerContainer,
                                    selectedEvent?.id === event.id && styles.markerContainerActive
                                ]}>
                                    <Image
                                        source={{ uri: event.posterUrl }}
                                        style={styles.markerImage}
                                        contentFit="cover"
                                    />
                                </View>
                            </Marker>
                        )
                    ))}

                    {/* User Location Beacon */}
                    {location && (
                        <Marker
                            coordinate={{
                                latitude: location.coords.latitude,
                                longitude: location.coords.longitude,
                            }}
                        >
                            <View style={styles.beaconContainer}>
                                <View style={styles.beaconRing} />
                                <View style={styles.beaconDot} />
                            </View>
                        </Marker>
                    )}
                </ClusteredMapView>
            )}

            {/* Header Overlay */}
            <BlurView intensity={80} tint="dark" style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <Pressable onPress={handleBack} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color="#fff" />
                </Pressable>
                <Text style={styles.headerTitle}>M A P</Text>
                <View style={{ width: 44 }} />
            </BlurView>

            {/* Bottom Controls */}
            <View style={[styles.bottomControls, { bottom: insets.bottom + 24 }]}>
                {/* Toggle Pill */}
                <View style={styles.toggleContainer}>
                    <Pressable
                        onPress={() => {
                            if (filter !== "trending") {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setFilter("trending");
                                setSelectedEvent(null);
                            }
                        }}
                        style={[styles.togglePill, filter === "trending" && styles.togglePillActive]}
                    >
                        <Text style={[styles.toggleText, filter === "trending" && styles.toggleTextActive]}>Trending</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => {
                            if (filter !== "tonight") {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setFilter("tonight");
                                setSelectedEvent(null);
                            }
                        }}
                        style={[styles.togglePill, filter === "tonight" && styles.togglePillActive]}
                    >
                        <Text style={[styles.toggleText, filter === "tonight" && styles.toggleTextActive]}>Tonight</Text>
                    </Pressable>
                </View>

                {/* Relocate Button */}
                <Pressable
                    onPress={() => {
                        if (location) {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            mapRef.current?.animateToRegion({
                                latitude: location.coords.latitude,
                                longitude: location.coords.longitude,
                                latitudeDelta: 0.04,
                                longitudeDelta: 0.04,
                            }, 1000);
                        }
                    }}
                    style={styles.relocateButton}
                >
                    <BlurView intensity={40} tint="dark" style={styles.relocateBlur}>
                        <Ionicons name="location" size={20} color="#fff" />
                    </BlurView>
                </Pressable>
            </View>

            {/* Event Details Bottom Sheet */}
            {selectedEvent && (
                <Animated.View
                    entering={SlideInDown.springify()}
                    exiting={SlideOutDown}
                    style={[styles.sheetContainer, { paddingBottom: insets.bottom + 20 }]}
                >
                    <View style={styles.sheetContent}>
                        <View style={styles.sheetHeader}>
                            <View style={styles.sheetTextContent}>
                                <Text style={styles.venueName}>{selectedEvent.venue}</Text>
                                <Text style={styles.eventTitle} numberOfLines={2}>{selectedEvent.title}</Text>
                                <View style={styles.eventInfoRow}>
                                    <View style={styles.infoBadge}>
                                        <Text style={styles.infoBadgeText}>{formatEventDate(selectedEvent.startDate, "short")}</Text>
                                    </View>
                                    <Text style={styles.distanceText}>1.2 mi away</Text>
                                </View>
                            </View>
                            <Image
                                source={{ uri: selectedEvent.posterUrl }}
                                style={styles.sheetPoster}
                                contentFit="cover"
                            />
                        </View>

                        <Pressable
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                router.push({
                                    pathname: "/event/[id]",
                                    params: { id: selectedEvent.id }
                                });
                            }}
                            style={styles.viewEventButton}
                        >
                            <Text style={styles.viewEventText}>View Event</Text>
                        </Pressable>
                    </View>
                </Animated.View>
            )}
        </View>
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
    },
    map: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
    },
    header: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderColor: "rgba(255,255,255,0.05)",
    },
    headerTitle: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "900",
        letterSpacing: 4,
        textTransform: "uppercase",
        opacity: 0.9,
    },
    backButton: {
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
    },
    markerContainer: {
        width: 50,
        height: 65,
        borderRadius: 12,
        backgroundColor: "#222",
        padding: 3,
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.2)",
        ...shadows.card,
    },
    markerContainerActive: {
        borderColor: colors.iris,
        transform: [{ scale: 1.1 }],
    },
    markerImage: {
        width: "100%",
        height: "100%",
        borderRadius: 9,
    },
    beaconContainer: {
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
    },
    beaconDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.cyan,
        borderWidth: 2,
        borderColor: "#fff",
    },
    beaconRing: {
        position: "absolute",
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: "rgba(0, 217, 255, 0.3)",
        borderWidth: 1,
        borderColor: "rgba(0, 217, 255, 0.5)",
    },
    bottomControls: {
        position: "absolute",
        left: 20,
        right: 20,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    toggleContainer: {
        flexDirection: "row",
        backgroundColor: "rgba(10, 10, 10, 0.9)",
        borderRadius: radii.pill,
        padding: 5,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
        ...shadows.floating,
    },
    togglePill: {
        paddingHorizontal: 22,
        paddingVertical: 10,
        borderRadius: radii.pill,
    },
    togglePillActive: {
        backgroundColor: "rgba(255, 255, 255, 0.15)",
    },
    toggleText: {
        color: "rgba(255,255,255,0.4)",
        fontSize: 14,
        fontWeight: "700",
        letterSpacing: 0.5,
    },
    toggleTextActive: {
        color: "#fff",
    },
    relocateButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
        ...shadows.floating,
    },
    relocateBlur: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    sheetContainer: {
        position: "absolute",
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 1000,
    },
    sheetContent: {
        backgroundColor: "rgba(15, 15, 15, 0.98)",
        borderRadius: 28,
        padding: 18,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
        ...shadows.floating,
    },
    sheetHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 20,
    },
    sheetTextContent: {
        flex: 1,
        marginRight: 16,
    },
    venueName: {
        color: colors.goldMetallic,
        fontSize: 13,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 4,
    },
    eventTitle: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "800",
        lineHeight: 24,
        marginBottom: 12,
    },
    eventInfoRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    infoBadge: {
        backgroundColor: "rgba(255,255,255,0.06)",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    infoBadgeText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "600",
    },
    distanceText: {
        color: "rgba(255,255,255,0.4)",
        fontSize: 13,
    },
    sheetPoster: {
        width: 80,
        height: 100,
        borderRadius: 12,
    },
    viewEventButton: {
        backgroundColor: colors.iris,
        height: 54,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    viewEventText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },
});
