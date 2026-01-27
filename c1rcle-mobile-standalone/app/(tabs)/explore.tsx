/**
 * THE C1RCLE — Explore Page (Premium Redesign)
 * 
 * Features:
 * - Premium Header with city selector and time-based greeting
 * - Search bar with rotating placeholders (navigates to search)
 * - Hero carousel with featured events
 * - Quick filters (Tonight, Weekend, This Week)
 * - Category chips with haptics
 * - 2-column grid event feed with premium cards
 */

import { useState, useEffect, useCallback, useMemo, memo, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    RefreshControl,
    ActivityIndicator,
    Pressable,
    Dimensions,
    Alert
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetInfo } from "@react-native-community/netinfo";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import { Ionicons } from "@expo/vector-icons";
import { colors, gradients, radii } from "@/lib/design/theme";
import { useEventsStore, Event } from "@/store/eventsStore";
import { getCachedEvents, cacheEvents } from "@/lib/cache";
import { normalizeCategory, isToday, isThisWeek, formatEventDate, formatPrice } from "@/lib/utils/formatters";

// Components
import { HeaderZone } from "@/components/explore/HeaderZone";
import { SearchBar } from "@/components/explore/SearchBar";
import { HeroCarousel } from "@/components/explore/HeroCarousel";
import { CategoryChips } from "@/components/explore/CategoryChips";
import { MapDiscoveryCard } from "@/components/explore/MapDiscoveryCard";
import { HorizontalSection } from "@/components/explore/HorizontalSection";
import { EventCard } from "@/components/ui/EventCard";
import { HeroCardSkeleton, GridCardSkeleton, Shimmer } from "@/components/ui/Skeleton";

import { useUIStore } from "@/store/uiStore";
import { useCityStore } from "@/store/cityStore";
import { useDiscoveryStore } from "@/store/discoveryStore";
import { useScrollToHide } from "@/hooks/useScrollToHide";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Quick filter buttons
interface QuickFilter {
    id: string;
    label: string;
    iconName: keyof typeof Ionicons.glyphMap;
}

const QUICK_FILTERS: QuickFilter[] = [
    { id: "tonight", label: "Tonight", iconName: "moon" },
    { id: "weekend", label: "Weekend", iconName: "wine" },
    { id: "week", label: "This Week", iconName: "calendar" },
];

// Helper functions
function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
}

function getCategoryTitle(category: string): string {
    const titles: Record<string, string> = {
        club: "Clubbing",
        concert: "Concerts",
        party: "Parties",
        ladies_night: "Ladies Night",
        day_party: "Day Parties",
        afterhours: "After Hours",
        festival: "Festivals",
        brunch: "Brunch",
        couple: "Couples Events",
    };
    return titles[category] || "Events";
}

const getSectionTitle = (quickFilter: string | null, selectedCategory: string) => {
    if (quickFilter === "tonight") return "Tonight's Events";
    if (quickFilter === "weekend") return "Weekend Events";
    if (quickFilter === "week") return "This Week";
    if (selectedCategory !== "all") return getCategoryTitle(selectedCategory);
    return "All Events";
};

// Section Header Component
const SectionHeader = memo(({ title, count }: { title: string; count: number }) => {
    return (
        <Animated.View entering={FadeIn.delay(200)} style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
                <Ionicons name="sparkles" size={18} color={colors.gold} />
                <Text style={styles.sectionTitle}>{title}</Text>
                {count > 0 && (
                    <View style={styles.countBadge}>
                        <Text style={styles.countText}>{count}</Text>
                    </View>
                )}
            </View>
            <Pressable
                style={styles.seeAllButton}
                onPress={() => router.push("/search")}
            >
                <Text style={styles.seeAllText}>See All</Text>
            </Pressable>
        </Animated.View>
    );
});

// ============================================
// MEMOIZED EXPLORE HEADER
// ============================================
interface ExploreSection {
    id: string;
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    data: Event[];
}

interface ExploreHeaderProps {
    isOffline: boolean;
    onCityPress: () => void;
    onSearchPress: () => void;
    onFilterPress: () => void;
    quickFilter: string | null;
    onQuickFilterPress: (id: string) => void;
    loading: boolean;
    eventsCount: number;
    heroEvents: Event[];
    selectedCategory: string;
    onSelectCategory: (cat: string) => void;
    error: string | null;
    onRefresh: () => void;
    onClearFilters: () => void;
}

const ExploreHeader = memo(({
    isOffline,
    onCityPress,
    onSearchPress,
    onFilterPress,
    quickFilter,
    onQuickFilterPress,
    loading,
    eventsCount,
    heroEvents,
    selectedCategory,
    onSelectCategory,
    error,
    onRefresh,
    onClearFilters,
    cityLabel
}: ExploreHeaderProps & { cityLabel: string }) => {
    return (
        <>
            {/* Header */}
            <HeaderZone
                city={cityLabel}
                isOffline={isOffline}
                onCityPress={onCityPress}
                greeting={getGreeting()}
            />

            {/* Search Bar */}
            <SearchBar
                onFocus={onSearchPress}
                onFilterPress={onFilterPress}
            />

            {/* Quick Filters */}
            <View style={styles.quickFilters}>
                {QUICK_FILTERS.map((filter) => (
                    <Pressable
                        key={filter.id}
                        onPress={() => onQuickFilterPress(filter.id)}
                        style={[
                            styles.quickFilterChip,
                            quickFilter === filter.id && styles.quickFilterActive
                        ]}
                    >
                        {quickFilter === filter.id ? (
                            <LinearGradient
                                colors={gradients.primary as [string, string]}
                                style={styles.quickFilterGradient}
                            >
                                <Ionicons name={filter.iconName} size={14} color="#fff" />
                                <Text style={styles.quickFilterTextActive}>{filter.label}</Text>
                            </LinearGradient>
                        ) : (
                            <>
                                <Ionicons name={filter.iconName} size={14} color={colors.goldMetallic} />
                                <Text style={styles.quickFilterText}>{filter.label}</Text>
                            </>
                        )}
                    </Pressable>
                ))}
            </View>

            {/* Hero Carousel */}
            {loading && eventsCount === 0 ? (
                <View style={styles.heroLoading}>
                    <HeroCardSkeleton />
                </View>
            ) : heroEvents.length > 0 ? (
                <View style={styles.heroSection}>
                    <HeroCarousel events={heroEvents} />
                </View>
            ) : null}

            {/* Category Chips */}
            <CategoryChips
                selected={selectedCategory}
                onSelect={onSelectCategory}
            />


            {/* Error View */}
            {error && !loading && (
                <Animated.View entering={FadeIn} style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                    <Pressable onPress={onRefresh} style={styles.retryButton}>
                        <Text style={styles.retryText}>Tap to retry</Text>
                    </Pressable>
                </Animated.View>
            )}

            {/* Empty state should be handled by the main list */}
        </>
    );
});

// ============================================
// MAIN COMPONENT
// ============================================

export default function ExplorePage() {
    const insets = useSafeAreaInsets();
    const netInfo = useNetInfo();
    const isOffline = netInfo.isConnected === false;
    const onScroll = useScrollToHide();
    const { setTabBarVisible } = useUIStore();

    // Store
    const {
        selectedCity,
        setCity,
        initCity,
        isLocating
    } = useCityStore();

    const {
        events,
        featuredEvents,
        loading,
        loadingMore,
        hasMore,
        error,
        fetchEvents,
        fetchMoreEvents,
        fetchFeaturedEvents,
        logEventImpression,
        subscribeToEventStock,
        unsubscribeFromAllStock
    } = useEventsStore();

    const {
        config: layoutConfig,
        fetchConfig: fetchLayoutConfig
    } = useDiscoveryStore();

    // Reset tab bar on focus and handle stock subscriptions clean-up
    useEffect(() => {
        setTabBarVisible(true);
        initCity();
        fetchLayoutConfig();

        return () => {
            unsubscribeFromAllStock();
        };
    }, []);

    // State
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [quickFilter, setQuickFilter] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [usingCachedData, setUsingCachedData] = useState(false);

    // Initial data load when city changes
    useEffect(() => {
        loadData(true);
    }, [selectedCity.key]);

    const loadData = async (isRefresh = false) => {
        try {
            // Try to load from cache first for fast initial render if refreshing whole app
            if (isRefresh && events.length === 0) {
                const cached = await getCachedEvents();
                if (cached.data && cached.data.length > 0) {
                    setUsingCachedData(true);
                }
            }

            // Fetch fresh data if online
            if (!isOffline) {
                await Promise.all([
                    fetchEvents({ city: selectedCity.key, isRefresh }),
                    fetchFeaturedEvents({ city: selectedCity.key }),
                ]);

                // Cache the new data
                if (events.length > 0) {
                    await cacheEvents(events);
                }
                setUsingCachedData(false);
            }
        } catch (err) {
            console.error("Error loading events:", err);
        }
    };

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadData(true);
        setRefreshing(false);
    }, [isOffline, selectedCity.key]);

    const handleLoadMore = useCallback(() => {
        if (!loadingMore && hasMore && !isOffline) {
            fetchMoreEvents({ city: selectedCity.key });
        }
    }, [loadingMore, hasMore, isOffline, selectedCity.key]);

    // Viewability tracking for impressions and real-time stock
    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems.length > 0) {
            const visibleIds = viewableItems.map((v: any) => v.item.id);

            // 1. Subscribe to stock updates for what's on screen
            subscribeToEventStock(visibleIds);

            // 2. Log impressions for analytics (throttle briefly in production)
            viewableItems.forEach((v: any) => {
                if (v.isViewable) {
                    logEventImpression(v.item.id);
                }
            });
        }
    }).current;

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 50
    }).current;

    // Filter events by category and quick filter
    const filteredEvents = useMemo(() => {
        let result = events;

        // Apply category filter
        if (selectedCategory !== "all") {
            result = result.filter((event) => {
                const eventCategory = normalizeCategory(event.category) || normalizeCategory(event.type);
                return eventCategory === selectedCategory;
            });
        }

        // Apply quick filter
        if (quickFilter === "tonight") {
            result = result.filter((event) => isToday(event.startDate));
        } else if (quickFilter === "weekend") {
            const today = new Date();
            const dayOfWeek = today.getDay();
            // Get next Friday-Sunday range
            result = result.filter((event) => {
                const eventDate = new Date(event.startDate);
                const eventDay = eventDate.getDay();
                return eventDay === 5 || eventDay === 6 || eventDay === 0; // Fri, Sat, Sun
            });
        } else if (quickFilter === "week") {
            result = result.filter((event) => isThisWeek(event.startDate));
        }

        return result;
    }, [events, selectedCategory, quickFilter]);

    const heroEvents = useMemo(() => {
        if (featuredEvents.length > 0) return featuredEvents.slice(0, 5);
        return events.slice(0, 5);
    }, [featuredEvents, events]);

    // Group events into horizontal sections based on CMS config
    const sectionsData = useMemo<ExploreSection[]>(() => {
        if (loading && events.length === 0) return [];

        return layoutConfig.map(section => {
            let sectionEvents: Event[] = [];

            switch (section.filterType) {
                case "trending":
                case "heat_score":
                    sectionEvents = filteredEvents
                        .filter(e => e.heatScore > (section.filterValue || 30))
                        .slice(0, section.limit);
                    break;
                case "social_proof":
                    sectionEvents = filteredEvents
                        .filter(e => e.stats.rsvps > (section.filterValue || 5))
                        .slice(0, section.limit);
                    break;
                case "category":
                    const categories = Array.isArray(section.filterValue)
                        ? section.filterValue
                        : [section.filterValue];
                    sectionEvents = filteredEvents.filter(e => {
                        const cat = normalizeCategory(e.category) || "";
                        return categories.some((c: string) => cat.includes(c.toLowerCase()));
                    }).slice(0, section.limit);
                    break;
                case "tonight":
                    sectionEvents = filteredEvents.filter(e => isToday(e.startDate)).slice(0, section.limit);
                    break;
                case "all":
                default:
                    sectionEvents = filteredEvents.slice(0, section.limit);
                    break;
            }

            return {
                id: section.id,
                title: section.title,
                icon: section.icon as any,
                data: sectionEvents
            };
        }).filter(s => s.data.length > 0);
    }, [filteredEvents, loading, layoutConfig]);

    // Handle search press - navigate to search screen
    const handleSearchPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push("/search");
    };

    // Handle filter press
    const handleFilterPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // Navigate to search which contains filters
        router.push("/search");
    };

    // Handle city press
    const handleCityPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Alert.alert(
            "Change City",
            "Automatic location discovery is active. We are currently showing events near you.",
            [{ text: "OK" }]
        );
    };

    // Handle quick filter toggle
    const handleQuickFilterPress = (filterId: string) => {
        Haptics.selectionAsync();
        if (quickFilter === filterId) {
            setQuickFilter(null); // Toggle off
        } else {
            setQuickFilter(filterId);
        }
    };

    const renderFooter = useCallback(() => (
        <>
            {/* Map Discovery Card at the very end */}
            {!loading && events.length > 0 && (
                <View style={{ marginTop: 24 }}>
                    <MapDiscoveryCard
                        eventsCount={events.length + 12}
                        nearbyEvents={heroEvents.map(e => ({ id: e.id, imageUrl: e.posterUrl || "" }))}
                    />
                </View>
            )}

            {/* Offline Banner */}
            {isOffline && usingCachedData && (
                <Animated.View entering={FadeIn} style={styles.offlineBanner}>
                    <Ionicons name="cloud-offline-outline" size={14} color={colors.warning} style={{ marginRight: 6 }} />
                    <Text style={styles.offlineText}>Showing cached events</Text>
                </Animated.View>
            )}

            {/* Footer Spacer */}
            <View style={{ height: 120 }} />
        </>
    ), [isOffline, usingCachedData]);

    const renderSection = useCallback(({ item }: { item: any }) => (
        <HorizontalSection
            title={item.title}
            events={item.data}
            icon={item.icon}
            onSeeAll={() => router.push("/search")}
        />
    ), []);

    return (
        <View style={styles.container}>
            {/* Glossy Status Bar Blur */}
            <BlurView
                intensity={80}
                tint="dark"
                style={[styles.statusBarBlur, { height: insets.top }]}
            />

            <FlashList<ExploreSection>
                data={sectionsData}
                renderItem={renderSection}
                keyExtractor={(item) => item.id}
                numColumns={1}
                estimatedItemSize={300}
                contentContainerStyle={[styles.flashListContent, { paddingTop: insets.top }]}
                ListHeaderComponent={
                    <ExploreHeader
                        isOffline={isOffline}
                        onCityPress={handleCityPress}
                        onSearchPress={handleSearchPress}
                        onFilterPress={handleFilterPress}
                        quickFilter={quickFilter}
                        onQuickFilterPress={handleQuickFilterPress}
                        loading={loading}
                        eventsCount={events.length}
                        heroEvents={heroEvents}
                        selectedCategory={selectedCategory}
                        onSelectCategory={(cat: string) => {
                            setSelectedCategory(cat);
                            if (cat !== "all") setQuickFilter(null);
                        }}
                        error={error}
                        onRefresh={handleRefresh}
                        onClearFilters={() => {
                            setQuickFilter(null);
                            setSelectedCategory("all");
                        }}
                        cityLabel={selectedCity.label.split(",")[0]}
                    />
                }
                ListFooterComponent={
                    <>
                        {loadingMore && (
                            <View style={{ paddingVertical: 20 }}>
                                <ActivityIndicator color={colors.gold} />
                            </View>
                        )}
                        {renderFooter()}
                    </>
                }
                ListEmptyComponent={
                    (!loading && !error) ? (
                        <Animated.View entering={FadeInUp} style={styles.emptyContainer}>
                            <View style={styles.emptyIconContainer}>
                                <Ionicons
                                    name={quickFilter === "tonight" ? "moon-outline" :
                                        quickFilter === "weekend" ? "wine-outline" :
                                            quickFilter === "week" ? "calendar-outline" : "search-outline"}
                                    size={48}
                                    color={colors.gold}
                                />
                            </View>
                            <Text style={styles.emptyTitle}>No events found</Text>
                            <Text style={styles.emptyText}>
                                {quickFilter
                                    ? "Try clearing filters to see more events"
                                    : "Check back later for new events"}
                            </Text>
                        </Animated.View>
                    ) : null
                }
                onRefresh={handleRefresh}
                refreshing={refreshing}
                onScroll={onScroll}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                extraData={{ selectedCategory, quickFilter, loading, isOffline, heroEvents, loadingMore, sectionsData, layoutConfig }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
    },
    scrollContent: {
        flexGrow: 1,
    },
    flashListContent: {
        paddingBottom: 20,
    },
    gridItemWrapper: {
        flex: 1,
        paddingHorizontal: 10,
        marginBottom: 12,
    },
    heroSection: {
        marginBottom: 8,
    },
    heroLoading: {
        paddingHorizontal: 24,
        marginBottom: 16,
    },

    // Quick Filters
    quickFilters: {
        flexDirection: "row",
        paddingHorizontal: 20,
        paddingVertical: 8,
        gap: 10,
    },
    quickFilterChip: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#121212",
        borderRadius: radii.pill,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        gap: 6,
        overflow: "hidden",
    },
    quickFilterActive: {
        borderColor: colors.iris,
        borderWidth: 0,
    },
    quickFilterGradient: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 14,
        marginVertical: -10,
        marginHorizontal: -14,
    },
    quickFilterText: {
        color: colors.goldMetallic,
        fontSize: 13,
        fontWeight: "600",
    },
    quickFilterTextActive: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "700",
    },

    // Section Header
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    sectionTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    sectionTitle: {
        color: "#fff",
        fontSize: 22,
        fontWeight: "800",
        letterSpacing: -0.5,
    },
    countBadge: {
        backgroundColor: "#1A1A1A",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
    },
    countText: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 12,
        fontWeight: "700",
    },
    seeAllButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    seeAllText: {
        color: colors.iris,
        fontSize: 14,
        fontWeight: "600",
    },

    // Events Grid
    eventsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        paddingHorizontal: 20,
        gap: 12,
        justifyContent: "space-between",
    },

    // Loading
    loadingGrid: {
        paddingHorizontal: 20,
        gap: 12,
    },
    skeletonRow: {
        flexDirection: "row",
        gap: 12,
    },

    // Error
    errorContainer: {
        marginHorizontal: 20,
        backgroundColor: colors.errorMuted,
        borderWidth: 1,
        borderColor: "rgba(255, 61, 113, 0.3)",
        borderRadius: radii.xl,
        padding: 20,
        alignItems: "center",
    },
    errorText: {
        color: colors.error,
        textAlign: "center",
        marginBottom: 12,
    },
    retryButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    retryText: {
        color: colors.iris,
        fontWeight: "600",
    },

    // Empty State
    emptyContainer: {
        alignItems: "center",
        paddingVertical: 60,
        paddingHorizontal: 40,
    },
    emptyIconContainer: {
        marginBottom: 16,
    },
    emptyTitle: {
        color: colors.gold,
        fontSize: 20,
        fontWeight: "700",
        marginBottom: 8,
    },
    emptyText: {
        color: colors.goldMetallic,
        fontSize: 14,
        textAlign: "center",
        marginBottom: 16,
    },
    clearFiltersButton: {
        backgroundColor: "rgba(244, 74, 34, 0.15)",
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: radii.pill,
    },
    clearFiltersText: {
        color: colors.iris,
        fontSize: 14,
        fontWeight: "600",
    },

    // Offline Banner
    offlineBanner: {
        marginHorizontal: 20,
        backgroundColor: colors.warningMuted,
        borderRadius: radii.lg,
        padding: 12,
        flexDirection: "row",
        alignItems: "center",
        marginTop: 16,
    },
    offlineIndicator: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: 4,
        marginHorizontal: 20,
        backgroundColor: colors.warningMuted,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radii.pill,
        alignSelf: "flex-start",
    },
    offlineText: {
        color: colors.warning,
        fontSize: 11,
        fontWeight: "500",
    },
    statusBarBlur: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
    },
});
