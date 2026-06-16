// Media Sharing Service via API Gateway
import { apiFetch } from '@/lib/api';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

// Media types
export interface EventMedia {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  type: 'image' | 'video';
  caption?: string;
  likes: number;
  likedBy: string[];
  createdAt: any;
  isApproved: boolean;
  isFlagged: boolean;
}

export interface MediaUploadProgress {
  progress: number;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  mediaId?: string;
  error?: string;
}

// Pick image from gallery
export async function pickImage(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

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
}

// Take photo with camera
export async function takePhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [4, 5],
    quality: 0.8,
  });

  if (!result.canceled && result.assets[0]) {
    return result.assets[0].uri;
  }
  return null;
}

// Compress and resize image
async function processImage(uri: string): Promise<{
  fullUri: string;
  thumbnailUri: string;
}> {
  const fullImage = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1200 } }], {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  const thumbnail = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 300 } }], {
    compress: 0.6,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return {
    fullUri: fullImage.uri,
    thumbnailUri: thumbnail.uri,
  };
}

/**
 * Helper to upload a file to the API Gateway proxy
 */
async function uploadToGateway(uri: string): Promise<string> {
  const formData = new FormData();
  const filename = uri.split('/').pop() || 'image.jpg';

  // @ts-ignore
  formData.append('file', {
    uri,
    name: filename,
    type: 'image/jpeg',
  });

  const response = await apiFetch<{ url: string }>('/api/v1/social/upload', {
    method: 'POST',
    body: formData,
    requireAuth: true,
  });

  return response.url;
}

// Upload media to event gallery via API Gateway Proxy
export async function uploadEventMedia(
  eventId: string,
  userId: string,
  userName: string,
  imageUri: string,
  caption?: string,
  onProgress?: (progress: MediaUploadProgress) => void,
): Promise<{ success: boolean; mediaId?: string; error?: string }> {
  try {
    onProgress?.({ progress: 0, status: 'processing' });

    const { fullUri, thumbnailUri } = await processImage(imageUri);
    onProgress?.({ progress: 20, status: 'uploading' });

    // 1. Upload Full Image via Gateway
    const fullUrl = await uploadToGateway(fullUri);
    onProgress?.({ progress: 60, status: 'uploading' });

    // 2. Upload Thumbnail via Gateway
    const thumbUrl = await uploadToGateway(thumbnailUri);
    onProgress?.({ progress: 80, status: 'uploading' });

    // 3. Save Metadata via Gateway (Critical Decoupling)
    const response = await apiFetch<any>('/api/v1/social/media', {
      method: 'POST',
      body: JSON.stringify({
        eventId,
        mediaUrl: fullUrl,
        thumbnailUrl: thumbUrl,
        type: 'image',
        caption,
      }),
      requireAuth: true,
    });

    onProgress?.({ progress: 100, status: 'complete', mediaId: response.id });
    return { success: true, mediaId: response.id };
  } catch (error: any) {
    onProgress?.({ progress: 0, status: 'error', error: error.message });
    return { success: false, error: error.message };
  }
}

// Subscribe via Polling
export function subscribeToEventMedia(
  eventId: string,
  onMedia: (media: EventMedia[]) => void,
  mediaLimit: number = 50,
): () => void {
  let active = true;

  async function poll() {
    if (!active) return;
    try {
      const response = await apiFetch<{ media: EventMedia[] }>(
        `/api/v1/social/media/${eventId}?limit=${mediaLimit}`,
        { requireAuth: false },
      );
      if (active && response.media) onMedia(response.media);
    } catch (e) {}
  }

  poll();
  const intervalId = setInterval(poll, 10000); // 10s poll

  return () => {
    active = false;
    clearInterval(intervalId);
  };
}

// Like/unlike via Gateway
export async function toggleMediaLike(
  mediaId: string,
  userId: string,
): Promise<{ success: boolean; isLiked: boolean }> {
  try {
    const response = await apiFetch<any>(`/api/v1/social/media/${mediaId}/like`, {
      method: 'POST',
      requireAuth: true,
    });
    return response;
  } catch (error) {
    return { success: false, isLiked: false };
  }
}

// Delete media via Gateway
export async function deleteMedia(
  mediaId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiFetch(`/api/v1/social/media/${mediaId}`, { method: 'DELETE', requireAuth: true });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Report media via Gateway
export async function reportMedia(
  mediaId: string,
  reporterId: string,
  reason: string,
): Promise<{ success: boolean }> {
  try {
    await apiFetch('/api/v1/social/report', {
      method: 'POST',
      body: JSON.stringify({
        targetId: mediaId,
        targetType: 'media',
        reason,
      }),
      requireAuth: true,
    });
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

// Get media count via Gateway
export async function getEventMediaCount(eventId: string): Promise<number> {
  try {
    const response = await apiFetch<any>(`/api/v1/social/media/${eventId}/count`, {
      requireAuth: false,
    });
    return response.count || 0;
  } catch (error) {
    return 0;
  }
}
