import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    TextInput,
    ActivityIndicator,
    RefreshControl,
    StyleSheet,
    Dimensions,
    Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { Image } from "expo-image";
import { useEventsStore, Event } from "@/store/eventsStore";
import { cacheEvents, getCachedEvents, updateLastSyncTime, getLastSyncTime } from "@/lib/cache";
import * as Haptics from "expo-haptics";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    interpolate,
    FadeIn,
    FadeInDown,
    FadeInRight,
    SlideInRight,
} from "react-native-reanimated";
import { colors, radii, gradients } from "@/lib/design/theme";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { EmptyState, ErrorState, NetworkError } from "@/components/ui/EmptyState";
import { useNotificationsStore } from "@/store/notificationsStore";
import { trackScreen } from "@/lib/analytics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_CARD_WIDTH = SCREEN_WIDTH - 48;

// Animated Pressable
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Premium Search Bar
function SearchBar({
    value,
    onChangeText,
    onFocus,
    onClear,
}: {
    value: string;
    onChangeText: (text: string) => void;
    onFocus?: () => void;
    onClear?: () => void;
}) {
    const isFocused = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => ({
        borderColor: `rgba(244, 74, 34, ${interpolate(isFocused.value, [0, 1], [0, 0.5])})`,
        transform: [{ scale: interpolate(isFocused.value, [0, 1], [1, 1.01]) }],
    }));

    return (
        <Animated.View style={[styles.searchContainer, animatedStyle]}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
                placeholder="Search events, venues, artists..."
                placeholderTextColor={colors.goldMetallic}
                value={value}
                onChangeText={onChangeText}
                onFocus={() => {
                    isFocused.value = withTiming(1, { duration: 200 });
                    onFocus?.();
                }}
                onBlur={() => {
                    isFocused.value = withTiming(0, { duration: 200 });
                }}
                style={styles.searchInput}
                returnKeyType="search"
            />
            {value.length > 0 && (
                <Pressable onPress={onClear} style={styles.searchClear}>
                    <Text style={styles.searchClearText}>✕</Text>
                </Pressable>
            )}
        </Animated.View>
    );
}

// Premium Category Chip
function CategoryChip({
    label,
    icon,
    isActive,
    onPress,
    index,
}: {
    label: string;
    icon?: string;
    isActive: boolean;
    onPress: () => void;
    index: number;
}) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePress = () => {
        scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
        setTimeout(() => {
            scale.value = withSpring(1, { damping: 15, stiffness: 400 });
        }, 100);
        Haptics.selectionAsync();
        onPress();
    };

    return (
        <Animated.View
            entering={FadeInRight.delay(index * 50).springify()}
            style={animatedStyle}
        >
            <Pressable onPress={handlePress}>
                {isActive ? (
                    <LinearGradient
                        colors={gradients.primary as [string, string]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.categoryChipActive}
                    >
                        {icon && <Text style={styles.categoryIcon}>{icon}</Text>}
                        <Text style={styles.categoryTextActive}>{label}</Text>
                    </LinearGradient>
                ) : (
                    <View style={styles.categoryChip}>
                        {icon && <Text style={styles.categoryIcon}>{icon}</Text>}
                        <Text style={styles.categoryText}>{label}</Text>
                    </View>
                )}
            </Pressable>
        </Animated.View>
    );
}

// Hero Event Card (Full-width featured)
function HeroEventCard({ event, index }: { event: Event; index: number }) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    };

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push({ pathname: "/event/[id]", params: { id: event.id } });
    };

    const formattedDate = new Date(event.startDate).toLocaleDateString("en-IN", {
        weekday: "short",
        month: "short",
        day: "numeric",
    });

    const lowestPrice = event.tickets?.reduce((min, tier) =>
        tier.price < min ? tier.price : min,
        event.tickets[0]?.price || 0
    ) || 0;

    return (
        <AnimatedPressable
            entering={FadeInRight.delay(index * 100).springify().damping(15)}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            style={[animatedStyle, styles.heroCard]}
        >
            {/* Image */}
            {event.coverImage ? (
                <Image
                    source={{ uri: event.coverImage }}
                    style={styles.heroImage}
                    contentFit="cover"
                    transition={300}
                />
            ) : (
                <LinearGradient
                    colors={["#F44A22", "#8B2010"]}
                    style={styles.heroImage}
                />
            )}

            {/* Gradient overlay */}
            <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.9)"]}
                locations={[0, 0.5, 1]}
                style={styles.heroGradient}
            />

            {/* Category badge */}
            {event.category && (
                <View style={styles.heroBadge}>
                    <LinearGradient
                        colors={gradients.primary as [string, string]}
                        style={styles.heroBadgeGradient}
                    >
                        <Text style={styles.heroBadgeText}>
                            {event.category.toUpperCase()}
                        </Text>
                    </LinearGradient>
                </View>
            )}

            {/* Content */}
            <View style={styles.heroContent}>
                <View style={styles.heroDatePill}>
                    <Text style={styles.heroDateText}>{formattedDate}</Text>
                </View>

                <Text style={styles.heroTitle} numberOfLines={2}>
                    {event.title}
                </Text>

                <Text style={styles.heroVenue} numberOfLines={1}>
                    📍 {event.venue || event.location || "TBA"}
                </Text>

                <View style={styles.heroFooter}>
                    {event.stats?.rsvps && event.stats.rsvps > 0 && (
                        <View style={styles.heroAttendees}>
                            <View style={styles.heroAvatars}>
                                {[0, 1, 2].map((i) => (
                                    <View key={i} style={[styles.heroAvatar, { marginLeft: i > 0 ? -8 : 0 }]}>
                                        <LinearGradient
                                            colors={["rgba(244, 74, 34, 0.3)", "rgba(244, 74, 34, 0.1)"]}
                                            style={styles.heroAvatarGradient}
                                        >
                                            <Text style={styles.heroAvatarEmoji}>👤</Text>
                                        </LinearGradient>
                                    </View>
                                ))}
                            </View>
                            <Text style={styles.heroAttendeesText}>+{event.stats.rsvps} going</Text>
                        </View>
                    )}

                    <View style={styles.heroPriceContainer}>
                        <Text style={styles.heroPriceLabel}>from</Text>
                        <Text style={styles.heroPrice}>
                            {lowestPrice === 0 ? "Free" : `₹${lowestPrice}`}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Border overlay */}
            <View style={styles.heroBorder} />
        </AnimatedPressable>
    );
}

// Compact Event Card (List item style)
function EventListCard({ event, index }: { event: Event; index: number }) {
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

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: "/event/[id]", params: { id: event.id } });
    };

    const formattedDate = new Date(event.startDate).toLocaleDateString("en-IN", {
        weekday: "short",
        month: "short",
        day: "numeric",
    });

    const lowestPrice = event.tickets?.reduce((min, tier) =>
        tier.price < min ? tier.price : min,
        event.tickets[0]?.price || 0
    ) || 0;

    return (
        <AnimatedPressable
            entering={FadeInDown.delay(index * 40).springify().damping(15)}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            style={[animatedStyle, styles.listCard]}
        >
            {/* Thumbnail */}
            {event.coverImage ? (
                <Image
                    source={{ uri: event.coverImage }}
                    style={styles.listImage}
                    contentFit="cover"
                    transition={200}
                />
            ) : (
                <LinearGradient
                    colors={["#292929", "#1F1F1F"]}
                    style={styles.listImage}
                >
                    <Text style={styles.listImagePlaceholder}>🎉</Text>
                </LinearGradient>
            )}

            {/* Content */}
            <View style={styles.listContent}>
                <Text style={styles.listTitle} numberOfLines={1}>
                    {event.title}
                </Text>

                <View style={styles.listMeta}>
                    <Text style={styles.listDate}>{formattedDate}</Text>
                    <View style={styles.listDot} />
                    <Text style={styles.listVenue} numberOfLines={1}>
                        {event.venue || event.city || "TBA"}
                    </Text>
                </View>

                <View style={styles.listFooter}>
                    <Text style={styles.listPrice}>
                        {lowestPrice === 0 ? "Free" : `₹${lowestPrice}`}
                    </Text>
                    {event.stats?.rsvps && event.stats.rsvps > 0 && (
                        <Text style={styles.listAttendees}>
                            {event.stats.rsvps}+ going
                        </Text>
                    )}
                </View>
            </View>

            {/* Arrow */}
            <Text style={styles.listArrow}>›</Text>
        </AnimatedPressable>
    );
}

// Section Header
function SectionHeader({ title, emoji, action }: { title: string; emoji?: string; action?: { label: string; onPress: () => void } }) {
    return (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
                {emoji && <Text>{emoji} </Text>}{title}
            </Text>
            {action && (
                <Pressable onPress={action.onPress}>
                    <Text style={styles.sectionAction}>{action.label} →</Text>
                </Pressable>
            )}
        </View>
    );
}

// Categories with icons
const CATEGORIES = [
    { id: "all", label: "All", icon: "✨" },
    { id: "club", label: "Clubs", icon: "🪩" },
    { id: "concert", label: "Concerts", icon: "🎸" },
    { id: "festival", label: "Festivals", icon: "🎪" },
    { id: "party", label: "Parties", icon: "🎉" },
    { id: "brunch", label: "Brunch", icon: "🥂" },
    { id: "comedy", label: "Comedy", icon: "😂" },
];

export default function ExploreScreen() {
    const { events, featuredEvents, loading, error, fetchEvents, fetchFeaturedEvents } = useEventsStore();
    const insets = useSafeAreaInsets();

    const [searchQuery, setSearchQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState("all");
    const [isOffline, setIsOffline] = useState(false);
    const [cachedEvents, setCachedEvents] = useState<Event[]>([]);
    const [lastSync, setLastSync] = useState<Date | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const cached = await getCachedEvents();
        if (cached.data && cached.data.length > 0) {
            setCachedEvents(cached.data);
            const syncTime = await getLastSyncTime();
            setLastSync(syncTime);
        }

        try {
            await Promise.all([fetchEvents(), fetchFeaturedEvents()]);
            const store = useEventsStore.getState();
            if (store.events.length > 0) {
                await cacheEvents(store.events);
                await updateLastSyncTime();
                setIsOffline(false);
            }
        } catch (err) {
            setIsOffline(true);
        }
    };

    const onRefresh = useCallback(async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await loadData();
    }, []);

    // Filter events
    const filteredEvents = useMemo(() => {
        const sourceEvents = events.length > 0 ? events : cachedEvents;
        let result = sourceEvents;

        if (activeCategory !== "all") {
            result = result.filter((event) =>
                event.category?.toLowerCase() === activeCategory ||
                event.type?.toLowerCase() === activeCategory
            );
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter((event) =>
                event.title.toLowerCase().includes(query) ||
                event.venue?.toLowerCase().includes(query) ||
                event.location?.toLowerCase().includes(query) ||
                event.city?.toLowerCase().includes(query)
            );
        }

        return result;
    }, [events, cachedEvents, activeCategory, searchQuery]);

    // Group events
    const displayEvents = useMemo(() => {
        const now = new Date();
        const thisWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        return {
            featured: featuredEvents.slice(0, 5),
            thisWeek: filteredEvents.filter((e) => {
                const date = new Date(e.startDate);
                return date >= now && date <= thisWeek;
            }).slice(0, 5),
            upcoming: filteredEvents.slice(0, 10),
        };
    }, [filteredEvents, featuredEvents]);

    const showNoResults = !loading && filteredEvents.length === 0 && searchQuery;
    const showEmpty = !loading && events.length === 0 && cachedEvents.length === 0 && !searchQuery;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120 }}
                refreshControl={
                    <RefreshControl
                        refreshing={loading}
                        onRefresh={onRefresh}
                        tintColor={colors.iris}
                    />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerTop}>
                        <View>
                            <Text style={styles.headerTitle}>Explore</Text>
                            <Text style={styles.headerSubtitle}>
                                Discover events near you
                            </Text>
                        </View>

                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            {isOffline && (
                                <View style={styles.offlineBadge}>
                                    <Text style={styles.offlineText}>Offline</Text>
                                </View>
                            )}
                            <NotificationBell variant="solid" />
                        </View>
                    </View>

                    {/* Search */}
                    <SearchBar
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onClear={() => setSearchQuery("")}
                    />

                    {/* Categories */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.categoriesContainer}
                    >
                        {CATEGORIES.map((cat, index) => (
                            <CategoryChip
                                key={cat.id}
                                label={cat.label}
                                icon={cat.icon}
                                isActive={activeCategory === cat.id}
                                onPress={() => setActiveCategory(cat.id)}
                                index={index}
                            />
                        ))}
                    </ScrollView>
                </View>

                {/* Loading */}
                {loading && events.length === 0 && cachedEvents.length === 0 && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.iris} />
                        <Text style={styles.loadingText}>Loading events...</Text>
                    </View>
                )}

                {/* Error - No cached data */}
                {error && !loading && events.length === 0 && cachedEvents.length === 0 && (
                    <ErrorState
                        message="Failed to load events. Please try again."
                        onRetry={onRefresh}
                    />
                )}

                {/* Offline with no cache */}
                {isOffline && events.length === 0 && cachedEvents.length === 0 && !loading && (
                    <NetworkError onRetry={onRefresh} />
                )}

                {/* No Results */}
                {showNoResults && (
                    <EmptyState
                        type="no-search-results"
                        message={`No events match "${searchQuery}"`}
                        actionLabel="Clear Search"
                        onAction={() => setSearchQuery("")}
                    />
                )}


                {/* Empty State */}
                {showEmpty && !error && (
                    <EmptyState
                        type="no-events"
                        actionLabel="Refresh"
                        onAction={onRefresh}
                    />
                )}

                {/* Featured Carousel */}
                {!searchQuery && displayEvents.featured.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader title="Featured" emoji="🔥" />
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            pagingEnabled
                            snapToInterval={HERO_CARD_WIDTH + 16}
                            decelerationRate="fast"
                            contentContainerStyle={styles.heroCarousel}
                        >
                            {displayEvents.featured.map((event, index) => (
                                <HeroEventCard key={event.id} event={event} index={index} />
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* This Week */}
                {!searchQuery && displayEvents.thisWeek.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader title="This Week" emoji="📅" />
                        {displayEvents.thisWeek.map((event, index) => (
                            <EventListCard key={event.id} event={event} index={index} />
                        ))}
                    </View>
                )}

                {/* All Events */}
                <View style={styles.section}>
                    <SectionHeader
                        title={searchQuery ? `Results (${filteredEvents.length})` : "All Events"}
                        emoji={searchQuery ? undefined : "🎭"}
                    />
                    {(searchQuery ? filteredEvents : displayEvents.upcoming).map((event, index) => (
                        <EventListCard key={event.id} event={event} index={index} />
                    ))}
                </View>

                {/* Offline indicator */}
                {isOffline && lastSync && (
                    <Text style={styles.syncText}>
                        Last updated: {lastSync.toLocaleDateString("en-IN", {
                            hour: "numeric",
                            minute: "2-digit",
                        })}
                    </Text>
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
    scrollView: {
        flex: 1,
    },

    // Header
    header: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 8,
    },
    headerTop: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: 20,
    },
    headerTitle: {
        color: colors.gold,
        fontSize: 34,
        fontWeight: "800",
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        color: colors.goldMetallic,
        fontSize: 15,
        marginTop: 4,
    },
    offlineBadge: {
        backgroundColor: "rgba(255, 170, 0, 0.15)",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: "rgba(255, 170, 0, 0.3)",
    },
    offlineText: {
        color: colors.warning,
        fontSize: 12,
        fontWeight: "600",
    },

    // Search
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        borderWidth: 1.5,
        borderColor: colors.base[200],
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    searchIcon: {
        fontSize: 16,
        marginRight: 12,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 14,
        color: colors.gold,
        fontSize: 16,
    },
    searchClear: {
        padding: 4,
    },
    searchClearText: {
        color: colors.goldMetallic,
        fontSize: 14,
    },

    // Categories
    categoriesContainer: {
        paddingRight: 20,
        gap: 8,
    },
    categoryChip: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.base[50],
        borderRadius: radii.pill,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: colors.base[200],
        marginRight: 8,
    },
    categoryChipActive: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: radii.pill,
        paddingVertical: 10,
        paddingHorizontal: 16,
        marginRight: 8,
    },
    categoryIcon: {
        marginRight: 6,
        fontSize: 14,
    },
    categoryText: {
        color: colors.goldMetallic,
        fontSize: 14,
        fontWeight: "500",
    },
    categoryTextActive: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "600",
    },

    // Section
    section: {
        marginTop: 24,
    },
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    sectionTitle: {
        color: colors.gold,
        fontSize: 20,
        fontWeight: "700",
    },
    sectionAction: {
        color: colors.iris,
        fontSize: 14,
        fontWeight: "600",
    },

    // Hero Card
    heroCarousel: {
        paddingHorizontal: 20,
    },
    heroCard: {
        width: HERO_CARD_WIDTH,
        height: 380,
        borderRadius: radii["2xl"],
        overflow: "hidden",
        marginRight: 16,
    },
    heroImage: {
        ...StyleSheet.absoluteFillObject,
    },
    heroGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    heroBorder: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: radii["2xl"],
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
    },
    heroBadge: {
        position: "absolute",
        top: 16,
        left: 16,
    },
    heroBadgeGradient: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: radii.pill,
    },
    heroBadgeText: {
        color: "#fff",
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 1,
    },
    heroContent: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
    },
    heroDatePill: {
        backgroundColor: "rgba(255, 255, 255, 0.12)",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: radii.pill,
        alignSelf: "flex-start",
        marginBottom: 12,
    },
    heroDateText: {
        color: colors.gold,
        fontSize: 13,
        fontWeight: "600",
    },
    heroTitle: {
        color: colors.gold,
        fontSize: 26,
        fontWeight: "800",
        lineHeight: 32,
        marginBottom: 8,
    },
    heroVenue: {
        color: colors.goldMetallic,
        fontSize: 14,
        marginBottom: 16,
    },
    heroFooter: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    heroAttendees: {
        flexDirection: "row",
        alignItems: "center",
    },
    heroAvatars: {
        flexDirection: "row",
        marginRight: 8,
    },
    heroAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: "rgba(0, 0, 0, 0.8)",
        overflow: "hidden",
    },
    heroAvatarGradient: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    heroAvatarEmoji: {
        fontSize: 12,
    },
    heroAttendeesText: {
        color: colors.goldMetallic,
        fontSize: 13,
    },
    heroPriceContainer: {
        alignItems: "flex-end",
    },
    heroPriceLabel: {
        color: colors.goldMetallic,
        fontSize: 11,
    },
    heroPrice: {
        color: colors.iris,
        fontSize: 22,
        fontWeight: "800",
    },

    // List Card
    listCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.base[50],
        borderRadius: radii.xl,
        marginHorizontal: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
        overflow: "hidden",
    },
    listImage: {
        width: 88,
        height: 88,
        alignItems: "center",
        justifyContent: "center",
    },
    listImagePlaceholder: {
        fontSize: 32,
    },
    listContent: {
        flex: 1,
        padding: 14,
    },
    listTitle: {
        color: colors.gold,
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 4,
    },
    listMeta: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
    },
    listDate: {
        color: colors.goldMetallic,
        fontSize: 13,
    },
    listDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: colors.goldMetallic,
        marginHorizontal: 8,
    },
    listVenue: {
        color: colors.goldMetallic,
        fontSize: 13,
        flex: 1,
    },
    listFooter: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    listPrice: {
        color: colors.iris,
        fontSize: 15,
        fontWeight: "700",
    },
    listAttendees: {
        color: colors.goldMetallic,
        fontSize: 12,
    },
    listArrow: {
        color: colors.goldMetallic,
        fontSize: 24,
        marginRight: 12,
    },

    // States
    loadingContainer: {
        alignItems: "center",
        paddingVertical: 60,
    },
    loadingText: {
        color: colors.goldMetallic,
        marginTop: 16,
    },
    errorContainer: {
        marginHorizontal: 20,
        backgroundColor: "rgba(255, 61, 113, 0.15)",
        borderWidth: 1,
        borderColor: "rgba(255, 61, 113, 0.3)",
        borderRadius: radii.xl,
        padding: 16,
        marginBottom: 16,
    },
    errorText: {
        color: colors.error,
        textAlign: "center",
    },
    emptyContainer: {
        alignItems: "center",
        paddingVertical: 60,
        paddingHorizontal: 40,
    },
    emptyEmoji: {
        fontSize: 48,
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
        fontSize: 15,
        textAlign: "center",
    },
    syncText: {
        color: colors.goldMetallic,
        fontSize: 12,
        textAlign: "center",
        marginTop: 16,
        opacity: 0.5,
    },
});
