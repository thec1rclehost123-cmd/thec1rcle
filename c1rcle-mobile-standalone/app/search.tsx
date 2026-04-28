/**
 * Global Search Screen
 * Unified search for events, venues, and hosts
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    TextInput,
    StyleSheet,
    Keyboard,
    ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
    FadeIn,
    FadeInDown,
    FadeOut,
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    Layout,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useEventsStore, Event } from "@/store/eventsStore";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { colors, radii, gradients } from "@/lib/design/theme";
import { trackScreen, trackEvent } from "@/lib/analytics";
import { LinearGradient } from "expo-linear-gradient";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const RECENT_SEARCHES_KEY = "@recent_searches";
const MAX_RECENT_SEARCHES = 8;

// Search result types
type SearchResultType = "event" | "venue" | "host" | "history";

interface SearchResult {
    id: string;
    type: SearchResultType;
    title: string;
    subtitle?: string;
    imageUrl?: string;
    data?: any;
}

// Filter chips
const FILTERS = [
    { id: "all", label: "All" },
    { id: "events", label: "Events" },
    { id: "venues", label: "Venues" },
    { id: "hosts", label: "Hosts" },
];

const CITIES = ["Mumbai", "Delhi", "Bangalore", "Pune", "Goa", "All Cities"];

// Search result card
function SearchResultCard({
    result,
    index,
    onPress,
}: {
    result: SearchResult;
    index: number;
    onPress: () => void;
}) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    };

    return (
        <AnimatedPressable
            entering={FadeInDown.delay(index * 40).springify()}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPress();
            }}
            style={[animatedStyle, styles.resultCard]}
        >
            {/* Image */}
            {result.imageUrl ? (
                <Image
                    source={{ uri: result.imageUrl }}
                    style={styles.resultImage}
                    contentFit="cover"
                />
            ) : (
                <View style={styles.resultImagePlaceholder}>
                    <Ionicons
                        name={result.type === "event" ? "calendar" : result.type === "venue" ? "location" : "musical-notes"}
                        size={24}
                        color={colors.goldMetallic}
                    />
                </View>
            )}

            {/* Content */}
            <View style={styles.resultContent}>
                <Text style={styles.resultTitle} numberOfLines={1}>
                    {result.title}
                </Text>
                {result.subtitle && (
                    <Text style={styles.resultSubtitle} numberOfLines={1}>
                        {result.subtitle}
                    </Text>
                )}
                <View style={styles.resultMeta}>
                    <View style={[styles.resultTypeBadge, result.type === "event" && styles.resultTypeBadgeEvent]}>
                        <Text style={styles.resultTypeText}>
                            {result.type.charAt(0).toUpperCase() + result.type.slice(1)}
                        </Text>
                    </View>
                </View>
            </View>

            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" style={styles.resultArrow} />
        </AnimatedPressable>
    );
}

// Recent search item
function RecentSearchItem({
    query,
    onPress,
    onRemove,
    delay,
}: {
    query: string;
    onPress: () => void;
    onRemove: () => void;
    delay: number;
}) {
    return (
        <Animated.View
            entering={FadeInDown.delay(delay).springify()}
            style={styles.recentSearchItem}
        >
            <Pressable onPress={onPress} style={styles.recentSearchContent}>
                <Ionicons name="time-outline" size={16} color={colors.goldMetallic} style={styles.recentSearchIcon} />
                <Text style={styles.recentSearchText}>{query}</Text>
            </Pressable>
            <Pressable onPress={onRemove} style={styles.recentSearchRemove}>
                <Ionicons name="close" size={16} color={colors.goldMetallic} />
            </Pressable>
        </Animated.View>
    );
}

// Quick filter chip
function FilterChip({
    label,
    selected,
    onPress,
}: {
    label: string;
    selected: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable onPress={onPress}>
            {selected ? (
                <LinearGradient
                    colors={gradients.primary as [string, string]}
                    style={styles.filterChip}
                >
                    <Text style={styles.filterChipTextSelected}>{label}</Text>
                </LinearGradient>
            ) : (
                <View style={[styles.filterChip, styles.filterChipInactive]}>
                    <Text style={styles.filterChipText}>{label}</Text>
                </View>
            )}
        </Pressable>
    );
}

export default function SearchScreen() {
    const { filter: initialFilter } = useLocalSearchParams<{ filter?: string }>();
    const { events, fetchPublicEvents, searchEvents } = useEventsStore();
    const insets = useSafeAreaInsets();
    const inputRef = useRef<TextInput>(null);

    const [query, setQuery] = useState("");
    const [activeFilter, setActiveFilter] = useState(initialFilter || "all");
    const [selectedCity, setSelectedCity] = useState("All Cities");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    useEffect(() => {
        trackScreen("Search");
        loadRecentSearches();
        fetchPublicEvents({ limit: 50 });

        // Auto-focus input
        setTimeout(() => inputRef.current?.focus(), 100);
    }, []);

    const loadRecentSearches = async () => {
        try {
            const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
            if (stored) {
                setRecentSearches(JSON.parse(stored));
            }
        } catch (error) {
            console.error("Failed to load recent searches:", error);
        }
    };

    const saveRecentSearch = async (searchQuery: string) => {
        try {
            const updated = [
                searchQuery,
                ...recentSearches.filter((s) => s !== searchQuery),
            ].slice(0, MAX_RECENT_SEARCHES);

            setRecentSearches(updated);
            await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
        } catch (error) {
            console.error("Failed to save recent search:", error);
        }
    };

    const removeRecentSearch = async (searchQuery: string) => {
        try {
            const updated = recentSearches.filter((s) => s !== searchQuery);
            setRecentSearches(updated);
            await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (error) {
            console.error("Failed to remove recent search:", error);
        }
    };

    const performSearch = useCallback(async (searchQuery: string) => {
        if (!searchQuery.trim()) {
            setResults([]);
            setHasSearched(false);
            return;
        }

        setLoading(true);
        setHasSearched(true);

        // PRODUCTION UPGRADE: Use Firestore keyword search instead of local filtering
        const foundEvents = await searchEvents(searchQuery, { city: selectedCity });

        const eventResults: SearchResult[] = foundEvents
            .map((event) => ({
                id: event.id,
                type: "event" as SearchResultType,
                title: event.title,
                subtitle: event.venue || event.location,
                imageUrl: event.posterUrl || event.coverImage,
                data: event,
            }));

        // Filter by type if needed
        let filteredResults = eventResults;
        if (activeFilter === "venues") {
            // Group by venue
            const venueMap = new Map<string, SearchResult>();
            eventResults.forEach((r) => {
                if (r.subtitle && !venueMap.has(r.subtitle)) {
                    venueMap.set(r.subtitle, {
                        id: `venue-${r.subtitle}`,
                        type: "venue",
                        title: r.subtitle,
                        subtitle: `${foundEvents.filter(e => (e.venue || e.location) === r.subtitle).length} events`,
                    });
                }
            });
            filteredResults = Array.from(venueMap.values());
        }

        setResults(filteredResults);
        setLoading(false);

        trackEvent("search_performed", { query: searchQuery, resultsCount: filteredResults.length, filter: activeFilter, city: selectedCity });
    }, [searchEvents, activeFilter, selectedCity]);

    const handleSearch = () => {
        Keyboard.dismiss();
        if (query.trim()) {
            saveRecentSearch(query.trim());
            performSearch(query);
        }
    };

    const handleRecentSearchPress = (searchQuery: string) => {
        setQuery(searchQuery);
        saveRecentSearch(searchQuery);
        performSearch(searchQuery);
    };

    const handleResultPress = (result: SearchResult) => {
        if (result.type === "event") {
            router.push({ pathname: "/event/[id]", params: { id: result.id } });
        } else if (result.type === "venue") {
            // Could navigate to venue page
            setQuery(result.title);
            performSearch(result.title);
        }
    };

    const handleCancel = () => {
        Keyboard.dismiss();
        router.back();
    };

    const clearQuery = () => {
        setQuery("");
        setResults([]);
        setHasSearched(false);
        inputRef.current?.focus();
    };

    // Suggested searches when empty
    const suggestedSearches = ["Techno", "Hip Hop Night", "Rooftop Party", "Live Music", "Club Night"];

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Search Header */}
            <View style={styles.header}>
                <View style={styles.searchInputContainer}>
                    <Ionicons name="search" size={18} color={colors.goldMetallic} style={styles.searchIcon} />
                    <TextInput
                        ref={inputRef}
                        value={query}
                        onChangeText={(text) => {
                            setQuery(text);
                            if (text.length > 2) {
                                performSearch(text);
                            } else if (text.length === 0) {
                                setResults([]);
                                setHasSearched(false);
                            }
                        }}
                        placeholder="Search events, venues..."
                        placeholderTextColor={colors.goldMetallic}
                        style={styles.searchInput}
                        returnKeyType="search"
                        onSubmitEditing={handleSearch}
                    />
                    {query.length > 0 && (
                        <Pressable onPress={clearQuery} style={styles.clearButton}>
                            <Ionicons name="close-circle" size={18} color={colors.goldMetallic} />
                        </Pressable>
                    )}
                </View>
                <Pressable onPress={handleCancel} style={styles.cancelButton}>
                    <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
            </View>

            {/* Filters */}
            <View style={styles.filters}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filtersList}
                >
                    {FILTERS.map((filter) => (
                        <FilterChip
                            key={filter.id}
                            label={filter.label}
                            selected={activeFilter === filter.id}
                            onPress={() => {
                                Haptics.selectionAsync();
                                setActiveFilter(filter.id);
                                if (query) performSearch(query);
                            }}
                        />
                    ))}

                    <View style={styles.filterDivider} />

                    {/* City filter */}
                    <Pressable
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            // Show city picker
                        }}
                        style={styles.cityFilter}
                    >
                        <Ionicons name="location" size={14} color={colors.goldMetallic} style={styles.cityFilterIcon} />
                        <Text style={styles.cityFilterText}>{selectedCity}</Text>
                    </Pressable>
                </ScrollView>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Loading */}
                {loading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.iris} />
                    </View>
                )}

                {/* Results */}
                {!loading && results.length > 0 && (
                    <View style={styles.resultsSection}>
                        <Text style={styles.sectionTitle}>
                            {results.length} Result{results.length > 1 ? "s" : ""}
                        </Text>
                        {results.map((result, index) => (
                            <SearchResultCard
                                key={result.id}
                                result={result}
                                index={index}
                                onPress={() => handleResultPress(result)}
                            />
                        ))}
                    </View>
                )}

                {/* No results */}
                {!loading && hasSearched && results.length === 0 && (
                    <EmptyState
                        type="no-search-results"
                        message={`No results for "${query}". Try different keywords.`}
                        actionLabel="Clear Search"
                        onAction={clearQuery}
                    />
                )}

                {/* Initial state - show recent and suggestions */}
                {!hasSearched && !loading && (
                    <>
                        {/* Recent Searches */}
                        {recentSearches.length > 0 && (
                            <View style={styles.recentSection}>
                                <View style={styles.sectionHeader}>
                                    <Text style={styles.sectionTitle}>Recent Searches</Text>
                                    <Pressable
                                        onPress={async () => {
                                            setRecentSearches([]);
                                            await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        }}
                                    >
                                        <Text style={styles.clearAllText}>Clear All</Text>
                                    </Pressable>
                                </View>
                                {recentSearches.map((search, index) => (
                                    <RecentSearchItem
                                        key={search}
                                        query={search}
                                        onPress={() => handleRecentSearchPress(search)}
                                        onRemove={() => removeRecentSearch(search)}
                                        delay={index * 30}
                                    />
                                ))}
                            </View>
                        )}

                        {/* Suggested Searches */}
                        <View style={styles.suggestedSection}>
                            <Text style={styles.sectionTitle}>Popular Searches</Text>
                            <View style={styles.suggestedChips}>
                                {suggestedSearches.map((suggestion, index) => (
                                    <Animated.View
                                        key={suggestion}
                                        entering={FadeInDown.delay(index * 40).springify()}
                                    >
                                        <Pressable
                                            onPress={() => handleRecentSearchPress(suggestion)}
                                            style={styles.suggestedChip}
                                        >
                                            <Text style={styles.suggestedChipText}>{suggestion}</Text>
                                        </Pressable>
                                    </Animated.View>
                                ))}
                            </View>
                        </View>

                        {/* Featured venues */}
                        <View style={styles.featuredSection}>
                            <Text style={styles.sectionTitle}>Featured Venues</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.featuredList}
                            >
                                {["District Club", "Toit Brewpub", "BKC Social", "Yautcha"].map((venue, index) => (
                                    <Animated.View
                                        key={venue}
                                        entering={FadeInDown.delay(100 + index * 50).springify()}
                                    >
                                        <Pressable
                                            onPress={() => handleRecentSearchPress(venue)}
                                            style={styles.featuredCard}
                                        >
                                            <View style={styles.featuredImagePlaceholder}>
                                                <Ionicons name="location" size={24} color={colors.goldMetallic} />
                                            </View>
                                            <Text style={styles.featuredTitle}>{venue}</Text>
                                        </Pressable>
                                    </Animated.View>
                                ))}
                            </ScrollView>
                        </View>
                    </>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.base.DEFAULT,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        paddingHorizontal: 14,
        marginRight: 12,
    },
    searchIcon: {
        fontSize: 16,
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        color: colors.gold,
        fontSize: 16,
        paddingVertical: 12,
    },
    clearButton: {
        padding: 4,
    },
    clearIcon: {
        color: colors.goldMetallic,
        fontSize: 14,
    },
    cancelButton: {
        paddingVertical: 8,
    },
    cancelText: {
        color: colors.iris,
        fontSize: 16,
        fontWeight: "500",
    },
    filters: {
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255, 255, 255, 0.06)",
    },
    filtersList: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
        flexDirection: "row",
        alignItems: "center",
    },
    filterChip: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: radii.pill,
    },
    filterChipInactive: {
        backgroundColor: colors.base[50],
    },
    filterChipText: {
        color: colors.goldMetallic,
        fontSize: 14,
        fontWeight: "500",
    },
    filterChipTextSelected: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "600",
    },
    filterDivider: {
        width: 1,
        height: 24,
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        marginHorizontal: 8,
    },
    cityFilter: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.base[50],
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: radii.pill,
    },
    cityFilterIcon: {
        fontSize: 14,
        marginRight: 6,
    },
    cityFilterText: {
        color: colors.goldMetallic,
        fontSize: 14,
        fontWeight: "500",
    },
    scrollView: {
        flex: 1,
    },
    loadingContainer: {
        paddingVertical: 60,
        alignItems: "center",
    },
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        marginBottom: 12,
    },
    sectionTitle: {
        color: colors.gold,
        fontSize: 16,
        fontWeight: "600",
        paddingHorizontal: 20,
        marginTop: 20,
        marginBottom: 12,
    },
    clearAllText: {
        color: colors.iris,
        fontSize: 14,
        fontWeight: "500",
    },

    // Results
    resultsSection: {},
    resultCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.base[50],
        marginHorizontal: 20,
        marginBottom: 8,
        padding: 12,
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
    },
    resultImage: {
        width: 60,
        height: 60,
        borderRadius: 12,
        marginRight: 14,
    },
    resultImagePlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 12,
        marginRight: 14,
        backgroundColor: colors.base[100],
        alignItems: "center",
        justifyContent: "center",
    },
    resultImageEmoji: {
        fontSize: 24,
    },
    resultContent: {
        flex: 1,
    },
    resultTitle: {
        color: colors.gold,
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 4,
    },
    resultSubtitle: {
        color: colors.goldMetallic,
        fontSize: 13,
        marginBottom: 6,
    },
    resultMeta: {
        flexDirection: "row",
    },
    resultTypeBadge: {
        backgroundColor: "rgba(255, 255, 255, 0.06)",
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    resultTypeBadgeEvent: {
        backgroundColor: "rgba(244, 74, 34, 0.15)",
    },
    resultTypeText: {
        color: colors.goldMetallic,
        fontSize: 11,
        fontWeight: "500",
    },
    resultArrow: {
        color: colors.goldMetallic,
        fontSize: 22,
        fontWeight: "300",
        marginLeft: 8,
    },

    // Recent searches
    recentSection: {
        marginTop: 8,
    },
    recentSearchItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 20,
    },
    recentSearchContent: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
    },
    recentSearchIcon: {
        fontSize: 16,
        marginRight: 14,
    },
    recentSearchText: {
        color: colors.gold,
        fontSize: 16,
    },
    recentSearchRemove: {
        padding: 8,
    },
    recentSearchRemoveIcon: {
        color: colors.goldMetallic,
        fontSize: 14,
    },

    // Suggested
    suggestedSection: {},
    suggestedChips: {
        flexDirection: "row",
        flexWrap: "wrap",
        paddingHorizontal: 16,
        gap: 8,
    },
    suggestedChip: {
        backgroundColor: colors.base[50],
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
    },
    suggestedChipText: {
        color: colors.gold,
        fontSize: 14,
    },

    // Featured
    featuredSection: {
        marginTop: 8,
    },
    featuredList: {
        paddingHorizontal: 16,
        gap: 12,
    },
    featuredCard: {
        width: 120,
        alignItems: "center",
    },
    featuredImagePlaceholder: {
        width: 100,
        height: 100,
        borderRadius: radii.xl,
        backgroundColor: colors.base[50],
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8,
    },
    featuredEmoji: {
        fontSize: 32,
    },
    featuredTitle: {
        color: colors.gold,
        fontSize: 13,
        fontWeight: "500",
        textAlign: "center",
    },
});
