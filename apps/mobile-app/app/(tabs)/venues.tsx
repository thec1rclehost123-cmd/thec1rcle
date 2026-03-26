import { useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    TextInput,
    FlatList,
    RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "@/lib/design/theme";
import { useVenuesStore, Venue } from "@/store/venuesStore";
import { VenueCard, VenueSkeleton } from "@/components/venues/VenueCard";
import { calculateDistanceKm, type Coordinates, getVenueLocationLabel } from "@/lib/venueDiscovery";

const AnyFlatList = FlatList as any;

type SortMode = "popular" | "nearby" | "events" | "tables";
type DisplayVenue = Venue & { distanceKm?: number | null };

export default function VenuesTab() {
    const insets = useSafeAreaInsets();
    const { venues, loading, error, fetchVenues } = useVenuesStore();

    const [search, setSearch] = useState("");
    const [activeArea, setActiveArea] = useState<string | null>(null);
    const [activeType, setActiveType] = useState<string | null>(null);
    const [sortMode, setSortMode] = useState<SortMode>("popular");
    const [refreshing, setRefreshing] = useState(false);
    const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
    const [locationDenied, setLocationDenied] = useState(false);

    useEffect(() => {
        void fetchVenues();
    }, [fetchVenues]);

    useEffect(() => {
        if (sortMode !== "nearby" || userLocation || locationDenied) {
            return;
        }

        let cancelled = false;

        async function loadUserLocation() {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (cancelled) {
                    return;
                }

                if (status !== "granted") {
                    setLocationDenied(true);
                    return;
                }

                const currentPosition = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });

                if (!cancelled) {
                    setUserLocation({
                        latitude: currentPosition.coords.latitude,
                        longitude: currentPosition.coords.longitude,
                    });
                }
            } catch {
                if (!cancelled) {
                    setLocationDenied(true);
                }
            }
        }

        void loadUserLocation();

        return () => {
            cancelled = true;
        };
    }, [locationDenied, sortMode, userLocation]);

    const areaOptions = useMemo(() => {
        const counts = new Map<string, number>();

        venues.forEach((venue) => {
            const label = getVenueLocationLabel(venue);
            if (!label) {
                return;
            }
            counts.set(label, (counts.get(label) || 0) + 1);
        });

        return [...counts.entries()]
            .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
            .slice(0, 10)
            .map(([label]) => label);
    }, [venues]);

    const venueTypes = useMemo(() => {
        const values = new Set<string>();
        venues.forEach((venue) => {
            if (venue.venueType?.trim()) {
                values.add(venue.venueType.trim());
            }
        });
        return [...values].sort((left, right) => left.localeCompare(right)).slice(0, 8);
    }, [venues]);

    const filtered = useMemo<DisplayVenue[]>(() => {
        const searchValue = search.trim().toLowerCase();

        return venues
            .filter((venue) => {
                if (activeArea) {
                    const locationMatch = [
                        venue.neighborhood,
                        venue.area,
                        venue.city,
                        venue.address,
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();

                    if (!locationMatch.includes(activeArea.toLowerCase())) {
                        return false;
                    }
                }

                if (activeType && venue.venueType?.toLowerCase() !== activeType.toLowerCase()) {
                    return false;
                }

                if (!searchValue) {
                    return true;
                }

                const searchHaystack = [
                    venue.displayName,
                    venue.name,
                    venue.neighborhood,
                    venue.area,
                    venue.city,
                    venue.description,
                    ...(venue.tags || []),
                    ...(venue.vibes || []),
                    ...(venue.genres || []),
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();

                return searchHaystack.includes(searchValue);
            })
            .map((venue) => ({
                ...venue,
                distanceKm:
                    userLocation && venue.coordinates
                        ? calculateDistanceKm(userLocation, venue.coordinates)
                        : null,
            }));
    }, [activeArea, activeType, search, userLocation, venues]);

    const sortedVenues = useMemo(() => {
        const next = [...filtered];

        switch (sortMode) {
            case "nearby":
                next.sort((left, right) => {
                    const leftDistance = left.distanceKm ?? null;
                    const rightDistance = right.distanceKm ?? null;

                    if (leftDistance !== null && rightDistance !== null) {
                        return leftDistance - rightDistance;
                    }
                    if (leftDistance !== null) {
                        return -1;
                    }
                    if (rightDistance !== null) {
                        return 1;
                    }
                    return (right.popularityScore || 0) - (left.popularityScore || 0);
                });
                break;
            case "events":
                next.sort((left, right) => {
                    const byEvents = (right.upcomingEventsCount || 0) - (left.upcomingEventsCount || 0);
                    if (byEvents !== 0) {
                        return byEvents;
                    }
                    const leftDate = left.nextEventDate ? Date.parse(left.nextEventDate) : Number.MAX_SAFE_INTEGER;
                    const rightDate = right.nextEventDate ? Date.parse(right.nextEventDate) : Number.MAX_SAFE_INTEGER;
                    return leftDate - rightDate;
                });
                break;
            case "tables":
                next.sort((left, right) => {
                    const byTables = Number(Boolean(right.tablesAvailable)) - Number(Boolean(left.tablesAvailable));
                    if (byTables !== 0) {
                        return byTables;
                    }
                    return (right.popularityScore || 0) - (left.popularityScore || 0);
                });
                break;
            case "popular":
            default:
                next.sort((left, right) => (right.popularityScore || 0) - (left.popularityScore || 0));
                break;
        }

        return next;
    }, [filtered, sortMode]);

    const activeVenueCount = useMemo(
        () => sortedVenues.filter((venue) => (venue.upcomingEventsCount || 0) > 0).length,
        [sortedVenues]
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchVenues();
        setRefreshing(false);
    };

    const openVenue = (venue: Venue) => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/venue/${venue.slug || venue.id}` as never);
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <AnyFlatList
                data={loading && sortedVenues.length === 0 ? [] : sortedVenues}
                keyExtractor={(item: Venue) => item.id}
                renderItem={({ item }: { item: Venue }) => (
                    <VenueCard venue={item} onPress={() => openVenue(item)} />
                )}
                ListHeaderComponent={
                    <>
                        <View style={styles.header}>
                            <View>
                                <Text style={styles.headerSubtitle}>Discover</Text>
                                <Text style={styles.headerTitle}>Venues</Text>
                                <Text style={styles.headerMeta}>
                                    {sortedVenues.length} places, {activeVenueCount} with upcoming events
                                </Text>
                            </View>
                            <Pressable
                                onPress={() => router.push({ pathname: "/map", params: { mode: "venues" } })}
                                style={styles.headerMapButton}
                            >
                                <Ionicons name="map-outline" size={18} color="#fff" />
                            </Pressable>
                        </View>

                        <View style={styles.filterSection}>
                            <View style={styles.searchBarContainer}>
                                <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
                                <Ionicons name="search" size={20} color="rgba(255,255,255,0.35)" style={styles.searchIcon} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search venues, area..."
                                    placeholderTextColor="rgba(255,255,255,0.35)"
                                    value={search}
                                    onChangeText={setSearch}
                                />
                                {search.length > 0 && (
                                    <Pressable onPress={() => setSearch("")} style={styles.clearButton}>
                                        <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.35)" />
                                    </Pressable>
                                )}
                            </View>

                            <AnyFlatList
                                data={[
                                    { key: "popular", label: "Popular" },
                                    { key: "nearby", label: "Nearby" },
                                    { key: "events", label: "Has Events" },
                                    { key: "tables", label: "Tables" },
                                ]}
                                keyExtractor={(item: { key: string }) => item.key}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.sortList}
                                renderItem={({ item }: { item: { key: string; label: string } }) => (
                                    <Pressable
                                        onPress={() => {
                                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            setSortMode(item.key as SortMode);
                                        }}
                                        style={[styles.sortChip, sortMode === item.key && styles.sortChipActive]}
                                    >
                                        <Text style={[styles.sortChipText, sortMode === item.key && styles.sortChipTextActive]}>
                                            {item.label}
                                        </Text>
                                    </Pressable>
                                )}
                            />

                            <AnyFlatList
                                data={areaOptions}
                                keyExtractor={(a: string) => a}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.areaList}
                                renderItem={({ item: area }: { item: string }) => (
                                    <Pressable
                                        onPress={() => {
                                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            setActiveArea(activeArea === area ? null : area);
                                        }}
                                        style={[
                                            styles.areaChip,
                                            activeArea === area && styles.areaChipActive,
                                        ]}
                                    >
                                        <Text style={[
                                            styles.areaChipText,
                                            activeArea === area && styles.areaChipActiveText,
                                        ]}>
                                            {area}
                                        </Text>
                                    </Pressable>
                                )}
                            />

                            {venueTypes.length > 0 ? (
                                <AnyFlatList
                                    data={venueTypes}
                                    keyExtractor={(value: string) => value}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.areaList}
                                    renderItem={({ item }: { item: string }) => (
                                        <Pressable
                                            onPress={() => {
                                                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                setActiveType(activeType === item ? null : item);
                                            }}
                                            style={[
                                                styles.areaChip,
                                                activeType === item && styles.areaChipActive,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.areaChipText,
                                                    activeType === item && styles.areaChipActiveText,
                                                ]}
                                            >
                                                {item}
                                            </Text>
                                        </Pressable>
                                    )}
                                />
                            ) : null}

                            {(activeArea || activeType || search) ? (
                                <Pressable
                                    onPress={() => {
                                        setActiveArea(null);
                                        setActiveType(null);
                                        setSearch("");
                                    }}
                                    style={styles.resetInlineButton}
                                >
                                    <Text style={styles.resetInlineText}>Reset filters</Text>
                                </Pressable>
                            ) : null}

                            {sortMode === "nearby" && locationDenied ? (
                                <Text style={styles.helperText}>
                                    Nearby sort needs location access. Showing venues with saved coordinates first.
                                </Text>
                            ) : null}
                            {error ? <Text style={styles.helperText}>{error}</Text> : null}
                        </View>

                        {loading && sortedVenues.length === 0 && (
                            <View>
                                <VenueSkeleton />
                                <VenueSkeleton />
                                <VenueSkeleton />
                            </View>
                        )}
                    </>
                }
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="location-outline" size={64} color="rgba(255,255,255,0.12)" />
                            <Text style={styles.emptyText}>No venues found</Text>
                            <Pressable
                                style={styles.resetButton}
                                onPress={() => {
                                    setActiveArea(null);
                                    setActiveType(null);
                                    setSearch("");
                                }}
                            >
                                <Text style={styles.resetButtonText}>Clear Filters</Text>
                            </Pressable>
                        </View>
                    ) : null
                }
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.iris}
                    />
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.base.DEFAULT,
    },
    listContent: {
        paddingBottom: 120,
    },
    header: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 10,
    },
    headerSubtitle: {
        color: colors.iris,
        fontSize: 12,
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 2,
    },
    headerTitle: {
        color: "#fff",
        fontSize: 34,
        fontWeight: "900",
        textTransform: "uppercase",
        letterSpacing: -1,
        marginTop: 2,
    },
    headerMeta: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 12,
        fontWeight: "600",
        marginTop: 8,
    },
    headerMapButton: {
        width: 46,
        height: 46,
        borderRadius: 23,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    filterSection: {
        marginBottom: 18,
    },
    sortList: {
        paddingHorizontal: 20,
        gap: 10,
        paddingBottom: 12,
    },
    sortChip: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.04)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
    },
    sortChipActive: {
        backgroundColor: "rgba(244,74,34,0.18)",
        borderColor: "rgba(244,74,34,0.35)",
    },
    sortChipText: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 12,
        fontWeight: "800",
        letterSpacing: 0.6,
        textTransform: "uppercase",
    },
    sortChipTextActive: {
        color: "#fff",
    },
    searchBarContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.05)",
        marginHorizontal: 20,
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 54,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
        overflow: "hidden",
    },
    searchIcon: {
        marginRight: 12,
    },
    searchInput: {
        flex: 1,
        color: "#fff",
        fontSize: 15,
        fontWeight: "600",
    },
    clearButton: {
        padding: 4,
    },
    areaList: {
        paddingHorizontal: 20,
        gap: 10,
        paddingBottom: 10,
    },
    areaChip: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
    },
    areaChipActive: {
        backgroundColor: `${colors.iris}25`,
        borderColor: `${colors.iris}35`,
    },
    areaChipText: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 12,
        fontWeight: "800",
        letterSpacing: 0.6,
        textTransform: "uppercase",
    },
    areaChipActiveText: {
        color: "#fff",
    },
    resetInlineButton: {
        marginHorizontal: 20,
        marginTop: 4,
        alignSelf: "flex-start",
    },
    resetInlineText: {
        color: colors.gold,
        fontSize: 12,
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 0.6,
    },
    helperText: {
        color: "rgba(255,255,255,0.52)",
        fontSize: 12,
        fontWeight: "600",
        lineHeight: 18,
        paddingHorizontal: 20,
        paddingTop: 4,
    },
    emptyState: {
        alignItems: "center",
        padding: 40,
    },
    emptyText: {
        color: "rgba(255,255,255,0.65)",
        fontSize: 16,
        fontWeight: "700",
        marginTop: 16,
        textAlign: "center",
    },
    resetButton: {
        marginTop: 18,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
    },
    resetButtonText: {
        color: colors.gold,
        fontSize: 13,
        fontWeight: "800",
    },
});
