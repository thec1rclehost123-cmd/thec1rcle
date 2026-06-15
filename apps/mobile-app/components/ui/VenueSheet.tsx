/**
 * VenueSheet — slide-up sheet showing venue detail
 * Opened from event detail when user taps the location row.
 */

import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
    View,
    Text,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Linking,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { apiFetch } from "@/lib/api";
import { colors, radii } from "@/lib/design/theme";

interface VenueInfo {
    id?: string;
    name: string;
    area?: string;
    city?: string;
    capacity?: number;
    vibeTags?: string[];
    dressCode?: string;
    facilities?: string[];
    description?: string;
    coordinates?: { latitude: number; longitude: number };
}

interface VenueSheetProps {
    visible: boolean;
    onClose: () => void;
    // From the event — always available
    venueName: string;
    venueLocation?: string;
    venueCoords?: { latitude: number; longitude: number } | null;
    venueId?: string;
}

export function VenueSheet({
    visible,
    onClose,
    venueName,
    venueLocation,
    venueCoords,
    venueId,
}: VenueSheetProps) {
    const [venue, setVenue] = useState<VenueInfo | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!visible || !venueId) return;
        setLoading(true);
        apiFetch(`/api/v1/venues/${venueId}`)
            .then((data: any) => setVenue(data?.venue ?? data ?? null))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [visible, venueId]);

    const displayName = venue?.name ?? venueName;
    const displayArea = venue?.area ?? venueLocation;
    const coords = venue?.coordinates ?? venueCoords;

    const openInMaps = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (coords) {
            Linking.openURL(
                `maps://?ll=${coords.latitude},${coords.longitude}&q=${encodeURIComponent(displayName)}`
            );
        } else if (displayArea) {
            Linking.openURL(`maps://search?q=${encodeURIComponent(displayArea)}`);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <SafeAreaView style={styles.safeArea}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Pressable onPress={onClose} style={styles.headerBtn}>
                            <Text style={styles.headerBtnText}>Done</Text>
                        </Pressable>
                        <View style={styles.headerHandle} />
                        <View style={{ width: 56 }} />
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.content}
                    >
                        {/* Hero */}
                        <Animated.View entering={FadeInDown.springify()} style={styles.hero}>
                            <LinearGradient
                                colors={["rgba(244,74,34,0.2)", "rgba(22,22,22,0)"]}
                                style={StyleSheet.absoluteFill}
                            />
                            <View style={styles.heroIconCircle}>
                                <Text style={styles.heroIcon}>📍</Text>
                            </View>
                            <Text style={styles.venueName}>{displayName}</Text>
                            {displayArea && (
                                <Text style={styles.venueArea}>{displayArea}</Text>
                            )}
                        </Animated.View>

                        {/* Info grid */}
                        <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.infoGrid}>
                            {venue?.capacity && (
                                <View style={styles.infoChip}>
                                    <Text style={styles.infoChipIcon}>👥</Text>
                                    <Text style={styles.infoChipText}>{venue.capacity.toLocaleString()} cap</Text>
                                </View>
                            )}
                            {venue?.dressCode && (
                                <View style={styles.infoChip}>
                                    <Text style={styles.infoChipIcon}>👔</Text>
                                    <Text style={styles.infoChipText}>{venue.dressCode}</Text>
                                </View>
                            )}
                            {venue?.city && (
                                <View style={styles.infoChip}>
                                    <Text style={styles.infoChipIcon}>🏙️</Text>
                                    <Text style={styles.infoChipText}>{venue.city}</Text>
                                </View>
                            )}
                        </Animated.View>

                        {/* Description */}
                        {venue?.description && (
                            <Animated.View entering={FadeInDown.delay(120).springify()} style={styles.section}>
                                <Text style={styles.sectionTitle}>About</Text>
                                <Text style={styles.descriptionText}>{venue.description}</Text>
                            </Animated.View>
                        )}

                        {/* Vibe tags */}
                        {(venue?.vibeTags?.length ?? 0) > 0 && (
                            <Animated.View entering={FadeInDown.delay(140).springify()} style={styles.section}>
                                <Text style={styles.sectionTitle}>Vibe</Text>
                                <View style={styles.tagsRow}>
                                    {venue!.vibeTags!.map(tag => (
                                        <View key={tag} style={styles.tag}>
                                            <Text style={styles.tagText}>{tag}</Text>
                                        </View>
                                    ))}
                                </View>
                            </Animated.View>
                        )}

                        {/* Facilities */}
                        {(venue?.facilities?.length ?? 0) > 0 && (
                            <Animated.View entering={FadeInDown.delay(160).springify()} style={styles.section}>
                                <Text style={styles.sectionTitle}>Facilities</Text>
                                <View style={styles.tagsRow}>
                                    {venue!.facilities!.map(f => (
                                        <View key={f} style={styles.tag}>
                                            <Text style={styles.tagText}>{f}</Text>
                                        </View>
                                    ))}
                                </View>
                            </Animated.View>
                        )}

                        {/* Directions CTA */}
                        {(coords || displayArea || venueId) && (
                            <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.ctaStack}>
                                {venueId ? (
                                    <Pressable
                                        onPress={() => {
                                            onClose();
                                            router.push(`/venue/${venueId}` as never);
                                        }}
                                        style={styles.directionBtn}
                                    >
                                        <LinearGradient
                                            colors={["rgba(255,255,255,0.1)", "rgba(255,255,255,0.04)"]}
                                            style={styles.directionGradient}
                                        >
                                            <Text style={styles.directionBtnText}>✨  View Venue Page</Text>
                                        </LinearGradient>
                                    </Pressable>
                                ) : null}
                                <Pressable onPress={openInMaps} style={styles.directionBtn}>
                                    <LinearGradient
                                        colors={["rgba(244,74,34,0.2)", "rgba(244,74,34,0.08)"]}
                                        style={styles.directionGradient}
                                    >
                                        <Text style={styles.directionBtnText}>🧭  Open in Maps</Text>
                                    </LinearGradient>
                                </Pressable>
                            </Animated.View>
                        )}
                    </ScrollView>
                </SafeAreaView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.base.DEFAULT,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255,255,255,0.06)",
    },
    headerBtn: {
        minWidth: 56,
        alignItems: "flex-end",
    },
    headerBtnText: {
        color: colors.iris,
        fontSize: 16,
        fontWeight: "600",
    },
    headerHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: "rgba(255,255,255,0.2)",
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 60,
    },
    ctaStack: {
        gap: 12,
    },
    hero: {
        alignItems: "center",
        paddingVertical: 24,
        marginBottom: 16,
        borderRadius: radii["2xl"],
        overflow: "hidden",
    },
    heroIconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: "rgba(244,74,34,0.15)",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 14,
        borderWidth: 1,
        borderColor: "rgba(244,74,34,0.25)",
    },
    heroIcon: {
        fontSize: 32,
    },
    venueName: {
        color: colors.gold,
        fontSize: 26,
        fontWeight: "800",
        textAlign: "center",
        marginBottom: 6,
    },
    venueArea: {
        color: colors.goldMetallic,
        fontSize: 15,
        textAlign: "center",
    },
    infoGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 20,
    },
    infoChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: colors.base[50],
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    infoChipIcon: {
        fontSize: 14,
    },
    infoChipText: {
        color: colors.goldMetallic,
        fontSize: 13,
        fontWeight: "500",
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        color: colors.goldMetallic,
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 1.5,
        textTransform: "uppercase",
        marginBottom: 10,
    },
    descriptionText: {
        color: colors.gold,
        fontSize: 15,
        lineHeight: 22,
    },
    tagsRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    tag: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: radii.pill,
        backgroundColor: colors.base[50],
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    tagText: {
        color: colors.goldMetallic,
        fontSize: 13,
    },
    directionBtn: {
        borderRadius: radii.xl,
        overflow: "hidden",
        marginTop: 4,
    },
    directionGradient: {
        paddingVertical: 16,
        alignItems: "center",
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: "rgba(244,74,34,0.25)",
    },
    directionBtnText: {
        color: colors.iris,
        fontSize: 16,
        fontWeight: "600",
    },
});
