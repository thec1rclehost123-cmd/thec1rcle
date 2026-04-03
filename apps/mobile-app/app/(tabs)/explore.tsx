import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
    View,
    Text,
    ScrollView,
    FlatList,
    Pressable,
    ActivityIndicator,
    RefreshControl,
    StyleSheet,
    Dimensions,
    Modal,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Image } from "expo-image";
import { useEventsStore, type Event } from "@/store/eventsStore";
import { useRecommendationsStore } from "@/store/recommendationsStore";
import { useAuthStore } from "@/store/authStore";
import { useTicketsStore } from "@/store/ticketsStore";
import { cacheEvents, getCachedEvents, updateLastSyncTime } from "@/lib/cache";
import * as Haptics from "expo-haptics";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withRepeat,
    withSequence,
    FadeInDown,
    FadeInRight,
    FadeIn,
} from "react-native-reanimated";
import { colors, radii, shadows } from "@/lib/design/theme";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { trackScreen } from "@/lib/analytics";
import { formatEventDate, formatEventTime, safeDate } from "@/lib/utils/date";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_WIDTH = SCREEN_WIDTH - 32;
const CAROUSEL_CARD_WIDTH = SCREEN_WIDTH * 0.62;
const PURE_BLACK = "#000000";

// ── Category config ────────────────────────────────────────────────────────────

const CATEGORIES = [
    { id: "club",     label: "Club Nights",  emoji: "🎧", accent: "#8B5CF6" },
    { id: "concert",  label: "Concerts",     emoji: "🎤", accent: "#3B82F6" },
    { id: "festival", label: "Festivals",    emoji: "🎡", accent: "#10B981" },
    { id: "party",    label: "Parties",      emoji: "🎉", accent: "#F44A22" },
    { id: "brunch",   label: "Brunches",     emoji: "🥂", accent: "#F59E0B" },
    { id: "comedy",   label: "Comedy Shows", emoji: "😂", accent: "#EC4899" },
] as const;

const DATE_FILTERS = [
    { id: "any",       label: "Any Date" },
    { id: "today",     label: "Today" },
    { id: "this-week", label: "This Week" },
    { id: "weekend",   label: "Weekend" },
] as const;

type DateFilter = typeof DATE_FILTERS[number]["id"];

// ── Helpers ────────────────────────────────────────────────────────────────────

function applyDateFilter(events: Event[], filter: DateFilter): Event[] {
    if (filter === "any") return events;
    const now = new Date();
    return events.filter((e) => {
        const d = safeDate(e.startDate);
        if (!d) return false;
        if (filter === "today") {
            return d.toDateString() === now.toDateString();
        }
        if (filter === "this-week") {
            const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            return d >= now && d <= weekAhead;
        }
        if (filter === "weekend") {
            const day = d.getDay();
            return (day === 5 || day === 6 || day === 0) && d >= now;
        }
        return true;
    });
}

function getLowestPrice(event: Event): number {
    return (
        event.tickets?.reduce(
            (min, t) => (t.price < min ? t.price : min),
            event.tickets[0]?.price ?? 0
        ) ?? 0
    );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pulsing live indicator */
function PulseDot() {
    const scale = useSharedValue(1);
    useEffect(() => {
        scale.value = withRepeat(
            withSequence(withTiming(1.4, { duration: 600 }), withTiming(1, { duration: 600 })),
            -1,
            false
        );
    }, []);
    const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    return (
        <Animated.View style={[styles.pulseDot, style]} />
    );
}

/** Tappable search bar — navigates to /search */
function SearchTrigger() {
    return (
        <Pressable
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/search");
            }}
            style={styles.searchTrigger}
        >
            <Text style={styles.searchIcon}>🔍</Text>
            <Text style={styles.searchPlaceholder}>Search events, venues, artists…</Text>
        </Pressable>
    );
}

/** Date filter pills */
function DateFilterRow({
    active,
    onChange,
}: {
    active: DateFilter;
    onChange: (v: DateFilter) => void;
}) {
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRowContent}
            style={styles.filterRow}
        >
            {DATE_FILTERS.map((f) => (
                <Pressable
                    key={f.id}
                    onPress={() => {
                        Haptics.selectionAsync();
                        onChange(f.id);
                    }}
                    style={[styles.filterPill, active === f.id && styles.filterPillActive]}
                >
                    <Text style={[styles.filterPillText, active === f.id && styles.filterPillTextActive]}>
                        {f.label}
                    </Text>
                </Pressable>
            ))}
        </ScrollView>
    );
}

/** Featured hero — single event card full-width */
function FeaturedHero({ event }: { event: Event }) {
    const scale = useSharedValue(1);

    const lowestPrice = getLowestPrice(event);
    const dateStr = formatEventDate(event.startDate);

    return (
        <AnimatedPressable
            entering={FadeInDown.delay(80).springify().damping(16)}
            onPressIn={() => { scale.value = withSpring(0.97, { damping: 15, stiffness: 400 }); }}
            onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push({ pathname: "/event/[id]", params: { id: event.id } });
            }}
            style={[useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] })), styles.heroCard]}
        >
            {event.coverImage ? (
                <Image
                    source={{ uri: event.coverImage }}
                    style={StyleSheet.absoluteFillObject}
                    contentFit="cover"
                    transition={400}
                />
            ) : (
                <LinearGradient colors={["#2D1A14", "#0A0A0A"]} style={StyleSheet.absoluteFillObject} />
            )}

            {/* gradient overlay */}
            <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.45)", "rgba(0,0,0,0.92)"]}
                locations={[0, 0.45, 1]}
                style={StyleSheet.absoluteFillObject}
            />

            {/* Featured badge */}
            <View style={styles.heroBadge}>
                <LinearGradient colors={["#F44A22", "#FF6B4A"]} style={styles.heroBadgeInner}>
                    <Text style={styles.heroBadgeText}>FEATURED</Text>
                </LinearGradient>
            </View>

            {/* Content */}
            <View style={styles.heroContent}>
                {event.category && (
                    <View style={styles.heroCategoryPill}>
                        <Text style={styles.heroCategoryText}>{event.category.toUpperCase()}</Text>
                    </View>
                )}
                <Text style={styles.heroTitle} numberOfLines={2}>{event.title}</Text>
                <Text style={styles.heroVenue} numberOfLines={1}>
                    📍 {event.venue ?? event.location ?? "TBA"}
                </Text>
                <View style={styles.heroFooter}>
                    <Text style={styles.heroDate}>{dateStr}</Text>
                    <View style={styles.heroPricePill}>
                        <Text style={styles.heroPriceText}>
                            {lowestPrice === 0 ? "Free" : `from ₹${lowestPrice.toLocaleString("en-IN")}`}
                        </Text>
                    </View>
                </View>
            </View>
        </AnimatedPressable>
    );
}

/** Horizontal carousel card */
function CarouselCard({ event, index }: { event: Event; index: number }) {
    const scale = useSharedValue(1);
    const lowestPrice = getLowestPrice(event);
    const dateStr = safeDate(event.startDate) ? formatEventDate(event.startDate) : "";

    return (
        <Animated.View
            entering={FadeInRight.delay(index * 60).springify().damping(16)}
            style={[useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] })), styles.carouselCard]}
        >
            <AnimatedPressable
                onPressIn={() => { scale.value = withSpring(0.97, { damping: 15, stiffness: 400 }); }}
                onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({ pathname: "/event/[id]", params: { id: event.id } });
                }}
                style={{ flex: 1 }}
            >
                <View style={styles.carouselImageWrap}>
                    {event.coverImage ? (
                        <Image
                            source={{ uri: event.coverImage }}
                            style={StyleSheet.absoluteFillObject}
                            contentFit="cover"
                            transition={300}
                        />
                    ) : (
                        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(255,255,255,0.04)" }]} />
                    )}
                    <LinearGradient
                        colors={["transparent", "rgba(0,0,0,0.75)"]}
                        style={StyleSheet.absoluteFillObject}
                    />
                </View>
                <View style={styles.carouselBody}>
                    <Text style={styles.carouselTitle} numberOfLines={2}>{event.title}</Text>
                    <Text style={styles.carouselVenue} numberOfLines={1}>
                        {event.venue ?? event.location ?? ""}
                    </Text>
                    <View style={styles.carouselMeta}>
                        <Text style={styles.carouselDate}>{dateStr}</Text>
                        {lowestPrice > 0 && (
                            <Text style={styles.carouselPrice}>₹{lowestPrice.toLocaleString("en-IN")}</Text>
                        )}
                    </View>
                </View>
            </AnimatedPressable>
        </Animated.View>
    );
}

/** Section header with optional "View All" */
function SectionHeader({
    title,
    emoji,
    onViewAll,
}: {
    title: string;
    emoji: string;
    onViewAll?: () => void;
}) {
    return (
        <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionEmoji}>{emoji}</Text>
                <Text style={styles.sectionTitle}>{title}</Text>
            </View>
            {onViewAll && (
                <Pressable onPress={onViewAll} hitSlop={8}>
                    <Text style={styles.viewAll}>View All →</Text>
                </Pressable>
            )}
        </View>
    );
}

/** Category carousel section */
function CategorySection({
    cat,
    events,
    isLoading,
    dateFilter,
}: {
    cat: typeof CATEGORIES[number];
    events: Event[];
    isLoading: boolean;
    dateFilter: DateFilter;
}) {
    const filtered = useMemo(() => applyDateFilter(events, dateFilter), [events, dateFilter]);

    // Don't render the section at all if empty + not loading
    if (!isLoading && filtered.length === 0) return null;

    return (
        <Animated.View entering={FadeInDown.delay(80).springify().damping(18)} style={styles.section}>
            <SectionHeader
                title={cat.label}
                emoji={cat.emoji}
                onViewAll={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({ pathname: "/events/[category]", params: { category: cat.id } });
                }}
            />

            {isLoading && filtered.length === 0 ? (
                <View style={styles.carouselLoader}>
                    <ActivityIndicator size="small" color={colors.goldMetallic} />
                </View>
            ) : (
                <FlatList
                    data={filtered.slice(0, 8)}
                    keyExtractor={(e) => e.id}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    snapToInterval={CAROUSEL_CARD_WIDTH + 12}
                    decelerationRate="fast"
                    contentContainerStyle={styles.carouselContent}
                    renderItem={({ item, index }) => (
                        <CarouselCard event={item} index={index} />
                    )}
                />
            )}
        </Animated.View>
    );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function ExploreScreen() {
    const insets = useSafeAreaInsets();

    const {
        events,
        featuredEvents,
        loading,
        fetchEvents,
        fetchFeaturedEvents,
        categoryEvents,
        categoryLoading,
        fetchByCategory,
    } = useEventsStore();

    const { recommendations, score, loadBrowsed } = useRecommendationsStore();
    const { user } = useAuthStore();
    const ticketsStore = useTicketsStore();

    const [dateFilter, setDateFilter] = useState<DateFilter>("any");
    const [cityFilter, setCityFilter] = useState("all");
    const [showCityModal, setShowCityModal] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    const [cachedEvents, setCachedEvents] = useState<Event[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    // Derive city options from all events
    const cityOptions = useMemo(() => {
        const source = events.length > 0 ? events : cachedEvents;
        const seen = new Map<string, string>();
        source.forEach((e) => {
            const city = e.city ?? e.location ?? "";
            if (city) seen.set(city.toLowerCase(), city);
        });
        return [{ value: "all", label: "All Cities" }, ...Array.from(seen.entries()).map(([, label]) => ({ value: label.toLowerCase(), label }))];
    }, [events, cachedEvents]);

    const activeCityLabel = cityOptions.find((o) => o.value === cityFilter)?.label ?? "All Cities";

    // Top featured event by heatScore
    const heroEvent = useMemo(() => {
        const source = featuredEvents.length > 0 ? featuredEvents : events;
        const future = source.filter((e) => {
            const d = safeDate(e.startDate);
            return d && d.getTime() > Date.now();
        });
        return future.sort((a, b) => (b.heatScore ?? 0) - (a.heatScore ?? 0))[0] ?? null;
    }, [featuredEvents, events]);

    // Past order categories for recommendation scoring
    const pastOrderCategories = useMemo(() => {
        const orders = (ticketsStore as any).orders ?? [];
        return Array.from(
            new Set(
                orders.flatMap((o: any) => {
                    const cat = o.eventCategory ?? o.category ?? "";
                    return cat ? [cat.toLowerCase()] : [];
                })
            )
        ) as string[];
    }, [(ticketsStore as any).orders]);

    useEffect(() => {
        trackScreen("Explore");
        void loadBrowsed();
        void loadData();
    }, []);

    // Rescore recommendations whenever events or user signals change
    useEffect(() => {
        const source = events.length > 0 ? events : cachedEvents;
        if (source.length > 0) {
            score(source, pastOrderCategories);
        }
    }, [events, cachedEvents, pastOrderCategories]);

    // Fetch category events for each category
    useEffect(() => {
        CATEGORIES.forEach(({ id }) => {
            const city = cityFilter !== "all" ? activeCityLabel : undefined;
            void fetchByCategory(id, city);
        });
    }, [cityFilter]);

    const loadData = async () => {
        const cached = await getCachedEvents();
        if (cached.data?.length) {
            setCachedEvents(cached.data);
        }

        try {
            await Promise.all([fetchEvents(), fetchFeaturedEvents()]);
            const store = useEventsStore.getState();
            if (store.events.length > 0) {
                await cacheEvents(store.events);
                await updateLastSyncTime();
                setIsOffline(false);
            }
            CATEGORIES.forEach(({ id }) => {
                void fetchByCategory(id);
            });
        } catch {
            setIsOffline(true);
        }
    };

    const onRefresh = useCallback(async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    }, []);

    const isInitialLoading = loading && events.length === 0 && cachedEvents.length === 0;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.iris}
                    />
                }
            >
                {/* ── Header ── */}
                <View style={styles.header}>
                    <View style={styles.headerRow}>
                        <View style={styles.headerLeft}>
                            <PulseDot />
                            <Text style={styles.headerTitle}>Explore</Text>
                        </View>
                        <NotificationBell variant="solid" />
                    </View>

                    {/* Search trigger */}
                    <SearchTrigger />

                    {/* Filters row */}
                    <View style={styles.filtersWrap}>
                        <DateFilterRow active={dateFilter} onChange={setDateFilter} />

                        {/* City picker button */}
                        <Pressable
                            onPress={() => setShowCityModal(true)}
                            style={styles.cityBtn}
                        >
                            <Text style={styles.cityBtnText}>📍 {activeCityLabel}</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Offline banner */}
                {isOffline && (
                    <Animated.View entering={FadeIn} style={styles.offlineBanner}>
                        <Text style={styles.offlineText}>📡 Offline — showing cached content</Text>
                    </Animated.View>
                )}

                {/* Initial loading skeleton */}
                {isInitialLoading && (
                    <View style={styles.loadingWrap}>
                        <ActivityIndicator size="large" color={colors.iris} />
                        <Text style={styles.loadingText}>Loading events…</Text>
                    </View>
                )}

                {/* ── Featured Hero ── */}
                {!isInitialLoading && heroEvent && (
                    <View style={styles.section}>
                        <SectionHeader title="Featured" emoji="🔥" />
                        <FeaturedHero event={heroEvent} />
                    </View>
                )}

                {/* ── For You (Recommendations) ── */}
                {recommendations.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader title="For You" emoji="✨" />
                        <FlatList
                            data={recommendations}
                            keyExtractor={(e) => e.id}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            snapToInterval={CAROUSEL_CARD_WIDTH + 12}
                            decelerationRate="fast"
                            contentContainerStyle={styles.carouselContent}
                            renderItem={({ item, index }) => (
                                <CarouselCard event={item} index={index} />
                            )}
                        />
                    </View>
                )}

                {/* ── Category Carousels ── */}
                {CATEGORIES.map((cat) => (
                    <CategorySection
                        key={cat.id}
                        cat={cat}
                        events={categoryEvents[cat.id] ?? []}
                        isLoading={categoryLoading[cat.id] ?? false}
                        dateFilter={dateFilter}
                    />
                ))}
            </ScrollView>

            {/* ── City Picker Modal ── */}
            <Modal
                visible={showCityModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowCityModal(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setShowCityModal(false)}
                />
                <View style={[styles.cityModal, { paddingBottom: insets.bottom + 16 }]}>
                    <View style={styles.cityModalHandle} />
                    <Text style={styles.cityModalTitle}>Choose City</Text>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {cityOptions.map((opt) => (
                            <Pressable
                                key={opt.value}
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    setCityFilter(opt.value);
                                    setShowCityModal(false);
                                }}
                                style={[
                                    styles.cityOption,
                                    cityFilter === opt.value && styles.cityOptionActive,
                                ]}
                            >
                                <Text style={[
                                    styles.cityOptionText,
                                    cityFilter === opt.value && styles.cityOptionTextActive,
                                ]}>
                                    {opt.label}
                                </Text>
                                {cityFilter === opt.value && (
                                    <Text style={styles.cityOptionCheck}>✓</Text>
                                )}
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: PURE_BLACK,
    },

    // Header
    header: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
        gap: 12,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    headerLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    headerTitle: {
        color: colors.gold,
        fontSize: 32,
        fontWeight: "800",
        letterSpacing: -0.5,
    },
    pulseDot: {
        width: 9,
        height: 9,
        borderRadius: 5,
        backgroundColor: "#4CAF50",
        shadowColor: "#4CAF50",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 5,
    },

    // Search trigger
    searchTrigger: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: "rgba(255,255,255,0.07)",
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.09)",
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    searchIcon: {
        fontSize: 16,
    },
    searchPlaceholder: {
        color: colors.goldMetallic,
        fontSize: 15,
        flex: 1,
    },

    // Filters
    filtersWrap: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    filterRow: {
        flex: 1,
    },
    filterRowContent: {
        gap: 8,
        paddingRight: 8,
    },
    filterPill: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: radii.pill,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    filterPillActive: {
        backgroundColor: "rgba(244,74,34,0.18)",
        borderColor: "rgba(244,74,34,0.45)",
    },
    filterPillText: {
        color: colors.goldMetallic,
        fontSize: 13,
        fontWeight: "600",
    },
    filterPillTextActive: {
        color: colors.iris,
    },
    cityBtn: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: radii.pill,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        flexShrink: 0,
    },
    cityBtnText: {
        color: colors.goldMetallic,
        fontSize: 13,
        fontWeight: "600",
    },

    // Offline banner
    offlineBanner: {
        marginHorizontal: 16,
        marginBottom: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: radii.md,
        backgroundColor: "rgba(255,170,0,0.1)",
        borderWidth: 1,
        borderColor: "rgba(255,170,0,0.25)",
    },
    offlineText: {
        color: colors.warning,
        fontSize: 13,
        fontWeight: "500",
    },

    // Loading
    loadingWrap: {
        paddingTop: 60,
        alignItems: "center",
        gap: 12,
    },
    loadingText: {
        color: colors.goldMetallic,
        fontSize: 14,
    },

    // Sections
    section: {
        marginTop: 24,
    },
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    sectionTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    sectionEmoji: {
        fontSize: 18,
    },
    sectionTitle: {
        color: colors.gold,
        fontSize: 18,
        fontWeight: "700",
        letterSpacing: -0.2,
    },
    viewAll: {
        color: colors.iris,
        fontSize: 13,
        fontWeight: "600",
    },

    // Featured hero card
    heroCard: {
        marginHorizontal: 16,
        height: 280,
        borderRadius: radii["2xl"],
        overflow: "hidden",
        ...shadows.card,
    },
    heroBadge: {
        position: "absolute",
        top: 14,
        left: 14,
        zIndex: 2,
        borderRadius: 8,
        overflow: "hidden",
    },
    heroBadgeInner: {
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    heroBadgeText: {
        color: "#fff",
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 0.8,
    },
    heroContent: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: 18,
        gap: 6,
    },
    heroCategoryPill: {
        alignSelf: "flex-start",
        backgroundColor: "rgba(255,255,255,0.15)",
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    heroCategoryText: {
        color: "#fff",
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 0.6,
    },
    heroTitle: {
        color: "#fff",
        fontSize: 22,
        fontWeight: "800",
        letterSpacing: -0.4,
    },
    heroVenue: {
        color: "rgba(255,255,255,0.75)",
        fontSize: 13,
    },
    heroFooter: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 4,
    },
    heroDate: {
        color: "rgba(255,255,255,0.6)",
        fontSize: 13,
        fontWeight: "500",
    },
    heroPricePill: {
        backgroundColor: "rgba(244,74,34,0.25)",
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: "rgba(244,74,34,0.4)",
    },
    heroPriceText: {
        color: "#FF6B4A",
        fontSize: 13,
        fontWeight: "700",
    },

    // Carousel
    carouselContent: {
        paddingHorizontal: 16,
        gap: 12,
    },
    carouselCard: {
        width: CAROUSEL_CARD_WIDTH,
        borderRadius: radii.lg,
        overflow: "hidden",
        backgroundColor: "rgba(255,255,255,0.04)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.07)",
    },
    carouselImageWrap: {
        height: 140,
        position: "relative",
    },
    carouselBody: {
        padding: 12,
        gap: 3,
    },
    carouselTitle: {
        color: colors.gold,
        fontSize: 14,
        fontWeight: "700",
        letterSpacing: -0.1,
    },
    carouselVenue: {
        color: colors.goldMetallic,
        fontSize: 12,
    },
    carouselMeta: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 6,
    },
    carouselDate: {
        color: colors.goldMetallic,
        fontSize: 11,
    },
    carouselPrice: {
        color: colors.iris,
        fontSize: 11,
        fontWeight: "700",
    },
    carouselLoader: {
        height: 120,
        alignItems: "center",
        justifyContent: "center",
    },

    // City modal
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
    },
    cityModal: {
        backgroundColor: "#111111",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 12,
        paddingHorizontal: 16,
        maxHeight: "60%",
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: "rgba(255,255,255,0.08)",
    },
    cityModalHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: "rgba(255,255,255,0.2)",
        alignSelf: "center",
        marginBottom: 16,
    },
    cityModalTitle: {
        color: colors.gold,
        fontSize: 17,
        fontWeight: "700",
        marginBottom: 12,
    },
    cityOption: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255,255,255,0.05)",
    },
    cityOptionActive: {
        // no bg change, just text + check
    },
    cityOptionText: {
        color: colors.goldMetallic,
        fontSize: 15,
        fontWeight: "500",
    },
    cityOptionTextActive: {
        color: colors.gold,
        fontWeight: "700",
    },
    cityOptionCheck: {
        color: colors.iris,
        fontSize: 16,
        fontWeight: "700",
    },
});
