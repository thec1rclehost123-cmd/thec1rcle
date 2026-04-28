import { useEffect, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    ActivityIndicator,
    Alert,
    StyleSheet,
    Linking
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { useLocalSearchParams, router } from "expo-router";
import { colors, gradients, shadows, radii } from "@/lib/design/theme";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useAuthStore } from "@/store/authStore";
import {
    initiateDMRequest,
    blockUser,
    reportUser,
    isUserBlocked,
    checkEventEntitlement,
} from "@/lib/social";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import * as Haptics from "expo-haptics";

interface UserProfile {
    displayName: string;
    photoURL?: string;
    coverPhotoUrl?: string;
    city?: string;
    bio?: string;
    tagline?: string;
    instagram?: string;
    snapchat?: string;
    isVerified?: boolean;
    privacy?: {
        showUpcomingEvents: boolean;
        showAttendedEvents: boolean;
        showStats: boolean;
        isPrivateProfile: boolean;
    };
    memberSince?: Date;
}

export default function ProfileViewScreen() {
    const { id, eventId } = useLocalSearchParams<{ id: string; eventId?: string }>();
    const { user } = useAuthStore();
    const insets = useSafeAreaInsets();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [hasEntitlement, setHasEntitlement] = useState(false);

    useEffect(() => {
        loadProfile();
    }, [id]);

    const loadProfile = async () => {
        if (!id || !user?.uid) return;

        setLoading(true);

        try {
            const db = getFirebaseDb();
            const userDoc = await getDoc(doc(db, "users", id));

            if (userDoc.exists()) {
                const data = userDoc.data();
                setProfile({
                    displayName: data.displayName || "Guest",
                    photoURL: data.photoURL,
                    coverPhotoUrl: data.coverPhotoUrl,
                    city: data.city,
                    bio: data.bio,
                    tagline: data.tagline,
                    instagram: data.instagram,
                    snapchat: data.snapchat,
                    isVerified: data.isVerified,
                    privacy: data.privacy,
                    memberSince: data.createdAt?.toDate?.(),
                });
            }

            // Check if blocked
            const blocked = await isUserBlocked(user.uid, id);
            setIsBlocked(blocked);

            // Check if can message (both have entitlements to same event)
            if (eventId) {
                const entitlement = await checkEventEntitlement(id, eventId);
                setHasEntitlement(!!entitlement);
            }
        } catch (error: any) {
            console.error("Error loading profile:", error);
            if (error.message?.includes("offline")) {
                Alert.alert("Connection Issue", "It seems we can't reach the server right now. Some data might be missing.");
            }
        }

        setLoading(false);
    };

    const handleMessage = async () => {
        if (!user?.uid || !id) return;

        if (!eventId) {
            Alert.alert("Error", "Messages can only be sent within event context");
            return;
        }

        setActionLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const result = await initiateDMRequest(user.uid, id, eventId);

        setActionLoading(false);

        if (result.success && result.conversationId) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.push({
                pathname: "/social/dm/[id]",
                params: {
                    id: result.conversationId,
                    recipientName: profile?.displayName,
                    eventId
                }
            });
        } else {
            Alert.alert("Error", result.error || "Unable to start conversation");
        }
    };

    const handleBlock = async () => {
        if (!user?.uid || !id) return;

        Alert.alert(
            "Block User",
            "This user won't be able to message you anywhere. You can unblock them later from settings.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Block",
                    style: "destructive",
                    onPress: async () => {
                        await blockUser(user.uid, id, eventId, true);
                        setIsBlocked(true);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }
                }
            ]
        );
    };

    const handleReport = () => {
        router.push({
            pathname: "/social/report",
            params: { userId: id, eventId }
        });
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-midnight items-center justify-center">
                <ActivityIndicator size="large" color="#F44A22" />
            </SafeAreaView>
        );
    }

    if (!profile) {
        return (
            <SafeAreaView className="flex-1 bg-midnight">
                <View className="flex-row items-center px-4 py-3 border-b border-white/10">
                    <Pressable onPress={() => router.back()} className="mr-4 flex-row items-center">
                        <Ionicons name="arrow-back" size={20} color="#FFD700" style={{ marginRight: 4 }} />
                        <Text className="text-gold text-lg">Back</Text>
                    </Pressable>
                </View>
                <View className="flex-1 items-center justify-center">
                    <Ionicons name="close-circle-outline" size={64} color="rgba(255, 255, 255, 0.2)" style={{ marginBottom: 16 }} />
                    <Text className="text-gold font-semibold text-lg">User Not Found</Text>
                </View>
            </SafeAreaView>
        );
    }

    // If private profile and not friends (entitlement check is a proxy for being in same event)
    const isActuallyPrivate = profile.privacy?.isPrivateProfile && !hasEntitlement;


    const initials = profile.displayName
        .split(" ")
        .map(n => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    return (
        <View style={styles.container}>
            {/* Header / Social Overlay */}
            <View style={[styles.headerOverlay, { paddingTop: insets.top }]}>
                <Pressable onPress={() => router.back()} style={styles.headerButton}>
                    <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
                </Pressable>

                <Pressable
                    onPress={() => {
                        Alert.alert("Options", undefined, [
                            { text: "Cancel", style: "cancel" },
                            { text: "Report User", onPress: handleReport },
                            {
                                text: isBlocked ? "Unblock" : "Block User",
                                style: "destructive",
                                onPress: handleBlock,
                            },
                        ]);
                    }}
                    style={styles.headerButton}
                >
                    <Ionicons name="ellipsis-horizontal" size={20} color="#FFFFFF" />
                </Pressable>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={{ paddingBottom: 60 }}
                showsVerticalScrollIndicator={false}
                bounces={true}
            >
                {/* Hero Section */}
                <View style={styles.heroSection}>
                    {/* Background Echo */}
                    <View style={styles.coverContainer}>
                        {profile.photoURL ? (
                            <Image
                                source={{ uri: profile.photoURL }}
                                style={styles.coverImage}
                                contentFit="cover"
                            />
                        ) : (
                            <View style={[styles.coverImage, { backgroundColor: "#1A1A1A" }]} />
                        )}
                        <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
                        <LinearGradient
                            colors={["transparent", "rgba(5, 5, 5, 0.8)", "#050505"]}
                            style={StyleSheet.absoluteFill}
                        />
                    </View>

                    {/* Profile Photo */}
                    <View style={styles.avatarContainer}>
                        {profile.photoURL ? (
                            <Image
                                source={{ uri: profile.photoURL }}
                                style={styles.avatar}
                            />
                        ) : (
                            <LinearGradient
                                colors={["#2A1A1A", "#1A0A0A"]}
                                style={[styles.avatar, styles.placeholderAvatar]}
                            >
                                <Text style={styles.placeholderText}>{initials}</Text>
                            </LinearGradient>
                        )}
                        {profile.isVerified && (
                            <LinearGradient
                                colors={["#4A90E2", "#357ABD"]}
                                style={styles.verifiedBadge}
                            >
                                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                            </LinearGradient>
                        )}
                    </View>

                    {/* Identity */}
                    <Text style={styles.displayName}>{profile.displayName}</Text>
                    {profile.tagline ? (
                        <Text style={styles.tagline}>{profile.tagline}</Text>
                    ) : (
                        profile.city && (
                            <View style={styles.locationContainer}>
                                <Ionicons name="location-outline" size={14} color="rgba(255, 255, 255, 0.5)" style={{ marginRight: 4 }} />
                                <Text style={styles.location}>{profile.city}</Text>
                            </View>
                        )
                    )}

                    {/* Stats Row (Public versions) */}
                    {profile.privacy?.showStats !== false && (
                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>—</Text>
                                <Text style={styles.statLabel}>Events</Text>
                            </View>
                            <View style={styles.statDivider} />

                            {/* Social Icons */}
                            <View style={styles.socialIcons}>
                                {profile.instagram && (
                                    <Pressable onPress={() => Linking.openURL(`https://instagram.com/${profile.instagram}`)}>
                                        <Ionicons name="logo-instagram" size={20} color="#FFFFFF" />
                                    </Pressable>
                                )}
                                {profile.snapchat && (
                                    <Pressable onPress={() => Linking.openURL(`https://snapchat.com/add/${profile.snapchat}`)}>
                                        <Ionicons name="logo-snapchat" size={20} color="#FFFFFF" />
                                    </Pressable>
                                )}
                                {!profile.instagram && !profile.snapchat && (
                                    <Ionicons name="share-social-outline" size={20} color="rgba(255,255,255,0.2)" />
                                )}
                            </View>

                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>
                                    {profile.memberSince ? profile.memberSince.getFullYear() : "—"}
                                </Text>
                                <Text style={styles.statLabel}>Joined</Text>
                            </View>
                        </View>
                    )}

                    {/* Bio */}
                    {profile.bio && (
                        <View style={styles.bioContainer}>
                            <Text style={styles.bioText}>{profile.bio}</Text>
                        </View>
                    )}

                    {/* Action Buttons */}
                    {!isBlocked && eventId && hasEntitlement && (
                        <View style={styles.actionsContainer}>
                            <Pressable
                                onPress={handleMessage}
                                disabled={actionLoading}
                                style={styles.messageButton}
                            >
                                {actionLoading ? (
                                    <ActivityIndicator size="small" color="#000000" />
                                ) : (
                                    <>
                                        <Ionicons name="chatbubble" size={18} color="#000000" />
                                        <Text style={styles.messageButtonText}>Message</Text>
                                    </>
                                )}
                            </Pressable>
                        </View>
                    )}
                </View>

                {/* Content Section */}
                <View style={styles.contentSection}>
                    {isActuallyPrivate ? (
                        <View style={styles.privateMessage}>
                            <Ionicons name="lock-closed-outline" size={40} color="rgba(255,255,255,0.2)" />
                            <Text style={styles.privateText}>This profile is private</Text>
                        </View>
                    ) : (
                        <>
                            {/* USER CONTRIBUTION / GALLERY SHORTCUT */}
                            <Animated.View
                                entering={FadeInDown.delay(500)}
                                style={styles.communitySection}
                            >
                                <View style={styles.communityHeader}>
                                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                                        <Ionicons name="camera" size={14} color={colors.iris} style={{ marginRight: 8 }} />
                                        <Text style={styles.communityTitle}>GALLERY DROPS</Text>
                                    </View>
                                </View>

                                <Pressable
                                    onPress={() => eventId && router.push({ pathname: "/social/gallery/[eventId]", params: { eventId } })}
                                    style={styles.communityCard}
                                >
                                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                        <View>
                                            <Text style={styles.communityHighlight}>CONTRIBUTIONS</Text>
                                            <Text style={styles.communityValue}>ACTIVE</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.2)" />
                                    </View>
                                </Pressable>
                            </Animated.View>

                            <View style={styles.privacyNote}>
                                <Ionicons name="shield-checkmark" size={14} color="rgba(255,255,255,0.4)" />
                                <Text style={styles.privacyNoteText}>
                                    Mandatory Privacy Active • Email and ticket counts are never shown publicly.
                                </Text>
                            </View>
                        </>
                    )}
                </View>

                {isBlocked && (
                    <View style={styles.blockedBadge}>
                        <Text style={styles.blockedText}>User Blocked</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#050505",
    },
    headerOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 20,
    },
    headerButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(0, 0, 0, 0.3)",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
    },
    scrollView: {
        flex: 1,
    },
    heroSection: {
        alignItems: "center",
    },
    coverContainer: {
        width: "100%",
        height: 320,
        position: "absolute",
        top: 0,
    },
    coverImage: {
        width: "100%",
        height: "100%",
    },
    avatarContainer: {
        marginTop: 180,
        width: 160,
        height: 160,
        borderRadius: 80,
        padding: 4,
        backgroundColor: "#050505",
        justifyContent: "center",
        alignItems: "center",
    },
    avatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 2,
        borderColor: "rgba(255, 255, 255, 0.1)",
    },
    placeholderAvatar: {
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#1A1A1A",
    },
    placeholderText: {
        color: "#FFFFFF",
        fontSize: 40,
        fontWeight: "700",
    },
    verifiedBadge: {
        position: "absolute",
        bottom: 8,
        right: 8,
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: "#050505",
        alignItems: "center",
        justifyContent: "center",
    },
    displayName: {
        color: "#FFFFFF",
        fontSize: 28,
        fontWeight: "800",
        marginTop: 16,
    },
    tagline: {
        color: "rgba(255, 255, 255, 0.6)",
        fontSize: 15,
        fontWeight: "500",
        marginTop: 4,
    },
    location: {
        color: "rgba(255, 255, 255, 0.5)",
        fontSize: 14,
    },
    locationContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 4,
    },
    statsRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 24,
        paddingHorizontal: 30,
    },
    statItem: {
        alignItems: "center",
        paddingHorizontal: 20,
    },
    statValue: {
        color: "#FFFFFF",
        fontSize: 18,
        fontWeight: "700",
    },
    statLabel: {
        color: "rgba(255, 255, 255, 0.4)",
        fontSize: 12,
        fontWeight: "600",
        textTransform: "uppercase",
        marginTop: 2,
    },
    statDivider: {
        width: 1,
        height: 20,
        backgroundColor: "rgba(255, 255, 255, 0.1)",
    },
    socialIcons: {
        flexDirection: "row",
        gap: 16,
        paddingHorizontal: 20,
    },
    bioContainer: {
        paddingHorizontal: 40,
        marginTop: 20,
    },
    bioText: {
        color: "rgba(255, 255, 255, 0.7)",
        fontSize: 14,
        lineHeight: 20,
        textAlign: "center",
    },
    actionsContainer: {
        width: "100%",
        paddingHorizontal: 40,
        marginTop: 30,
    },
    messageButton: {
        backgroundColor: "#FFFFFF",
        height: 52,
        borderRadius: 26,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    messageButtonText: {
        color: "#000000",
        fontSize: 16,
        fontWeight: "700",
    },
    contentSection: {
        paddingHorizontal: 20,
        marginTop: 40,
    },
    privateMessage: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 40,
    },
    privateText: {
        color: "rgba(255, 255, 255, 0.3)",
        fontSize: 16,
        marginTop: 12,
    },
    privacyNote: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255, 255, 255, 0.03)",
        padding: 12,
        borderRadius: 12,
        gap: 8,
    },
    privacyNoteText: {
        color: "rgba(255, 255, 255, 0.4)",
        fontSize: 11,
        textAlign: "center",
    },
    blockedBadge: {
        backgroundColor: "rgba(255, 69, 58, 0.1)",
        padding: 10,
        borderRadius: 10,
        marginTop: 20,
        marginHorizontal: 40,
        borderWidth: 1,
        borderColor: "rgba(255, 69, 58, 0.2)",
    },
    blockedText: {
        color: "#FF453A",
        fontSize: 13,
        textAlign: "center",
        fontWeight: "600",
    },

    // COMMUNITY SECTION
    communitySection: {
        marginTop: 10,
        marginBottom: 30,
    },
    communityHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    communityTitle: {
        color: "rgba(255, 255, 255, 0.4)",
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 1.5,
    },
    communityCard: {
        backgroundColor: "rgba(255, 255, 255, 0.03)",
        borderRadius: 20,
        padding: 24,
        marginHorizontal: 20,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.05)",
    },
    communityHighlight: {
        color: "rgba(255, 255, 255, 0.4)",
        fontSize: 10,
        fontWeight: "600",
        textTransform: "uppercase",
    },
    communityValue: {
        color: "#FFFFFF",
        fontSize: 24,
        fontWeight: "900",
        marginTop: 4,
    },
});
