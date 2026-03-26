import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { FlashList } from "@shopify/flash-list";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    View,
    Text,
    ScrollView,
    FlatList,
    Pressable,
    TextInput,
    ActivityIndicator,
    RefreshControl,
    StyleSheet,
    Dimensions,
    Platform,
    type NativeSyntheticEvent,
    type NativeScrollEvent,
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
    withRepeat,
    withSequence,
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
import { safeDate, formatEventDate } from "@/lib/utils/date";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_CARD_WIDTH = SCREEN_WIDTH - 48;

// Animated Pressable
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const CarouselFlatList = FlatList as any;

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

    const formattedDate = formatEventDate(event.startDate);

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

    const formattedDate = formatEventDate(event.startDate);

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

// Pulse bar: live events indicator
function PulseBar({ liveCount, isTonight, topEventTitle }: { liveCount: number; isTonight: boolean; topEventTitle?: string }) {
    const pulseScale = useSharedValue(1);

    useEffect(() => {
        pulseScale.value = withRepeat(
            withSequence(
                withTiming(1.2, { duration: 700 }),
                withTiming(1, { duration: 700 })
            ),
            -1,
            true
        );
    }, []);

    const dotStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
    }));

    if (!isTonight && liveCount === 0) return null;

    return (
        <View style={styles.pulseBar}>
            <Animated.View style={[styles.pulseDot, dotStyle]} />
            <Text style={styles.pulseText}>
                {isTonight
                    ? topEventTitle
                        ? `Tonight: ${topEventTitle}`
                        : "What's on tonight"
                    : `${liveCount} ${liveCount === 1 ? "event" : "events"} happening now`
                }
            </Text>
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

const SORT_OPTIONS = ["Trending", "This Week", "New", "Soonest", "Price Low to High"] as const;
const DATE_OPTIONS = [
    { id: "any", label: "Any Date" },
    { id: "today", label: "Today" },
    { id: "weekend", label: "This Weekend" },
] as const;
const PRICE_OPTIONS = [
    { id: "all", label: "All Prices" },
    { id: "free", label: "Free RSVP" },
    { id: "paid", label: "Paid" },
] as const;

type SortOption = typeof SORT_OPTIONS[number];
type DateOption = typeof DATE_OPTIONS[number]["id"];
type PriceOption = typeof PRICE_OPTIONS[number]["id"];

const EXPLORE_PREFERENCES_KEY = "@explore_preferences";

type DerivedEvent = Event & {
    _searchHaystack: string;
    _parsedDate: Date | null;
    _parsedTime: number;
    _startingPrice: number;
    _cityValue: string;
    _cityLabel: string;
    _createdTime: number;
    _heatScore: number;
};

function normalizeLocationValue(value?: string) {
    return String(value || "other")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "other";
}

function getCityLabel(event: Event) {
    return String((event as any).cityLabel || event.city || event.location || event.venue || "Other Locations");
}

function getCityValue(event: Event) {
    return normalizeLocationValue(String((event as any).cityKey || event.city || event.location || event.venue || "other"));
}

function getStartingPrice(event: Event) {
    return event.tickets?.reduce((min, tier) =>
        tier.price < min ? tier.price : min,
        event.tickets[0]?.price || 0
    ) || 0;
}

function getCreatedTime(event: Event) {
    const rawValue = (event as any).createdAt;
    const parsed = safeDate(rawValue);
    return parsed?.getTime() ?? 0;
}

function getHeatScore(event: Event) {
    return Number(
        event.heatScore ??
        event.stats?.views ??
        event.stats?.rsvps ??
        event.stats?.shares ??
        0
    );
}

function isSameDay(left: Date, right: Date) {
    return (
        left.getFullYear() === right.getFullYear() &&
        left.getMonth() === right.getMonth() &&
        left.getDate() === right.getDate()
    );
}

function isWeekend(date: Date) {
    const day = date.getDay();
    return day === 0 || day === 6;
}

const sortComparators: Record<SortOption, (a: DerivedEvent, b: DerivedEvent) => number> = {
    Trending: (a, b) => b._heatScore - a._heatScore,
    "This Week": (a, b) => {
        const now = Date.now();
        const weekAhead = now + 7 * 24 * 60 * 60 * 1000;
        const aInWeek = a._parsedTime >= now && a._parsedTime <= weekAhead;
        const bInWeek = b._parsedTime >= now && b._parsedTime <= weekAhead;
        if (aInWeek && !bInWeek) return -1;
        if (!aInWeek && bInWeek) return 1;
        return a._parsedTime - b._parsedTime;
    },
    New: (a, b) => b._createdTime - a._createdTime,
    Soonest: (a, b) => a._parsedTime - b._parsedTime,
    "Price Low to High": (a, b) => a._startingPrice - b._startingPrice,
};

function FilterPill({
    label,
    isActive,
    onPress,
}: {
    label: string;
    isActive: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable onPress={onPress}>
            <View style={[styles.filterPill, isActive && styles.filterPillActive]}>
                <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                    {label}
                </Text>
            </View>
        </Pressable>
    );
}

export default function ExploreScreen() {
    const { events, featuredEvents, loading, error, hasMore, fetchEvents, fetchFeaturedEvents, loadMoreEvents } = useEventsStore();
    const insets = useSafeAreaInsets();

    const [searchQuery, setSearchQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState("all");
    const [activeSort, setActiveSort] = useState<SortOption>("Trending");
    const [activeCity, setActiveCity] = useState("all");
    const [activeDate, setActiveDate] = useState<DateOption>("any");
    const [activePrice, setActivePrice] = useState<PriceOption>("all");
    const [isOffline, setIsOffline] = useState(false);
    const [cachedEvents, setCachedEvents] = useState<Event[]>([]);
    const [lastSync, setLastSync] = useState<Date | null>(null);
    const [carouselIndex, setCarouselIndex] = useState(0);
    const [loadingMore, setLoadingMore] = useState(false);
    const carouselRef = useRef<FlatList>(null);
    const preferencesLoadedRef = useRef(false);

    useEffect(() => {
        trackScreen("Explore");
        void restorePreferences();
        void loadData();
    }, []);

    const restorePreferences = async () => {
        try {
            const stored = await AsyncStorage.getItem(EXPLORE_PREFERENCES_KEY);
            if (!stored) {
                return;
            }

            const parsed = JSON.parse(stored) as Partial<{
                activeCategory: string;
                activeSort: SortOption;
                activeCity: string;
                activeDate: DateOption;
                activePrice: PriceOption;
            }>;

            if (parsed.activeCategory) setActiveCategory(parsed.activeCategory);
            if (parsed.activeSort && SORT_OPTIONS.includes(parsed.activeSort)) setActiveSort(parsed.activeSort);
            if (parsed.activeCity) setActiveCity(parsed.activeCity);
            if (parsed.activeDate && DATE_OPTIONS.some((option) => option.id === parsed.activeDate)) setActiveDate(parsed.activeDate);
            if (parsed.activePrice && PRICE_OPTIONS.some((option) => option.id === parsed.activePrice)) setActivePrice(parsed.activePrice);
        } catch (error) {
            console.error("Failed to restore explore preferences:", error);
        } finally {
            preferencesLoadedRef.current = true;
        }
    };

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
                setLastSync(new Date());
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

    const sourceEvents = useMemo(() => (
        events.length > 0 ? events : cachedEvents
    ), [events, cachedEvents]);

    const cityOptions = useMemo(() => {
        const counts = new Map<string, { value: string; label: string; count: number }>();

        sourceEvents.forEach((event) => {
            const value = getCityValue(event);
            const label = getCityLabel(event);
            const existing = counts.get(value);
            counts.set(value, {
                value,
                label,
                count: (existing?.count || 0) + 1,
            });
        });

        return [
            { value: "all", label: "All Locations", count: sourceEvents.length },
            ...Array.from(counts.values()).sort((a, b) => b.count - a.count),
        ];
    }, [sourceEvents]);

    useEffect(() => {
        if (!cityOptions.some((option) => option.value === activeCity)) {
            setActiveCity("all");
        }
    }, [cityOptions, activeCity]);

    useEffect(() => {
        if (!preferencesLoadedRef.current) {
            return;
        }

        void AsyncStorage.setItem(
            EXPLORE_PREFERENCES_KEY,
            JSON.stringify({
                activeCategory,
                activeSort,
                activeCity,
                activeDate,
                activePrice,
            })
        ).catch((error) => {
            console.error("Failed to save explore preferences:", error);
        });
    }, [activeCategory, activeSort, activeCity, activeDate, activePrice]);

    const processedEvents = useMemo<DerivedEvent[]>(() => (
        sourceEvents.map((event) => {
            const parsedDate = safeDate(event.startDate);
            const searchHaystack = [
                event.title,
                event.description,
                event.venue,
                event.location,
                event.city,
                event.hostName,
                ...(event.tags || []),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return {
                ...event,
                _searchHaystack: searchHaystack,
                _parsedDate: parsedDate,
                _parsedTime: parsedDate?.getTime() ?? Number.MAX_SAFE_INTEGER,
                _startingPrice: getStartingPrice(event),
                _cityValue: getCityValue(event),
                _cityLabel: getCityLabel(event),
                _createdTime: getCreatedTime(event),
                _heatScore: getHeatScore(event),
            };
        })
    ), [sourceEvents]);

    const filteredEvents = useMemo(() => {
        const now = new Date();
        const comparator = sortComparators[activeSort] || sortComparators.Trending;
        const query = searchQuery.trim().toLowerCase();

        return [...processedEvents]
            .filter((event) => {
                const endDate = safeDate(event.endDate || event.startDate);
                if (endDate && endDate < now) return false;

                if (activeCategory !== "all") {
                    const matchesCategory =
                        event.category?.toLowerCase() === activeCategory ||
                        event.type?.toLowerCase() === activeCategory ||
                        event.tags?.some((tag) => tag.toLowerCase() === activeCategory);
                    if (!matchesCategory) return false;
                }

                if (activeCity !== "all" && event._cityValue !== activeCity) {
                    return false;
                }

                if (activePrice === "free" && event._startingPrice > 0) {
                    return false;
                }

                if (activePrice === "paid" && event._startingPrice <= 0) {
                    return false;
                }

                if (activeDate !== "any" && event._parsedDate) {
                    if (activeDate === "today" && !isSameDay(event._parsedDate, now)) {
                        return false;
                    }
                    if (activeDate === "weekend" && !isWeekend(event._parsedDate)) {
                        return false;
                    }
                }

                if (query && !event._searchHaystack.includes(query)) {
                    return false;
                }

                return true;
            })
            .sort(comparator);
    }, [processedEvents, activeCategory, activeCity, activePrice, activeDate, activeSort, searchQuery]);

    // Group events
    const displayEvents = useMemo(() => {
        const now = new Date();
        const thisWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const filteredFeatured = [...filteredEvents].sort(sortComparators.Trending).slice(0, 5);

        return {
            featured: filteredFeatured,
            thisWeek: filteredEvents.filter((e) => {
                const date = e._parsedDate;
                return date !== null && date >= now && date <= thisWeek;
            }).slice(0, 5),
            upcoming: filteredEvents,
        };
    }, [filteredEvents]);

    // Count live events (status === "live" or startDate is today)
    const liveCount = useMemo(() => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart.getTime() + 86_400_000);
        return sourceEvents.filter((e) => {
            if ((e as any).status === "live") return true;
            const d = safeDate(e.startDate);
            return d !== null && d >= todayStart && d < todayEnd;
        }).length;
    }, [sourceEvents]);

    // "Tonight" mode: after 6 PM, surface top tonight event
    const isTonightMode = new Date().getHours() >= 18;
    const topTonightEvent = useMemo(() => {
        if (!isTonightMode) return undefined;
        const now = new Date();
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const tonight = sourceEvents.filter((e) => {
            const d = safeDate(e.startDate);
            return d !== null && d >= now && d < midnight;
        });
        // Return the one with the highest heatScore (or first)
        return tonight.sort((a, b) => ((b as any).heatScore ?? 0) - ((a as any).heatScore ?? 0))[0]?.title;
    }, [sourceEvents, isTonightMode]);

    // Auto-advance hero carousel every 5 seconds
    useEffect(() => {
        if (displayEvents.featured.length <= 1) return;
        const interval = setInterval(() => {
            setCarouselIndex((prev) => {
                const next = (prev + 1) % displayEvents.featured.length;
                carouselRef.current?.scrollToIndex({ index: next, animated: true });
                return next;
            });
        }, 5000);
        return () => clearInterval(interval);
    }, [displayEvents.featured.length]);

    const hasActiveFilters =
        !!searchQuery.trim() ||
        activeCategory !== "all" ||
        activeCity !== "all" ||
        activeDate !== "any" ||
        activePrice !== "all";
    const showNoResults = !loading && filteredEvents.length === 0 && hasActiveFilters;
    const showEmpty = !loading && events.length === 0 && cachedEvents.length === 0 && !hasActiveFilters;
    const activeCityLabel = cityOptions.find((option) => option.value === activeCity)?.label || "all locations";

    const resetFilters = () => {
        setSearchQuery("");
        setActiveCategory("all");
        setActiveSort("Trending");
        setActiveCity("all");
        setActiveDate("any");
        setActivePrice("all");
    };

    const handleLoadMore = useCallback(async () => {
        if (!hasMore || loadingMore) {
            return;
        }

        setLoadingMore(true);
        try {
            await loadMoreEvents();
            const store = useEventsStore.getState();
            if (store.events.length > 0) {
                await cacheEvents(store.events);
                await updateLastSyncTime();
                setLastSync(new Date());
            }
        } finally {
            setLoadingMore(false);
        }
    }, [hasMore, loadingMore, loadMoreEvents]);

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
                                {activeCity === "all"
                                    ? "Discover events across locations"
                                    : `What's on in ${activeCityLabel}`}
                            </Text>
                        </View>

                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            {isOffline && (
                                <View style={styles.offlineBadge}>
                                    <Text style={styles.offlineText}>Offline</Text>
                                </View>
                            )}
                            <Pressable
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    router.push("/map" as any);
                                }}
                                style={styles.mapButton}
                            >
                                <Text style={styles.mapButtonText}>🗺️</Text>
                            </Pressable>
                            <NotificationBell variant="solid" />
                        </View>
                    </View>

                    {/* Live events pulse indicator */}
                    <PulseBar liveCount={liveCount} isTonight={isTonightMode} topEventTitle={topTonightEvent} />

                    {/* Search */}
                    <SearchBar
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onClear={() => setSearchQuery("")}
                    />

                    <View style={styles.filterStack}>
                        <View style={styles.filterRowHeader}>
                            <Text style={styles.filterLabel}>Sort</Text>
                            {(activeCity !== "all" || activeDate !== "any" || activePrice !== "all" || activeCategory !== "all" || searchQuery.trim()) && (
                                <Pressable onPress={resetFilters}>
                                    <Text style={styles.filterResetText}>Reset</Text>
                                </Pressable>
                            )}
                        </View>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.filterRow}
                        >
                            {SORT_OPTIONS.map((sort) => (
                                <FilterPill
                                    key={sort}
                                    label={sort}
                                    isActive={activeSort === sort}
                                    onPress={() => setActiveSort(sort)}
                                />
                            ))}
                        </ScrollView>

                        <Text style={styles.filterLabel}>Locations</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.filterRow}
                        >
                            {cityOptions.map((option) => (
                                <FilterPill
                                    key={option.value}
                                    label={`${option.label} (${option.count})`}
                                    isActive={activeCity === option.value}
                                    onPress={() => setActiveCity(option.value)}
                                />
                            ))}
                        </ScrollView>

                        <Text style={styles.filterLabel}>When</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.filterRow}
                        >
                            {DATE_OPTIONS.map((option) => (
                                <FilterPill
                                    key={option.id}
                                    label={option.label}
                                    isActive={activeDate === option.id}
                                    onPress={() => setActiveDate(option.id)}
                                />
                            ))}
                        </ScrollView>

                        <Text style={styles.filterLabel}>Price</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.filterRow}
                        >
                            {PRICE_OPTIONS.map((option) => (
                                <FilterPill
                                    key={option.id}
                                    label={option.label}
                                    isActive={activePrice === option.id}
                                    onPress={() => setActivePrice(option.id)}
                                />
                            ))}
                        </ScrollView>
                    </View>

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
                        message={
                            searchQuery.trim()
                                ? `No events match "${searchQuery}"`
                                : "No events match your current filters"
                        }
                        actionLabel="Reset Filters"
                        onAction={resetFilters}
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

                {/* Featured Carousel — auto-advances every 5s */}
                {!searchQuery && displayEvents.featured.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader title="Featured" emoji="🔥" />
                        <CarouselFlatList
                            ref={carouselRef}
                            data={displayEvents.featured}
                            keyExtractor={(e: Event) => e.id}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            pagingEnabled={false}
                            snapToInterval={HERO_CARD_WIDTH + 16}
                            decelerationRate="fast"
                            contentContainerStyle={styles.heroCarousel}
                            renderItem={({ item, index }: { item: Event; index: number }) => (
                                <HeroEventCard event={item} index={index} />
                            )}
                            onScrollToIndexFailed={() => {}}
                            onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                                const idx = Math.round(
                                    e.nativeEvent.contentOffset.x / (HERO_CARD_WIDTH + 16)
                                );
                                setCarouselIndex(idx);
                            }}
                        />
                        {/* Pagination dots */}
                        {displayEvents.featured.length > 1 && (
                            <View style={styles.carouselDots}>
                                {displayEvents.featured.map((_, i) => (
                                    <View
                                        key={i}
                                        style={[styles.carouselDot, i === carouselIndex && styles.carouselDotActive]}
                                    />
                                ))}
                            </View>
                        )}
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

                {/* All Events — FlashList for smooth performance */}
                {(searchQuery ? filteredEvents : displayEvents.upcoming).length > 0 && (
                    <View style={[styles.section, { minHeight: 300 }]}>
                        <SectionHeader
                            title={searchQuery ? `Results (${filteredEvents.length})` : "All Events"}
                            emoji={searchQuery ? undefined : "🎭"}
                            action={!searchQuery ? {
                                label: "Map View",
                                onPress: () => router.push("/map" as any),
                            } : undefined}
                        />
                        <FlashList
                            data={searchQuery ? filteredEvents : displayEvents.upcoming}
                            keyExtractor={(e) => e.id}
                            estimatedItemSize={120}
                            renderItem={({ item, index }) => (
                                <EventListCard event={item} index={index} />
                            )}
                            scrollEnabled={false}
                        />
                        {hasMore ? (
                            <Pressable
                                onPress={() => {
                                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    void handleLoadMore();
                                }}
                                style={styles.loadMoreButton}
                            >
                                <Text style={styles.loadMoreButtonText}>
                                    {loadingMore ? "Loading More..." : "Load More Events"}
                                </Text>
                            </Pressable>
                        ) : null}
                    </View>
                )}

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
    // Pulse bar
    pulseBar: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
    },
    pulseDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#4CAF50",
        shadowColor: "#4CAF50",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
    },
    pulseText: {
        color: "#4CAF50",
        fontSize: 13,
        fontWeight: "600",
    },

    // Carousel dots
    carouselDots: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 6,
        marginTop: 12,
    },
    carouselDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: "rgba(255,255,255,0.25)",
    },
    carouselDotActive: {
        backgroundColor: colors.iris,
        width: 16,
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

    filterStack: {
        marginBottom: 8,
    },
    filterRowHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    filterLabel: {
        color: colors.goldMetallic,
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 1.2,
        textTransform: "uppercase",
        marginBottom: 8,
    },
    filterResetText: {
        color: colors.iris,
        fontSize: 13,
        fontWeight: "600",
    },
    filterRow: {
        paddingRight: 20,
        marginBottom: 12,
    },
    filterPill: {
        backgroundColor: colors.base[50],
        borderRadius: radii.pill,
        paddingVertical: 9,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: colors.base[200],
        marginRight: 8,
    },
    filterPillActive: {
        backgroundColor: "rgba(244, 74, 34, 0.18)",
        borderColor: "rgba(244, 74, 34, 0.45)",
    },
    filterPillText: {
        color: colors.goldMetallic,
        fontSize: 13,
        fontWeight: "600",
    },
    filterPillTextActive: {
        color: colors.gold,
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
    loadMoreButton: {
        marginTop: 14,
        alignSelf: "center",
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        backgroundColor: "rgba(255,255,255,0.05)",
    },
    loadMoreButtonText: {
        color: colors.gold,
        fontSize: 12,
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 0.7,
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
    mapButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.base[50],
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
        alignItems: "center" as const,
        justifyContent: "center" as const,
    },
    mapButtonText: {
        fontSize: 18,
    },
});
