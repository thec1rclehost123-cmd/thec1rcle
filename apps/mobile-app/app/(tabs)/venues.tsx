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
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "@/lib/design/theme";
import { useVenuesStore, Venue } from "@/store/venuesStore";
import { VenueCard, VenueSkeleton } from "@/components/venues/VenueCard";
import { VenueSheet } from "@/components/ui/VenueSheet";

const AREAS = [
    "Koregaon Park",
    "Baner",
    "Viman Nagar",
    "Kalyani Nagar",
    "FC Road",
    "Hinjewadi",
    "Wakad",
    "Shivajinagar",
];

export default function VenuesTab() {
    const insets = useSafeAreaInsets();
    const { venues, loading, fetchVenues } = useVenuesStore();

    const [search, setSearch] = useState("");
    const [activeArea, setActiveArea] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);

    const filtered = useMemo(() => venues, [venues]);

    useEffect(() => {
        void fetchVenues({ area: activeArea || undefined, search: search || undefined });
    }, [activeArea, search, fetchVenues]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchVenues({ area: activeArea || undefined, search: search || undefined });
        setRefreshing(false);
    };

    const openVenue = (venue: Venue) => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedVenue(venue);
        setSheetOpen(true);
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <VenueSheet
                visible={sheetOpen}
                onClose={() => setSheetOpen(false)}
                venueName={selectedVenue?.displayName || selectedVenue?.name || "Venue"}
                venueLocation={selectedVenue?.area || selectedVenue?.neighborhood || selectedVenue?.city}
                venueId={selectedVenue?.id}
                venueCoords={null}
            />

            <FlatList
                data={loading && filtered.length === 0 ? [] : filtered}
                keyExtractor={(item: Venue) => item.id}
                renderItem={({ item }) => (
                    <VenueCard venue={item} onPress={() => openVenue(item)} />
                )}
                ListHeaderComponent={
                    <>
                        <View style={styles.header}>
                            <View>
                                <Text style={styles.headerSubtitle}>Discover</Text>
                                <Text style={styles.headerTitle}>Venues</Text>
                            </View>
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

                            <FlatList
                                data={AREAS}
                                keyExtractor={(a) => a}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.areaList}
                                renderItem={({ item: area }) => (
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
                        </View>

                        {loading && filtered.length === 0 && (
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
                                onPress={() => { setActiveArea(null); setSearch(""); }}
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
    filterSection: {
        marginBottom: 18,
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
        paddingBottom: 4,
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

