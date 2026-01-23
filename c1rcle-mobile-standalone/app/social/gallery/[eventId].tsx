import { useEffect, useState, useCallback } from "react";
import {
    View,
    Text,
    ScrollView,
    Pressable,
    ActivityIndicator,
    Modal,
    Dimensions,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useLocalSearchParams, router } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { Ionicons } from "@expo/vector-icons";
import { colors, gradients, shadows, radii } from "@/lib/design/theme";
import { AuroraBackground } from "@/components/ui/PremiumEffects";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, StatusBar } from "react-native";
import {
    EventMedia,
    MediaUploadProgress,
    subscribeToEventMedia,
    uploadEventMedia,
    toggleMediaLike,
    deleteMedia,
    reportMedia,
    pickImage,
    takePhoto,
    getEventPhase,
    checkEventEntitlement,
} from "@/lib/social";
import * as Haptics from "expo-haptics";
import Animated, {
    FadeIn,
    FadeInDown,
    ZoomIn,
    SlideInUp,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const COLUMN_COUNT = 3;
const GAP = 2;
const ITEM_SIZE = (SCREEN_WIDTH - GAP * (COLUMN_COUNT + 1)) / COLUMN_COUNT;

// Grid item component
function MediaGridItem({
    media,
    index,
    onPress
}: {
    media: EventMedia;
    index: number;
    onPress: () => void;
}) {
    return (
        <Animated.View entering={FadeInDown.delay(index * 20).springify()}>
            <Pressable
                onPress={onPress}
                style={{
                    width: ITEM_SIZE,
                    height: ITEM_SIZE,
                    margin: GAP / 2,
                    borderRadius: 12,
                    overflow: "hidden",
                    backgroundColor: "rgba(255,255,255,0.05)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.08)",
                }}
            >
                <Image
                    source={{ uri: media.thumbnailUrl || media.mediaUrl }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                    transition={400}
                />

                {media.likes > 0 && (
                    <View style={{
                        position: "absolute",
                        bottom: 8,
                        right: 8,
                        backgroundColor: "rgba(0,0,0,0.6)",
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 10,
                        flexDirection: "row",
                        alignItems: "center",
                    }}>
                        <Ionicons name="heart" size={10} color={colors.iris} style={{ marginRight: 4 }} />
                        <Text style={{ color: "white", fontSize: 10, fontWeight: "800" }}>{media.likes}</Text>
                    </View>
                )}
            </Pressable>
        </Animated.View>
    );
}

// Full screen media viewer
function MediaViewer({
    media,
    visible,
    onClose,
    currentUserId,
    onLike,
    onDelete,
    onReport,
}: {
    media: EventMedia | null;
    visible: boolean;
    onClose: () => void;
    currentUserId: string;
    onLike: () => void;
    onDelete: () => void;
    onReport: () => void;
}) {
    if (!media) return null;

    const isOwn = media.userId === currentUserId;
    const isLiked = media.likedBy?.includes(currentUserId);
    const insets = useSafeAreaInsets();

    const formattedDate = media.createdAt?.toDate?.()
        ? new Date(media.createdAt.toDate()).toLocaleTimeString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        })
        : "";

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent
            onRequestClose={onClose}
        >
            <View style={{ flex: 1, backgroundColor: "#000" }}>
                <StatusBar barStyle="light-content" />
                <AuroraBackground intensity="medium" />

                {/* Header */}
                <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 20,
                    paddingTop: insets.top + 10,
                    paddingBottom: 20,
                    zIndex: 10,
                }}>
                    <Pressable
                        onPress={onClose}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: "rgba(255,255,255,0.08)",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Ionicons name="close" size={24} color="#fff" />
                    </Pressable>

                    <View style={{ alignItems: "center" }}>
                        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>{media.userName.toUpperCase()}</Text>
                        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "600", marginTop: 2 }}>{formattedDate}</Text>
                    </View>

                    <Pressable
                        onPress={() => {
                            Alert.alert(
                                "Options",
                                undefined,
                                [
                                    { text: "Cancel", style: "cancel" },
                                    isOwn && { text: "Delete", style: "destructive", onPress: onDelete },
                                    !isOwn && { text: "Report", onPress: onReport },
                                ].filter(Boolean) as any
                            );
                        }}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: "rgba(255,255,255,0.08)",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
                    </Pressable>
                </View>

                {/* Image Container with Spatial Blur */}
                <View style={{ flex: 1, justifyContent: "center" }}>
                    <Animated.View entering={ZoomIn.duration(400)} style={{ shadowColor: "#000", shadowRadius: 30, shadowOpacity: 0.5 }}>
                        <Image
                            source={{ uri: media.mediaUrl }}
                            style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.25, backgroundColor: "#0A0A0A" }}
                            contentFit="contain"
                        />
                    </Animated.View>
                </View>

                {/* Footer Content */}
                <BlurView intensity={30} tint="dark" style={{ paddingBottom: insets.bottom + 20 }}>
                    {media.caption && (
                        <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 10 }}>
                            <Text style={{ color: "#fff", fontSize: 16, lineHeight: 24, fontWeight: "400" }}>{media.caption}</Text>
                        </View>
                    )}

                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 30, paddingVertical: 20 }}>
                        <Pressable
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                onLike();
                            }}
                            style={{ alignItems: "center" }}
                        >
                            <View style={{
                                width: 64,
                                height: 64,
                                borderRadius: 32,
                                backgroundColor: isLiked ? colors.iris : "rgba(255,255,255,0.08)",
                                alignItems: "center",
                                justifyContent: "center",
                                shadowColor: isLiked ? colors.iris : "transparent",
                                shadowRadius: 15,
                                shadowOpacity: 0.3,
                            }}>
                                <Ionicons
                                    name={isLiked ? "heart" : "heart-outline"}
                                    size={32}
                                    color={isLiked ? "#FFFFFF" : "rgba(255,255,255,0.8)"}
                                />
                            </View>
                            <Text style={{ color: "#fff", fontWeight: "900", marginTop: 8, fontSize: 14 }}>{media.likes}</Text>
                        </Pressable>
                    </View>
                </BlurView>
            </View>
        </Modal>
    );
}

// Upload progress overlay
function UploadProgress({ progress }: { progress: MediaUploadProgress | null }) {
    if (!progress || progress.status === "complete") return null;

    return (
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <Animated.View entering={ZoomIn} style={{ backgroundColor: "#111", borderRadius: 32, padding: 32, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", shadowColor: colors.iris, shadowRadius: 30, shadowOpacity: 0.3 }}>
                {progress.status === "error" ? (
                    <>
                        <Ionicons name="close-circle-outline" size={64} color="#FF4444" style={{ marginBottom: 16 }} />
                        <Text style={{ color: "#FF4444", fontWeight: "800", fontSize: 18, marginBottom: 8 }}>Upload Failed</Text>
                        <Text style={{ color: "rgba(255,255,255,0.5)", textAlign: "center", fontSize: 13 }}>{progress.error}</Text>
                    </>
                ) : (
                    <>
                        <ActivityIndicator size="large" color={colors.iris} />
                        <Text style={{ color: "#fff", marginTop: 20, fontWeight: "900", letterSpacing: 1 }}>
                            {progress.status === "processing" ? "POLISHING..." : "DROPPING..."}
                        </Text>
                        <View style={{ width: 200, height: 4, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 2, marginTop: 24, overflow: "hidden" }}>
                            <Animated.View
                                style={{
                                    height: "100%",
                                    backgroundColor: colors.iris,
                                    width: `${progress.progress}%`,
                                }}
                            />
                        </View>
                        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: "700", marginTop: 12 }}>
                            {Math.round(progress.progress)}%
                        </Text>
                    </>
                )}
            </Animated.View>
        </View>
    );
}

export default function MediaGalleryScreen() {
    const { eventId, eventTitle } = useLocalSearchParams<{
        eventId: string;
        eventTitle: string;
    }>();
    const { user } = useAuthStore();

    const [media, setMedia] = useState<EventMedia[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasAccess, setHasAccess] = useState(false);
    const [selectedMedia, setSelectedMedia] = useState<EventMedia | null>(null);
    const [showViewer, setShowViewer] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<MediaUploadProgress | null>(null);
    const [canUpload, setCanUpload] = useState(false);

    useEffect(() => {
        if (!eventId || !user?.uid) return;

        checkAccess();
    }, [eventId, user?.uid]);

    const checkAccess = async () => {
        const entitlement = await checkEventEntitlement(user!.uid, eventId!);
        setHasAccess(!!entitlement);

        // Check if in post-event phase for uploads
        // For now, allow uploads in all phases
        setCanUpload(!!entitlement);

        if (entitlement) {
            // Subscribe to media
            const unsubscribe = subscribeToEventMedia(eventId!, (newMedia) => {
                setMedia(newMedia);
                setLoading(false);
            });

            return () => unsubscribe();
        } else {
            setLoading(false);
        }
    };

    const handleUpload = async (uri: string) => {
        if (!user?.uid || !eventId) return;

        Alert.prompt(
            "Add Caption",
            "Optional caption for your photo",
            [
                { text: "Skip", onPress: () => doUpload(uri, undefined) },
                {
                    text: "Add",
                    onPress: (caption?: string) => doUpload(uri, caption)
                },
            ],
            "plain-text"
        );
    };

    const doUpload = async (uri: string, caption?: string) => {
        setUploadProgress({ progress: 0, status: "uploading" });

        const result = await uploadEventMedia(
            eventId!,
            user!.uid,
            user!.displayName || "Guest",
            uri,
            caption,
            setUploadProgress
        );

        if (result.success) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setTimeout(() => setUploadProgress(null), 1500);
        } else {
            setTimeout(() => setUploadProgress(null), 3000);
        }
    };

    const handlePickImage = async () => {
        const uri = await pickImage();
        if (uri) handleUpload(uri);
    };

    const handleTakePhoto = async () => {
        const uri = await takePhoto();
        if (uri) handleUpload(uri);
    };

    const handleAddMedia = () => {
        Alert.alert(
            "Add Photo",
            "Share a moment from this event",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Take Photo", onPress: handleTakePhoto },
                { text: "From Gallery", onPress: handlePickImage },
            ]
        );
    };

    const handleLike = async () => {
        if (!selectedMedia || !user?.uid) return;

        const result = await toggleMediaLike(selectedMedia.id, user.uid);
        if (result.success) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            // Update local state
            setMedia(prev => prev.map(m => {
                if (m.id === selectedMedia.id) {
                    return {
                        ...m,
                        likes: result.isLiked ? m.likes + 1 : m.likes - 1,
                        likedBy: result.isLiked
                            ? [...(m.likedBy || []), user.uid]
                            : (m.likedBy || []).filter(id => id !== user.uid),
                    };
                }
                return m;
            }));

            // Update selected media
            setSelectedMedia(prev => prev ? {
                ...prev,
                likes: result.isLiked ? prev.likes + 1 : prev.likes - 1,
                likedBy: result.isLiked
                    ? [...(prev.likedBy || []), user.uid]
                    : (prev.likedBy || []).filter(id => id !== user.uid),
            } : null);
        }
    };

    const handleDelete = async () => {
        if (!selectedMedia || !user?.uid) return;

        Alert.alert(
            "Delete Photo",
            "This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        const result = await deleteMedia(selectedMedia.id, user.uid);
                        if (result.success) {
                            setShowViewer(false);
                            setSelectedMedia(null);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        } else {
                            Alert.alert("Error", result.error || "Failed to delete");
                        }
                    }
                },
            ]
        );
    };

    const handleReport = async () => {
        if (!selectedMedia || !user?.uid) return;

        Alert.alert(
            "Report Photo",
            "Report this photo for violating community guidelines?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Report",
                    style: "destructive",
                    onPress: async () => {
                        await reportMedia(selectedMedia.id, user.uid, "inappropriate");
                        setShowViewer(false);
                        Alert.alert("Reported", "Thank you. We'll review this photo.");
                    }
                },
            ]
        );
    };

    // Access denied
    if (!hasAccess && !loading) {
        return (
            <View style={{ flex: 1, backgroundColor: "#000" }}>
                <AuroraBackground intensity="medium" />
                <SafeAreaView style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12 }}>
                        <Pressable onPress={() => router.back()} style={{ marginRight: 16 }}>
                            <Ionicons name="chevron-back" size={28} color="#FFF" />
                        </Pressable>
                        <Text style={{ color: "#FFF", fontWeight: "900", fontSize: 24, letterSpacing: -1 }}>GALLERY</Text>
                    </View>

                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 }}>
                        <View style={{
                            width: 100,
                            height: 100,
                            borderRadius: 50,
                            backgroundColor: "rgba(255, 255, 255, 0.05)",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: 24,
                            borderWidth: 1,
                            borderColor: "rgba(255, 255, 255, 0.1)",
                        }}>
                            <Ionicons name="lock-closed" size={40} color="rgba(255,255,255,0.4)" />
                        </View>
                        <Text style={{ color: "#FFF", fontSize: 28, fontWeight: "900", letterSpacing: -0.5, marginBottom: 12 }}>LOCKED</Text>
                        <Text style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", fontSize: 15, lineHeight: 22, marginBottom: 32 }}>
                            You need an active entitlement to this event to view and drop photos in the community gallery.
                        </Text>
                        <Pressable
                            onPress={() => router.push({ pathname: "/event/[id]", params: { id: eventId } })}
                            style={{ backgroundColor: colors.iris, paddingHorizontal: 32, paddingVertical: 18, borderRadius: 20 }}
                        >
                            <Text style={{ color: "white", fontWeight: "900", fontSize: 16, letterSpacing: 1 }}>GET ACCESS</Text>
                        </Pressable>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: "#000" }}>
            <StatusBar barStyle="light-content" />
            <AuroraBackground intensity="subtle" />

            {/* Upload Progress Overlay */}
            <UploadProgress progress={uploadProgress} />

            {/* Media Viewer Modal */}
            <MediaViewer
                media={selectedMedia}
                visible={showViewer}
                onClose={() => {
                    setShowViewer(false);
                    setSelectedMedia(null);
                }}
                currentUserId={user?.uid || ""}
                onLike={handleLike}
                onDelete={handleDelete}
                onReport={handleReport}
            />

            {/* Header */}
            <SafeAreaView edges={["top"]}>
                <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Pressable
                            onPress={() => router.back()}
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: "rgba(255,255,255,0.06)",
                                alignItems: "center",
                                justifyContent: "center",
                                marginRight: 16
                            }}
                        >
                            <Ionicons name="chevron-back" size={24} color="#FFF" />
                        </Pressable>
                        <View>
                            <Text style={{ color: "#FFF", fontSize: 24, fontWeight: "900", letterSpacing: -0.5 }}>GALLERY</Text>
                            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "700", marginTop: 2 }}>
                                {eventTitle?.toUpperCase()} • {media.length} SHOTS
                            </Text>
                        </View>
                    </View>

                    {canUpload && (
                        <Pressable
                            onPress={handleAddMedia}
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: 22,
                                backgroundColor: colors.iris,
                                alignItems: "center",
                                justifyContent: "center",
                                shadowColor: colors.iris,
                                shadowRadius: 10,
                                shadowOpacity: 0.3,
                            }}
                        >
                            <Ionicons name="add" size={28} color="#fff" />
                        </Pressable>
                    )}
                </View>
            </SafeAreaView>

            {/* Gallery Grid */}
            <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: GAP / 2, paddingBottom: 100 }}
            >
                {loading ? (
                    <View style={{ alignItems: "center", paddingVertical: 100 }}>
                        <ActivityIndicator size="large" color={colors.iris} />
                        <Text style={{ color: "rgba(255,255,255,0.4)", marginTop: 20 }}>fetching raw drops...</Text>
                    </View>
                ) : media.length === 0 ? (
                    <View style={{ alignItems: "center", paddingVertical: 100, paddingHorizontal: 40 }}>
                        <View style={{
                            width: 80,
                            height: 80,
                            borderRadius: 40,
                            backgroundColor: "rgba(255,255,255,0.03)",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: 24
                        }}>
                            <Ionicons name="camera-outline" size={32} color="rgba(255,255,255,0.2)" />
                        </View>
                        <Text style={{ color: "#FFF", fontSize: 20, fontWeight: "900", marginBottom: 8 }}>NO SHOTS YET</Text>
                        <Text style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", fontSize: 14, marginBottom: 32 }}>
                            Be the first to drop a memory from tonight.
                        </Text>
                        {canUpload && (
                            <Pressable
                                onPress={handleAddMedia}
                                style={{ backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16 }}
                            >
                                <Text style={{ color: "#FFF", fontWeight: "800" }}>SHARE FIRST PHOTO</Text>
                            </Pressable>
                        )}
                    </View>
                ) : (
                    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                        {media.map((item, index) => (
                            <MediaGridItem
                                key={item.id}
                                media={item}
                                index={index}
                                onPress={() => {
                                    setSelectedMedia(item);
                                    setShowViewer(true);
                                    Haptics.selectionAsync();
                                }}
                            />
                        ))}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
