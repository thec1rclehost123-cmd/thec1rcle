import { useEffect, useMemo, useRef, useState } from "react";
import {
    View,
    Text,
    Pressable,
    ActivityIndicator,
    StyleSheet,
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
import { useEventsStore, type Event } from "@/store/eventsStore";
import { useVenuesStore, type Venue } from "@/store/venuesStore";
import { colors, radii, gradients } from "@/lib/design/theme";
import {
    calculateDistanceKm,
    type Coordinates,
    findKnownVenueCoordinates,
    formatCompactCount,
    formatDistance,
    getVenueDisplayName,
    getVenueLocationLabel,
    normalizeVenueKey,
} from "@/lib/venueDiscovery";

const DEFAULT_REGION = {
    latitude: 19.076,
    longitude: 72.8777,
    latitudeDelta: 0.15,
    longitudeDelta: 0.15,
};

type MapMode = "events" | "venues";

interface EventWithCoords extends Event {
    venueId?: string;
    venueSlug?: string;
    resolvedCoords?: Coordinates;
}

interface VenueWithCoords extends Venue {
    resolvedCoords: Coordinates;
    distanceKm?: number | null;
}

interface EventCluster {
    key: string;
    coordinate: Coordinates;
    events: EventWithCoords[];
    venueId?: string;
    venueSlug?: string;
    venueName: string;
}

function normalizeParam(value?: string | string[]): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

async function geocodeVenue(
    venue?: string,
    location?: string,
    city?: string
): Promise<Coordinates | null> {
    const known = findKnownVenueCoordinates(venue, location, city);
    if (known) {
        return known;
    }

    const searchText = [venue, location, city].filter(Boolean).join(", ");
    if (!searchText) {
        return null;
    }

    try {
        const results = await Location.geocodeAsync(searchText);
        if (!results.length) {
            return null;
        }

        return {
            latitude: results[0].latitude,
            longitude: results[0].longitude,
        };
    } catch (error) {
        console.warn("[Map] Geocoding failed:", error);
        return null;
    }
}

function getEventPriceLabel(event: Event): string {
    const price =
        event.tickets?.reduce(
            (min, tier) => (tier.price < min ? tier.price : min),
            event.tickets[0]?.price || 0
        ) || 0;

    return price === 0 ? "Free" : `₹${price}`;
}

function getDirectionsUrl(coords: Coordinates, label: string): string {
    if (Platform.OS === "ios") {
        return `maps:0,0?q=${encodeURIComponent(label)}@${coords.latitude},${coords.longitude}`;
    }

    return `geo:0,0?q=${coords.latitude},${coords.longitude}(${encodeURIComponent(label)})`;
}

async function openDirections(coords: Coordinates, label: string) {
    try {
        await Linking.openURL(getDirectionsUrl(coords, label));
    } catch {
        await Linking.openURL(
            `https://www.google.com/maps/dir/?api=1&destination=${coords.latitude},${coords.longitude}`
        );
    }
}

function MapEventCard({
    cluster,
    onPress,
}: {
    cluster: EventCluster;
    onPress: () => void;
}) {
    const event = cluster.events[0];
    const formattedDate = new Date(event.startDate).toLocaleDateString("en-IN", {
        weekday: "short",
        month: "short",
        day: "numeric",
    });
    const imageUrl = event.coverImage;

    return (
        <Pressable onPress={onPress} style={mapStyles.eventCard}>
            {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={mapStyles.eventCardImage} contentFit="cover" />
            ) : (
                <LinearGradient colors={gradients.primary as [string, string]} style={mapStyles.eventCardImage}>
                    <Text style={mapStyles.cardFallbackEmoji}>🎉</Text>
                </LinearGradient>
            )}

            <View style={mapStyles.eventCardContent}>
                <Text style={mapStyles.eventCardEyebrow} numberOfLines={1}>
                    {cluster.events.length > 1 ? `${cluster.events.length} events at ${cluster.venueName}` : cluster.venueName}
                </Text>
                <Text style={mapStyles.eventCardTitle} numberOfLines={1}>
                    {event.title}
                </Text>
                <View style={mapStyles.eventCardFooter}>
                    <Text style={mapStyles.eventCardDate}>{formattedDate}</Text>
                    <Text style={mapStyles.eventCardPrice}>{getEventPriceLabel(event)}</Text>
                </View>
            </View>
        </Pressable>
    );
}

function MapVenueCard({
    venue,
    onPress,
}: {
    venue: VenueWithCoords;
    onPress: () => void;
}) {
    const imageUrl = venue.coverImage || venue.coverURL || venue.bannerImage || venue.photoURL || venue.image;
    const distanceLabel = formatDistance(venue.distanceKm);

    return (
        <Pressable onPress={onPress} style={mapStyles.eventCard}>
            {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={mapStyles.eventCardImage} contentFit="cover" />
            ) : (
                <LinearGradient colors={["#0F2D3A", "#11251F"]} style={mapStyles.eventCardImage}>
                    <Text style={mapStyles.cardFallbackEmoji}>📍</Text>
                </LinearGradient>
            )}

            <View style={mapStyles.eventCardContent}>
                <Text style={mapStyles.eventCardEyebrow} numberOfLines={1}>
                    {getVenueLocationLabel(venue) || "Venue"}
                </Text>
                <Text style={mapStyles.eventCardTitle} numberOfLines={1}>
                    {getVenueDisplayName(venue)}
                </Text>
                <View style={mapStyles.venueStatRow}>
                    <Text style={mapStyles.eventCardDate}>{formatCompactCount(venue.followers)} following</Text>
                    {venue.upcomingEventsCount ? (
                        <Text style={mapStyles.eventCardDate}>{venue.upcomingEventsCount} upcoming</Text>
                    ) : null}
                </View>
                {distanceLabel ? <Text style={mapStyles.distanceText}>{distanceLabel}</Text> : null}
            </View>
        </Pressable>
    );
}

export default function MapScreen() {
    const params = useLocalSearchParams<{
        eventId?: string | string[];
        venueId?: string | string[];
        mode?: string | string[];
    }>();
    const requestedEventId = normalizeParam(params.eventId);
    const requestedVenueId = normalizeParam(params.venueId);
    const requestedMode = normalizeParam(params.mode) === "venues" ? "venues" : "events";

    const { fetchEvents } = useEventsStore();
    const { fetchVenues } = useVenuesStore();
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);

    const [mapMode, setMapMode] = useState<MapMode>(requestedMode);
    const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
    const [eventsWithCoords, setEventsWithCoords] = useState<EventWithCoords[]>([]);
    const [venuesWithCoords, setVenuesWithCoords] = useState<VenueWithCoords[]>([]);
    const [selectedCluster, setSelectedCluster] = useState<EventCluster | null>(null);
    const [selectedVenue, setSelectedVenue] = useState<VenueWithCoords | null>(null);
    const [loading, setLoading] = useState(true);
    const [mapReady, setMapReady] = useState(false);

    useEffect(() => {
        setMapMode(requestedMode);
    }, [requestedMode]);

    useEffect(() => {
        let cancelled = false;

        async function loadMapData() {
            setLoading(true);

            try {
                let resolvedUserLocation = userLocation;
                const latestEvents = useEventsStore.getState().events;
                const latestVenues = useVenuesStore.getState().venues;

                await Promise.all([
                    latestEvents.length === 0 ? fetchEvents() : Promise.resolve(),
                    latestVenues.length === 0 ? fetchVenues() : Promise.resolve(),
                ]);

                try {
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    if (status === "granted") {
                        const location = await Location.getCurrentPositionAsync({
                            accuracy: Location.Accuracy.Balanced,
                        });

                        resolvedUserLocation = {
                            latitude: location.coords.latitude,
                            longitude: location.coords.longitude,
                        };

                        if (!cancelled) {
                            setUserLocation(resolvedUserLocation);
                        }
                    }
                } catch (error) {
                    console.warn("[Map] Location permission error:", error);
                }

                const venueItems = useVenuesStore.getState().venues;
                const venueById = new Map<string, Venue>(venueItems.map((venue) => [venue.id, venue]));
                const venueByKey = new Map<string, Venue>();

                venueItems.forEach((venue) => {
                    [
                        venue.id,
                        venue.slug,
                        normalizeVenueKey(venue.displayName),
                        normalizeVenueKey(venue.name),
                    ]
                        .filter((value): value is string => Boolean(value))
                        .forEach((key) => venueByKey.set(key, venue));
                });

                const resolvedEvents = (
                    await Promise.all(
                        useEventsStore.getState().events.map(async (event) => {
                            const rawEvent = event as EventWithCoords & Record<string, unknown>;
                            const matchedVenue =
                                (rawEvent.venueId && venueById.get(rawEvent.venueId)) ||
                                (rawEvent.venueSlug && venueByKey.get(rawEvent.venueSlug)) ||
                                venueByKey.get(normalizeVenueKey(event.venue));

                            let resolvedCoords =
                                event.coordinates ||
                                matchedVenue?.coordinates ||
                                findKnownVenueCoordinates(
                                    event.venue,
                                    event.location,
                                    event.city,
                                    matchedVenue?.displayName,
                                    matchedVenue?.name
                                );

                            if (!resolvedCoords) {
                                resolvedCoords = await geocodeVenue(event.venue, event.location, event.city);
                            }

                            if (!resolvedCoords) {
                                return null;
                            }

                            return {
                                ...event,
                                venueId: rawEvent.venueId || matchedVenue?.id,
                                venueSlug: rawEvent.venueSlug || matchedVenue?.slug,
                                resolvedCoords,
                            } as EventWithCoords;
                        })
                    )
                ).filter((event): event is EventWithCoords => Boolean(event));

                const resolvedVenues = venueItems
                    .map((venue) => {
                        const coords =
                            venue.coordinates ||
                            findKnownVenueCoordinates(
                                venue.displayName,
                                venue.name,
                                venue.neighborhood,
                                venue.area,
                                venue.city,
                                venue.address
                            );

                        if (!coords) {
                            return null;
                        }

                        return {
                            ...venue,
                            resolvedCoords: coords,
                            distanceKm: resolvedUserLocation ? calculateDistanceKm(resolvedUserLocation, coords) : null,
                        } as VenueWithCoords;
                    })
                    .filter((venue): venue is VenueWithCoords => Boolean(venue))
                    .sort((left, right) => {
                        const leftDistance = left.distanceKm ?? null;
                        const rightDistance = right.distanceKm ?? null;

                        if (leftDistance !== null && rightDistance !== null) {
                            return leftDistance - rightDistance;
                        }
                        return (right.popularityScore || 0) - (left.popularityScore || 0);
                    });

                if (cancelled) {
                    return;
                }

                setEventsWithCoords(resolvedEvents);
                setVenuesWithCoords(resolvedVenues);

                const focusEvent = requestedEventId
                    ? resolvedEvents.find((event) => event.id === requestedEventId)
                    : null;
                const focusVenue = requestedVenueId
                    ? resolvedVenues.find((venue) => venue.id === requestedVenueId || venue.slug === requestedVenueId)
                    : null;

                if (focusEvent?.resolvedCoords) {
                    setMapMode("events");
                    setSelectedVenue(null);
                } else if (focusVenue) {
                    setMapMode("venues");
                    setSelectedCluster(null);
                    setSelectedVenue(focusVenue);
                    setTimeout(() => {
                        mapRef.current?.animateToRegion(
                            {
                                ...focusVenue.resolvedCoords,
                                latitudeDelta: 0.015,
                                longitudeDelta: 0.015,
                            },
                            800
                        );
                    }, 450);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void loadMapData();

        return () => {
            cancelled = true;
        };
    }, [fetchEvents, fetchVenues, requestedEventId, requestedVenueId]);

    const eventClusters = useMemo(() => {
        const grouped = new Map<string, EventCluster>();

        eventsWithCoords.forEach((event) => {
            if (!event.resolvedCoords) {
                return;
            }

            const key =
                event.venueId ||
                event.venueSlug ||
                `${event.resolvedCoords.latitude.toFixed(4)}:${event.resolvedCoords.longitude.toFixed(4)}`;
            const existing = grouped.get(key);

            if (existing) {
                existing.events.push(event);
                return;
            }

            grouped.set(key, {
                key,
                coordinate: event.resolvedCoords,
                events: [event],
                venueId: event.venueId,
                venueSlug: event.venueSlug,
                venueName: event.venue || event.location || event.title,
            });
        });

        return [...grouped.values()]
            .map((cluster) => ({
                ...cluster,
                events: [...cluster.events].sort(
                    (left, right) => Date.parse(left.startDate || "") - Date.parse(right.startDate || "")
                ),
            }))
            .sort((left, right) => right.events.length - left.events.length);
    }, [eventsWithCoords]);

    useEffect(() => {
        if (!requestedEventId || !eventClusters.length) {
            return;
        }

        const targetCluster = eventClusters.find((cluster) =>
            cluster.events.some((event) => event.id === requestedEventId)
        );

        if (!targetCluster) {
            return;
        }

        setSelectedCluster(targetCluster);
        setSelectedVenue(null);

        setTimeout(() => {
            mapRef.current?.animateToRegion(
                {
                    ...targetCluster.coordinate,
                    latitudeDelta: 0.012,
                    longitudeDelta: 0.012,
                },
                800
            );
        }, 350);
    }, [eventClusters, requestedEventId]);

    const initialRegion = useMemo(() => {
        if (userLocation) {
            return { ...userLocation, latitudeDelta: 0.1, longitudeDelta: 0.1 };
        }

        if (mapMode === "venues" && venuesWithCoords.length > 0) {
            return {
                ...venuesWithCoords[0].resolvedCoords,
                latitudeDelta: 0.12,
                longitudeDelta: 0.12,
            };
        }

        if (eventClusters.length > 0) {
            return {
                ...eventClusters[0].coordinate,
                latitudeDelta: 0.15,
                longitudeDelta: 0.15,
            };
        }

        return DEFAULT_REGION;
    }, [eventClusters, mapMode, userLocation, venuesWithCoords]);

    const subtitle = useMemo(() => {
        if (mapMode === "venues") {
            return `${venuesWithCoords.length} venues mapped`;
        }
        return `${eventClusters.length} hotspots nearby`;
    }, [eventClusters.length, mapMode, venuesWithCoords.length]);

    return (
        <View style={mapStyles.container}>
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
                {mapReady && mapMode === "events"
                    ? eventClusters.map((cluster) => {
                        const isSelected = selectedCluster?.key === cluster.key;
                        const markerCount = cluster.events.length;

                        return (
                            <Marker
                                key={cluster.key}
                                coordinate={cluster.coordinate}
                                onPress={() => {
                                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setSelectedCluster(cluster);
                                    setSelectedVenue(null);
                                }}
                            >
                                <View style={mapStyles.markerContainer}>
                                    <LinearGradient
                                        colors={
                                            isSelected
                                                ? (gradients.primary as [string, string])
                                                : markerCount > 1
                                                    ? ["rgba(13, 161, 146, 0.92)", "rgba(13, 161, 146, 0.68)"]
                                                    : ["rgba(244, 74, 34, 0.82)", "rgba(244, 74, 34, 0.56)"]
                                        }
                                        style={[
                                            mapStyles.markerGradient,
                                            isSelected && mapStyles.markerSelected,
                                            markerCount > 1 && mapStyles.markerGradientCluster,
                                        ]}
                                    >
                                        <Text style={markerCount > 1 ? mapStyles.markerCount : mapStyles.markerEmoji}>
                                            {markerCount > 1 ? markerCount : "🎉"}
                                        </Text>
                                    </LinearGradient>
                                    <View style={mapStyles.markerArrow} />
                                </View>
                            </Marker>
                        );
                    })
                    : mapReady
                        ? venuesWithCoords.map((venue) => {
                            const isSelected = selectedVenue?.id === venue.id;
                            const markerLabel = venue.upcomingEventsCount ? `${Math.min(venue.upcomingEventsCount, 99)}` : "V";

                            return (
                                <Marker
                                    key={venue.id}
                                    coordinate={venue.resolvedCoords}
                                    onPress={() => {
                                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        setSelectedVenue(venue);
                                        setSelectedCluster(null);
                                    }}
                                >
                                    <View style={mapStyles.markerContainer}>
                                        <LinearGradient
                                            colors={
                                                isSelected
                                                    ? ["#F4B942", "#F44A22"]
                                                    : ["rgba(24, 112, 77, 0.9)", "rgba(24, 112, 77, 0.62)"]
                                            }
                                            style={[
                                                mapStyles.markerGradient,
                                                isSelected && mapStyles.markerSelected,
                                            ]}
                                        >
                                            <Text style={mapStyles.markerCount}>{markerLabel}</Text>
                                        </LinearGradient>
                                        <View style={mapStyles.markerArrow} />
                                    </View>
                                </Marker>
                            );
                        })
                        : null}
            </MapView>

            {loading ? (
                <View style={mapStyles.loadingOverlay}>
                    <BlurView intensity={60} tint="dark" style={mapStyles.loadingBlur}>
                        <ActivityIndicator size="large" color={colors.iris} />
                        <Text style={mapStyles.loadingText}>Building the city map...</Text>
                    </BlurView>
                </View>
            ) : null}

            <SafeAreaView edges={["top"]} style={mapStyles.topBar}>
                <View style={mapStyles.topBarContent}>
                    <Pressable
                        onPress={() => {
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.back();
                        }}
                        style={mapStyles.backButton}
                    >
                        <BlurView intensity={40} tint="dark" style={mapStyles.backButtonBlur}>
                            <Text style={mapStyles.backButtonText}>←</Text>
                        </BlurView>
                    </Pressable>

                    <View style={mapStyles.titleContainer}>
                        <Text style={mapStyles.titleText}>{mapMode === "events" ? "Event Map" : "Venue Map"}</Text>
                        <Text style={mapStyles.subtitleText}>{subtitle}</Text>
                    </View>

                    <Pressable
                        onPress={() => {
                            if (!userLocation) {
                                return;
                            }

                            mapRef.current?.animateToRegion(
                                {
                                    ...userLocation,
                                    latitudeDelta: 0.05,
                                    longitudeDelta: 0.05,
                                },
                                600
                            );
                        }}
                        style={mapStyles.locationButton}
                    >
                        <BlurView intensity={40} tint="dark" style={mapStyles.backButtonBlur}>
                            <Text style={mapStyles.backButtonText}>📍</Text>
                        </BlurView>
                    </Pressable>
                </View>

                <View style={mapStyles.modeSwitchRow}>
                    {(["events", "venues"] as MapMode[]).map((mode) => (
                        <Pressable
                            key={mode}
                            onPress={() => {
                                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setMapMode(mode);
                                if (mode === "events") {
                                    setSelectedVenue(null);
                                } else {
                                    setSelectedCluster(null);
                                }
                            }}
                            style={[mapStyles.modeChip, mapMode === mode && mapStyles.modeChipActive]}
                        >
                            <Text style={[mapStyles.modeChipText, mapMode === mode && mapStyles.modeChipTextActive]}>
                                {mode === "events" ? "Events" : "Venues"}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            </SafeAreaView>

            {mapMode === "events" && selectedCluster ? (
                <Animated.View
                    entering={SlideInUp.springify().damping(18)}
                    style={[mapStyles.bottomCard, { paddingBottom: insets.bottom + 8 }]}
                >
                    <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={mapStyles.bottomCardInner}>
                        <MapEventCard
                            cluster={selectedCluster}
                            onPress={() =>
                                router.push({
                                    pathname: "/event/[id]",
                                    params: { id: selectedCluster.events[0].id },
                                })
                            }
                        />

                        <View style={mapStyles.bottomActions}>
                            <Pressable
                                onPress={() => {
                                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    router.push({
                                        pathname: "/event/[id]",
                                        params: { id: selectedCluster.events[0].id },
                                    });
                                }}
                                style={mapStyles.viewButton}
                            >
                                <LinearGradient colors={gradients.primary as [string, string]} style={mapStyles.viewButtonGradient}>
                                    <Text style={mapStyles.viewButtonText}>View Event</Text>
                                </LinearGradient>
                            </Pressable>

                            <Pressable
                                onPress={() => {
                                    const targetVenue =
                                        (selectedCluster.venueId &&
                                            venuesWithCoords.find((venue) => venue.id === selectedCluster.venueId)) ||
                                        (selectedCluster.venueSlug &&
                                            venuesWithCoords.find((venue) => venue.slug === selectedCluster.venueSlug));

                                    if (targetVenue) {
                                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        router.push(`/venue/${targetVenue.slug || targetVenue.id}` as never);
                                        return;
                                    }

                                    if (selectedCluster.events[0].resolvedCoords) {
                                        void openDirections(
                                            selectedCluster.events[0].resolvedCoords,
                                            selectedCluster.venueName
                                        );
                                    }
                                }}
                                style={mapStyles.directionsButton}
                            >
                                <Text style={mapStyles.directionsButtonText}>
                                    {selectedCluster.events.length > 1 ? "Venue Page" : "Directions"}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </Animated.View>
            ) : null}

            {mapMode === "venues" && selectedVenue ? (
                <Animated.View
                    entering={SlideInUp.springify().damping(18)}
                    style={[mapStyles.bottomCard, { paddingBottom: insets.bottom + 8 }]}
                >
                    <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={mapStyles.bottomCardInner}>
                        <MapVenueCard
                            venue={selectedVenue}
                            onPress={() => router.push(`/venue/${selectedVenue.slug || selectedVenue.id}` as never)}
                        />

                        <View style={mapStyles.bottomActions}>
                            <Pressable
                                onPress={() => {
                                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    router.push(`/venue/${selectedVenue.slug || selectedVenue.id}` as never);
                                }}
                                style={mapStyles.viewButton}
                            >
                                <LinearGradient colors={["#F4B942", "#F44A22"]} style={mapStyles.viewButtonGradient}>
                                    <Text style={mapStyles.viewButtonText}>View Venue</Text>
                                </LinearGradient>
                            </Pressable>

                            <Pressable
                                onPress={() => {
                                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    void openDirections(
                                        selectedVenue.resolvedCoords,
                                        getVenueDisplayName(selectedVenue)
                                    );
                                }}
                                style={mapStyles.directionsButton}
                            >
                                <Text style={mapStyles.directionsButtonText}>Directions</Text>
                            </Pressable>
                        </View>
                    </View>
                </Animated.View>
            ) : null}
        </View>
    );
}

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
    markerContainer: {
        alignItems: "center",
    },
    markerGradient: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.2)",
    },
    markerGradientCluster: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    markerSelected: {
        transform: [{ scale: 1.14 }],
    },
    markerEmoji: {
        fontSize: 18,
    },
    markerCount: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "900",
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
    modeSwitchRow: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 10,
        paddingHorizontal: 20,
        paddingBottom: 6,
    },
    modeChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: "rgba(0,0,0,0.38)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    modeChipActive: {
        backgroundColor: "rgba(244,74,34,0.2)",
        borderColor: "rgba(244,74,34,0.35)",
    },
    modeChipText: {
        color: "rgba(255,255,255,0.68)",
        fontSize: 12,
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 0.6,
    },
    modeChipTextActive: {
        color: "#fff",
    },
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
    cardFallbackEmoji: {
        fontSize: 24,
    },
    eventCardContent: {
        flex: 1,
        padding: 12,
        justifyContent: "center",
    },
    eventCardEyebrow: {
        color: colors.goldMetallic,
        fontSize: 11,
        fontWeight: "700",
        marginBottom: 4,
        textTransform: "uppercase",
        letterSpacing: 0.6,
    },
    eventCardTitle: {
        color: colors.gold,
        fontSize: 16,
        fontWeight: "700",
        marginBottom: 6,
    },
    eventCardFooter: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    eventCardDate: {
        color: colors.goldDark,
        fontSize: 12,
        fontWeight: "600",
    },
    eventCardPrice: {
        color: colors.gold,
        fontSize: 12,
        fontWeight: "700",
    },
    venueStatRow: {
        flexDirection: "row",
        gap: 12,
        flexWrap: "wrap",
    },
    distanceText: {
        color: "rgba(255,255,255,0.68)",
        fontSize: 12,
        fontWeight: "600",
        marginTop: 6,
    },
    viewButton: {
        flex: 1,
        borderRadius: radii.xl,
        overflow: "hidden",
    },
    viewButtonGradient: {
        paddingVertical: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    viewButtonText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 0.8,
    },
    directionsButton: {
        minWidth: 120,
        borderRadius: radii.xl,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 18,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        backgroundColor: "rgba(255,255,255,0.04)",
    },
    directionsButtonText: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 0.7,
    },
});
