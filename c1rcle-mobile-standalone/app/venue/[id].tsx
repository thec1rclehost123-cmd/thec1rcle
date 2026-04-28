/**
 * THE C1RCLE — Venue Page Screen (Rebuilt)
 * 
 * Instagram-style venue profile with:
 * - Full-width banner hero with logo overlay
 * - Story highlights strip
 * - Upcoming Events / Food Menu tabs
 * - 3x3 Vibe Gallery
 * - Facilities section
 */

import { useEffect, useState, useCallback } from "react";
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    Dimensions,
    Linking,
    Modal,
    FlatList,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
    FadeIn,
    FadeInDown,
    useSharedValue,
    useAnimatedStyle,
    useAnimatedScrollHandler,
    interpolate,
    Extrapolation,
} from "react-native-reanimated";

import { colors } from "@/lib/design/theme";
import { useAuthStore } from "@/store/authStore";
import { useVenuePageStore, getFacilityEmoji, VenueHighlight } from "@/store/venuePageStore";
import { PremiumButton } from "@/components/ui/PremiumButton";
import { EventCard } from "@/components/ui/EventCard";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const HERO_HEIGHT = SCREEN_HEIGHT * 0.4;

export default function VenuePageScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const insets = useSafeAreaInsets();
    const { user } = useAuthStore();

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
    const [storyModal, setStoryModal] = useState<{ highlight: VenueHighlight; index: number } | null>(null);
    const [menuModal, setMenuModal] = useState(false);
    const [menuIndex, setMenuIndex] = useState(0);

    const scrollY = useSharedValue(0);
    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => { scrollY.value = event.contentOffset.y; },
    });

    useEffect(() => {
        if (id) {
            clearVenuePage();
            fetchVenuePage(id);
        }
        return () => clearVenuePage();
    }, [id]);

    const heroImageStyle = useAnimatedStyle(() => {
        const translateY = interpolate(scrollY.value, [-100, 0, HERO_HEIGHT], [-50, 0, HERO_HEIGHT * 0.5], Extrapolation.CLAMP);
        const scale = interpolate(scrollY.value, [-100, 0], [1.2, 1], Extrapolation.CLAMP);
        return { transform: [{ translateY }, { scale }] };
    });

    const handleReservation = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (venue?.whatsapp) {
            const message = encodeURIComponent(`Hi, I'd like to make a reservation at ${venue.name || venue.displayName}`);
            Linking.openURL(`https://wa.me/${venue.whatsapp.replace(/\D/g, "")}?text=${message}`);
        } else if (venue?.phone) {
            Linking.openURL(`tel:${venue.phone}`);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.iris} />
            </View>
        );
    }

    if (error || !venue) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error || "Venue not found"}</Text>
                <PremiumButton onPress={() => router.back()}>Go Back</PremiumButton>
            </View>
        );
    }

    const bannerUrl = venue.bannerImage || venue.coverURL;
    const logoUrl = venue.logoImage || venue.photoURL;
    const venueName = venue.displayName || venue.name || "Venue";

    return (
        <View style={styles.container}>
            {/* Header Back Button */}
            <View style={[styles.headerActions, { top: insets.top + 8 }]}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color="#FFF" />
                </Pressable>
            </View>

            <Animated.ScrollView
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
            >
                {/* HERO SECTION */}
                <View style={styles.hero}>
                    <Animated.View style={[styles.heroImageWrapper, heroImageStyle]}>
                        <Image
                            source={{ uri: bannerUrl || "https://thec1rcle.com/events/placeholder.svg" }}
                            style={styles.heroImage}
                            contentFit="cover"
                        />
                    </Animated.View>
                    <LinearGradient colors={["transparent", "rgba(0,0,0,0.6)", "#000"]} style={styles.heroGradient} />

                    {/* Logo Overlay */}
                    {logoUrl && (
                        <View style={styles.logoContainer}>
                            <Image source={{ uri: logoUrl }} style={styles.logo} contentFit="cover" />
                        </View>
                    )}

                    {/* Venue Info */}
                    <View style={styles.heroContent}>
                        <View style={styles.badgeRow}>
                            {venue.isVerified && (
                                <View style={styles.verifiedBadge}>
                                    <Ionicons name="checkmark-circle" size={14} color="#A3E635" />
                                    <Text style={styles.verifiedText}>VERIFIED</Text>
                                </View>
                            )}
                            {venue.neighborhood && (
                                <View style={styles.locationBadge}>
                                    <Text style={styles.locationText}>{venue.neighborhood}</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.venueName}>{venueName}</Text>
                        {venue.tagline && <Text style={styles.tagline}>"{venue.tagline}"</Text>}

                        {/* Timings */}
                        {venue.timings && Object.keys(venue.timings).length > 0 && (
                            <View style={styles.timingsRow}>
                                <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.6)" />
                                <Text style={styles.timingsText}>
                                    {Object.entries(venue.timings).slice(0, 1).map(([day, time]) => `${day}: ${time}`).join(", ")}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* GET RESERVATION Button */}
                    {(venue.hasReservation || venue.whatsapp) && (
                        <Pressable style={styles.reservationButton} onPress={handleReservation}>
                            <Text style={styles.reservationButtonText}>GET RESERVATION</Text>
                        </Pressable>
                    )}
                </View>

                {/* HIGHLIGHTS STRIP */}
                {highlights.length > 0 && (
                    <Animated.View entering={FadeInDown.delay(100)} style={styles.highlightsSection}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.highlightsScroll}>
                            {highlights.map((highlight) => (
                                <Pressable
                                    key={highlight.id}
                                    onPress={() => {
                                        if (highlight.images.length > 0) {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            setStoryModal({ highlight, index: 0 });
                                        }
                                    }}
                                    style={styles.highlightItem}
                                >
                                    <View style={styles.highlightRing}>
                                        <Image source={{ uri: highlight.coverImage || highlight.images[0] }} style={styles.highlightImage} contentFit="cover" />
                                    </View>
                                    <Text style={styles.highlightTitle} numberOfLines={1}>{highlight.title}</Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                    </Animated.View>
                )}

                {/* TAB BUTTONS */}
                <Animated.View entering={FadeInDown.delay(200)} style={styles.tabContainer}>
                    <Pressable
                        style={[styles.tabButton, activeTab === "events" && styles.tabButtonActive]}
                        onPress={() => setActiveTab("events")}
                    >
                        <Text style={[styles.tabButtonText, activeTab === "events" && styles.tabButtonTextActive]}>
                            UPCOMING EVENTS
                        </Text>
                    </Pressable>
                    <Pressable
                        style={[styles.tabButton, activeTab === "menu" && styles.tabButtonActive]}
                        onPress={() => setActiveTab("menu")}
                    >
                        <Text style={[styles.tabButtonText, activeTab === "menu" && styles.tabButtonTextActive]}>
                            FOOD MENU
                        </Text>
                    </Pressable>
                </Animated.View>

                {/* TAB CONTENT */}
                <View style={styles.tabContent}>
                    {activeTab === "events" ? (
                        upcomingEvents.length > 0 ? (
                            <View style={styles.eventsGrid}>
                                {upcomingEvents.map((event) => (
                                    <View key={event.id} style={styles.eventCardWrapper}>
                                        <EventCard
                                            id={event.id}
                                            title={event.title}
                                            venue={venueName}
                                            date={new Date(event.startDate).toLocaleDateString([], { month: "short", day: "numeric" })}
                                            imageUrl={event.posterUrl || event.coverImage || ""}
                                            price={event.priceDisplay}
                                            category={event.category}
                                            variant="grid"
                                            width="100%"
                                        />
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <View style={styles.emptyState}>
                                <Ionicons name="calendar-outline" size={48} color="rgba(255,255,255,0.2)" />
                                <Text style={styles.emptyText}>No upcoming events</Text>
                            </View>
                        )
                    ) : (
                        menu.length > 0 ? (
                            <Pressable
                                style={styles.menuPreview}
                                onPress={() => { setMenuIndex(0); setMenuModal(true); }}
                            >
                                <Image source={{ uri: menu[0].imageUrl }} style={styles.menuImage} contentFit="cover" />
                                <View style={styles.menuOverlay}>
                                    <Ionicons name="expand-outline" size={32} color="#FFF" />
                                    <Text style={styles.menuOverlayText}>View Full Menu ({menu.length} pages)</Text>
                                </View>
                            </Pressable>
                        ) : (
                            <View style={styles.emptyState}>
                                <Ionicons name="restaurant-outline" size={48} color="rgba(255,255,255,0.2)" />
                                <Text style={styles.emptyText}>Menu coming soon</Text>
                            </View>
                        )
                    )}
                </View>

                {/* VIBE GALLERY */}
                {gallery.length > 0 && (
                    <Animated.View entering={FadeInDown.delay(300)} style={styles.gallerySection}>
                        <Text style={styles.sectionTitle}>THE VIBE</Text>
                        <View style={styles.galleryGrid}>
                            {gallery.slice(0, 9).map((photo, idx) => (
                                <View key={photo.id} style={styles.galleryItem}>
                                    <Image source={{ uri: photo.imageUrl }} style={styles.galleryImage} contentFit="cover" />
                                </View>
                            ))}
                        </View>
                    </Animated.View>
                )}

                {/* FACILITIES */}
                {facilities.length > 0 && (
                    <Animated.View entering={FadeInDown.delay(400)} style={styles.facilitiesSection}>
                        <Text style={styles.sectionTitle}>FACILITIES</Text>
                        <View style={styles.facilitiesGrid}>
                            {facilities.map((facility) => (
                                <View key={facility.id} style={styles.facilityItem}>
                                    <Text style={styles.facilityEmoji}>{getFacilityEmoji(facility.icon)}</Text>
                                    <Text style={styles.facilityName}>{facility.name}</Text>
                                </View>
                            ))}
                        </View>
                    </Animated.View>
                )}

                {/* ADDRESS */}
                {venue.address && (
                    <Animated.View entering={FadeInDown.delay(500)} style={styles.addressSection}>
                        <Pressable
                            style={styles.addressCard}
                            onPress={() => {
                                const query = encodeURIComponent(venue.address || venueName);
                                Linking.openURL(`https://maps.google.com/?q=${query}`);
                            }}
                        >
                            <Ionicons name="location-outline" size={24} color="#A3E635" />
                            <View style={styles.addressInfo}>
                                <Text style={styles.addressText}>{venue.address}</Text>
                                <Text style={styles.addressHint}>Tap to open in Maps</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.4)" />
                        </Pressable>
                    </Animated.View>
                )}
            </Animated.ScrollView>

            {/* STORY MODAL */}
            <StoryModal
                visible={!!storyModal}
                highlight={storyModal?.highlight || null}
                initialIndex={storyModal?.index || 0}
                onClose={() => setStoryModal(null)}
            />

            {/* MENU MODAL */}
            <MenuModal
                visible={menuModal}
                menuItems={menu}
                initialIndex={menuIndex}
                onClose={() => setMenuModal(false)}
            />
        </View>
    );
}

// Story Viewer Modal
function StoryModal({ visible, highlight, initialIndex, onClose }: { visible: boolean; highlight: VenueHighlight | null; initialIndex: number; onClose: () => void }) {
    const [index, setIndex] = useState(initialIndex);
    const insets = useSafeAreaInsets();

    useEffect(() => { setIndex(initialIndex); }, [initialIndex]);

    if (!highlight) return null;

    return (
        <Modal visible={visible} animationType="fade" statusBarTranslucent>
            <View style={{ flex: 1, backgroundColor: "#000" }}>
                <View style={[styles.storyHeader, { paddingTop: insets.top + 8 }]}>
                    <View style={styles.storyProgress}>
                        {highlight.images.map((_, i) => (
                            <View key={i} style={[styles.progressBar, i === index && styles.progressBarActive]} />
                        ))}
                    </View>
                    <Pressable onPress={onClose} style={styles.storyClose}>
                        <Ionicons name="close" size={28} color="#FFF" />
                    </Pressable>
                </View>
                <Pressable
                    style={styles.storyContent}
                    onPress={(e) => {
                        const x = e.nativeEvent.locationX;
                        if (x < SCREEN_WIDTH / 2) {
                            setIndex(Math.max(0, index - 1));
                        } else {
                            if (index < highlight.images.length - 1) {
                                setIndex(index + 1);
                            } else {
                                onClose();
                            }
                        }
                    }}
                >
                    <Image source={{ uri: highlight.images[index] }} style={styles.storyImage} contentFit="contain" />
                </Pressable>
                <View style={[styles.storyFooter, { paddingBottom: insets.bottom + 16 }]}>
                    <Text style={styles.storyTitle}>{highlight.title}</Text>
                    <Text style={styles.storyCounter}>{index + 1} / {highlight.images.length}</Text>
                </View>
            </View>
        </Modal>
    );
}

// Menu Viewer Modal
function MenuModal({ visible, menuItems, initialIndex, onClose }: { visible: boolean; menuItems: any[]; initialIndex: number; onClose: () => void }) {
    const [index, setIndex] = useState(initialIndex);
    const insets = useSafeAreaInsets();

    useEffect(() => { setIndex(initialIndex); }, [initialIndex]);

    return (
        <Modal visible={visible} animationType="slide" statusBarTranslucent>
            <View style={{ flex: 1, backgroundColor: "#000" }}>
                <View style={[styles.menuHeader, { paddingTop: insets.top + 8 }]}>
                    <Text style={styles.menuHeaderText}>Menu - Page {index + 1} of {menuItems.length}</Text>
                    <Pressable onPress={onClose}>
                        <Ionicons name="close" size={28} color="#FFF" />
                    </Pressable>
                </View>
                <FlatList
                    data={menuItems}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    initialScrollIndex={initialIndex}
                    getItemLayout={(_, i) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * i, index: i })}
                    onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
                    renderItem={({ item }) => (
                        <ScrollView style={{ width: SCREEN_WIDTH }} contentContainerStyle={{ alignItems: "center", padding: 16 }}>
                            <Image source={{ uri: item.imageUrl }} style={{ width: SCREEN_WIDTH - 32, height: SCREEN_HEIGHT * 0.75 }} contentFit="contain" />
                        </ScrollView>
                    )}
                    keyExtractor={(item) => item.id}
                />
                <View style={[styles.menuFooter, { paddingBottom: insets.bottom + 16 }]}>
                    {menuItems.map((_, i) => (
                        <View key={i} style={[styles.menuDot, i === index && styles.menuDotActive]} />
                    ))}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#000" },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" },
    errorContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40, backgroundColor: "#000" },
    errorText: { color: "#FFF", fontSize: 16, marginBottom: 20, textAlign: "center" },

    headerActions: { position: "absolute", left: 16, zIndex: 10 },
    backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },

    hero: { height: HERO_HEIGHT + 60, overflow: "hidden", justifyContent: "flex-end" },
    heroImageWrapper: { ...StyleSheet.absoluteFillObject },
    heroImage: { width: "100%", height: "100%" },
    heroGradient: { ...StyleSheet.absoluteFillObject },

    logoContainer: { position: "absolute", top: 100, left: 24, width: 72, height: 72, borderRadius: 16, overflow: "hidden", borderWidth: 2, borderColor: "rgba(255,255,255,0.2)" },
    logo: { width: "100%", height: "100%" },

    heroContent: { padding: 24, paddingBottom: 80 },
    badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
    verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(163,230,53,0.1)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    verifiedText: { color: "#A3E635", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
    locationBadge: { backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
    locationText: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "600" },
    venueName: { color: "#FFF", fontSize: 36, fontWeight: "900", letterSpacing: -1 },
    tagline: { color: "rgba(255,255,255,0.6)", fontSize: 14, fontStyle: "italic", marginTop: 4 },
    timingsRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
    timingsText: { color: "rgba(255,255,255,0.6)", fontSize: 12 },

    reservationButton: { position: "absolute", right: 24, bottom: 24, backgroundColor: "#A3E635", paddingHorizontal: 20, paddingVertical: 14, borderRadius: 12 },
    reservationButtonText: { color: "#000", fontSize: 12, fontWeight: "900", letterSpacing: 1 },

    highlightsSection: { paddingVertical: 16 },
    highlightsScroll: { paddingHorizontal: 20, gap: 16 },
    highlightItem: { alignItems: "center", width: 72 },
    highlightRing: { width: 68, height: 68, borderRadius: 34, padding: 3, backgroundColor: "transparent", borderWidth: 2, borderColor: "#A3E635" },
    highlightImage: { width: "100%", height: "100%", borderRadius: 32 },
    highlightTitle: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 6, textAlign: "center" },

    tabContainer: { flexDirection: "row", marginHorizontal: 20, marginTop: 8, marginBottom: 16, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 4 },
    tabButton: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 8 },
    tabButtonActive: { backgroundColor: "#A3E635" },
    tabButtonText: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
    tabButtonTextActive: { color: "#000" },

    tabContent: { marginHorizontal: 20, minHeight: 200 },
    eventsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    eventCardWrapper: { width: (SCREEN_WIDTH - 52) / 2 },
    emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 48 },
    emptyText: { color: "rgba(255,255,255,0.4)", fontSize: 14, marginTop: 12 },

    menuPreview: { aspectRatio: 0.7, borderRadius: 16, overflow: "hidden" },
    menuImage: { width: "100%", height: "100%" },
    menuOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
    menuOverlayText: { color: "#FFF", fontSize: 14, fontWeight: "600", marginTop: 8 },

    gallerySection: { marginTop: 32, paddingHorizontal: 20 },
    sectionTitle: { color: "#A3E635", fontSize: 11, fontWeight: "900", letterSpacing: 2, marginBottom: 12 },
    galleryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
    galleryItem: { width: (SCREEN_WIDTH - 48) / 3, aspectRatio: 1, borderRadius: 8, overflow: "hidden" },
    galleryImage: { width: "100%", height: "100%" },

    facilitiesSection: { marginTop: 32, paddingHorizontal: 20 },
    facilitiesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    facilityItem: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.05)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
    facilityEmoji: { fontSize: 16 },
    facilityName: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600" },

    addressSection: { marginTop: 32, paddingHorizontal: 20 },
    addressCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(255,255,255,0.05)", padding: 16, borderRadius: 16 },
    addressInfo: { flex: 1 },
    addressText: { color: "#FFF", fontSize: 14, fontWeight: "500" },
    addressHint: { color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 },

    storyHeader: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: 16 },
    storyProgress: { flexDirection: "row", gap: 4, marginBottom: 12 },
    progressBar: { flex: 1, height: 2, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 1 },
    progressBarActive: { backgroundColor: "#FFF" },
    storyClose: { alignSelf: "flex-end" },
    storyContent: { flex: 1, justifyContent: "center", alignItems: "center" },
    storyImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.7 },
    storyFooter: { alignItems: "center", paddingHorizontal: 16 },
    storyTitle: { color: "#FFF", fontSize: 18, fontWeight: "700" },
    storyCounter: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 4 },

    menuHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12 },
    menuHeaderText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
    menuFooter: { flexDirection: "row", justifyContent: "center", gap: 8, paddingTop: 16 },
    menuDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.3)" },
    menuDotActive: { backgroundColor: "#FFF", width: 24 },
});
