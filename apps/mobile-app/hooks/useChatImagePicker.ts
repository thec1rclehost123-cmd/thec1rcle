/**
 * Chat Image Picker Hook
 *
 * Provides image picking (camera/gallery), compressing, uploading to
 * Firebase Storage, and returning the download URL for chat messages.
 */

import { useState, useCallback } from "react";
import { Alert, ActionSheetIOS, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { apiFetch } from "@/lib/api";

interface ChatImagePickerResult {
    /** Whether an upload is in progress */
    uploading: boolean;
    /** Upload progress 0-1 */
    progress: number;
    /** Pick image from camera or gallery, upload, and return URL */
    pickAndUpload: () => Promise<string | null>;
}

export function useChatImagePicker(
    userId: string,
    chatContext: string // e.g. "dm/conversationId" or "group/eventId"
): ChatImagePickerResult {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const pickAndUpload = useCallback(async (): Promise<string | null> => {
        // Show source picker
        const source = await new Promise<"camera" | "gallery" | null>((resolve) => {
            if (Platform.OS === "ios") {
                ActionSheetIOS.showActionSheetWithOptions(
                    {
                        options: ["Cancel", "Take Photo", "Choose from Library"],
                        cancelButtonIndex: 0,
                    },
                    (buttonIndex) => {
                        if (buttonIndex === 1) resolve("camera");
                        else if (buttonIndex === 2) resolve("gallery");
                        else resolve(null);
                    }
                );
            } else {
                Alert.alert("Send Photo", "Choose source", [
                    { text: "Cancel", onPress: () => resolve(null), style: "cancel" },
                    { text: "📷 Camera", onPress: () => resolve("camera") },
                    { text: "🖼️ Gallery", onPress: () => resolve("gallery") },
                ]);
            }
        });

        if (!source) return null;

        try {
            // Request permissions
            if (source === "camera") {
                const perm = await ImagePicker.requestCameraPermissionsAsync();
                if (!perm.granted) {
                    Alert.alert("Permission Required", "Camera access is needed.");
                    return null;
                }
            } else {
                const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (!perm.granted) {
                    Alert.alert("Permission Required", "Photo library access is needed.");
                    return null;
                }
            }

            // Pick image
            const result = await (source === "camera"
                ? ImagePicker.launchCameraAsync({
                    mediaTypes: ["images"],
                    quality: 0.7,
                    allowsEditing: true,
                    aspect: [4, 3],
                })
                : ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ["images"],
                    quality: 0.7,
                    allowsEditing: true,
                    aspect: [4, 3],
                }));

            if (result.canceled || !result.assets?.[0]?.uri) {
                return null;
            }

            setUploading(true);
            setProgress(0.1);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            const imageUri = result.assets[0].uri;
            const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
            const storagePath = `chat-images/${chatContext}/${userId}/${filename}`;

            // Upload via API Gateway Proxy
            setProgress(0.5);
            const formData = new FormData();

            // @ts-ignore
            formData.append("file", {
                uri: imageUri,
                name: filename,
                type: "image/jpeg",
            });

            const uploadResult = await apiFetch<{ url: string }>("/api/v1/social/upload", {
                method: "POST",
                body: formData,
                requireAuth: true,
            });

            setProgress(1);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            return uploadResult.url;
        } catch (error) {
            console.error("[ChatImagePicker] Error:", error);
            Alert.alert("Upload Failed", "Could not upload the image. Please try again.");
            return null;
        } finally {
            setUploading(false);
            setProgress(0);
        }
    }, [userId, chatContext]);

    return {
        uploading,
        progress,
        pickAndUpload,
    };
}
