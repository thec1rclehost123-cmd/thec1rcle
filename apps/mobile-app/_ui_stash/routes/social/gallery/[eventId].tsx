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
        <Animated.View entering={FadeIn.delay(index * 30)}>
            <Pressable
                onPress={onPress}
                style={{ width: ITEM_SIZE, height: ITEM_SIZE, margin: GAP / 2 }}
            >
                <Image
                    source={{ uri: media.thumbnailUrl || media.mediaUrl }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                    transition={200}
                />
                {media.likes > 0 && (
                    <View className="absolute bottom-1 right-1 bg-black/50 px-1.5 py-0.5 rounded-full flex-row items-center">
                        <Text className="text-white text-xs">❤️ {media.likes}</Text>
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

    const formattedDate = media.createdAt?.toDate?.()
        ? new Date(media.createdAt.toDate()).toLocaleDateString("en-IN", {
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
            <View className="flex-1 bg-black">
                <SafeAreaView className="flex-1">
                    {/* Header */}
                    <View className="flex-row items-center justify-between px-4 py-3">
                        <Pressable onPress={onClose}>
                            <Text className="text-white text-lg">✕</Text>
                        </Pressable>

                        <View className="flex-row items-center">
                            <View className="w-8 h-8 rounded-full bg-surface items-center justify-center mr-2">
                                <Text className="text-sm">👤</Text>
                            </View>
                            <View>
                                <Text className="text-white font-semibold">{media.userName}</Text>
                                <Text className="text-white/50 text-xs">{formattedDate}</Text>
                            </View>
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
                        >
                            <Text className="text-white text-2xl">⋮</Text>
                        </Pressable>
                    </View>

                    {/* Image */}
                    <View className="flex-1 items-center justify-center">
                        <Image
                            source={{ uri: media.mediaUrl }}
                            style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.25 }}
                            contentFit="contain"
                            transition={200}
                        />
                    </View>

                    {/* Caption */}
                    {media.caption && (
                        <View className="px-4 py-3">
                            <Text className="text-white">{media.caption}</Text>
                        </View>
                    )}

                    {/* Actions */}
                    <View className="flex-row items-center justify-center gap-8 py-6">
                        <Pressable
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                onLike();
                            }}
                            className="items-center"
                        >
                            <Text className="text-3xl">{isLiked ? "❤️" : "🤍"}</Text>
                            <Text className="text-white mt-1">{media.likes}</Text>
                        </Pressable>
                    </View>
                </SafeAreaView>
            </View>
        </Modal>
    );
}

// Upload progress overlay
function UploadProgress({ progress }: { progress: MediaUploadProgress | null }) {
    if (!progress || progress.status === "complete") return null;

    return (
        <View className="absolute inset-0 bg-black/80 items-center justify-center z-50">
            <Animated.View entering={ZoomIn} className="bg-surface rounded-bubble p-8 items-center">
                {progress.status === "error" ? (
                    <>
                        <Text className="text-4xl mb-4">❌</Text>
                        <Text className="text-red-400 font-semibold mb-2">Upload Failed</Text>
                        <Text className="text-gold-stone text-sm">{progress.error}</Text>
                    </>
                ) : (
                    <>
                        <ActivityIndicator size="large" color="#F44A22" />
                        <Text className="text-gold mt-4 font-semibold">
                            {progress.status === "processing" ? "Processing..." : "Uploading..."}
                        </Text>
                        <View className="w-48 h-2 bg-midnight rounded-full mt-4 overflow-hidden">
                            <View
                                className="h-full bg-iris rounded-full"
                                style={{ width: `${progress.progress}%` }}
                            />
                        </View>
                        <Text className="text-gold-stone text-sm mt-2">
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
                { text: "📷 Take Photo", onPress: handleTakePhoto },
                { text: "🖼️ From Gallery", onPress: handlePickImage },
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
            <SafeAreaView className="flex-1 bg-midnight">
                <View className="flex-row items-center px-4 py-3 border-b border-white/10">
                    <Pressable onPress={() => router.back()} className="mr-4">
                        <Text className="text-gold text-lg">←</Text>
                    </Pressable>
                    <Text className="text-gold font-semibold">{eventTitle}</Text>
                </View>

                <View className="flex-1 items-center justify-center px-6">
                    <Text className="text-6xl mb-4">📸</Text>
                    <Text className="text-gold font-satoshi-bold text-xl mb-2">Photos Locked</Text>
                    <Text className="text-gold-stone text-center mb-6">
                        You need a ticket to view and share event photos
                    </Text>
                    <Pressable
                        onPress={() => router.push({ pathname: "/event/[id]", params: { id: eventId } })}
                        className="bg-iris px-6 py-3 rounded-pill"
                    >
                        <Text className="text-white font-semibold">Get Tickets</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-midnight">
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
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-white/10">
                <View className="flex-row items-center">
                    <Pressable onPress={() => router.back()} className="mr-4">
                        <Text className="text-gold text-lg">←</Text>
                    </Pressable>
                    <View>
                        <Text className="text-gold font-semibold" numberOfLines={1}>{eventTitle}</Text>
                        <Text className="text-gold-stone text-xs">Photo Gallery • {media.length} photos</Text>
                    </View>
                </View>

                {canUpload && (
                    <Pressable
                        onPress={handleAddMedia}
                        className="bg-iris w-10 h-10 rounded-full items-center justify-center"
                    >
                        <Text className="text-white text-xl">+</Text>
                    </Pressable>
                )}
            </View>

            {/* Gallery */}
            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
            >
                {loading ? (
                    <View className="items-center py-20">
                        <ActivityIndicator size="large" color="#F44A22" />
                        <Text className="text-gold-stone mt-4">Loading photos...</Text>
                    </View>
                ) : media.length === 0 ? (
                    <View className="items-center py-20 px-6">
                        <Text className="text-6xl mb-4">📷</Text>
                        <Text className="text-gold font-satoshi-bold text-xl mb-2">No Photos Yet</Text>
                        <Text className="text-gold-stone text-center mb-6">
                            Be the first to share a moment from this event!
                        </Text>
                        {canUpload && (
                            <Pressable
                                onPress={handleAddMedia}
                                className="bg-iris px-6 py-3 rounded-pill"
                            >
                                <Text className="text-white font-semibold">Share Photo</Text>
                            </Pressable>
                        )}
                    </View>
                ) : (
                    <View className="flex-row flex-wrap" style={{ padding: GAP / 2 }}>
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

                {/* Bottom spacing */}
                <View className="h-20" />
            </ScrollView>
        </SafeAreaView>
    );
}
