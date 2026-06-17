import { useMemo, useState } from "react";
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from "react-native";
import type { ImageSourcePropType } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { ArrowLeft, BadgeCheck, Heart, MapPin, MessageCircle, Send, Sparkles, X } from "lucide-react-native";
import { colors, radii, spacing } from "@/lib/design/theme";
import { useAuthStore } from "@/store/authStore";
import { MOCK_PROFILES } from "@/lib/data/mockDating";
import type { DatingProfile, Prompt, DatingPhoto } from "@/lib/data/mockDating";

type ReplyTarget = {
    profile: DatingProfile;
    prompt: Prompt;
} | null;

function ProfileHeader({
    profile,
    liked,
    onPass,
    onLike,
    onReply,
    stageHeight,
}: {
    profile: DatingProfile;
    liked: boolean;
    onPass: () => void;
    onLike: () => void;
    onReply: () => void;
    stageHeight: number;
}) {
    return (
        <View style={[styles.heroStage, { height: stageHeight }]}>
            <View style={styles.backCardFar} />
            <View style={styles.backCardNear} />
            <Pressable
                style={styles.hero}
                onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({
                        pathname: "/dating/[id]",
                        params: { id: profile.id },
                    });
                }}
            >
                <Image source={profile.photos[0].source} style={styles.heroImage} contentFit="cover" contentPosition="center" />
                <LinearGradient
                    colors={["rgba(95,0,12,0.02)", "rgba(0,0,0,0.08)", "rgba(0,0,0,0.88)"]}
                    locations={[0, 0.45, 1]}
                    style={StyleSheet.absoluteFill}
                />
                <View style={styles.heroActionRail}>
                    <Pressable accessibilityLabel="Pass profile" style={styles.railButton} onPress={onPass}>
                        <X size={25} color="#fff" strokeWidth={2.5} />
                    </Pressable>
                    <Pressable
                        accessibilityLabel="Like profile"
                        style={[styles.railButton, liked && styles.railButtonActive]}
                        onPress={onLike}
                    >
                        <Heart size={26} color="#fff" fill="#fff" />
                    </Pressable>
                    <Pressable accessibilityLabel="Reply to prompt" style={styles.railButton} onPress={onReply}>
                        <MessageCircle size={25} color="#fff" fill="#fff" />
                    </Pressable>
                </View>
                <View style={styles.heroCopy}>
                    <View style={styles.locationRow}>
                        <MapPin size={15} color="rgba(255,255,255,0.86)" fill="rgba(255,255,255,0.86)" />
                        <Text style={styles.locationText}>{profile.venue}</Text>
                    </View>
                    <View style={styles.nameRow}>
                        <Text style={styles.nameText}>{profile.name}, {profile.age}</Text>
                        <BadgeCheck size={23} color="#3CA4FF" fill="#3CA4FF" />
                    </View>
                    <View style={styles.cardTags}>
                        {profile.tags.slice(0, 3).map((tag) => (
                            <View key={tag} style={styles.cardTag}>
                                <Text style={styles.cardTagText}>{tag}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            </Pressable>
        </View>
    );
}



function ReplySheet({
    target,
    value,
    onChangeText,
    onClose,
    onSend,
}: {
    target: ReplyTarget;
    value: string;
    onChangeText: (next: string) => void;
    onClose: () => void;
    onSend: () => void;
}) {
    return (
        <Modal visible={target !== null} transparent animationType="slide" onRequestClose={onClose}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.modalRoot}
            >
                <Pressable style={styles.modalScrim} onPress={onClose} />
                <View style={styles.replySheet}>
                    <View style={styles.sheetHandle} />
                    <Text style={styles.sheetEyebrow}>Replying to {target?.profile.name}</Text>
                    <Text style={styles.sheetPrompt}>{target?.prompt.title}</Text>
                    <Text style={styles.sheetAnswer}>{target?.prompt.answer}</Text>
                    <TextInput
                        value={value}
                        onChangeText={onChangeText}
                        autoFocus
                        multiline
                        maxLength={180}
                        placeholder="Write a reply..."
                        placeholderTextColor="rgba(255,255,255,0.34)"
                        style={styles.replyInput}
                    />
                    <View style={styles.sheetActions}>
                        <Pressable style={styles.cancelReplyButton} onPress={onClose}>
                            <Text style={styles.cancelReplyText}>Cancel</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.sendReplyButton, !value.trim() && styles.sendReplyButtonDisabled]}
                            onPress={onSend}
                            disabled={!value.trim()}
                        >
                            <Send size={16} color="#fff" />
                            <Text style={styles.sendReplyText}>Send reply</Text>
                        </Pressable>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

export default function DatingScreen() {
    const insets = useSafeAreaInsets();
    const { user } = useAuthStore();
    const { height: screenHeight } = useWindowDimensions();
    const [profileIndex, setProfileIndex] = useState(0);
    const [likesSent, setLikesSent] = useState<string[]>([]);
    const [superlikesSent, setSuperlikesSent] = useState<string[]>([]);
    const [chatStarts, setChatStarts] = useState<Array<{ profileId: string; text: string }>>([]);
    const [replyTarget, setReplyTarget] = useState<ReplyTarget>(null);
    const [replyText, setReplyText] = useState("");
    const [toast, setToast] = useState("Ready for tonight");

    const profile = MOCK_PROFILES[profileIndex % MOCK_PROFILES.length];
    const alreadyLiked = likesSent.includes(profile.id);
    const alreadySuperliked = superlikesSent.includes(profile.id);

    const initials = useMemo(() => {
        if (!user?.displayName) return "C";
        return user.displayName
            .split(" ")
            .map((name) => name[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
    }, [user?.displayName]);

    const advanceProfile = (message: string) => {
        setToast(message);
        setProfileIndex((current) => current + 1);
    };

    const handlePass = () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        advanceProfile(`${profile.name} dismissed`);
    };

    const handleLike = () => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setLikesSent((current) => current.includes(profile.id) ? current : [...current, profile.id]);
        setChatStarts((current) => [
            { profileId: profile.id, text: `Liked ${profile.name}` },
            ...current,
        ].slice(0, 4));
        advanceProfile(`Like sent to ${profile.name}`);
    };

    const handleSuperlike = () => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSuperlikesSent((current) => current.includes(profile.id) ? current : [...current, profile.id]);
        setChatStarts((current) => [
            { profileId: profile.id, text: `Superliked ${profile.name}` },
            ...current,
        ].slice(0, 4));
        advanceProfile(`Superlike sent to ${profile.name}`);
    };

    const handleOpenReply = (prompt: Prompt) => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setReplyTarget({ profile, prompt });
        setReplyText("");
    };

    const handleSendReply = () => {
        if (!replyText.trim() || !replyTarget) return;
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setLikesSent((current) => current.includes(replyTarget.profile.id) ? current : [...current, replyTarget.profile.id]);
        setChatStarts((current) => [
            { profileId: replyTarget.profile.id, text: `Reply sent: ${replyText.trim()}` },
            ...current,
        ].slice(0, 4));
        setToast(`Reply sent to ${replyTarget.profile.name}`);
        setReplyTarget(null);
        setReplyText("");
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                pointerEvents="none"
                colors={["#8B0618", "#42050D", "#000000"]}
                locations={[0, 0.38, 0.76]}
                style={StyleSheet.absoluteFill}
            />
            <View
                key={profile.id}
                style={[
                    styles.content,
                    { flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom + 116 },
                ]}
            >
                <View style={styles.header}>
                    <Pressable
                        style={styles.backButton}
                        onPress={() => {
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.back();
                        }}
                    >
                        <ArrowLeft size={25} color="#fff" strokeWidth={2.6} />
                    </Pressable>
                    <Text style={styles.title}>People You May Like</Text>
                    <View style={{ width: 44 }} />
                </View>

                <ProfileHeader
                    profile={profile}
                    liked={alreadyLiked}
                    onPass={handlePass}
                    onLike={handleLike}
                    onReply={() => handleOpenReply(profile.prompts[0])}
                    stageHeight={screenHeight * 0.64}
                />
            </View>

            <ReplySheet
                target={replyTarget}
                value={replyText}
                onChangeText={setReplyText}
                onClose={() => setReplyTarget(null)}
                onSend={handleSendReply}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.base.DEFAULT,
    },
    content: {
        paddingHorizontal: 18,
        gap: spacing.base,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: 54,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.14)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.18)",
    },
    title: {
        color: "#fff",
        flex: 1,
        fontSize: 21,
        fontWeight: "800",
        letterSpacing: 0,
        textAlign: "center",
        marginHorizontal: 10,
    },
    subtitle: {
        color: "rgba(255,255,255,0.44)",
        fontSize: 13,
        marginTop: 2,
    },
    profileButton: {
        width: 52,
        height: 52,
        borderRadius: 26,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.18)",
        backgroundColor: "rgba(255,255,255,0.14)",
    },
    profileImage: {
        width: "100%",
        height: "100%",
    },
    profileFallback: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(244,74,34,0.12)",
    },
    profileInitials: {
        color: colors.iris,
        fontSize: 14,
        fontWeight: "800",
    },
    statusRow: {
        alignSelf: "center",
        minHeight: 42,
        minWidth: "68%",
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.14)",
        backgroundColor: "rgba(0,0,0,0.18)",
        paddingHorizontal: spacing.lg,
        paddingVertical: 9,
        justifyContent: "center",
        alignItems: "center",
    },
    statusText: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "700",
    },
    statusMeta: {
        color: "rgba(255,255,255,0.42)",
        fontSize: 11,
        marginTop: 2,
    },
    heroStage: {
        justifyContent: "flex-end",
        marginTop: 14,
        marginBottom: spacing.sm,
    },
    backCardFar: {
        position: "absolute",
        top: 0,
        left: 28,
        right: 28,
        bottom: 24,
        borderRadius: 34,
        backgroundColor: "rgba(255,255,255,0.08)",
    },
    backCardNear: {
        position: "absolute",
        top: 12,
        left: 14,
        right: 14,
        bottom: 12,
        borderRadius: 34,
        backgroundColor: "rgba(255,255,255,0.14)",
    },
    hero: {
        position: "absolute",
        top: 24,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 34,
        overflow: "hidden",
        backgroundColor: colors.base[100],
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.22)",
    },
    heroImage: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
    },
    heroActionRail: {
        position: "absolute",
        right: 14,
        bottom: 116,
        width: 62,
        borderRadius: 31,
        overflow: "hidden",
        backgroundColor: "rgba(0,0,0,0.36)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.16)",
    },
    railButton: {
        width: 62,
        height: 62,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.12)",
        borderTopWidth: 1,
        borderTopColor: "rgba(255,255,255,0.08)",
    },
    railButtonSoft: {
        position: "absolute",
        right: 14,
        bottom: 248,
        width: 58,
        height: 58,
        borderRadius: 29,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,184,78,0.34)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
    },
    railButtonPurple: {
        backgroundColor: "rgba(139,92,246,0.42)",
    },
    railButtonActive: {
        backgroundColor: colors.iris,
    },
    heroCopy: {
        position: "absolute",
        left: spacing.lg,
        right: 92,
        bottom: spacing.lg,
    },
    locationRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginBottom: 10,
    },
    locationText: {
        color: "rgba(255,255,255,0.82)",
        fontSize: 16,
        fontWeight: "800",
    },
    nameRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
    },
    nameText: {
        color: "#fff",
        fontSize: 29,
        fontWeight: "800",
        letterSpacing: 0,
        flexShrink: 1,
    },
    headlineText: {
        color: "rgba(255,255,255,0.82)",
        fontSize: 13,
        lineHeight: 18,
        marginTop: 7,
        fontWeight: "600",
    },
    eventPill: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        marginTop: spacing.md,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radii.pill,
        backgroundColor: "rgba(244,74,34,0.14)",
        borderWidth: 1,
        borderColor: "rgba(244,74,34,0.32)",
        maxWidth: "100%",
    },
    eventPillText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "800",
        flexShrink: 1,
    },
    cardTags: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginTop: spacing.md,
    },
    cardTag: {
        borderRadius: radii.pill,
        paddingHorizontal: 14,
        paddingVertical: 9,
        backgroundColor: "rgba(0,0,0,0.4)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
    },
    cardTagText: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "800",
    },
    quickFacts: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    quickFact: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 12,
        fontWeight: "700",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radii.pill,
        backgroundColor: "rgba(255,255,255,0.06)",
        overflow: "hidden",
    },
    tagsWrap: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 9,
    },
    tagPill: {
        borderRadius: radii.pill,
        paddingHorizontal: 13,
        paddingVertical: 9,
        backgroundColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
    },
    tagText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "800",
    },
    promptBlock: {
        borderRadius: 24,
        padding: spacing.lg,
        backgroundColor: "#151515",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    promptTitle: {
        color: "rgba(255,255,255,0.45)",
        fontSize: 13,
        fontWeight: "800",
        textTransform: "uppercase",
    },
    promptAnswer: {
        color: "#fff",
        fontSize: 25,
        lineHeight: 31,
        fontWeight: "800",
        letterSpacing: 0,
        marginTop: spacing.sm,
    },
    replyButton: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        marginTop: spacing.lg,
        borderRadius: radii.pill,
        paddingHorizontal: 13,
        paddingVertical: 9,
        backgroundColor: "rgba(244,74,34,0.12)",
        borderWidth: 1,
        borderColor: "rgba(244,74,34,0.22)",
    },
    replyButtonText: {
        color: colors.iris,
        fontSize: 13,
        fontWeight: "800",
    },
    photoSection: {
        minHeight: 500,
        borderRadius: 28,
        overflow: "hidden",
        backgroundColor: colors.base[100],
    },
    sectionImage: {
        ...StyleSheet.absoluteFillObject,
    },
    captionGradient: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        minHeight: 116,
        justifyContent: "flex-end",
        padding: spacing.lg,
    },
    captionText: {
        color: "#fff",
        fontSize: 17,
        lineHeight: 22,
        fontWeight: "800",
    },
    endBlock: {
        alignItems: "center",
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xxl,
    },
    endTitle: {
        color: "#fff",
        fontSize: 21,
        fontWeight: "800",
    },
    endBody: {
        color: "rgba(255,255,255,0.44)",
        fontSize: 13,
        lineHeight: 20,
        textAlign: "center",
        marginTop: spacing.sm,
    },
    bottomFade: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
    },
    actionsBar: {
        position: "absolute",
        left: 0,
        right: 0,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
    },
    actionButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.09)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.16)",
    },
    likeButton: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: colors.iris,
        borderColor: "rgba(255,255,255,0.24)",
        shadowColor: colors.iris,
        shadowOpacity: 0.32,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 8 },
    },
    superlikeButton: {
        backgroundColor: "#8B5CF6",
        borderColor: "rgba(255,255,255,0.2)",
    },
    actionButtonActive: {
        transform: [{ scale: 0.96 }],
    },
    modalRoot: {
        flex: 1,
        justifyContent: "flex-end",
    },
    modalScrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.62)",
    },
    replySheet: {
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.xl,
        backgroundColor: "#111111",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
    },
    sheetHandle: {
        alignSelf: "center",
        width: 38,
        height: 4,
        borderRadius: 2,
        backgroundColor: "rgba(255,255,255,0.18)",
        marginBottom: spacing.lg,
    },
    sheetEyebrow: {
        color: colors.iris,
        fontSize: 12,
        fontWeight: "800",
        textTransform: "uppercase",
    },
    sheetPrompt: {
        color: "#fff",
        fontSize: 21,
        fontWeight: "800",
        marginTop: spacing.sm,
    },
    sheetAnswer: {
        color: "rgba(255,255,255,0.62)",
        fontSize: 15,
        lineHeight: 21,
        marginTop: 6,
    },
    replyInput: {
        minHeight: 104,
        borderRadius: 20,
        marginTop: spacing.lg,
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        color: "#fff",
        fontSize: 16,
        lineHeight: 22,
        textAlignVertical: "top",
        backgroundColor: "rgba(255,255,255,0.07)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
    },
    sheetActions: {
        flexDirection: "row",
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    cancelReplyButton: {
        flex: 1,
        minHeight: 50,
        borderRadius: radii.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.08)",
    },
    cancelReplyText: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 14,
        fontWeight: "800",
    },
    sendReplyButton: {
        flex: 1.3,
        minHeight: 50,
        borderRadius: radii.pill,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: colors.iris,
    },
    sendReplyButtonDisabled: {
        opacity: 0.45,
    },
    sendReplyText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "800",
    },
});
