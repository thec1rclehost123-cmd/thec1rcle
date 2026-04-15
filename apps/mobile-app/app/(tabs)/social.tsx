import { useState, useCallback, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    Dimensions,
    Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Heart, X, Sparkles } from "lucide-react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    interpolate,
    runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { colors } from "@/lib/design/theme";
import { useAuthStore } from "@/store/authStore";
import { useDatingStore, type DatingProfile, type Match } from "@/store/datingStore";
import { useSocialProfileStore } from "@/store/socialProfileStore";
import { SoftBlockSheet } from "@/components/SoftBlockSheet";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const CARD_W = SCREEN_W - 40;
const CARD_H = SCREEN_H * 0.58;
const SWIPE_THRESHOLD = 90;
const SWIPE_VELOCITY = 500;

// ── Swipe card component ──────────────────────────────────────────────────────
function SwipeCard({
    profile,
    onSwipedOff,
}: {
    profile: DatingProfile;
    onSwipedOff: (direction: "like" | "pass") => void;
}) {
    const tx = useSharedValue(0);
    const ty = useSharedValue(0);

    const gesture = Gesture.Pan()
        .onUpdate((e) => {
            tx.value = e.translationX;
            ty.value = e.translationY * 0.4; // dampen vertical
        })
        .onEnd((e) => {
            const shouldFly =
                Math.abs(e.translationX) > SWIPE_THRESHOLD ||
                Math.abs(e.velocityX) > SWIPE_VELOCITY;

            if (shouldFly) {
                const dir = e.translationX > 0 ? 1 : -1;
                tx.value = withTiming(dir * (SCREEN_W + 150), { duration: 300 });
                ty.value = withTiming(ty.value + 60, { duration: 300 });
                runOnJS(onSwipedOff)(dir > 0 ? "like" : "pass");
            } else {
                tx.value = withSpring(0, { damping: 20, stiffness: 220 });
                ty.value = withSpring(0, { damping: 20, stiffness: 220 });
            }
        });

    const cardStyle = useAnimatedStyle(() => {
        const rotate = interpolate(tx.value, [-SCREEN_W / 2, 0, SCREEN_W / 2], [-18, 0, 18]);
        return {
            transform: [
                { translateX: tx.value },
                { translateY: ty.value },
                { rotate: `${rotate}deg` },
            ],
        };
    });

    const likeStyle = useAnimatedStyle(() => ({
        opacity: interpolate(tx.value, [0, 70], [0, 1]),
    }));

    const nopeStyle = useAnimatedStyle(() => ({
        opacity: interpolate(tx.value, [-70, 0], [1, 0]),
    }));

    const initials = profile.displayName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    return (
        <GestureDetector gesture={gesture}>
            <Animated.View style={[styles.card, cardStyle]}>
                {/* Photo */}
                {profile.photoURL ? (
                    <Image
                        source={{ uri: profile.photoURL }}
                        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                        contentFit="cover"
                    />
                ) : (
                    <View style={styles.avatarFallback}>
                        <Text style={styles.avatarInitials}>{initials}</Text>
                    </View>
                )}

                {/* Bottom gradient */}
                <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.82)"]}
                    locations={[0.45, 1]}
                    style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: CARD_H * 0.55 }}
                    pointerEvents="none"
                />

                {/* LIKE stamp */}
                <Animated.View style={[styles.likeStamp, likeStyle]}>
                    <Text style={styles.likeStampText}>LIKE</Text>
                </Animated.View>

                {/* NOPE stamp */}
                <Animated.View style={[styles.nopeStamp, nopeStyle]}>
                    <Text style={styles.nopeStampText}>NOPE</Text>
                </Animated.View>

                {/* Info */}
                <View style={styles.cardInfo}>
                    <View style={styles.nameRow}>
                        <Text style={styles.cardName}>{profile.displayName}</Text>
                        {profile.isVerified && (
                            <View style={styles.verifiedBadge}>
                                <Text style={styles.verifiedCheck}>✓</Text>
                            </View>
                        )}
                    </View>

                    {profile.city ? (
                        <Text style={styles.cardCity}>📍 {profile.city}</Text>
                    ) : null}

                    {profile.bio ? (
                        <Text style={styles.cardBio} numberOfLines={2}>{profile.bio}</Text>
                    ) : null}

                    {/* Shared event context */}
                    <View style={styles.eventPill}>
                        <Text style={styles.eventPillText} numberOfLines={1}>
                            🎟 Going to {profile.sharedEventTitle}
                        </Text>
                    </View>

                    {/* Vibe tags */}
                    {profile.vibeTags && profile.vibeTags.length > 0 && (
                        <View style={styles.tagsRow}>
                            {profile.vibeTags.slice(0, 3).map((tag) => (
                                <View key={tag} style={styles.vibeTag}>
                                    <Text style={styles.vibeTagText}>{tag}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            </Animated.View>
        </GestureDetector>
    );
}

// ── Match modal ───────────────────────────────────────────────────────────────
function MatchModal({
    match,
    onClose,
    onMessage,
}: {
    match: Match;
    onClose: () => void;
    onMessage: () => void;
}) {
    return (
        <View style={styles.modalOverlay}>
            <View style={styles.matchModal}>
                {/* Sparkle heading */}
                <View style={styles.matchIconRow}>
                    <Sparkles size={28} color={colors.iris} />
                </View>
                <Text style={styles.matchTitle}>It's a Match!</Text>
                <Text style={styles.matchSubtitle}>
                    You and {match.displayName} both liked each other
                </Text>

                {/* Avatars */}
                <View style={styles.matchAvatars}>
                    <View style={[styles.matchAvatar, styles.matchAvatarLeft]}>
                        {match.photoURL ? (
                            <Image source={{ uri: match.photoURL }} style={styles.matchAvatarImg} contentFit="cover" />
                        ) : (
                            <View style={[styles.matchAvatarImg, styles.matchAvatarFallback]}>
                                <Text style={styles.matchAvatarInitials}>
                                    {match.displayName.slice(0, 2).toUpperCase()}
                                </Text>
                            </View>
                        )}
                    </View>
                    <View style={[styles.matchAvatar, styles.matchAvatarRight]}>
                        <View style={[styles.matchAvatarImg, styles.matchAvatarFallback]}>
                            <Heart size={24} color={colors.iris} fill={colors.iris} />
                        </View>
                    </View>
                </View>

                <Text style={styles.matchEventText}>
                    Met at: {match.sharedEventTitle}
                </Text>

                <Pressable style={styles.matchMessageBtn} onPress={onMessage}>
                    <MessageIcon />
                    <Text style={styles.matchMessageBtnText}>Send a Message</Text>
                </Pressable>

                <Pressable style={styles.matchKeepSwipingBtn} onPress={onClose}>
                    <Text style={styles.matchKeepSwipingText}>Keep Swiping</Text>
                </Pressable>
            </View>
        </View>
    );
}

function MessageIcon() {
    return (
        <View style={{ marginRight: 8 }}>
            <Heart size={18} color="#fff" fill="#fff" />
        </View>
    );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function SocialScreen() {
    const insets = useSafeAreaInsets();
    const { user } = useAuthStore();
    const {
        profiles,
        matches,
        loading,
        fetchProfiles,
        fetchMatches,
        likeUser,
        passUser,
        removeTopProfile,
    } = useDatingStore();
    const { checkAccess, loadSocialProfile } = useSocialProfileStore();

    const [pendingMatch, setPendingMatch] = useState<Match | null>(null);

    useEffect(() => {
        if (user?.uid) {
            loadSocialProfile(user.uid).then(() => {
                // Only load swipe profiles if user is verified
                const { socialState: state } = useSocialProfileStore.getState();
                if (state === "verified" || state === "complete") {
                    fetchProfiles(user.uid);
                    fetchMatches(user.uid);
                }
            });
        }
    }, [user?.uid]);

    const handleSwipedOff = useCallback(
        async (direction: "like" | "pass") => {
            if (!user?.uid || profiles.length === 0) return;
            const top = profiles[0];

            // Remove card from deck after 280ms fly-off
            setTimeout(() => removeTopProfile(), 280);

            if (direction === "like") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                const result = await likeUser(user.uid, top);
                if (result.isMatch && result.match) {
                    setPendingMatch(result.match);
                }
            } else {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                passUser(user.uid, top.userId);
            }
        },
        [profiles, user?.uid]
    );

    // Button-triggered like / pass — guard: must be verified
    const handleLikeBtn = useCallback(() => {
        if (!checkAccess("verified", "dating")) return;
        if (profiles.length === 0) return;
        handleSwipedOff("like");
    }, [profiles, handleSwipedOff, checkAccess]);

    const handlePassBtn = useCallback(() => {
        if (profiles.length === 0) return;
        handleSwipedOff("pass");
    }, [profiles, handleSwipedOff]);

    const goToMatches = () => router.push("/social/matches" as any);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Meet People</Text>
                    <Text style={styles.headerSub}>People going to your events</Text>
                </View>
                <Pressable style={styles.matchesPill} onPress={goToMatches}>
                    <Heart size={15} color={colors.iris} fill={colors.iris} />
                    <Text style={styles.matchesPillText}>
                        {matches.length > 0 ? `${matches.length} Matches` : "Matches"}
                    </Text>
                    {matches.length > 0 && <View style={styles.matchDot} />}
                </Pressable>
            </View>

            {/* Content */}
            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator color={colors.iris} size="large" />
                    <Text style={styles.loadingText}>Finding people nearby…</Text>
                </View>
            ) : profiles.length === 0 ? (
                <View style={styles.center}>
                    <View style={styles.emptyIconWrap}>
                        <Heart size={36} color={colors.iris} />
                    </View>
                    <Text style={styles.emptyTitle}>No one to show yet</Text>
                    <Text style={styles.emptyBody}>
                        People attending the same upcoming events as you will appear here. Buy
                        a ticket to meet others!
                    </Text>
                    <Pressable
                        style={styles.exploreBtn}
                        onPress={() => router.push("/(tabs)/explore")}
                    >
                        <Text style={styles.exploreBtnText}>Browse Events</Text>
                    </Pressable>
                </View>
            ) : (
                // Card stack — render bottom → top so top card is on top
                <View style={styles.deckArea}>
                    {profiles[2] && (
                        <View style={[styles.card, styles.thirdCard]}>
                            {profiles[2].photoURL && (
                                <Image
                                    source={{ uri: profiles[2].photoURL }}
                                    style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                                    contentFit="cover"
                                />
                            )}
                        </View>
                    )}
                    {profiles[1] && (
                        <View style={[styles.card, styles.secondCard]}>
                            {profiles[1].photoURL && (
                                <Image
                                    source={{ uri: profiles[1].photoURL }}
                                    style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                                    contentFit="cover"
                                />
                            )}
                            <LinearGradient
                                colors={["transparent", "rgba(0,0,0,0.7)"]}
                                locations={[0.5, 1]}
                                style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 80 }}
                                pointerEvents="none"
                            />
                            <View style={styles.secondCardName}>
                                <Text style={styles.cardName}>{profiles[1].displayName}</Text>
                            </View>
                        </View>
                    )}
                    {profiles[0] && (
                        <SwipeCard
                            key={profiles[0].userId}
                            profile={profiles[0]}
                            onSwipedOff={handleSwipedOff}
                        />
                    )}
                </View>
            )}

            {/* Action buttons */}
            {!loading && profiles.length > 0 && (
                <View style={styles.actions}>
                    <Pressable style={styles.passBtn} onPress={handlePassBtn}>
                        <X size={26} color="rgba(255,255,255,0.7)" strokeWidth={2.5} />
                    </Pressable>
                    <Pressable style={styles.likeBtn} onPress={handleLikeBtn}>
                        <Heart size={26} color="#fff" fill="#fff" />
                    </Pressable>
                </View>
            )}

            {/* Match modal */}
            <Modal
                visible={pendingMatch !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setPendingMatch(null)}
            >
                {pendingMatch && (
                    <MatchModal
                        match={pendingMatch}
                        onClose={() => setPendingMatch(null)}
                        onMessage={() => {
                            setPendingMatch(null);
                            goToMatches();
                        }}
                    />
                )}
            </Modal>

            {/* Soft block sheet — shown when gated feature is accessed */}
            <SoftBlockSheet />
        </View>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.base.DEFAULT,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    headerTitle: {
        color: "#fff",
        fontSize: 26,
        fontWeight: "700",
        letterSpacing: -0.5,
    },
    headerSub: {
        color: "rgba(255,255,255,0.4)",
        fontSize: 12,
        marginTop: 2,
    },
    matchesPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "rgba(244,74,34,0.12)",
        borderWidth: 1,
        borderColor: "rgba(244,74,34,0.25)",
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
    },
    matchesPillText: {
        color: colors.iris,
        fontSize: 13,
        fontWeight: "600",
    },
    matchDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: colors.iris,
    },
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
    },
    loadingText: {
        color: "rgba(255,255,255,0.4)",
        marginTop: 12,
        fontSize: 14,
    },
    emptyIconWrap: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: "rgba(244,74,34,0.1)",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
    },
    emptyTitle: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "700",
        marginBottom: 10,
    },
    emptyBody: {
        color: "rgba(255,255,255,0.45)",
        fontSize: 14,
        textAlign: "center",
        lineHeight: 22,
        marginBottom: 24,
    },
    exploreBtn: {
        backgroundColor: colors.iris,
        paddingHorizontal: 28,
        paddingVertical: 13,
        borderRadius: 24,
    },
    exploreBtnText: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "700",
    },

    // Card deck
    deckArea: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8,
    },
    card: {
        position: "absolute",
        width: CARD_W,
        height: CARD_H,
        borderRadius: 20,
        overflow: "hidden",
        backgroundColor: "#1C1C1E",
    },
    secondCard: {
        transform: [{ scale: 0.95 }, { translateY: 12 }],
    },
    thirdCard: {
        transform: [{ scale: 0.90 }, { translateY: 24 }],
        opacity: 0.6,
    },
    secondCardName: {
        position: "absolute",
        bottom: 16,
        left: 16,
    },
    avatarFallback: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#2C2C2E",
    },
    avatarInitials: {
        color: colors.iris,
        fontSize: 52,
        fontWeight: "700",
    },

    // Stamps
    likeStamp: {
        position: "absolute",
        top: 28,
        left: 24,
        borderWidth: 3,
        borderColor: "#22C55E",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 4,
        transform: [{ rotate: "-15deg" }],
    },
    likeStampText: {
        color: "#22C55E",
        fontSize: 28,
        fontWeight: "900",
        letterSpacing: 2,
    },
    nopeStamp: {
        position: "absolute",
        top: 28,
        right: 24,
        borderWidth: 3,
        borderColor: "#EF4444",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 4,
        transform: [{ rotate: "15deg" }],
    },
    nopeStampText: {
        color: "#EF4444",
        fontSize: 28,
        fontWeight: "900",
        letterSpacing: 2,
    },

    // Card info
    cardInfo: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        gap: 6,
    },
    nameRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    cardName: {
        color: "#fff",
        fontSize: 22,
        fontWeight: "700",
        letterSpacing: -0.3,
    },
    verifiedBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: "#3B82F6",
        alignItems: "center",
        justifyContent: "center",
    },
    verifiedCheck: {
        color: "#fff",
        fontSize: 11,
        fontWeight: "700",
    },
    cardCity: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 13,
    },
    cardBio: {
        color: "rgba(255,255,255,0.65)",
        fontSize: 13,
        lineHeight: 18,
    },
    eventPill: {
        alignSelf: "flex-start",
        backgroundColor: "rgba(244,74,34,0.25)",
        borderWidth: 1,
        borderColor: "rgba(244,74,34,0.4)",
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginTop: 2,
    },
    eventPillText: {
        color: "#FCA089",
        fontSize: 12,
        fontWeight: "600",
    },
    tagsRow: {
        flexDirection: "row",
        gap: 6,
        marginTop: 2,
        flexWrap: "wrap",
    },
    vibeTag: {
        backgroundColor: "rgba(255,255,255,0.12)",
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 3,
    },
    vibeTagText: {
        color: "rgba(255,255,255,0.8)",
        fontSize: 12,
    },

    // Action buttons
    actions: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 32,
        paddingBottom: 100,
        paddingTop: 12,
    },
    passBtn: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: "#1C1C1E",
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.15)",
        alignItems: "center",
        justifyContent: "center",
    },
    likeBtn: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: colors.iris,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: colors.iris,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
        elevation: 8,
    },

    // Match modal
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.85)",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
    },
    matchModal: {
        width: "100%",
        backgroundColor: "#1C1C1E",
        borderRadius: 28,
        padding: 28,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(244,74,34,0.3)",
    },
    matchIconRow: {
        marginBottom: 8,
    },
    matchTitle: {
        color: "#fff",
        fontSize: 28,
        fontWeight: "800",
        letterSpacing: -0.5,
        marginBottom: 6,
    },
    matchSubtitle: {
        color: "rgba(255,255,255,0.55)",
        fontSize: 14,
        textAlign: "center",
        marginBottom: 24,
    },
    matchAvatars: {
        flexDirection: "row",
        justifyContent: "center",
        marginBottom: 16,
        gap: -16,
    },
    matchAvatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 3,
        overflow: "hidden",
    },
    matchAvatarLeft: {
        borderColor: "#22C55E",
        zIndex: 2,
    },
    matchAvatarRight: {
        borderColor: colors.iris,
        marginLeft: -16,
        zIndex: 1,
    },
    matchAvatarImg: {
        width: "100%",
        height: "100%",
    },
    matchAvatarFallback: {
        backgroundColor: "rgba(244,74,34,0.15)",
        alignItems: "center",
        justifyContent: "center",
    },
    matchAvatarInitials: {
        color: colors.iris,
        fontSize: 22,
        fontWeight: "700",
    },
    matchEventText: {
        color: "rgba(255,255,255,0.4)",
        fontSize: 12,
        marginBottom: 24,
    },
    matchMessageBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.iris,
        width: "100%",
        paddingVertical: 14,
        borderRadius: 20,
        marginBottom: 12,
    },
    matchMessageBtnText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },
    matchKeepSwipingBtn: {
        paddingVertical: 10,
    },
    matchKeepSwipingText: {
        color: "rgba(255,255,255,0.4)",
        fontSize: 14,
    },
});
