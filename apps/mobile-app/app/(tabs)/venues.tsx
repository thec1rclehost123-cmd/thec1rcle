/**
 * venues.tsx
 * Two-tab screen: Venues | Hosts
 * 2-column poster grid (BookMyShow-style), search bar, no filter chips.
 */
import { useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    TextInput,
    FlatList,
    RefreshControl,
    Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Search, X, MapPin, Building2, Users, Heart } from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { colors } from "@/lib/design/theme";
import { useVenuesStore, Venue } from "@/store/venuesStore";
import { useEventsStore } from "@/store/eventsStore";
import { useFollowStore } from "@/store/followStore";
import { useAuth } from "@/hooks/useAuth";
import { getVenueDisplayName, getVenueLocationLabel, formatCompactCount } from "@/lib/venueDiscovery";

const { width: SCREEN_W } = Dimensions.get("window");
const H_PAD = 16;
const COL_GAP = 10;
const CARD_W = (SCREEN_W - H_PAD * 2 - COL_GAP) / 2;
const CARD_H = CARD_W * 1.45;

type Tab = "venues" | "hosts";

interface DerivedHost {
    id: string;
    name: string;
    photoURL?: string;
    eventsCount: number;
}

// ── Poster card ───────────────────────────────────────────────────────────────
function PosterCard({
    imageUrl,
    title,
    subtitle,
    badge,
    index,
    onPress,
    onFollow,
    isFollowed,
}: {
    imageUrl?: string | null;
    title: string;
    subtitle?: string;
    badge?: string;
    index: number;
    onPress: () => void;
    onFollow?: () => void;
    isFollowed?: boolean;
}) {
    return (
        <Animated.View
            entering={FadeInDown.delay(Math.min(index * 40, 240)).springify().damping(18)}
            style={styles.posterCard}
        >
            <Pressable
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onPress();
                }}
                style={{ flex: 1 }}
            >
                {/* Image */}
                <View style={styles.posterImgWrap}>
                    {imageUrl ? (
                        <Image
                            source={{ uri: imageUrl }}
                            style={StyleSheet.absoluteFillObject}
                            contentFit="cover"
                            transition={300}
                        />
                    ) : (
                        <LinearGradient
                            colors={["#1E1E22", "#111113"]}
                            style={StyleSheet.absoluteFillObject}
                        />
                    )}
                    {/* Gradient scrim */}
                    <LinearGradient
                        colors={["transparent", "rgba(0,0,0,0.72)", "rgba(0,0,0,0.94)"]}
                        locations={[0.45, 0.78, 1]}
                        style={StyleSheet.absoluteFillObject}
                    />
                    {/* Badge top-right */}
                    {badge && (
                        <View style={styles.posterBadge}>
                            <Text style={styles.posterBadgeText}>{badge}</Text>
                        </View>
                    )}
                    {/* Follow button top-left */}
                    {onFollow && (
                        <Pressable
                            style={[styles.posterFollowBtn, isFollowed && styles.posterFollowBtnActive]}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                onFollow();
                            }}
                            hitSlop={8}
                        >
                            <Heart
                                size={13}
                                color={isFollowed ? "#F44A22" : "#fff"}
                                fill={isFollowed ? "#F44A22" : "none"}
                                strokeWidth={2}
                            />
                        </Pressable>
                    )}
                </View>

                {/* Info below image */}
                <View style={styles.posterInfo}>
                    <Text style={styles.posterTitle} numberOfLines={2}>{title}</Text>
                    {subtitle ? (
                        <Text style={styles.posterSubtitle} numberOfLines={1}>{subtitle}</Text>
                    ) : null}
                </View>
            </Pressable>
        </Animated.View>
    );
}

function PosterSkeleton() {
    return (
        <View style={[styles.posterCard, styles.posterSkeleton]} />
    );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function VenuesTab() {
    const insets = useSafeAreaInsets();
    const { venues, loading: venuesLoading, fetchVenues } = useVenuesStore();
    const { events } = useEventsStore();
    const { user } = useAuth();
    const { isFollowingVenue, isFollowingHost, toggleVenueFollow, toggleHostFollow, fetchFollows, loaded } = useFollowStore();

    const [activeTab, setActiveTab] = useState<Tab>("venues");
    const [search, setSearch] = useState("");
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => { void fetchVenues(); }, []);
    useEffect(() => {
        if (user?.uid && !loaded) void fetchFollows(user.uid);
    }, [user?.uid, loaded, fetchFollows]);

    // Derive hosts from events — unique by hostName, sort by event count
    const hosts = useMemo<DerivedHost[]>(() => {
        const map = new Map<string, DerivedHost>();
        events.forEach((e) => {
            if (!e.hostName) return;
            const key = e.hostId ?? e.hostName;
            const existing = map.get(key);
            if (existing) {
                existing.eventsCount += 1;
            } else {
                map.set(key, {
                    id: key,
                    name: e.hostName,
                    photoURL: undefined,
                    eventsCount: 1,
                });
            }
        });
        return [...map.values()].sort((a, b) => b.eventsCount - a.eventsCount);
    }, [events]);

    const filteredVenues = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return venues;
        return venues.filter((v) => {
            const hay = [v.displayName, v.name, v.neighborhood, v.area, v.city, ...(v.tags ?? [])]
                .filter(Boolean).join(" ").toLowerCase();
            return hay.includes(q);
        });
    }, [venues, search]);

    const filteredHosts = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return hosts;
        return hosts.filter((h) => h.name.toLowerCase().includes(q));
    }, [hosts, search]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchVenues();
        setRefreshing(false);
    };

    // Build pairs for 2-column layout
    const venuePairs = useMemo(() => {
        const rows: Venue[][] = [];
        for (let i = 0; i < filteredVenues.length; i += 2) {
            rows.push(filteredVenues.slice(i, i + 2));
        }
        return rows;
    }, [filteredVenues]);

    const hostPairs = useMemo(() => {
        const rows: DerivedHost[][] = [];
        for (let i = 0; i < filteredHosts.length; i += 2) {
            rows.push(filteredHosts.slice(i, i + 2));
        }
        return rows;
    }, [filteredHosts]);

    const isLoading = venuesLoading && venues.length === 0;
    const count = activeTab === "venues" ? filteredVenues.length : filteredHosts.length;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* ── Header ── */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerLabel}>DISCOVER</Text>
                    <Text style={styles.headerTitle}>
                        {activeTab === "venues" ? "Venues" : "Hosts"}
                    </Text>
                    <Text style={styles.headerMeta}>{count} {activeTab === "venues" ? "places" : "organisers"}</Text>
                </View>
                <Pressable
                    onPress={() => router.push({ pathname: "/map", params: { mode: "venues" } })}
                    style={styles.mapBtn}
                >
                    <MapPin size={18} color="#fff" strokeWidth={2} />
                </Pressable>
            </View>

            {/* ── Segment control ── */}
            <View style={styles.segmentWrap}>
                <View style={styles.segmentTrack}>
                    {(["venues", "hosts"] as Tab[]).map((tab) => {
                        const isActive = activeTab === tab;
                        const Icon = tab === "venues" ? Building2 : Users;
                        return (
                            <Pressable
                                key={tab}
                                style={[
                                    styles.segmentPill,
                                    isActive && styles.segmentPillActive,
                                ]}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setActiveTab(tab);
                                    setSearch("");
                                }}
                            >
                                <Icon
                                    size={14}
                                    color={isActive ? "#fff" : "rgba(255,255,255,0.36)"}
                                    strokeWidth={isActive ? 2.2 : 1.8}
                                />
                                <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                                    {tab === "venues" ? "Venues" : "Hosts"}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            </View>

            {/* ── Search ── */}
            <View style={styles.searchWrap}>
                <Search size={17} color="rgba(255,255,255,0.35)" strokeWidth={2} />
                <TextInput
                    style={styles.searchInput}
                    placeholder={activeTab === "venues" ? "Search venues, area…" : "Search hosts…"}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={search}
                    onChangeText={setSearch}
                    returnKeyType="search"
                />
                {search.length > 0 && (
                    <Pressable onPress={() => setSearch("")} hitSlop={8}>
                        <X size={16} color="rgba(255,255,255,0.35)" strokeWidth={2} />
                    </Pressable>
                )}
            </View>

            {/* ── Grid ── */}
            {isLoading ? (
                <View style={styles.skeletonGrid}>
                    {[0, 1, 2, 3].map((i) => <PosterSkeleton key={i} />)}
                </View>
            ) : (
                <FlatList bounces={false} overScrollMode="never"
                    data={activeTab === "venues" ? venuePairs : hostPairs}
                    keyExtractor={(_, i) => String(i)}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.gridContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.iris} />
                    }
                    renderItem={({ item: row, index: rowIdx }) => (
                        <View style={styles.gridRow}>
                            {activeTab === "venues"
                                ? (row as Venue[]).map((venue, col) => {
                                    const img = venue.coverImage || venue.coverURL || venue.bannerImage || venue.photoURL || venue.image;
                                    const name = getVenueDisplayName(venue);
                                    const area = getVenueLocationLabel(venue);
                                    const badge = venue.upcomingEventsCount
                                        ? `${venue.upcomingEventsCount} events`
                                        : venue.venueType ?? undefined;
                                    return (
                                        <PosterCard
                                            key={venue.id}
                                            imageUrl={img}
                                            title={name}
                                            subtitle={area ?? undefined}
                                            badge={badge}
                                            index={rowIdx * 2 + col}
                                            onPress={() => router.push(`/venue/${venue.slug || venue.id}` as never)}
                                            isFollowed={isFollowingVenue(venue.id)}
                                            onFollow={() => {
                                                if (!user?.uid) return;
                                                void toggleVenueFollow(venue.id, name, user.uid);
                                            }}
                                        />
                                    );
                                })
                                : (row as DerivedHost[]).map((host, col) => (
                                    <PosterCard
                                        key={host.id}
                                        imageUrl={host.photoURL}
                                        title={host.name}
                                        subtitle={`${host.eventsCount} event${host.eventsCount !== 1 ? "s" : ""}`}
                                        badge="HOST"
                                        index={rowIdx * 2 + col}
                                        onPress={() => {}}
                                        isFollowed={isFollowingHost(host.id)}
                                        onFollow={() => {
                                            if (!user?.uid) return;
                                            void toggleHostFollow(host.id, host.name, user.uid);
                                        }}
                                    />
                                ))
                            }
                            {/* Fill empty last cell if odd count */}
                            {row.length === 1 && <View style={styles.posterCard} />}
                        </View>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyIcon}>
                                {activeTab === "venues" ? "🏛️" : "🎧"}
                            </Text>
                            <Text style={styles.emptyTitle}>
                                {search ? "No results found" : activeTab === "venues" ? "No venues yet" : "No hosts yet"}
                            </Text>
                            <Text style={styles.emptyBody}>
                                {search
                                    ? `No ${activeTab} match "${search}"`
                                    : "Check back soon"}
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0A0A0B",
    },

    // Header
    header: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 14,
    },
    headerLabel: {
        color: colors.iris,
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 2,
        textTransform: "uppercase",
    },
    headerTitle: {
        color: "#fff",
        fontSize: 32,
        fontWeight: "900",
        letterSpacing: 0,
        marginTop: 2,
        textTransform: "uppercase",
    },
    headerMeta: {
        color: "rgba(255,255,255,0.35)",
        fontSize: 12,
        fontWeight: "500",
        marginTop: 4,
    },
    mapBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: "rgba(255,255,255,0.07)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        alignItems: "center",
        justifyContent: "center",
    },

    // Segment control
    segmentWrap: {
        paddingHorizontal: 16,
        marginBottom: 14,
    },
    segmentTrack: {
        flexDirection: "row",
        backgroundColor: "#161618",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.07)",
        padding: 4,
        gap: 4,
    },
    segmentPill: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 12,
        borderRadius: 11,
    },
    segmentPillActive: {
        backgroundColor: "#F44A22",
        shadowColor: "#F44A22",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 5,
    },
    segmentText: {
        color: "rgba(255,255,255,0.38)",
        fontSize: 13,
        fontWeight: "600",
        letterSpacing: 0.1,
    },
    segmentTextActive: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 13,
    },

    // Search
    searchWrap: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginHorizontal: 16,
        marginBottom: 16,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    searchInput: {
        flex: 1,
        color: "#fff",
        fontSize: 14,
        fontWeight: "500",
        padding: 0,
    },

    // Grid
    gridContent: {
        paddingHorizontal: H_PAD,
        paddingBottom: 120,
        gap: COL_GAP,
    },
    gridRow: {
        flexDirection: "row",
        gap: COL_GAP,
    },

    // Poster card
    posterCard: {
        width: CARD_W,
        height: CARD_H,
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor: "rgba(255,255,255,0.04)",
    },
    posterSkeleton: {
        opacity: 0.4,
    },
    posterImgWrap: {
        flex: 1,
        position: "relative",
    },
    posterFollowBtn: {
        position: "absolute",
        top: 10,
        left: 10,
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: "rgba(0,0,0,0.45)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
        alignItems: "center",
        justifyContent: "center",
    },
    posterFollowBtnActive: {
        backgroundColor: "rgba(244,74,34,0.18)",
        borderColor: "rgba(244,74,34,0.45)",
    },
    posterBadge: {
        position: "absolute",
        top: 10,
        right: 10,
        backgroundColor: "rgba(244,74,34,0.85)",
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    posterBadgeText: {
        color: "#fff",
        fontSize: 9,
        fontWeight: "800",
        letterSpacing: 0.5,
        textTransform: "uppercase",
    },
    posterInfo: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: 12,
    },
    posterTitle: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "800",
        letterSpacing: 0,
        lineHeight: 17,
    },
    posterSubtitle: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 11,
        fontWeight: "500",
        marginTop: 3,
    },

    // Skeleton grid
    skeletonGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: COL_GAP,
        paddingHorizontal: H_PAD,
    },

    // Empty state
    emptyState: {
        alignItems: "center",
        paddingTop: 60,
        paddingHorizontal: 32,
    },
    emptyIcon: {
        fontSize: 52,
        marginBottom: 16,
    },
    emptyTitle: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 17,
        fontWeight: "700",
        marginBottom: 8,
        textAlign: "center",
    },
    emptyBody: {
        color: "rgba(255,255,255,0.3)",
        fontSize: 13,
        textAlign: "center",
        lineHeight: 19,
    },
});
