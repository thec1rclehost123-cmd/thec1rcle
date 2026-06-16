import { useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Pressable,
    ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft, MessageCircle, Heart } from "lucide-react-native";
import { Image } from "expo-image";
import { colors } from "@/lib/design/theme";
import { useAuthStore } from "@/store/authStore";
import { useDatingStore, type Match } from "@/store/datingStore";
import { formatTimeAgo } from "@/lib/social";

function MatchCard({ match }: { match: Match }) {
    const initials = match.displayName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    const handleMessage = () => {
        if (match.conversationId) {
            router.push(`/social/dm/${match.conversationId}` as any);
        } else {
            // No DM yet — navigate to their profile to initiate
            router.push(`/social/profile/${match.otherUserId}` as any);
        }
    };

    return (
        <Pressable style={styles.matchCard} onPress={handleMessage}>
            {/* Avatar */}
            <View style={styles.avatarWrap}>
                {match.photoURL ? (
                    <Image
                        source={typeof match.photoURL === 'string' ? { uri: match.photoURL } : match.photoURL}
                        style={styles.avatar}
                        contentFit="cover"
                    />
                ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                        <Text style={styles.avatarInitials}>{initials}</Text>
                    </View>
                )}
                {/* Online indicator */}
                <View style={styles.onlineDot} />
            </View>

            {/* Info */}
            <View style={styles.matchInfo}>
                <Text style={styles.matchName}>{match.displayName}</Text>
                <Text style={styles.matchEvent} numberOfLines={1}>
                    🎟 {match.sharedEventTitle}
                </Text>
                <Text style={styles.matchTime}>
                    Matched {formatTimeAgo(new Date(match.matchedAt))}
                </Text>
            </View>

            {/* Message button */}
            <Pressable style={styles.msgBtn} onPress={handleMessage}>
                <MessageCircle size={18} color={colors.iris} strokeWidth={2} />
            </Pressable>
        </Pressable>
    );
}

export default function MatchesScreen() {
    const insets = useSafeAreaInsets();
    const { user } = useAuthStore();
    const { matches, matchesLoading, fetchMatches } = useDatingStore();

    useEffect(() => {
        if (user?.uid) fetchMatches(user.uid);
    }, [user?.uid]);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable style={styles.backBtn} onPress={() => router.back()}>
                    <ArrowLeft size={22} color="#fff" />
                </Pressable>
                <Text style={styles.headerTitle}>Your Matches</Text>
                <View style={{ width: 38 }} />
            </View>

            {matchesLoading ? (
                <View style={styles.center}>
                    <ActivityIndicator color={colors.iris} size="large" />
                </View>
            ) : matches.length === 0 ? (
                <View style={styles.center}>
                    <View style={styles.emptyIconWrap}>
                        <Heart size={36} color={colors.iris} />
                    </View>
                    <Text style={styles.emptyTitle}>No matches yet</Text>
                    <Text style={styles.emptyBody}>
                        When you and someone both like each other, you'll see them here.
                    </Text>
                    <Pressable
                        style={styles.discoverBtn}
                        onPress={() => router.back()}
                    >
                        <Text style={styles.discoverBtnText}>Start Swiping</Text>
                    </Pressable>
                </View>
            ) : (
                <FlatList bounces={false} overScrollMode="never"
                    data={matches}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => <MatchCard match={item} />}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={
                        <Text style={styles.matchCount}>
                            {matches.length} {matches.length === 1 ? "match" : "matches"}
                        </Text>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.base.DEFAULT,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: "rgba(255,255,255,0.07)",
        alignItems: "center",
        justifyContent: "center",
    },
    headerTitle: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
    },
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
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
    discoverBtn: {
        backgroundColor: colors.iris,
        paddingHorizontal: 28,
        paddingVertical: 13,
        borderRadius: 24,
    },
    discoverBtnText: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "700",
    },
    list: {
        paddingHorizontal: 16,
        paddingBottom: 120,
        gap: 12,
    },
    matchCount: {
        color: "rgba(255,255,255,0.35)",
        fontSize: 12,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 8,
        marginTop: 4,
    },
    matchCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#1C1C1E",
        borderRadius: 16,
        padding: 14,
        gap: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
    },
    avatarWrap: {
        position: "relative",
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
    },
    avatarFallback: {
        backgroundColor: "rgba(244,74,34,0.12)",
        alignItems: "center",
        justifyContent: "center",
    },
    avatarInitials: {
        color: colors.iris,
        fontSize: 20,
        fontWeight: "700",
    },
    onlineDot: {
        position: "absolute",
        bottom: 1,
        right: 1,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: "#22C55E",
        borderWidth: 2,
        borderColor: "#1C1C1E",
    },
    matchInfo: {
        flex: 1,
        gap: 3,
    },
    matchName: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
    matchEvent: {
        color: "rgba(255,255,255,0.45)",
        fontSize: 12,
    },
    matchTime: {
        color: "rgba(255,255,255,0.3)",
        fontSize: 11,
    },
    msgBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(244,74,34,0.12)",
        borderWidth: 1,
        borderColor: "rgba(244,74,34,0.25)",
        alignItems: "center",
        justifyContent: "center",
    },
});
