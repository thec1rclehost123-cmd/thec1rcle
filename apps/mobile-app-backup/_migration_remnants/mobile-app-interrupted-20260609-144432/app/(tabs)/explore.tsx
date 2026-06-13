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
    DeviceEventEmitter,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Image } from "expo-image";
import MapView, { PROVIDER_DEFAULT } from "react-native-maps";
import { useEventsStore, type Event, getHeatScore } from "@/store/eventsStore";
import { useRecommendationsStore } from "@/store/recommendationsStore";
import { useProfileStore } from "@/store/profileStore";
import { getEventImage } from "@/lib/utils/event";
import { useTicketsStore } from "@/store/ticketsStore";
import { cacheEvents, getCachedEvents, updateLastSyncTime } from "@/lib/cache";
import { useEventInterestStore } from "@/store/eventInterestStore";
import { useAuth } from "@/hooks/useAuth";
import * as Haptics from "expo-haptics";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    FadeInDown,
    FadeInRight,
    FadeIn,
} from "react-native-reanimated";
import { colors } from "@/lib/design/theme";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { trackScreen } from "@/lib/analytics";
import { formatEventDate, safeDate } from "@/lib/utils/date";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_CARD_WIDTH = SCREEN_WIDTH - 32;
const FOR_YOU_CARD_WIDTH = SCREEN_WIDTH * 0.45;
const FOR_YOU_CARD_HEIGHT = SCREEN_WIDTH * 0.65;
const GRID_CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;
const GRID_CARD_HEIGHT = 260;
const PURE_BLACK = "#000000";

const DEFAULT_MAP_REGION = {
    latitude: 19.076,
    longitude: 72.8777,
    latitudeDelta: 0.15,
    longitudeDelta: 0.15,
};

// ── Date filter pills ─────────────────────────────────────────────────────────
const DATE_FILTERS = [
    { id: "tonight",   label: "Tonight" },
    { id: "weekend",   label: "Weekend" },
    { id: "this-week", label: "This Week" },
] as const;
type DateFilter = typeof DATE_FILTERS[number]["id"];

// ── Category filter pills ─────────────────────────────────────────────────────
const CATEGORY_FILTERS = [
    { id: "all",      label: "All" },
    { id: "club",     label: "Clubbing" },
    { id: "concert",  label: "Concerts" },
    { id: "festival", label: "Festivals" },
    { id: "party",    label: "Parties" },
    { id: "brunch",   label: "Brunch" },
    { id: "comedy",   label: "Comedy" },
] as const;
type CategoryFilter = typeof CATEGORY_FILTERS[number]["id"];

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

// ── Helpers ───────────────────────────────────────────────────────────────────
function getLowestPrice(event: Event): number {
    return event.minPrice ?? 0;
}

function getGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
}

function applyDateFilter(events: Event[], filter: DateFilter): Event[] {
    const now = new Date();
    return events.filter((e) => {
        const d = safeDate(e.startDate);
        if (!d) return false;
        if (filter === "tonight") return d.toDateString() === now.toDateString();
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

function matchCategory(event: Event, keywords: readonly string[]): boolean {
    const cat = (event.category ?? event.type ?? "").toLowerCase();
    const tags = (event.tags ?? []).map((t: string) => t.toLowerCase());
    const title = (event.title ?? "").toLowerCase();
    return keywords.some((kw) => cat.includes(kw) || tags.some((t) => t.includes(kw)) || title.includes(kw));
}

function applyCategoryFilter(events: Event[], category: CategoryFilter): Event[] {
    if (category === "all") return events;
    const cat = CATEGORIES.find((c) => c.id === category);
    if (!cat) return events;
    return events.filter((e) => matchCategory(e, cat.keywords));
}

// ── AnimatedPressable ──────────────────────────────────────────────────────────
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ── Profile Avatar (header) ────────────────────────────────────────────────────
function HeaderProfileAvatar() {
    const profile = useProfileStore((s) => s.profile);
    const initials = profile?.displayName
        ? profile.displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
        : "ME";

    return (
        <Pressable
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/(tabs)/profile");
            }}
            style={styles.avatarRing}
        >
            {profile?.photoURL ? (
                <Image
                    source={{ uri: profile.photoURL }}
                    style={styles.avatarImage}
                    contentFit="cover"
                />
            ) : (
                <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
            )}
        </Pressable>
    );
}

// ── Hero slide card ────────────────────────────────────────────────────────────
function HeroSlide({ event }: { event: Event }) {
    const scale = useSharedValue(1);
    const img = getEventImage(event);
    const price = getLowestPrice(event);
    const isFree = price === 0;
    const isSoldOut = (event as any).soldOut ?? false;

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
                colors={["transparent", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.92)"]}
                locations={[0.35, 0.65, 1]}
                style={StyleSheet.absoluteFillObject}
            />
            {event.category && (
                <View style={styles.heroCatTag}>
                    <Text style={styles.heroCatTagText}>{event.category.toUpperCase()}</Text>
                </View>
            )}
            <View style={styles.heroContent}>
                <Text style={styles.heroTitle} numberOfLines={2}>{event.title}</Text>
                <Text style={styles.heroVenueLine} numberOfLines={1}>
                    {event.venue ?? event.location ?? "TBA"}
                    {event.startDate ? ` • ${formatEventDate(event.startDate)}` : ""}
                </Text>
                <View style={styles.heroFooter}>
                    <Text style={styles.heroPriceLabel}>
                        {isSoldOut ? "Sold Out" : (isFree ? "Free" : `₹${price.toLocaleString("en-IN")}`)}
                    </Text>
                    <Pressable
                        style={[styles.heroCtaBtn, isSoldOut && styles.heroCtaBtnSoldOut]}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            router.push({ pathname: "/event/[id]", params: { id: event.id } });
                        }}
                    >
                        <Text style={styles.heroCtaText}>{isSoldOut ? "Sold Out" : "Get Tickets"}</Text>
                    </Pressable>
                </View>
            </View>
        </AnimatedPressable>
    );
}

function FeaturedCarousel({ events }: { events: Event[] }) {
    if (!events.length) return null;
    return (
        <View style={styles.heroSection}>
            <FlatList bounces={false} overScrollMode="never"
                data={events}
                horizontal
                keyExtractor={(e) => e.id}
                snapToInterval={HERO_CARD_WIDTH + 12}
                decelerationRate="fast"
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.heroCarouselContent}
                renderItem={({ item }) => <HeroSlide event={item} />}
            />
        </View>
    );
}

// ── Category filter pills ─────────────────────────────────────────────────────
function CategoryFilterRow({ active, onChange }: { active: CategoryFilter; onChange: (v: CategoryFilter) => void }) {
    return (
        <ScrollView bounces={false} overScrollMode="never"
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catFilterContent}
            style={styles.catFilterRow}
        >
            {CATEGORY_FILTERS.map((f) => (
                <Pressable
                    key={f.id}
                    onPress={() => { Haptics.selectionAsync(); onChange(f.id); }}
                    style={[styles.catFilterPill, active === f.id && styles.catFilterPillActive]}
                >
                    <Text style={[styles.catFilterText, active === f.id && styles.catFilterTextActive]}>
                        {f.label}
                    </Text>
                </Pressable>
            ))}
        </ScrollView>
    );
}

// ── Date filter pills ─────────────────────────────────────────────────────────
function DateFilterRow({ active, onChange }: { active: DateFilter; onChange: (v: DateFilter) => void }) {
    return (
        <ScrollView bounces={false} overScrollMode="never" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRowContent}>
            {DATE_FILTERS.map((f) => (
                <Pressable
                    key={f.id}
                    onPress={() => { Haptics.selectionAsync(); onChange(f.id); }}
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

// ── For You / Similar to you — large card ─────────────────────────────────────
function LargeEventCard({ event, index }: { event: Event; index: number }) {
    const scale = useSharedValue(1);
    const heartScale = useSharedValue(1);
    const price = getLowestPrice(event);
    const isFree = price === 0;
    const img = getEventImage(event);
    const isSoldOut = (event as any).soldOut ?? false;

    const { user } = useAuth();
    const { likedEventIds, toggleInterest } = useEventInterestStore();
    const profile = useProfileStore((s) => s.profile);
    const isLiked = likedEventIds.has(event.id);

    const handleLike = () => {
        if (!user?.uid) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        heartScale.value = withSpring(1.4, { damping: 6 }, () => {
            heartScale.value = withSpring(1, { damping: 10 });
        });
        toggleInterest(event.id, user.uid, {
            displayName: profile?.displayName ?? "",
            photoURL: profile?.photoURL ?? null,
        });
    };

    return (
        <Animated.View
            entering={FadeInRight.delay(index * 50).springify().damping(18)}
            style={[useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] })), styles.largeCard]}
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
                {/* Full bleed image */}
                <View style={styles.largeCardImg}>
                    {img ? (
                        <Image source={{ uri: img }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={300} />
                    ) : (
                        <LinearGradient colors={["#2D1A14", "#0A0A0A"]} style={StyleSheet.absoluteFillObject} />
                    )}
                    <LinearGradient
                        colors={["transparent", "rgba(0,0,0,0.5)", "rgba(0,0,0,0.98)"]}
                        locations={[0.4, 0.7, 1]}
                        style={StyleSheet.absoluteFillObject}
                    />
                    {/* SOLD OUT banner */}
                    {isSoldOut && (
                        <View style={styles.largeCardSoldOut}>
                            <Text style={styles.largeCardSoldOutText}>SOLD OUT</Text>
                        </View>
                    )}
                    {/* Like button */}
                    <Animated.View style={[styles.likeBtn, useAnimatedStyle(() => ({ transform: [{ scale: heartScale.value }] }))]}>
                        <Pressable onPress={handleLike} hitSlop={10}>
                            <Text style={styles.likeBtnIcon}>{isLiked ? "❤️" : "🤍"}</Text>
                        </Pressable>
                    </Animated.View>

                    {/* Floating Info row */}
                    <View style={styles.largeCardBody}>
                        <Text style={styles.largeCardTitle} numberOfLines={1}>{event.title}</Text>
                        <Text style={styles.largeCardVenue} numberOfLines={1}>
                            {event.venue ?? event.location ?? ""}
                        </Text>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                            <Text style={styles.largeCardDate}>
                                {event.startDate ? formatEventDate(event.startDate) : ""}
                            </Text>
                            <Text style={styles.largeCardPrice}>
                                {isSoldOut ? "Sold Out" : (isFree ? "Free" : `₹${price.toLocaleString("en-IN")}`)}
                            </Text>
                        </View>
                    </View>
                </View>
            </AnimatedPressable>
        </Animated.View>
    );
}

// ── Grid card ─────────────────────────────────────────────────────────────────
function GridCard({ event, index }: { event: Event; index: number }) {
    const scale = useSharedValue(1);
    const heartScale = useSharedValue(1);
    const price = getLowestPrice(event);
    const isFree = price === 0;
    const img = getEventImage(event);
    const isSoldOut = (event as any).soldOut ?? false;

    const { user } = useAuth();
    const { likedEventIds, toggleInterest } = useEventInterestStore();
    const profile = useProfileStore((s) => s.profile);
    const isLiked = likedEventIds.has(event.id);

    const handleLike = () => {
        if (!user?.uid) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        heartScale.value = withSpring(1.4, { damping: 6 }, () => {
            heartScale.value = withSpring(1, { damping: 10 });
        });
        toggleInterest(event.id, user.uid, {
            displayName: profile?.displayName ?? "",
            photoURL: profile?.photoURL ?? null,
        });
    };

    return (
        <Animated.View
            entering={FadeInDown.delay(Math.min(index * 40, 200)).springify().damping(18)}
            style={[useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] })), styles.gridCard]}
        >
            <AnimatedPressable
                onPressIn={() => { scale.value = withSpring(0.96, { damping: 15, stiffness: 400 }); }}
                onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({ pathname: "/event/[id]", params: { id: event.id } });
                }}
                style={{ flex: 1 }}
            >
                <View style={styles.gridImgWrap}>
                    {img ? (
                        <Image source={{ uri: img }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={300} />
                    ) : (
                        <LinearGradient colors={["#2D1A14", "#0A0A0A"]} style={StyleSheet.absoluteFillObject} />
                    )}
                    <LinearGradient colors={["transparent", "rgba(0,0,0,0.6)", "rgba(0,0,0,0.98)"]} locations={[0.3, 0.7, 1]} style={StyleSheet.absoluteFillObject} />
                    {/* SOLD OUT overlay */}
                    {isSoldOut && (
                        <View style={styles.gridSoldOut}><Text style={styles.gridSoldOutText}>SOLD OUT</Text></View>
                    )}
                    {/* Like button */}
                    <Animated.View style={[styles.gridLikeBtn, useAnimatedStyle(() => ({ transform: [{ scale: heartScale.value }] }))]}>
                        <Pressable onPress={handleLike} hitSlop={10}>
                            <Text style={styles.gridLikeBtnIcon}>{isLiked ? "❤️" : "🤍"}</Text>
                        </Pressable>
                    </Animated.View>

                    {/* Floating Info */}
                    <View style={styles.gridBody}>
                        <Text style={styles.gridTitle} numberOfLines={2}>{event.title}</Text>
                        <Text style={styles.gridVenue} numberOfLines={1}>{event.venue ?? event.location ?? ""}</Text>
                        <View style={styles.gridFooter}>
                            <Text style={styles.gridDate}>{event.startDate ? formatEventDate(event.startDate) : ""}</Text>
                            <Text style={styles.gridPrice}>
                                {isSoldOut ? "Sold Out" : (isFree ? "Free" : `₹${price.toLocaleString("en-IN")}`)}
                            </Text>
                        </View>
                    </View>
                </View>
            </AnimatedPressable>
        </Animated.View>
    );
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({
    title,
    icon,
    onViewAll,
    viewAllLabel = "See All",
}: {
    title: string;
    icon?: string;
    onViewAll?: () => void;
    viewAllLabel?: string;
}) {
    return (
        <View style={styles.sectionHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {icon && <Text style={{ fontSize: 18 }}>{icon}</Text>}
                <Text style={styles.sectionTitle}>{title}</Text>
            </View>
            {onViewAll && (
                <Pressable onPress={onViewAll} hitSlop={8}>
                    <Text style={styles.viewAll}>{viewAllLabel}</Text>
                </Pressable>
            )}
        </View>
    );
}

// ── Map preview section ────────────────────────────────────────────────────────
function MapSection({ eventCount }: { eventCount: number }) {
    return (
        <View style={styles.section}>
            <SectionHeader
                title="Map"
                onViewAll={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push("/map");
                }}
                viewAllLabel="View →"
            />
            <Pressable
                style={styles.mapCard}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push("/map");
                }}
            >
                <MapView
                    style={StyleSheet.absoluteFillObject}
                    provider={PROVIDER_DEFAULT}
                    initialRegion={DEFAULT_MAP_REGION}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                    toolbarEnabled={false}
                    userInterfaceStyle="dark"
                />
                {/* Dark overlay so badge is readable */}
                <View style={styles.mapOverlay} />
                {/* Events nearby badge */}
                <View style={styles.mapBadge}>
                    <Text style={styles.mapBadgeText}>📍 {eventCount}+ events nearby</Text>
                </View>
            </Pressable>
        </View>
    );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function ExploreScreen() {
    const insets = useSafeAreaInsets();

    const { events, featuredEvents, loading, fetchEvents, fetchFeaturedEvents } = useEventsStore();
    const { recommendations, score, loadBrowsed } = useRecommendationsStore();
    const ticketsStore = useTicketsStore();
    const { user } = useAuth();
    const { loadUserInterests } = useEventInterestStore();

    const [dateFilter, setDateFilter]         = useState<DateFilter>("tonight");
    const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
    const [cityFilter, setCityFilter]         = useState("all");
    const [showCityModal, setShowCityModal]   = useState(false);
    const [isOffline, setIsOffline]           = useState(false);
    const [cachedEvents, setCachedEvents]     = useState<Event[]>([]);
    const [refreshing, setRefreshing]         = useState(false);
    const [showAllEvents, setShowAllEvents]   = useState(false);

    const allEvents = events.length > 0 ? events : cachedEvents;

    const cityOptions = useMemo(() => {
        const seen = new Map<string, string>();
        allEvents.forEach((e) => {
            const city = e.city ?? e.location ?? "";
            if (city) seen.set(city.toLowerCase(), city);
        });
        return [
            { value: "all", label: "Mumbai" },
            ...Array.from(seen.entries()).map(([, label]) => ({ value: label.toLowerCase(), label })),
        ];
    }, [allEvents]);

    const activeCityLabel = cityOptions.find((o) => o.value === cityFilter)?.label ?? "Mumbai";

    const heroSlides = useMemo(() => {
        const src = featuredEvents.length > 0 ? featuredEvents : allEvents;
        return [...src].sort((a, b) => getHeatScore(b) - getHeatScore(a)).slice(0, 6);
    }, [featuredEvents, allEvents]);

    const filteredEvents = useMemo(() => {
        let result = allEvents;
        if (cityFilter !== "all") {
            result = result.filter((e) => {
                const c = (e.city ?? e.location ?? "").toLowerCase();
                return c.includes(cityFilter);
            });
        }
        result = applyDateFilter(result, dateFilter);
        result = applyCategoryFilter(result, categoryFilter);
        return result;
    }, [allEvents, cityFilter, dateFilter, categoryFilter]);

    // "Similar to you" — events NOT in recommendations, by heat score
    const similarEvents = useMemo(() => {
        const recIds = new Set(recommendations.map((e) => e.id));
        return [...allEvents]
            .filter((e) => !recIds.has(e.id))
            .sort((a, b) => getHeatScore(b) - getHeatScore(a))
            .slice(0, 8);
    }, [allEvents, recommendations]);

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
        if (user?.uid) void loadUserInterests(user.uid);
    }, [user?.uid]);

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

    const gridEvents = showAllEvents ? filteredEvents : filteredEvents.slice(0, 8);
    const gridRows: Event[][] = [];
    for (let i = 0; i < gridEvents.length; i += 2) {
        gridRows.push(gridEvents.slice(i, i + 2));
    }

    const greeting = getGreeting();

    // ── Auto-hide tab bar on scroll ──────────────────────────────────────────
    const lastScrollY = useRef(0);
    const handleScroll = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            const y    = e.nativeEvent.contentOffset.y;
            const diff = y - lastScrollY.current;
            lastScrollY.current = y;

            if (y < 20) {
                // Always show at the very top
                DeviceEventEmitter.emit("tabBarScroll", { hide: false });
            } else if (diff > 8) {
                // Scrolling DOWN — hide
                DeviceEventEmitter.emit("tabBarScroll", { hide: true });
            } else if (diff < -8) {
                // Scrolling UP — show
                DeviceEventEmitter.emit("tabBarScroll", { hide: false });
            }
        },
        []
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <ScrollView bounces={false} overScrollMode="never" 
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={handleScroll}
                contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.iris} />
                }
            >
                {/* ── Header ── */}
                <View style={styles.header}>
                    <View style={styles.headerRow}>
                        {/* Left: greeting + location */}
                        <Pressable onPress={() => setShowCityModal(true)} style={styles.locationBlock}>
                            <Text style={styles.greetingText}>{greeting}</Text>
                            <View style={styles.cityRow}>
                                <Text style={styles.locationPin}>📍</Text>
                                <Text style={styles.cityName}>{activeCityLabel}</Text>
                                <Text style={styles.cityChevron}> ∨</Text>
                            </View>
                        </Pressable>

                        {/* Right: bell + profile avatar */}
                        <View style={styles.headerRight}>
                            <NotificationBell variant="solid" />
                            <HeaderProfileAvatar />
                        </View>
                    </View>

                    {/* Search bar */}
                    <Pressable
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.push("/search");
                        }}
                        style={styles.searchBar}
                    >
                        <Text style={styles.searchBarIcon}>🔍</Text>
                        <Text style={styles.searchBarPlaceholder}>Search events...</Text>
                    </Pressable>

                    {/* Date filter pills */}
                    <DateFilterRow active={dateFilter} onChange={setDateFilter} />
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

                {/* ── Featured Carousel ── */}
                {!isInitialLoading && heroSlides.length > 0 && (
                    <FeaturedCarousel events={heroSlides} />
                )}

                {/* ── Category filter pills ── */}
                {allEvents.length > 0 && (
                    <CategoryFilterRow active={categoryFilter} onChange={setCategoryFilter} />
                )}

                {/* ── For You ── */}
                {recommendations.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader
                            title="For You"
                            icon="✨"
                            onViewAll={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                router.push({ pathname: "/events/feed", params: { type: "foryou" } });
                            }}
                        />
                        <FlatList bounces={false} overScrollMode="never"
                            data={recommendations}
                            keyExtractor={(e) => e.id}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            snapToInterval={FOR_YOU_CARD_WIDTH + 12}
                            decelerationRate="fast"
                            contentContainerStyle={styles.largeCarouselContent}
                            renderItem={({ item, index }) => <LargeEventCard event={item} index={index} />}
                        />
                    </View>
                )}

                {/* ── Similar to you ── */}
                {similarEvents.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader
                            title="Similar to you"
                            icon="👥"
                            onViewAll={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                router.push({ pathname: "/events/feed", params: { type: "similar" } });
                            }}
                        />
                        <FlatList bounces={false} overScrollMode="never"
                            data={similarEvents}
                            keyExtractor={(e) => e.id}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            snapToInterval={FOR_YOU_CARD_WIDTH + 12}
                            decelerationRate="fast"
                            contentContainerStyle={styles.largeCarouselContent}
                            renderItem={({ item, index }) => <LargeEventCard event={item} index={index} />}
                        />
                    </View>
                )}

                {/* ── All Events grid ── */}
                {filteredEvents.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader
                            title="All Events"
                            icon="🪐"
                            onViewAll={
                                filteredEvents.length > 8 && !showAllEvents
                                    ? () => setShowAllEvents(true)
                                    : undefined
                            }
                            viewAllLabel="See All"
                        />
                        <View style={styles.gridContainer}>
                            {gridRows.map((row, ri) => (
                                <View key={ri} style={styles.gridRow}>
                                    {row.map((event, ci) => (
                                        <GridCard key={event.id} event={event} index={ri * 2 + ci} />
                                    ))}
                                    {row.length === 1 && <View style={styles.gridCard} />}
                                </View>
                            ))}
                        </View>
                        {filteredEvents.length > 8 && !showAllEvents && (
                            <Pressable style={styles.loadMoreBtn} onPress={() => setShowAllEvents(true)}>
                                <Text style={styles.loadMoreText}>
                                    Load More ({filteredEvents.length - 8} more)
                                </Text>
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

                {/* ── Map section ── */}
                {allEvents.length > 0 && (
                    <MapSection eventCount={allEvents.length > 31 ? 31 : allEvents.length} />
                )}

                {/* No content */}
                {!loading && allEvents.length === 0 && !isOffline && (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyEmoji}>🎪</Text>
                        <Text style={styles.emptyText}>No events yet</Text>
                        <Text style={styles.emptySubtext}>Pull down to refresh</Text>
                    </View>
                )}
            </ScrollView>

            {/* ── City Picker Modal ── */}
            <Modal
                visible={showCityModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowCityModal(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setShowCityModal(false)} />
                <View style={[styles.cityModal, { paddingBottom: insets.bottom + 16 }]}>
                    <View style={styles.cityModalHandle} />
                    <Text style={styles.cityModalTitle}>Choose City</Text>
                    <ScrollView bounces={false} overScrollMode="never" showsVerticalScrollIndicator={false}>
                        {cityOptions.map((opt) => (
                            <Pressable
                                key={opt.value}
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    setCityFilter(opt.value);
                                    setShowCityModal(false);
                                }}
                                style={styles.cityOption}
                            >
                                <Text
                                    style={[
                                        styles.cityOptionText,
                                        cityFilter === opt.value && styles.cityOptionTextActive,
                                    ]}
                                >
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
    container: { flex: 1, backgroundColor: PURE_BLACK },

    // ── Header ──────────────────────────────────────────────────────────────────
    header: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, gap: 12 },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    locationBlock: { flex: 1, gap: 2 },
    greetingText: { color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: "500" },
    cityRow: { flexDirection: "row", alignItems: "center" },
    locationPin: { fontSize: 16, marginRight: 4 },
    cityName: { color: "#FFFFFF", fontSize: 26, fontWeight: "800", letterSpacing: -0.6 },
    cityChevron: { color: "rgba(255,255,255,0.55)", fontSize: 18, fontWeight: "600", marginTop: 2 },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },

    // Profile avatar in header
    avatarRing: {
        width: 38,
        height: 38,
        borderRadius: 19,
        borderWidth: 2,
        borderColor: colors.iris,
        overflow: "hidden",
    },
    avatarImage: { width: "100%", height: "100%" },
    avatarFallback: {
        width: "100%",
        height: "100%",
        backgroundColor: colors.base[100],
        alignItems: "center",
        justifyContent: "center",
    },
    avatarInitials: { color: colors.gold, fontSize: 11, fontWeight: "700" },

    // ── Search bar ───────────────────────────────────────────────────────────────
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        paddingHorizontal: 14,
        paddingVertical: 13,
    },
    searchBarIcon: { fontSize: 15 },
    searchBarPlaceholder: { color: "rgba(255,255,255,0.38)", fontSize: 15, flex: 1 },

    // ── Date filter pills ────────────────────────────────────────────────────────
    filterRowContent: { gap: 8, paddingRight: 4 },
    filterPill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 100,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.09)",
    },
    filterPillActive: {
        backgroundColor: "rgba(244,74,34,0.16)",
        borderColor: "rgba(244,74,34,0.5)",
    },
    filterPillText: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "600" },
    filterPillTextActive: { color: "#F44A22" },

    // ── Offline / loading ────────────────────────────────────────────────────────
    offlineBanner: {
        marginHorizontal: 16, marginBottom: 8,
        paddingHorizontal: 14, paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: "rgba(255,170,0,0.1)",
        borderWidth: 1, borderColor: "rgba(255,170,0,0.25)",
    },
    offlineText: { color: "#FFAA00", fontSize: 13, fontWeight: "500" },
    loadingWrap: { paddingTop: 60, alignItems: "center", gap: 12 },
    loadingText: { color: "rgba(255,255,255,0.4)", fontSize: 14 },

    // ── Featured hero carousel ───────────────────────────────────────────────────
    heroSection: { marginTop: 16 },
    heroCarouselContent: { paddingHorizontal: 16, gap: 12 },
    heroSlide: {
        width: HERO_CARD_WIDTH,
        height: 330,
        borderRadius: 20,
        overflow: "hidden",
        position: "relative",
    },
    heroCatTag: {
        position: "absolute", top: 12, right: 12, zIndex: 2,
        backgroundColor: "rgba(255,255,255,0.18)",
        borderRadius: 6, paddingHorizontal: 9, paddingVertical: 3,
        borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
    },
    heroCatTagText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700", letterSpacing: 0.7 },
    heroContent: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, gap: 4 },
    heroTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "800", letterSpacing: -0.4, lineHeight: 28 },
    heroVenueLine: { color: "rgba(255,255,255,0.62)", fontSize: 12, fontWeight: "500", marginTop: 2 },
    heroFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
    heroPriceLabel: { color: "rgba(255,255,255,0.75)", fontSize: 15, fontWeight: "700" },
    heroCtaBtn: { backgroundColor: "#F44A22", borderRadius: 100, paddingHorizontal: 18, paddingVertical: 9 },
    heroCtaBtnSoldOut: { backgroundColor: "rgba(255,255,255,0.18)" },
    heroCtaText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800", letterSpacing: 0.2 },

    // ── Category filter pills ────────────────────────────────────────────────────
    catFilterRow: { marginTop: 20 },
    catFilterContent: { paddingHorizontal: 16, gap: 8 },
    catFilterPill: {
        paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100,
        backgroundColor: "rgba(255,255,255,0.07)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
    },
    catFilterPillActive: {
        backgroundColor: "rgba(255,255,255,0.14)",
        borderColor: "rgba(255,255,255,0.22)",
    },
    catFilterText: { color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: "600" },
    catFilterTextActive: { color: "#FFFFFF" },

    // ── Sections ─────────────────────────────────────────────────────────────────
    section: { marginTop: 28 },
    sectionHeader: {
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 16, marginBottom: 16,
    },
    sectionTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },
    viewAll: { color: "#F44A22", fontSize: 13, fontWeight: "700" },

    // ── Large cards (For You, Similar to you) ────────────────────────────────────
    largeCarouselContent: { paddingHorizontal: 16, gap: 12 },
    largeCard: {
        width: FOR_YOU_CARD_WIDTH,
        height: FOR_YOU_CARD_HEIGHT,
        borderRadius: 20,
        overflow: "hidden",
        backgroundColor: "rgba(255,255,255,0.04)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
    },
    largeCardImg: {
        flex: 1,
        position: "relative",
    },
    largeCardSoldOut: {
        position: "absolute",
        top: 8,
        left: 8,
        alignItems: "center",
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: "rgba(0,0,0,0.75)",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
    },
    largeCardSoldOutText: {
        color: "#F44A22",
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 1.0,
    },
    likeBtn: {
        position: "absolute",
        top: 8,
        right: 8,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "rgba(0,0,0,0.55)",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
    },
    likeBtnIcon: { fontSize: 16 },

    largeCardBody: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: 12,
        gap: 2,
    },
    largeCardTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "800", letterSpacing: -0.2 },
    largeCardVenue: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "600" },
    largeCardDate: { color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "600" },
    largeCardPrice: { color: "#F44A22", fontSize: 13, fontWeight: "800" },

    // ── Grid (All Events) ─────────────────────────────────────────────────────────
    gridContainer: { paddingHorizontal: 16, gap: 12 },
    gridRow: { flexDirection: "row", gap: 12 },
    gridCard: {
        width: GRID_CARD_WIDTH, height: GRID_CARD_HEIGHT, flex: 1, borderRadius: 20, overflow: "hidden",
        backgroundColor: "rgba(255,255,255,0.04)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
    },
    gridImgWrap: { flex: 1, position: "relative" },
    gridFreeBadge: {
        position: "absolute", bottom: 10, right: 10,
    },
    gridFreeBadgeText: { color: "#F44A22", fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
    gridSoldOut: {
        position: "absolute", top: 8, left: 8,
        alignItems: "center", paddingHorizontal: 6, paddingVertical: 3,
        backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 6,
        borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
    },
    gridSoldOutText: { color: "#F44A22", fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
    gridLikeBtn: {
        position: "absolute",
        top: 7,
        right: 7,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: "rgba(0,0,0,0.55)",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
    },
    gridLikeBtnIcon: { fontSize: 13 },
    gridBody: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 12, gap: 2 },
    gridTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", letterSpacing: -0.2 },
    gridVenue: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "600" },
    gridFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
    gridDate: { color: "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: "600" },
    gridPrice: { color: "#F44A22", fontSize: 12, fontWeight: "800" },

    // ── Load more ─────────────────────────────────────────────────────────────────
    loadMoreBtn: {
        marginHorizontal: 16, marginTop: 16, paddingVertical: 14,
        borderRadius: 100, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
        alignItems: "center",
    },
    loadMoreText: { color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "600" },

    // ── Map section ───────────────────────────────────────────────────────────────
    mapCard: {
        marginHorizontal: 16,
        height: 180,
        borderRadius: 20,
        overflow: "hidden",
        position: "relative",
    },
    mapOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.25)",
    },
    mapBadge: {
        position: "absolute",
        bottom: 16,
        alignSelf: "center",
        backgroundColor: "rgba(0,0,0,0.75)",
        borderRadius: 100,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
    },
    mapBadgeText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },

    // ── Empty state ───────────────────────────────────────────────────────────────
    emptyState: { alignItems: "center", paddingVertical: 60, gap: 8 },
    emptyEmoji: { fontSize: 40 },
    emptyText: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
    emptySubtext: { color: "rgba(255,255,255,0.4)", fontSize: 14 },

    // ── City modal ────────────────────────────────────────────────────────────────
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
