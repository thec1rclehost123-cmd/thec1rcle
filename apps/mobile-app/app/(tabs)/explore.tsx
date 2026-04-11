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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Image } from "expo-image";
import { useEventsStore, type Event, getHeatScore } from "@/store/eventsStore";
import { useRecommendationsStore } from "@/store/recommendationsStore";
import { getEventImage } from "@/lib/utils/event";
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
    runOnJS,
} from "react-native-reanimated";
import { colors, radii, shadows } from "@/lib/design/theme";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { trackScreen } from "@/lib/analytics";
import { formatEventDate, safeDate } from "@/lib/utils/date";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CAROUSEL_CARD_WIDTH = SCREEN_WIDTH * 0.72;
const GRID_CARD_WIDTH = (SCREEN_WIDTH - 48) / 2; // 2-column grid
const PURE_BLACK = "#000000";

// ── Sort tabs — mirrors guest portal sortTabs ──────────────────────────────────
const SORT_TABS = [
    { id: "trending", label: "Trending" },
    { id: "soonest",  label: "Soonest" },
    { id: "this-week", label: "This Week" },
    { id: "price-low", label: "Price ↑" },
] as const;
type SortTab = typeof SORT_TABS[number]["id"];

// ── Date filters ───────────────────────────────────────────────────────────────
const DATE_FILTERS = [
    { id: "any",      label: "Any Date" },
    { id: "today",    label: "Today" },
    { id: "weekend",  label: "Weekend" },
    { id: "this-week", label: "This Week" },
] as const;
type DateFilter = typeof DATE_FILTERS[number]["id"];

// ── Category config ────────────────────────────────────────────────────────────
const CATEGORIES = [
    { id: "club",     label: "Club Nights",  emoji: "🎧", keywords: ["club", "nightclub", "dj"] },
    { id: "concert",  label: "Concerts",     emoji: "🎤", keywords: ["concert", "live music", "gig"] },
    { id: "festival", label: "Festivals",    emoji: "🎡", keywords: ["festival", "fest"] },
    { id: "party",    label: "Parties",      emoji: "🎉", keywords: ["party", "parties", "blowout"] },
    { id: "brunch",   label: "Brunches",     emoji: "🥂", keywords: ["brunch", "day party"] },
    { id: "comedy",   label: "Comedy",       emoji: "😂", keywords: ["comedy", "standup", "stand-up"] },
    { id: "music",    label: "Music",        emoji: "🎵", keywords: ["music"] },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────
function getLowestPrice(event: Event): number {
    if (!event.tickets?.length) return 0;
    return event.tickets.reduce((min, t) => (t.price < min ? t.price : min), event.tickets[0].price);
}

function getEventTime(event: Event): number {
    const d = safeDate(event.startDate);
    return d ? d.getTime() : Number.MAX_SAFE_INTEGER;
}

function applyDateFilter(events: Event[], filter: DateFilter): Event[] {
    if (filter === "any") return events;
    const now = new Date();
    return events.filter((e) => {
        const d = safeDate(e.startDate);
        if (!d) return false;
        if (filter === "today") return d.toDateString() === now.toDateString();
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

function applySortTab(events: Event[], sort: SortTab): Event[] {
    const copy = [...events];
    if (sort === "trending")  return copy.sort((a, b) => getHeatScore(b) - getHeatScore(a));
    if (sort === "soonest")   return copy.sort((a, b) => getEventTime(a) - getEventTime(b));
    if (sort === "this-week") {
        const now = Date.now();
        const weekAhead = now + 7 * 24 * 60 * 60 * 1000;
        return copy.sort((a, b) => {
            const ta = getEventTime(a), tb = getEventTime(b);
            const aIn = ta >= now && ta <= weekAhead;
            const bIn = tb >= now && tb <= weekAhead;
            if (aIn && !bIn) return -1;
            if (!aIn && bIn) return 1;
            return ta - tb;
        });
    }
    if (sort === "price-low") return copy.sort((a, b) => getLowestPrice(a) - getLowestPrice(b));
    return copy;
}

// Match events to a category flexibly (category field OR tags OR title keywords)
function matchCategory(event: Event, keywords: readonly string[]): boolean {
    const cat = (event.category ?? event.type ?? "").toLowerCase();
    const tags = (event.tags ?? []).map((t: string) => t.toLowerCase());
    const title = (event.title ?? "").toLowerCase();
    return keywords.some((kw) => cat.includes(kw) || tags.some((t) => t.includes(kw)) || title.includes(kw));
}

// ── Sub-components ─────────────────────────────────────────────────────────────
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function PulseDot() {
    const scale = useSharedValue(1);
    useEffect(() => {
        scale.value = withRepeat(
            withSequence(withTiming(1.4, { duration: 600 }), withTiming(1, { duration: 600 })),
            -1, false
        );
    }, []);
    return <Animated.View style={[styles.pulseDot, useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))]} />;
}

function SearchTrigger() {
    return (
        <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/search"); }}
            style={styles.searchTrigger}
        >
            <Text style={styles.searchIcon}>🔍</Text>
            <Text style={styles.searchPlaceholder}>Search events, venues, artists…</Text>
        </Pressable>
    );
}

// ── Featured Carousel — auto-slides like guest portal hero ────────────────────
function FeaturedCarousel({ events }: { events: Event[] }) {
    const [active, setActive] = useState(0);
    const activeRef = useRef(0);
    const opacity = useSharedValue(1);

    useEffect(() => {
        if (events.length < 2) return;
        const id = setInterval(() => {
            const next = (activeRef.current + 1) % events.length;
            const swap = () => {
                activeRef.current = next;
                setActive(next);
                opacity.value = withTiming(1, { duration: 400 });
            };
            opacity.value = withTiming(0, { duration: 300 }, () => {
                runOnJS(swap)();
            });
        }, 4000);
        return () => clearInterval(id);
    }, [events.length]);

    const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

    if (!events.length) return null;

    return (
        <View style={styles.heroSection}>
            <Animated.View style={fadeStyle}>
                <HeroSlide event={events[active]} />
            </Animated.View>
            {events.length > 1 && (
                <View style={styles.heroDots}>
                    {events.map((_, i) => (
                        <View key={i} style={[styles.heroDot, i === active && styles.heroDotActive]} />
                    ))}
                </View>
            )}
        </View>
    );
}

function HeroSlide({ event }: { event: Event }) {
    const scale = useSharedValue(1);
    const img = getEventImage(event);
    const price = getLowestPrice(event);

    return (
        <AnimatedPressable
            onPressIn={() => { scale.value = withSpring(0.98, { damping: 15, stiffness: 400 }); }}
            onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push({ pathname: "/event/[id]", params: { id: event.id } });
            }}
            style={[useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] })), styles.heroSlide]}
        >
            {img ? (
                <Image source={{ uri: img }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={500} />
            ) : (
                <LinearGradient colors={["#2D1A14", "#1A0A0A", "#0A0A0A"]} style={StyleSheet.absoluteFillObject} />
            )}
            <LinearGradient
                colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.5)", "rgba(0,0,0,0.92)"]}
                locations={[0, 0.5, 1]}
                style={StyleSheet.absoluteFillObject}
            />
            {/* FEATURED badge */}
            <View style={styles.heroBadgeWrap}>
                <LinearGradient colors={["#F44A22", "#FF6B4A"]} style={styles.heroBadge}>
                    <Text style={styles.heroBadgeText}>FEATURED</Text>
                </LinearGradient>
            </View>
            {event.category && (
                <View style={styles.heroCatPill}>
                    <Text style={styles.heroCatText}>{event.category.toUpperCase()}</Text>
                </View>
            )}
            <View style={styles.heroContent}>
                <Text style={styles.heroTitle} numberOfLines={2}>{event.title}</Text>
                <Text style={styles.heroVenue} numberOfLines={1}>📍 {event.venue ?? event.location ?? "TBA"}</Text>
                <View style={styles.heroFooter}>
                    <Text style={styles.heroDate}>{formatEventDate(event.startDate)}</Text>
                    <View style={styles.heroPricePill}>
                        <Text style={styles.heroPriceText}>
                            {price === 0 ? "Free" : `from ₹${price.toLocaleString("en-IN")}`}
                        </Text>
                    </View>
                </View>
                {/* Get Tickets CTA — matches guest portal */}
                <Pressable
                    style={styles.heroCtaBtn}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        router.push({ pathname: "/event/[id]", params: { id: event.id } });
                    }}
                >
                    <Text style={styles.heroCtaText}>Get Tickets →</Text>
                </Pressable>
            </View>
        </AnimatedPressable>
    );
}

// ── Sort Tab Row ───────────────────────────────────────────────────────────────
function SortTabRow({ active, onChange }: { active: SortTab; onChange: (v: SortTab) => void }) {
    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortTabContent}>
            {SORT_TABS.map((t) => (
                <Pressable
                    key={t.id}
                    onPress={() => { Haptics.selectionAsync(); onChange(t.id); }}
                    style={[styles.sortTab, active === t.id && styles.sortTabActive]}
                >
                    <Text style={[styles.sortTabText, active === t.id && styles.sortTabTextActive]}>{t.label}</Text>
                </Pressable>
            ))}
        </ScrollView>
    );
}

// ── Date filter pills ──────────────────────────────────────────────────────────
function DateFilterRow({ active, onChange }: { active: DateFilter; onChange: (v: DateFilter) => void }) {
    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRowContent} style={styles.filterRow}>
            {DATE_FILTERS.map((f) => (
                <Pressable
                    key={f.id}
                    onPress={() => { Haptics.selectionAsync(); onChange(f.id); }}
                    style={[styles.filterPill, active === f.id && styles.filterPillActive]}
                >
                    <Text style={[styles.filterPillText, active === f.id && styles.filterPillTextActive]}>{f.label}</Text>
                </Pressable>
            ))}
        </ScrollView>
    );
}

// ── Carousel card (For You + Category sections) ────────────────────────────────
function CarouselCard({ event, index }: { event: Event; index: number }) {
    const scale = useSharedValue(1);
    const price = getLowestPrice(event);
    const img = getEventImage(event);

    return (
        <Animated.View
            entering={FadeInRight.delay(index * 50).springify().damping(18)}
            style={[useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] })), styles.carouselCard]}
        >
            <AnimatedPressable
                onPressIn={() => { scale.value = withSpring(0.97, { damping: 15, stiffness: 400 }); }}
                onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: "/event/[id]", params: { id: event.id } }); }}
                style={{ flex: 1 }}
            >
                <View style={styles.carouselImgWrap}>
                    {img ? (
                        <Image source={{ uri: img }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={300} />
                    ) : (
                        <LinearGradient colors={["#2D1A14", "#0A0A0A"]} style={StyleSheet.absoluteFillObject} />
                    )}
                    <LinearGradient colors={["transparent", "rgba(0,0,0,0.75)"]} style={StyleSheet.absoluteFillObject} />
                </View>
                <View style={styles.carouselBody}>
                    <Text style={styles.carouselTitle} numberOfLines={2}>{event.title}</Text>
                    <Text style={styles.carouselVenue} numberOfLines={1}>{event.venue ?? event.location ?? ""}</Text>
                    <View style={styles.carouselMeta}>
                        <Text style={styles.carouselDate}>{formatEventDate(event.startDate)}</Text>
                        {price > 0 && <Text style={styles.carouselPrice}>₹{price.toLocaleString("en-IN")}</Text>}
                    </View>
                </View>
            </AnimatedPressable>
        </Animated.View>
    );
}

// ── Grid card — 2-col layout for "All Events" section ─────────────────────────
function GridCard({ event, index }: { event: Event; index: number }) {
    const scale = useSharedValue(1);
    const price = getLowestPrice(event);
    const img = getEventImage(event);

    return (
        <Animated.View
            entering={FadeInDown.delay(Math.min(index * 40, 200)).springify().damping(18)}
            style={[useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] })), styles.gridCard]}
        >
            <AnimatedPressable
                onPressIn={() => { scale.value = withSpring(0.96, { damping: 15, stiffness: 400 }); }}
                onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: "/event/[id]", params: { id: event.id } }); }}
                style={{ flex: 1 }}
            >
                <View style={styles.gridImgWrap}>
                    {img ? (
                        <Image source={{ uri: img }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={300} />
                    ) : (
                        <LinearGradient colors={["#2D1A14", "#0A0A0A"]} style={StyleSheet.absoluteFillObject} />
                    )}
                    <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} locations={[0.3, 1]} style={StyleSheet.absoluteFillObject} />
                    {price === 0 && (
                        <View style={styles.gridFreeBadge}><Text style={styles.gridFreeBadgeText}>FREE</Text></View>
                    )}
                </View>
                <View style={styles.gridBody}>
                    <Text style={styles.gridTitle} numberOfLines={2}>{event.title}</Text>
                    <Text style={styles.gridVenue} numberOfLines={1}>{event.venue ?? event.location ?? ""}</Text>
                    <View style={styles.gridFooter}>
                        <Text style={styles.gridDate}>{formatEventDate(event.startDate)}</Text>
                        {price > 0 && <Text style={styles.gridPrice}>₹{price.toLocaleString("en-IN")}</Text>}
                    </View>
                </View>
            </AnimatedPressable>
        </Animated.View>
    );
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({ title, emoji, onViewAll }: { title: string; emoji: string; onViewAll?: () => void }) {
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

// ── Category section ───────────────────────────────────────────────────────────
function CategorySection({ cat, events, isLoading, dateFilter }: {
    cat: typeof CATEGORIES[number];
    events: Event[];
    isLoading: boolean;
    dateFilter: DateFilter;
}) {
    const filtered = useMemo(() => applyDateFilter(events, dateFilter), [events, dateFilter]);
    if (!isLoading && filtered.length === 0) return null;

    return (
        <Animated.View entering={FadeInDown.delay(80).springify().damping(18)} style={styles.section}>
            <SectionHeader
                title={cat.label}
                emoji={cat.emoji}
                onViewAll={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: "/events/[category]", params: { category: cat.id } }); }}
            />
            {isLoading && filtered.length === 0 ? (
                <View style={styles.carouselLoader}><ActivityIndicator size="small" color={colors.iris} /></View>
            ) : (
                <FlatList
                    data={filtered.slice(0, 8)}
                    keyExtractor={(e) => e.id}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    snapToInterval={CAROUSEL_CARD_WIDTH + 12}
                    decelerationRate="fast"
                    contentContainerStyle={styles.carouselContent}
                    renderItem={({ item, index }) => <CarouselCard event={item} index={index} />}
                />
            )}
        </Animated.View>
    );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function ExploreScreen() {
    const insets = useSafeAreaInsets();

    const { events, featuredEvents, loading, fetchEvents, fetchFeaturedEvents } = useEventsStore();
    const { recommendations, score, loadBrowsed } = useRecommendationsStore();
    const ticketsStore = useTicketsStore();

    const [dateFilter, setDateFilter]       = useState<DateFilter>("any");
    const [sortTab, setSortTab]             = useState<SortTab>("trending");
    const [cityFilter, setCityFilter]       = useState("all");
    const [showCityModal, setShowCityModal] = useState(false);
    const [isOffline, setIsOffline]         = useState(false);
    const [cachedEvents, setCachedEvents]   = useState<Event[]>([]);
    const [refreshing, setRefreshing]       = useState(false);
    const [showAllEvents, setShowAllEvents] = useState(false); // expand grid

    const allEvents = events.length > 0 ? events : cachedEvents;

    // City options derived from events
    const cityOptions = useMemo(() => {
        const seen = new Map<string, string>();
        allEvents.forEach((e) => {
            const city = e.city ?? e.location ?? "";
            if (city) seen.set(city.toLowerCase(), city);
        });
        return [{ value: "all", label: "All Cities" }, ...Array.from(seen.entries()).map(([, label]) => ({ value: label.toLowerCase(), label }))];
    }, [allEvents]);

    const activeCityLabel = cityOptions.find((o) => o.value === cityFilter)?.label ?? "All Cities";

    // Featured carousel slides (up to 6)
    const heroSlides = useMemo(() => {
        const src = featuredEvents.length > 0 ? featuredEvents : allEvents;
        return [...src]
            .sort((a, b) => getHeatScore(b) - getHeatScore(a))
            .slice(0, 6);
    }, [featuredEvents, allEvents]);

    // Category events — flexible matching via keywords + tags + title
    const categoryEventsMap = useMemo(() => {
        const map: Record<string, Event[]> = {};
        for (const cat of CATEGORIES) {
            map[cat.id] = allEvents.filter((e) => matchCategory(e, cat.keywords));
        }
        return map;
    }, [allEvents]);

    // Filtered + sorted events for "All Events" grid
    const filteredEvents = useMemo(() => {
        let result = allEvents;
        if (cityFilter !== "all") {
            result = result.filter((e) => {
                const c = (e.city ?? e.location ?? "").toLowerCase();
                return c.includes(cityFilter);
            });
        }
        result = applyDateFilter(result, dateFilter);
        result = applySortTab(result, sortTab);
        return result;
    }, [allEvents, cityFilter, dateFilter, sortTab]);

    // Recommendations
    const pastOrderCategories = useMemo(() => {
        const orders = (ticketsStore as any).orders ?? [];
        return Array.from(new Set(orders.flatMap((o: any) => {
            const cat = o.eventCategory ?? o.category ?? "";
            return cat ? [cat.toLowerCase()] : [];
        }))) as string[];
    }, [(ticketsStore as any).orders]);

    useEffect(() => {
        trackScreen("Explore");
        void loadBrowsed();
        void loadData();
    }, []);

    useEffect(() => {
        if (allEvents.length > 0) score(allEvents, pastOrderCategories);
    }, [allEvents, pastOrderCategories]);

    const loadData = async () => {
        const cached = await getCachedEvents();
        if (cached.data?.length) setCachedEvents(cached.data);

        const [eventsResult] = await Promise.allSettled([fetchEvents(), fetchFeaturedEvents()]);

        if (eventsResult.status === "fulfilled") {
            const store = useEventsStore.getState();
            if (store.events.length > 0) {
                await cacheEvents(store.events);
                await updateLastSyncTime();
            }
            setIsOffline(false);
        } else {
            setIsOffline(true);
        }
    };

    const onRefresh = useCallback(async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    }, []);

    const isInitialLoading = loading && allEvents.length === 0;

    // Grid rows: pair events into rows of 2
    const gridEvents = showAllEvents ? filteredEvents : filteredEvents.slice(0, 8);
    const gridRows: Event[][] = [];
    for (let i = 0; i < gridEvents.length; i += 2) {
        gridRows.push(gridEvents.slice(i, i + 2));
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.iris} />}
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
                    <SearchTrigger />
                    <View style={styles.filtersWrap}>
                        <DateFilterRow active={dateFilter} onChange={setDateFilter} />
                        <Pressable onPress={() => setShowCityModal(true)} style={styles.cityBtn}>
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

                {/* Loading */}
                {isInitialLoading && (
                    <View style={styles.loadingWrap}>
                        <ActivityIndicator size="large" color={colors.iris} />
                        <Text style={styles.loadingText}>Loading events…</Text>
                    </View>
                )}

                {/* ── Featured Carousel (auto-slides like guest portal) ── */}
                {!isInitialLoading && heroSlides.length > 0 && (
                    <FeaturedCarousel events={heroSlides} />
                )}

                {/* ── Sort Tabs ── */}
                {allEvents.length > 0 && (
                    <View style={styles.sortTabRow}>
                        <SortTabRow active={sortTab} onChange={setSortTab} />
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
                            renderItem={({ item, index }) => <CarouselCard event={item} index={index} />}
                        />
                    </View>
                )}

                {/* ── All Events Grid — main content, mirrors guest portal event grid ── */}
                {filteredEvents.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader
                            title={`What's on in ${activeCityLabel}`}
                            emoji="🗓️"
                            onViewAll={filteredEvents.length > 8 && !showAllEvents ? () => setShowAllEvents(true) : undefined}
                        />
                        <View style={styles.gridContainer}>
                            {gridRows.map((row, ri) => (
                                <View key={ri} style={styles.gridRow}>
                                    {row.map((event, ci) => (
                                        <GridCard key={event.id} event={event} index={ri * 2 + ci} />
                                    ))}
                                    {/* fill empty slot in last odd row */}
                                    {row.length === 1 && <View style={styles.gridCard} />}
                                </View>
                            ))}
                        </View>
                        {filteredEvents.length > 8 && !showAllEvents && (
                            <Pressable style={styles.loadMoreBtn} onPress={() => setShowAllEvents(true)}>
                                <Text style={styles.loadMoreText}>Load More Events ({filteredEvents.length - 8} more)</Text>
                            </Pressable>
                        )}
                        {filteredEvents.length === 0 && !loading && (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyEmoji}>🔍</Text>
                                <Text style={styles.emptyText}>No events found</Text>
                                <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* ── Category Carousels ── */}
                {CATEGORIES.map((cat) => (
                    <CategorySection
                        key={cat.id}
                        cat={cat}
                        events={categoryEventsMap[cat.id] ?? []}
                        isLoading={loading}
                        dateFilter={dateFilter}
                    />
                ))}

                {/* No content state */}
                {!loading && allEvents.length === 0 && !isOffline && (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyEmoji}>🎪</Text>
                        <Text style={styles.emptyText}>No events yet</Text>
                        <Text style={styles.emptySubtext}>Pull down to refresh</Text>
                    </View>
                )}
            </ScrollView>

            {/* ── City Picker Modal ── */}
            <Modal visible={showCityModal} transparent animationType="slide" onRequestClose={() => setShowCityModal(false)}>
                <Pressable style={styles.modalOverlay} onPress={() => setShowCityModal(false)} />
                <View style={[styles.cityModal, { paddingBottom: insets.bottom + 16 }]}>
                    <View style={styles.cityModalHandle} />
                    <Text style={styles.cityModalTitle}>Choose City</Text>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {cityOptions.map((opt) => (
                            <Pressable
                                key={opt.value}
                                onPress={() => { Haptics.selectionAsync(); setCityFilter(opt.value); setShowCityModal(false); }}
                                style={styles.cityOption}
                            >
                                <Text style={[styles.cityOptionText, cityFilter === opt.value && styles.cityOptionTextActive]}>
                                    {opt.label}
                                </Text>
                                {cityFilter === opt.value && <Text style={styles.cityOptionCheck}>✓</Text>}
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
    container: { flex: 1, backgroundColor: PURE_BLACK },

    // Header
    header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 12 },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
    headerTitle: { color: "#FFFFFF", fontSize: 32, fontWeight: "800", letterSpacing: -0.5 },
    pulseDot: {
        width: 9, height: 9, borderRadius: 5,
        backgroundColor: "#4CAF50",
        shadowColor: "#4CAF50", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 5,
    },

    // Search
    searchTrigger: {
        flexDirection: "row", alignItems: "center", gap: 10,
        backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 14,
        borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
        paddingHorizontal: 14, paddingVertical: 12,
    },
    searchIcon: { fontSize: 16 },
    searchPlaceholder: { color: "rgba(255,255,255,0.45)", fontSize: 15, flex: 1 },

    // Filters
    filtersWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
    filterRow: { flex: 1 },
    filterRowContent: { gap: 8, paddingRight: 8 },
    filterPill: {
        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100,
        backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    },
    filterPillActive: { backgroundColor: "rgba(244,74,34,0.18)", borderColor: "rgba(244,74,34,0.45)" },
    filterPillText: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "600" },
    filterPillTextActive: { color: "#F44A22" },
    cityBtn: {
        paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100,
        backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", flexShrink: 0,
    },
    cityBtnText: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "600" },

    // Offline
    offlineBanner: {
        marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 10,
        borderRadius: 10, backgroundColor: "rgba(255,170,0,0.1)", borderWidth: 1, borderColor: "rgba(255,170,0,0.25)",
    },
    offlineText: { color: "#FFAA00", fontSize: 13, fontWeight: "500" },

    // Loading
    loadingWrap: { paddingTop: 60, alignItems: "center", gap: 12 },
    loadingText: { color: "rgba(255,255,255,0.4)", fontSize: 14 },

    // Hero carousel
    heroSection: { position: "relative", marginTop: 12 },
    heroSlide: {
        width: SCREEN_WIDTH,
        height: 320,
        position: "relative",
        overflow: "hidden",
    },
    heroBadgeWrap: { position: "absolute", top: 14, left: 16, zIndex: 2, borderRadius: 8, overflow: "hidden" },
    heroBadge: { paddingHorizontal: 10, paddingVertical: 4 },
    heroBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
    heroCatPill: {
        position: "absolute", top: 14, right: 16, zIndex: 2,
        backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2,
    },
    heroCatText: { color: "#fff", fontSize: 10, fontWeight: "700", letterSpacing: 0.6 },
    heroContent: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 18, gap: 5 },
    heroTitle: { color: "#fff", fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
    heroVenue: { color: "rgba(255,255,255,0.7)", fontSize: 13 },
    heroFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
    heroDate: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "500" },
    heroPricePill: {
        backgroundColor: "rgba(244,74,34,0.25)", borderRadius: 20,
        paddingHorizontal: 12, paddingVertical: 3, borderWidth: 1, borderColor: "rgba(244,74,34,0.4)",
    },
    heroPriceText: { color: "#FF6B4A", fontSize: 12, fontWeight: "700" },
    heroCtaBtn: {
        marginTop: 8, alignSelf: "flex-start",
        backgroundColor: "#FFFFFF", borderRadius: 100,
        paddingHorizontal: 20, paddingVertical: 9,
    },
    heroCtaText: { color: "#000", fontSize: 13, fontWeight: "800", letterSpacing: 0.3 },
    heroDots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10, marginBottom: 4 },
    heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.25)" },
    heroDotActive: { width: 20, backgroundColor: "#F44A22" },

    // Sort tabs
    sortTabRow: { marginTop: 16 },
    sortTabContent: { paddingHorizontal: 16, gap: 8 },
    sortTab: {
        paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100,
        backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    },
    sortTabActive: { backgroundColor: "#F44A22", borderColor: "#F44A22" },
    sortTabText: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "600" },
    sortTabTextActive: { color: "#fff" },

    // Sections
    section: { marginTop: 28 },
    sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 12 },
    sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    sectionEmoji: { fontSize: 18 },
    sectionTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", letterSpacing: -0.2 },
    viewAll: { color: "#F44A22", fontSize: 13, fontWeight: "600" },

    // Carousel
    carouselContent: { paddingHorizontal: 16, gap: 12 },
    carouselCard: {
        width: CAROUSEL_CARD_WIDTH, borderRadius: 16, overflow: "hidden",
        backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    },
    carouselImgWrap: { height: 150, position: "relative" },
    carouselBody: { padding: 12, gap: 3 },
    carouselTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", letterSpacing: -0.1 },
    carouselVenue: { color: "rgba(255,255,255,0.45)", fontSize: 12 },
    carouselMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
    carouselDate: { color: "rgba(255,255,255,0.4)", fontSize: 11 },
    carouselPrice: { color: "#F44A22", fontSize: 11, fontWeight: "700" },
    carouselLoader: { height: 120, alignItems: "center", justifyContent: "center" },

    // Grid (All Events)
    gridContainer: { paddingHorizontal: 16, gap: 12 },
    gridRow: { flexDirection: "row", gap: 12 },
    gridCard: {
        width: GRID_CARD_WIDTH, flex: 1, borderRadius: 16, overflow: "hidden",
        backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    },
    gridImgWrap: { height: 160, position: "relative" },
    gridFreeBadge: {
        position: "absolute", top: 8, right: 8,
        backgroundColor: "#10B981", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
    },
    gridFreeBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
    gridBody: { padding: 10, gap: 3 },
    gridTitle: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
    gridVenue: { color: "rgba(255,255,255,0.4)", fontSize: 11 },
    gridFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 5 },
    gridDate: { color: "rgba(255,255,255,0.35)", fontSize: 10 },
    gridPrice: { color: "#F44A22", fontSize: 10, fontWeight: "700" },

    // Load more
    loadMoreBtn: {
        marginHorizontal: 16, marginTop: 16, paddingVertical: 14,
        borderRadius: 100, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
        alignItems: "center",
    },
    loadMoreText: { color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "600" },

    // Empty state
    emptyState: { alignItems: "center", paddingVertical: 60, gap: 8 },
    emptyEmoji: { fontSize: 40 },
    emptyText: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
    emptySubtext: { color: "rgba(255,255,255,0.4)", fontSize: 14 },

    // City modal
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
    cityModal: {
        backgroundColor: "#111111", borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingTop: 12, paddingHorizontal: 16, maxHeight: "60%",
        borderWidth: 1, borderBottomWidth: 0, borderColor: "rgba(255,255,255,0.08)",
    },
    cityModalHandle: {
        width: 40, height: 4, borderRadius: 2,
        backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginBottom: 16,
    },
    cityModalTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "700", marginBottom: 12 },
    cityOption: {
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingVertical: 14, paddingHorizontal: 4,
        borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)",
    },
    cityOptionText: { color: "rgba(255,255,255,0.5)", fontSize: 15, fontWeight: "500" },
    cityOptionTextActive: { color: "#FFFFFF", fontWeight: "700" },
    cityOptionCheck: { color: "#F44A22", fontSize: 16, fontWeight: "700" },
});
