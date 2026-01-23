// Media Sharing Service - Photo drops for post-event phase
import {
    doc,
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    addDoc,
    updateDoc,
    onSnapshot,
    serverTimestamp,
    increment,
} from "firebase/firestore";
import {
    ref,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject,
} from "firebase/storage";
import { getFirebaseDb, getFirebaseStorage } from "@/lib/firebase";
import { checkEventEntitlement } from "./entitlements";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

// Media types
export interface EventMedia {
    id: string;
    eventId: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    mediaUrl: string;
    thumbnailUrl?: string;
    type: "image" | "video";
    caption?: string;
    likes: number;
    likedBy: string[];
    createdAt: any;
    isApproved: boolean; // For moderation
    isFlagged: boolean;
}

export interface MediaUploadProgress {
    progress: number;
    status: "uploading" | "processing" | "complete" | "error";
    mediaId?: string;
    error?: string;
}

// Pick image from gallery
export async function pickImage(): Promise<string | null> {
    try {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            return null;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 5],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            return result.assets[0].uri;
        }

        return null;
    } catch (error) {
        console.error("Error picking image:", error);
        return null;
    }
}

// Take photo with camera
export async function takePhoto(): Promise<string | null> {
    try {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
            return null;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [4, 5],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            return result.assets[0].uri;
        }

        return null;
    } catch (error) {
        console.error("Error taking photo:", error);
        return null;
    }
}

// Compress and resize image for optimal upload
async function processImage(uri: string): Promise<{
    fullUri: string;
    thumbnailUri: string;
}> {
    // Full size (max 1200px)
    const fullImage = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );

    // Thumbnail (300px)
    const thumbnail = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 300 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
    );

    return {
        fullUri: fullImage.uri,
        thumbnailUri: thumbnail.uri,
    };
}

// Convert URI to blob for upload
async function uriToBlob(uri: string): Promise<Blob> {
    const response = await fetch(uri);
    return await response.blob();
}

// Upload media to event gallery
export async function uploadEventMedia(
    eventId: string,
    userId: string,
    userName: string,
    imageUri: string,
    caption?: string,
    onProgress?: (progress: MediaUploadProgress) => void
): Promise<{ success: boolean; mediaId?: string; error?: string }> {
    try {
        // Verify entitlement
        const entitlement = await checkEventEntitlement(userId, eventId);
        if (!entitlement) {
            return { success: false, error: "You need a ticket to share media" };
        }

        onProgress?.({ progress: 0, status: "processing" });

        // Process image
        const { fullUri, thumbnailUri } = await processImage(imageUri);

        onProgress?.({ progress: 10, status: "uploading" });

        // Generate unique filename
        const timestamp = Date.now();
        const filename = `${eventId}/${userId}_${timestamp}`;

        const storage = getFirebaseStorage();

        // Upload full image
        const fullBlob = await uriToBlob(fullUri);
        const fullRef = ref(storage, `event-media/${filename}_full.jpg`);
        const uploadTask = uploadBytesResumable(fullRef, fullBlob);

        // Track upload progress
        await new Promise<void>((resolve, reject) => {
            uploadTask.on(
                "state_changed",
                (snapshot) => {
                    const progress = 10 + (snapshot.bytesTransferred / snapshot.totalBytes) * 60;
                    onProgress?.({ progress, status: "uploading" });
                },
                reject,
                resolve
            );
        });

        const fullUrl = await getDownloadURL(fullRef);

        onProgress?.({ progress: 75, status: "uploading" });

        // Upload thumbnail
        const thumbBlob = await uriToBlob(thumbnailUri);
        const thumbRef = ref(storage, `event-media/${filename}_thumb.jpg`);
        await uploadBytesResumable(thumbRef, thumbBlob);
        const thumbUrl = await getDownloadURL(thumbRef);

        onProgress?.({ progress: 90, status: "processing" });

        // Create media record in Firestore
        const db = getFirebaseDb();
        const mediaData: Omit<EventMedia, "id"> = {
            eventId,
            userId,
            userName,
            mediaUrl: fullUrl,
            thumbnailUrl: thumbUrl,
            type: "image",
            caption: caption || undefined,
            likes: 0,
            likedBy: [],
            createdAt: serverTimestamp(),
            isApproved: true, // Auto-approve for now
            isFlagged: false,
        };

        const docRef = await addDoc(collection(db, "eventMedia"), mediaData);

        onProgress?.({ progress: 100, status: "complete", mediaId: docRef.id });

        return { success: true, mediaId: docRef.id };
    } catch (error: any) {
        console.error("Error uploading media:", error);
        onProgress?.({ progress: 0, status: "error", error: error.message });
        return { success: false, error: error.message };
    }
}

// Subscribe to event media gallery
export function subscribeToEventMedia(
    eventId: string,
    onMedia: (media: EventMedia[]) => void,
    mediaLimit: number = 50
): () => void {
    const db = getFirebaseDb();

    const mediaQuery = query(
        collection(db, "eventMedia"),
        where("eventId", "==", eventId),
        where("isApproved", "==", true),
        orderBy("createdAt", "desc"),
        limit(mediaLimit)
    );

    return onSnapshot(mediaQuery, (snapshot) => {
        const media: EventMedia[] = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as EventMedia[];

        onMedia(media);
    });
}

// Like/unlike media
export async function toggleMediaLike(
    mediaId: string,
    userId: string
): Promise<{ success: boolean; isLiked: boolean }> {
    try {
        const db = getFirebaseDb();
        const mediaRef = doc(db, "eventMedia", mediaId);
        const mediaDoc = await getDocs(
            query(collection(db, "eventMedia"), where("__name__", "==", mediaId))
        );

        if (mediaDoc.empty) {
            return { success: false, isLiked: false };
        }

        const data = mediaDoc.docs[0].data();
        const likedBy: string[] = data.likedBy || [];
        const isCurrentlyLiked = likedBy.includes(userId);

        if (isCurrentlyLiked) {
            // Unlike
            await updateDoc(mediaRef, {
                likes: increment(-1),
                likedBy: likedBy.filter((id) => id !== userId),
            });
            return { success: true, isLiked: false };
        } else {
            // Like
            await updateDoc(mediaRef, {
                likes: increment(1),
                likedBy: [...likedBy, userId],
            });
            return { success: true, isLiked: true };
        }
    } catch (error) {
        console.error("Error toggling like:", error);
        return { success: false, isLiked: false };
    }
}

// Delete own media
export async function deleteMedia(
    mediaId: string,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const db = getFirebaseDb();
        const mediaRef = doc(db, "eventMedia", mediaId);

        // Get media to verify ownership and get URLs
        const mediaQuery = query(
            collection(db, "eventMedia"),
            where("__name__", "==", mediaId)
        );
        const snapshot = await getDocs(mediaQuery);

        if (snapshot.empty) {
            return { success: false, error: "Media not found" };
        }

        const mediaData = snapshot.docs[0].data();

        if (mediaData.userId !== userId) {
            return { success: false, error: "You can only delete your own media" };
        }

        // Delete from storage
        const storage = getFirebaseStorage();
        try {
            if (mediaData.mediaUrl) {
                const fullRef = ref(storage, mediaData.mediaUrl);
                await deleteObject(fullRef);
            }
            if (mediaData.thumbnailUrl) {
                const thumbRef = ref(storage, mediaData.thumbnailUrl);
                await deleteObject(thumbRef);
            }
        } catch {
            // Continue even if storage delete fails
        }

        // Delete from Firestore
        const { deleteDoc } = await import("firebase/firestore");
        await deleteDoc(mediaRef);

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Report media
export async function reportMedia(
    mediaId: string,
    reporterId: string,
    reason: string
): Promise<{ success: boolean }> {
    try {
        const db = getFirebaseDb();

        await addDoc(collection(db, "mediaReports"), {
            mediaId,
            reporterId,
            reason,
            status: "pending",
            createdAt: serverTimestamp(),
        });

        // Flag the media
        const mediaRef = doc(db, "eventMedia", mediaId);
        await updateDoc(mediaRef, { isFlagged: true });

        return { success: true };
    } catch (error) {
        console.error("Error reporting media:", error);
        return { success: false };
    }
}

// Get media count for event
export async function getEventMediaCount(eventId: string): Promise<number> {
    try {
        const db = getFirebaseDb();

        const mediaQuery = query(
            collection(db, "eventMedia"),
            where("eventId", "==", eventId),
            where("isApproved", "==", true)
        );

        const snapshot = await getDocs(mediaQuery);
        return snapshot.size;
    } catch (error) {
        return 0;
    }
}
