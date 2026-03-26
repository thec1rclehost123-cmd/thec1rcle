import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Linking,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { colors, radii } from "@/lib/design/theme";
import { EventCard } from "@/components/ui/EventCard";
import { PremiumButton } from "@/components/ui/PremiumButton";
import { getFacilityEmoji, type VenueHighlight, useVenuePageStore } from "@/store/venuePageStore";
import { formatCompactCount } from "@/lib/venueDiscovery";

const AnyFlatList = FlatList as any;

export default function VenuePageScreen() {
    const { id } = useLocalSearchParams<{ id?: string }>();
    const insets = useSafeAreaInsets();
    const {
        venue,
        highlights,
        gallery,
        menu,
        facilities,
        upcomingEvents,
        loading,
        error,
        fetchVenuePage,
        clearVenuePage,
    } = useVenuePageStore();

    const [activeTab, setActiveTab] = useState<"events" | "menu">("events");
    const [storyModal, setStoryModal] = useState<{ highlight: VenueHighlight; imageIndex: number } | null>(null);
    const [menuModalIndex, setMenuModalIndex] = useState<number | null>(null);

    useEffect(() => {
        if (!id) return;
        void fetchVenuePage(id);
        return () => clearVenuePage();
    }, [clearVenuePage, fetchVenuePage, id]);

    const venueName = venue?.displayName || venue?.name || "Venue";
    const bannerUrl = venue?.bannerImage || venue?.coverURL || venue?.photoURL;
    const logoUrl = venue?.logoImage || venue?.photoURL;
    const primaryLocation = venue?.neighborhood || venue?.city || venue?.address;

    const timingsText = useMemo(() => {
        if (!venue?.timings) return null;
        const entries = Object.entries(venue.timings);
        if (!entries.length) return null;
        const [day, value] = entries[0];
        return `${day}: ${value}`;
    }, [venue?.timings]);

    const handleReservation = async () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (venue?.whatsapp) {
            const digits = venue.whatsapp.replace(/\D/g, "");
            const message = encodeURIComponent(`Hi, I'd like to make a reservation at ${venueName}`);
            await Linking.openURL(`https://wa.me/${digits}?text=${message}`);
            return;
        }

        if (venue?.phone) {
            await Linking.openURL(`tel:${venue.phone}`);
        }
    };

    const handleDirections = async () => {
        const coordinates = venue?.coordinates;
        const target = venue?.address || primaryLocation || venueName;
        if (coordinates) {
            await Linking.openURL(
                `https://www.google.com/maps/dir/?api=1&destination=${coordinates.latitude},${coordinates.longitude}`
            );
            return;
        }
        if (!target) return;
        await Linking.openURL(`maps://search?q=${encodeURIComponent(target)}`);
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={colors.iris} />
            </View>
        );
    }

    if (error || !venue) {
        return (
            <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
                <Text style={styles.errorTitle}>Venue unavailable</Text>
                <Text style={styles.errorText}>{error || "This venue could not be loaded."}</Text>
                <PremiumButton onPress={() => router.back()} style={styles.errorButton}>
                    Go Back
                </PremiumButton>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <View style={styles.hero}>
                    {bannerUrl ? (
                        <Image source={{ uri: bannerUrl }} style={styles.heroImage} contentFit="cover" />
                    ) : (
                        <LinearGradient colors={["#2C1B12", "#161616"]} style={styles.heroImage} />
                    )}
                    <LinearGradient colors={["rgba(0,0,0,0.12)", "rgba(0,0,0,0.72)", "#161616"]} style={StyleSheet.absoluteFill} />

                    <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
                        <Pressable onPress={() => router.back()} style={styles.iconButton}>
                            <Ionicons name="chevron-back" size={24} color="#fff" />
                        </Pressable>
                        <Pressable onPress={handleDirections} style={styles.iconButton}>
                            <Ionicons name="navigate-outline" size={20} color="#fff" />
                        </Pressable>
                    </View>

                    <View style={styles.heroContent}>
                        {logoUrl ? <Image source={{ uri: logoUrl }} style={styles.logo} contentFit="cover" /> : null}
                        <View style={styles.metaRow}>
                            {venue.isVerified ? (
                                <View style={styles.badge}>
                                    <Ionicons name="checkmark-circle" size={13} color="#D4FF70" />
                                    <Text style={styles.badgeText}>Verified</Text>
                                </View>
                            ) : null}
                            {venue.venueType ? (
                                <View style={styles.badgeMuted}>
                                    <Text style={styles.badgeMutedText}>{venue.venueType}</Text>
                                </View>
                            ) : null}
                            {primaryLocation ? (
                                <View style={styles.badgeMuted}>
                                    <Text style={styles.badgeMutedText}>{primaryLocation}</Text>
                                </View>
                            ) : null}
                        </View>
                        <Text style={styles.title}>{venueName}</Text>
                        {venue.tagline ? <Text style={styles.tagline}>{venue.tagline}</Text> : null}
                        {timingsText ? (
                            <View style={styles.timingsRow}>
                                <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.68)" />
                                <Text style={styles.timingsText}>{timingsText}</Text>
                            </View>
                        ) : null}
                        <View style={styles.statRow}>
                            <View style={styles.statChip}>
                                <Text style={styles.statChipValue}>{formatCompactCount(venue.followers)}</Text>
                                <Text style={styles.statChipLabel}>Followers</Text>
                            </View>
                            <View style={styles.statChip}>
                                <Text style={styles.statChipValue}>{venue.upcomingEventsCount || 0}</Text>
                                <Text style={styles.statChipLabel}>Upcoming</Text>
                            </View>
                        </View>
                    </View>
                </View>

                <View style={styles.body}>
                    {(venue.hasReservation || venue.whatsapp || venue.phone) ? (
                        <View style={styles.ctaRow}>
                            <PremiumButton fullWidth onPress={handleReservation} style={styles.ctaPrimary}>
                                {venue.primaryCta || "Get Reservation"}
                            </PremiumButton>
                            <Pressable
                                onPress={() => router.push({ pathname: "/map", params: { mode: "venues", venueId: venue.id } })}
                                style={styles.ctaSecondary}
                            >
                                <Ionicons name="map-outline" size={18} color="#fff" />
                            </Pressable>
                            <Pressable onPress={handleDirections} style={styles.ctaSecondary}>
                                <Ionicons name="location-outline" size={18} color="#fff" />
                            </Pressable>
                        </View>
                    ) : null}

                    {venue.description ? (
                        <Animated.View entering={FadeInDown.delay(50)} style={styles.section}>
                            <Text style={styles.sectionTitle}>About</Text>
                            <Text style={styles.bodyText}>{venue.description}</Text>
                        </Animated.View>
                    ) : null}

                    {highlights.length > 0 ? (
                        <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
                            <Text style={styles.sectionTitle}>Highlights</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.highlightRow}>
                                {highlights.map((highlight) => (
                                    <Pressable
                                        key={highlight.id}
                                        onPress={() => {
                                            if (!highlight.images?.length) return;
                                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            setStoryModal({ highlight, imageIndex: 0 });
                                        }}
                                        style={styles.highlightItem}
                                    >
                                        <LinearGradient colors={["#F44A22", "#7B4AE2"]} style={styles.highlightRing}>
                                            <Image
                                                source={{ uri: highlight.coverImage || highlight.images[0] }}
                                                style={styles.highlightImage}
                                                contentFit="cover"
                                            />
                                        </LinearGradient>
                                        <Text style={styles.highlightTitle} numberOfLines={1}>
                                            {highlight.title}
                                        </Text>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        </Animated.View>
                    ) : null}

                    <Animated.View entering={FadeInDown.delay(150)} style={styles.section}>
                        <View style={styles.tabRow}>
                            <Pressable onPress={() => setActiveTab("events")} style={[styles.tabButton, activeTab === "events" && styles.tabButtonActive]}>
                                <Text style={[styles.tabButtonText, activeTab === "events" && styles.tabButtonTextActive]}>Upcoming Events</Text>
                            </Pressable>
                            <Pressable onPress={() => setActiveTab("menu")} style={[styles.tabButton, activeTab === "menu" && styles.tabButtonActive]}>
                                <Text style={[styles.tabButtonText, activeTab === "menu" && styles.tabButtonTextActive]}>Food Menu</Text>
                            </Pressable>
                        </View>

                        {activeTab === "events" ? (
                            upcomingEvents.length > 0 ? (
                                <View style={styles.cardsColumn}>
                                    {upcomingEvents.map((event, index) => (
                                        <EventCard
                                            key={event.id}
                                            id={event.id}
                                            title={event.title || "Event"}
                                            venue={event.venue || venueName}
                                            date={event.startDate ? new Date(event.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "TBA"}
                                            time={event.startDate ? new Date(event.startDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : undefined}
                                            imageUrl={event.image || event.poster || bannerUrl || "https://thec1rcle.com/events/placeholder.svg"}
                                            category={event.category}
                                            variant="compact"
                                            animationDelay={index * 50}
                                            onPress={() => router.push({ pathname: "/event/[id]", params: { id: event.id } })}
                                        />
                                    ))}
                                </View>
                            ) : (
                                <View style={styles.emptyPanel}>
                                    <Text style={styles.emptyPanelText}>No upcoming events are scheduled here yet.</Text>
                                </View>
                            )
                        ) : menu.length > 0 ? (
                            <AnyFlatList
                                data={menu}
                                scrollEnabled={false}
                                keyExtractor={(item: typeof menu[number]) => item.id}
                                numColumns={2}
                                columnWrapperStyle={styles.menuGridRow}
                                renderItem={({ item, index }: { item: typeof menu[number]; index: number }) => (
                                    <Pressable onPress={() => setMenuModalIndex(index)} style={styles.menuCard}>
                                        <Image source={{ uri: item.imageUrl }} style={styles.menuImage} contentFit="cover" />
                                        {item.title ? <Text style={styles.menuTitle}>{item.title}</Text> : null}
                                    </Pressable>
                                )}
                            />
                        ) : (
                            <View style={styles.emptyPanel}>
                                <Text style={styles.emptyPanelText}>Menu images are not available yet.</Text>
                            </View>
                        )}
                    </Animated.View>

                    {gallery.length > 0 ? (
                        <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
                            <Text style={styles.sectionTitle}>Vibe Gallery</Text>
                            <AnyFlatList
                                data={gallery}
                                scrollEnabled={false}
                                numColumns={3}
                                keyExtractor={(item: typeof gallery[number]) => item.id}
                                columnWrapperStyle={styles.galleryGridRow}
                                renderItem={({ item }: { item: typeof gallery[number] }) => (
                                    <Image source={{ uri: item.imageUrl }} style={styles.galleryImage} contentFit="cover" />
                                )}
                            />
                        </Animated.View>
                    ) : null}

                    {facilities.length > 0 ? (
                        <Animated.View entering={FadeInDown.delay(250)} style={styles.section}>
                            <Text style={styles.sectionTitle}>Facilities</Text>
                            <View style={styles.facilitiesGrid}>
                                {facilities.map((facility) => (
                                    <View key={facility.id} style={styles.facilityCard}>
                                        <Text style={styles.facilityEmoji}>{getFacilityEmoji(facility.icon)}</Text>
                                        <Text style={styles.facilityText}>{facility.name}</Text>
                                    </View>
                                ))}
                            </View>
                        </Animated.View>
                    ) : null}
                </View>
            </ScrollView>

            <Modal visible={!!storyModal} transparent animationType="fade" onRequestClose={() => setStoryModal(null)}>
                <View style={styles.storyBackdrop}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => setStoryModal(null)} />
                    {storyModal ? (
                        <Animated.View entering={FadeIn} style={styles.storyCard}>
                            <Image source={{ uri: storyModal.highlight.images[storyModal.imageIndex] }} style={styles.storyImage} contentFit="cover" />
                            <LinearGradient colors={["rgba(0,0,0,0.55)", "transparent", "rgba(0,0,0,0.8)"]} style={StyleSheet.absoluteFill} />
                            <View style={styles.storyHeader}>
                                <Text style={styles.storyTitle}>{storyModal.highlight.title}</Text>
                                <Pressable onPress={() => setStoryModal(null)} style={styles.storyClose}>
                                    <Ionicons name="close" size={22} color="#fff" />
                                </Pressable>
                            </View>
                            {storyModal.highlight.images.length > 1 ? (
                                <View style={styles.storyFooter}>
                                    <Pressable
                                        onPress={() =>
                                            setStoryModal((current) =>
                                                current
                                                    ? {
                                                          ...current,
                                                          imageIndex:
                                                              (current.imageIndex - 1 + current.highlight.images.length) %
                                                              current.highlight.images.length,
                                                      }
                                                    : current
                                            )
                                        }
                                        style={styles.storyNav}
                                    >
                                        <Ionicons name="chevron-back" size={18} color="#fff" />
                                    </Pressable>
                                    <Text style={styles.storyCount}>
                                        {storyModal.imageIndex + 1}/{storyModal.highlight.images.length}
                                    </Text>
                                    <Pressable
                                        onPress={() =>
                                            setStoryModal((current) =>
                                                current
                                                    ? {
                                                          ...current,
                                                          imageIndex: (current.imageIndex + 1) % current.highlight.images.length,
                                                      }
                                                    : current
                                            )
                                        }
                                        style={styles.storyNav}
                                    >
                                        <Ionicons name="chevron-forward" size={18} color="#fff" />
                                    </Pressable>
                                </View>
                            ) : null}
                        </Animated.View>
                    ) : null}
                </View>
            </Modal>

            <Modal visible={menuModalIndex !== null} transparent animationType="fade" onRequestClose={() => setMenuModalIndex(null)}>
                <View style={styles.storyBackdrop}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuModalIndex(null)} />
                    {menuModalIndex !== null && menu[menuModalIndex] ? (
                        <Animated.View entering={FadeIn} style={styles.menuModalCard}>
                            <Image source={{ uri: menu[menuModalIndex].imageUrl }} style={styles.menuModalImage} contentFit="contain" />
                            <Pressable onPress={() => setMenuModalIndex(null)} style={styles.storyCloseFloating}>
                                <Ionicons name="close" size={22} color="#fff" />
                            </Pressable>
                        </Animated.View>
                    ) : null}
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.base.DEFAULT,
    },
    center: {
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
    },
    scrollContent: {
        paddingBottom: 60,
    },
    hero: {
        height: 420,
    },
    heroImage: {
        width: "100%",
        height: "100%",
    },
    headerBar: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 3,
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 16,
    },
    iconButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.32)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    heroContent: {
        position: "absolute",
        left: 20,
        right: 20,
        bottom: 28,
    },
    logo: {
        width: 72,
        height: 72,
        borderRadius: 24,
        marginBottom: 16,
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.15)",
    },
    metaRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 10,
    },
    badge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: "rgba(163,255,112,0.12)",
        borderWidth: 1,
        borderColor: "rgba(163,255,112,0.28)",
    },
    badgeText: {
        color: "#E4FFC0",
        fontSize: 12,
        fontWeight: "700",
    },
    badgeMuted: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.09)",
    },
    badgeMutedText: {
        color: "rgba(255,255,255,0.78)",
        fontSize: 12,
        fontWeight: "600",
    },
    title: {
        color: "#fff",
        fontSize: 34,
        fontWeight: "900",
        letterSpacing: -1,
    },
    tagline: {
        color: "rgba(255,255,255,0.8)",
        fontSize: 15,
        lineHeight: 22,
        marginTop: 8,
    },
    timingsRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 12,
    },
    timingsText: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 13,
    },
    statRow: {
        flexDirection: "row",
        gap: 10,
        marginTop: 16,
    },
    statChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    statChipValue: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "800",
    },
    statChipLabel: {
        color: "rgba(255,255,255,0.55)",
        fontSize: 11,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.4,
    },
    body: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    ctaRow: {
        flexDirection: "row",
        gap: 12,
        marginBottom: 24,
    },
    ctaPrimary: {
        flex: 1,
    },
    ctaSecondary: {
        width: 56,
        height: 56,
        borderRadius: radii.xl,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    section: {
        marginBottom: 28,
    },
    sectionTitle: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "800",
        marginBottom: 14,
    },
    bodyText: {
        color: "rgba(255,255,255,0.74)",
        fontSize: 15,
        lineHeight: 22,
    },
    highlightRow: {
        paddingRight: 20,
    },
    highlightItem: {
        width: 88,
        marginRight: 14,
        alignItems: "center",
    },
    highlightRing: {
        width: 82,
        height: 82,
        borderRadius: 41,
        padding: 3,
        marginBottom: 8,
    },
    highlightImage: {
        width: "100%",
        height: "100%",
        borderRadius: 38,
    },
    highlightTitle: {
        color: "rgba(255,255,255,0.82)",
        fontSize: 12,
        fontWeight: "600",
        textAlign: "center",
    },
    tabRow: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 16,
    },
    tabButton: {
        flex: 1,
        borderRadius: 16,
        paddingVertical: 12,
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    tabButtonActive: {
        backgroundColor: "rgba(244,74,34,0.18)",
        borderColor: "rgba(244,74,34,0.45)",
    },
    tabButtonText: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 13,
        fontWeight: "700",
    },
    tabButtonTextActive: {
        color: "#fff",
    },
    cardsColumn: {
        gap: 12,
    },
    emptyPanel: {
        borderRadius: radii.xl,
        padding: 18,
        backgroundColor: "rgba(255,255,255,0.04)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    emptyPanelText: {
        color: "rgba(255,255,255,0.66)",
        fontSize: 14,
        lineHeight: 20,
    },
    menuGridRow: {
        justifyContent: "space-between",
        marginBottom: 12,
    },
    menuCard: {
        width: "48%",
        borderRadius: 18,
        overflow: "hidden",
        backgroundColor: "rgba(255,255,255,0.04)",
    },
    menuImage: {
        width: "100%",
        aspectRatio: 0.76,
    },
    menuTitle: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "700",
        padding: 10,
    },
    galleryGridRow: {
        justifyContent: "space-between",
        marginBottom: 8,
    },
    galleryImage: {
        width: "32%",
        aspectRatio: 1,
        borderRadius: 12,
    },
    facilitiesGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },
    facilityCard: {
        width: "31%",
        borderRadius: 18,
        padding: 14,
        minHeight: 92,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        justifyContent: "space-between",
    },
    facilityEmoji: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "800",
    },
    facilityText: {
        color: "rgba(255,255,255,0.82)",
        fontSize: 12,
        fontWeight: "600",
    },
    storyBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.88)",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 20,
    },
    storyCard: {
        width: "100%",
        height: "72%",
        borderRadius: 28,
        overflow: "hidden",
        backgroundColor: "#111",
    },
    storyImage: {
        width: "100%",
        height: "100%",
    },
    storyHeader: {
        position: "absolute",
        top: 18,
        left: 18,
        right: 18,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    storyTitle: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "800",
        flex: 1,
        marginRight: 12,
    },
    storyClose: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.32)",
    },
    storyFooter: {
        position: "absolute",
        left: 18,
        right: 18,
        bottom: 18,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    storyNav: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.14)",
    },
    storyCount: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "700",
    },
    menuModalCard: {
        width: "100%",
        height: "80%",
        alignItems: "center",
        justifyContent: "center",
    },
    menuModalImage: {
        width: "100%",
        height: "100%",
    },
    storyCloseFloating: {
        position: "absolute",
        top: 12,
        right: 12,
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.35)",
    },
    errorTitle: {
        color: "#fff",
        fontSize: 24,
        fontWeight: "800",
    },
    errorText: {
        color: "rgba(255,255,255,0.72)",
        fontSize: 14,
        lineHeight: 20,
        marginTop: 8,
        textAlign: "center",
    },
    errorButton: {
        marginTop: 20,
        minWidth: 180,
    },
});
