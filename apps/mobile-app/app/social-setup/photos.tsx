/**
 * social-setup/photos.tsx
 * Step 1 — Photo grid (6 slots, Hinge-style layout).
 * Main slot must be filled to proceed.
 */
import { useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Alert,
    ScrollView,
    ActivityIndicator,
    Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Plus, X, ChevronRight } from "lucide-react-native";
import { useAuth } from "@/hooks/useAuth";
import { useSocialProfileStore } from "@/store/socialProfileStore";
import { colors } from "@/lib/design/theme";

const { width: SCREEN_W } = Dimensions.get("window");
const HORIZONTAL_PAD = 24;
const GAP = 8;
const USABLE = SCREEN_W - HORIZONTAL_PAD * 2;

// Top row: large (2/3) + small column (1/3)
const LARGE_W = Math.floor((USABLE - GAP) * 0.62);
const SMALL_W = USABLE - GAP - LARGE_W;
const SMALL_H = Math.floor((LARGE_W * 1.22 - GAP) / 2);
const LARGE_H = SMALL_H * 2 + GAP;

// Bottom row: 3 equal slots
const THIRD_W = Math.floor((USABLE - GAP * 2) / 3);
const THIRD_H = Math.floor(THIRD_W * 1.15);

const MAX_PHOTOS = 6;

// ── Single photo slot ─────────────────────────────────────────────────────────

function PhotoSlot({
    index,
    uri,
    uploading,
    isMain,
    width,
    height,
    onPick,
    onRemove,
}: {
    index: number;
    uri: string | null;
    uploading: boolean;
    isMain: boolean;
    width: number;
    height: number;
    onPick: (i: number) => void;
    onRemove: (i: number) => void;
}) {
    return (
        <Pressable
            style={[styles.slot, { width, height }, isMain && styles.slotMain]}
            onPress={() => onPick(index)}
        >
            {uploading ? (
                <View style={styles.uploadingOverlay}>
                    <ActivityIndicator color={colors.iris} size="small" />
                    <Text style={styles.uploadingText}>Uploading…</Text>
                </View>
            ) : uri ? (
                <>
                    <Image
                        source={{ uri }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                    />
                    {/* Gradient bottom fade */}
                    <View style={styles.photoFade} />

                    {isMain && (
                        <View style={styles.mainBadge}>
                            <Text style={styles.mainBadgeText}>MAIN</Text>
                        </View>
                    )}

                    {/* Remove — tap top-right corner */}
                    <Pressable
                        style={styles.removeBtn}
                        onPress={(e) => {
                            e.stopPropagation();
                            onRemove(index);
                        }}
                        hitSlop={12}
                    >
                        <X size={9} color="#fff" strokeWidth={3} />
                    </Pressable>

                    {/* Edit hint overlay on main photo */}
                    {isMain && (
                        <View style={styles.editHint}>
                            <Text style={styles.editHintText}>Tap to change</Text>
                        </View>
                    )}
                </>
            ) : (
                <View style={styles.emptyInner}>
                    <View style={[styles.plusCircle, isMain && styles.plusCircleMain]}>
                        <Plus
                            size={isMain ? 22 : 16}
                            color={isMain ? colors.iris : "rgba(255,255,255,0.35)"}
                            strokeWidth={2}
                        />
                    </View>
                    {isMain && <Text style={styles.addLabel}>Add photo</Text>}
                </View>
            )}
        </Pressable>
    );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SocialSetupPhotos() {
    const { user } = useAuth();
    const { uploadPhoto, socialProfile } = useSocialProfileStore();

    const [photos, setPhotos] = useState<(string | null)[]>(() => {
        const existing = socialProfile?.photos ?? [];
        return Array.from({ length: MAX_PHOTOS }, (_, i) => existing[i] ?? null);
    });
    const [uploading, setUploading] = useState<number | null>(null);

    const filledCount = photos.filter(Boolean).length;

    const pickPhoto = useCallback(async (index: number) => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            Alert.alert("Permission needed", "Please allow photo access in Settings.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [3, 4],
            quality: 0.85,
        });

        if (result.canceled || !result.assets[0]) return;
        if (!user?.uid) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setUploading(index);

        try {
            const url = await uploadPhoto(user.uid, result.assets[0].uri, index);
            setPhotos(prev => {
                const next = [...prev];
                next[index] = url;
                return next;
            });
        } catch {
            console.warn("[SocialSetupPhotos] upload failed");
        } finally {
            setUploading(null);
        }
    }, [user?.uid, uploadPhoto]);

    const removePhoto = useCallback((index: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setPhotos(prev => {
            const next = [...prev];
            next[index] = null;
            return next;
        });
    }, []);

    const handleNext = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push({
            pathname: "/social-setup/preferences",
            params: { photosJson: JSON.stringify(photos.filter(Boolean)) },
        });
    };

    const slotProps = (index: number) => ({
        index,
        uri: photos[index],
        uploading: uploading === index,
        isMain: index === 0,
        onPick: pickPhoto,
        onRemove: removePhoto,
    });

    return (
        <SafeAreaView style={styles.container}>
            {/* Progress header */}
            <View style={styles.header}>
                <Pressable style={styles.backBtn} onPress={() => router.back()}>
                    <Text style={styles.backArrow}>‹</Text>
                </Pressable>
                <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: "33%" }]} />
                </View>
                <Text style={styles.stepLabel}>1 / 3</Text>
            </View>

            <ScrollView bounces={false} overScrollMode="never"
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Animated.Text entering={FadeInDown.delay(40).springify().damping(18)} style={styles.title}>
                    Add your photos
                </Animated.Text>
                <Animated.Text entering={FadeInDown.delay(80).springify().damping(18)} style={styles.subtitle}>
                    First photo is your main pic. Add up to 6.
                </Animated.Text>

                {/* ── Top row: 1 large + 2 small stacked ── */}
                <Animated.View entering={FadeInDown.delay(140).springify().damping(16)} style={styles.topRow}>
                    <PhotoSlot {...slotProps(0)} width={LARGE_W} height={LARGE_H} />
                    <View style={styles.smallStack}>
                        <PhotoSlot {...slotProps(1)} width={SMALL_W} height={SMALL_H} />
                        <PhotoSlot {...slotProps(2)} width={SMALL_W} height={SMALL_H} />
                    </View>
                </Animated.View>

                {/* ── Bottom row: 3 equal ── */}
                <Animated.View entering={FadeInDown.delay(200).springify().damping(16)} style={styles.bottomRow}>
                    <PhotoSlot {...slotProps(3)} width={THIRD_W} height={THIRD_H} />
                    <PhotoSlot {...slotProps(4)} width={THIRD_W} height={THIRD_H} />
                    <PhotoSlot {...slotProps(5)} width={THIRD_W} height={THIRD_H} />
                </Animated.View>

                <Animated.Text entering={FadeInDown.delay(260).springify().damping(18)} style={styles.tip}>
                    💡 Clear solo face shots get 3× more matches
                </Animated.Text>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
                {/* Photo count indicator */}
                <View style={styles.countRow}>
                    {Array.from({ length: MAX_PHOTOS }).map((_, i) => (
                        <View
                            key={i}
                            style={[styles.countDot, photos[i] && styles.countDotFilled]}
                        />
                    ))}
                </View>

                <Pressable
                    style={styles.nextBtn}
                    onPress={handleNext}
                >
                    <Text style={styles.nextBtnText}>Continue</Text>
                    <ChevronRight size={18} color="#fff" strokeWidth={2.5} />
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0F0F0F" },

    // Header
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 16,
        gap: 14,
    },
    backBtn: { width: 32, height: 32, justifyContent: "center" },
    backArrow: {
        color: "rgba(255,255,255,0.6)",
        fontSize: 30,
        lineHeight: 32,
        fontWeight: "200",
    },
    progressTrack: {
        flex: 1,
        height: 3,
        borderRadius: 2,
        backgroundColor: "rgba(255,255,255,0.1)",
        overflow: "hidden",
    },
    progressFill: {
        height: "100%",
        borderRadius: 2,
        backgroundColor: colors.iris,
    },
    stepLabel: {
        color: "rgba(255,255,255,0.3)",
        fontSize: 12,
        fontWeight: "600",
        width: 32,
        textAlign: "right",
    },

    scroll: { flex: 1 },
    scrollContent: {
        paddingHorizontal: HORIZONTAL_PAD,
        paddingBottom: 24,
    },

    title: {
        color: "#fff",
        fontSize: 24,
        fontWeight: "800",
        letterSpacing: 0,
        marginBottom: 4,
    },
    subtitle: {
        color: "rgba(255,255,255,0.4)",
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 20,
    },

    // Grid
    topRow: {
        flexDirection: "row",
        gap: GAP,
        marginBottom: GAP,
    },
    smallStack: {
        gap: GAP,
    },
    bottomRow: {
        flexDirection: "row",
        gap: GAP,
        marginBottom: 16,
    },

    // Slot
    slot: {
        borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.09)",
        borderStyle: "dashed",
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
    },
    slotMain: {
        borderRadius: 18,
        borderColor: "rgba(244,74,34,0.25)",
        borderStyle: "solid",
        borderWidth: 1,
    },

    // Empty state
    emptyInner: { alignItems: "center", gap: 7 },
    plusCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "rgba(255,255,255,0.07)",
        alignItems: "center",
        justifyContent: "center",
    },
    plusCircleMain: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: "rgba(244,74,34,0.1)",
        borderWidth: 1,
        borderColor: "rgba(244,74,34,0.2)",
    },
    addLabel: {
        color: colors.iris,
        fontSize: 12,
        fontWeight: "600",
        letterSpacing: 0.2,
    },

    // Filled state
    photoFade: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 48,
        backgroundColor: "rgba(0,0,0,0.35)",
    },
    mainBadge: {
        position: "absolute",
        bottom: 8,
        left: 8,
        backgroundColor: colors.iris,
        borderRadius: 6,
        paddingHorizontal: 7,
        paddingVertical: 3,
    },
    mainBadgeText: {
        color: "#fff",
        fontSize: 9,
        fontWeight: "800",
        letterSpacing: 0.5,
    },
    removeBtn: {
        position: "absolute",
        top: 7,
        right: 7,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: "rgba(0,0,0,0.65)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
        alignItems: "center",
        justifyContent: "center",
    },
    editHint: {
        position: "absolute",
        bottom: 8,
        right: 8,
        backgroundColor: "rgba(0,0,0,0.55)",
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 3,
    },
    editHintText: {
        color: "rgba(255,255,255,0.6)",
        fontSize: 9,
        fontWeight: "500",
    },

    // Uploading
    uploadingOverlay: {
        alignItems: "center",
        gap: 6,
    },
    uploadingText: {
        color: "rgba(255,255,255,0.4)",
        fontSize: 10,
        fontWeight: "500",
    },

    tip: {
        color: "rgba(255,255,255,0.22)",
        fontSize: 12,
        textAlign: "center",
        lineHeight: 18,
    },

    // Footer
    footer: {
        paddingHorizontal: 24,
        paddingBottom: 24,
        paddingTop: 8,
        gap: 14,
    },
    countRow: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 6,
    },
    countDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: "rgba(255,255,255,0.12)",
    },
    countDotFilled: {
        backgroundColor: colors.iris,
        width: 18,
        borderRadius: 3,
    },
    nextBtn: {
        backgroundColor: colors.iris,
        paddingVertical: 17,
        borderRadius: 18,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        shadowColor: colors.iris,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
        elevation: 8,
    },
    nextBtnDisabled: { opacity: 0.35 },
    nextBtnText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
        letterSpacing: 0.1,
    },
});
