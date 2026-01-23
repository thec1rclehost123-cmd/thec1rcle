import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, FlatList, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useEffect, useState, useCallback } from "react";
import { colors } from "@/lib/design/theme";
import { useAuthStore } from "@/store/authStore";
import { useVenuesStore, Venue } from "@/store/venuesStore";
import { VenueCard, VenueSkeleton } from "@/components/venues/VenueCard";
import { BlurView } from "expo-blur";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { useUIStore } from "@/store/uiStore";
import { useScrollToHide } from "@/hooks/useScrollToHide";

const AREAS = ["Koregaon Park", "Baner", "Viman Nagar", "Kalyani Nagar", "FC Road", "Hinjewadi", "Wakad", "Shivajinagar"];

export default function VenuesTab() {
    const insets = useSafeAreaInsets();
    const { user } = useAuthStore();
    const { venues, loading, fetchVenues } = useVenuesStore();
    const onScroll = useScrollToHide();
    const { setTabBarVisible } = useUIStore();

    // Reset tab bar on focus
    useEffect(() => {
        setTabBarVisible(true);
    }, []);

    const [search, setSearch] = useState("");
    const [activeArea, setActiveArea] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchVenues({ area: activeArea || undefined, search: search || undefined });
        setRefreshing(false);
    }, [fetchVenues, activeArea, search]);

    useEffect(() => {
        fetchVenues({ area: activeArea || undefined, search: search || undefined });
    }, [activeArea, search]);

    const handleAreaPress = (area: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setActiveArea(activeArea === area ? null : area);
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <View>
                <Text style={styles.headerSubtitle}>Discover</Text>
                <Text style={styles.headerTitle}>Venues</Text>
            </View>
            <Pressable
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push("/(tabs)/profile");
                }}
                style={styles.profileButton}
            >
                {user?.photoURL ? (
                    <Image
                        source={{ uri: user.photoURL }}
                        style={styles.profileImage}
                        contentFit="cover"
                    />
                ) : (
                    <View style={styles.profilePlaceholder}>
                        <Text style={styles.profileInitials}>
                            {user?.displayName ? user.displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "C"}
                        </Text>
                    </View>
                )}
            </Pressable>
        </View>
    );

    const renderFilters = () => (
        <View style={styles.filterSection}>
            <View style={styles.searchBarContainer}>
                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                <Ionicons name="search" size={20} color="rgba(255,255,255,0.3)" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search venues, area..."
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={search}
                    onChangeText={setSearch}
                />
                {search.length > 0 && (
                    <Pressable onPress={() => setSearch("")} style={styles.clearButton}>
                        <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.3)" />
                    </Pressable>
                )}
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.areaList}
            >
                {AREAS.map((area) => (
                    <Pressable
                        key={area}
                        onPress={() => handleAreaPress(area)}
                        style={[
                            styles.areaChip,
                            activeArea === area && styles.areaChipActive
                        ]}
                    >
                        <Text style={[
                            styles.areaChipText,
                            activeArea === area && styles.areaChipActiveText
                        ]}>
                            {area}
                        </Text>
                    </Pressable>
                ))}
            </ScrollView>
        </View>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <FlatList
                data={loading && venues.length === 0 ? [] : venues}
                keyExtractor={(item: Venue) => item.id}
                renderItem={({ item }) => (
                    <Animated.View
                        entering={FadeInDown.duration(400)}
                    >
                        <VenueCard venue={item} />
                    </Animated.View>
                )}
                ListHeaderComponent={
                    <>
                        {renderHeader()}
                        {renderFilters()}
                        {loading && venues.length === 0 && (
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
                            <Ionicons name="location-outline" size={64} color="rgba(255,255,255,0.1)" />
                            <Text style={styles.emptyText}>No venues found in this area</Text>
                            <Pressable
                                style={styles.resetButton}
                                onPress={() => {
                                    setActiveArea(null);
                                    setSearch("");
                                }}
                            >
                                <Text style={styles.resetButtonText}>Clear Filters</Text>
                            </Pressable>
                        </View>
                    ) : null
                }
                contentContainerStyle={styles.listContent}
                onScroll={onScroll}
                scrollEventThrottle={16}
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
        paddingBottom: 40,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 20,
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
    },
    profileButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1.5,
        borderColor: colors.iris,
        overflow: "hidden",
    },
    profileImage: {
        width: "100%",
        height: "100%",
    },
    profilePlaceholder: {
        flex: 1,
        backgroundColor: "rgba(244, 74, 34, 0.1)",
        alignItems: "center",
        justifyContent: "center",
    },
    profileInitials: {
        color: colors.iris,
        fontSize: 14,
        fontWeight: "700",
    },
    filterSection: {
        marginBottom: 24,
    },
    searchBarContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.05)",
        marginHorizontal: 20,
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 54,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.05)",
    },
    searchIcon: {
        marginRight: 12,
    },
    searchInput: {
        flex: 1,
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
    clearButton: {
        padding: 4,
    },
    areaList: {
        paddingHorizontal: 20,
        gap: 10,
    },
    areaChip: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 25,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.05)",
    },
    areaChipActive: {
        backgroundColor: "#fff",
        borderColor: "#fff",
    },
    areaChipText: {
        color: "rgba(255,255,255,0.6)",
        fontSize: 12,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    areaChipActiveText: {
        color: "#000",
    },
    emptyState: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingTop: 100,
        paddingHorizontal: 40,
    },
    emptyText: {
        color: "rgba(255,255,255,0.4)",
        fontSize: 16,
        fontWeight: "600",
        textAlign: "center",
        marginTop: 20,
        marginBottom: 24,
    },
    resetButton: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 25,
        backgroundColor: colors.iris,
    },
    resetButtonText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 1,
    },
});
