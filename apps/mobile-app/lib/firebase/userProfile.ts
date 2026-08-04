import * as ImageManipulator from 'expo-image-manipulator';
import { apiFetch } from '@/lib/api';

const MAX_PHOTO_SIZE = 1080;

function clean<T extends Record<string, any>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

export async function prepareSquareJpeg(
  localUri: string,
  width?: number,
  height?: number,
): Promise<string> {
  const actions: ImageManipulator.Action[] = [];

  if (width && height) {
    const side = Math.min(width, height);
    actions.push({
      crop: {
        originX: Math.max(0, Math.floor((width - side) / 2)),
        originY: Math.max(0, Math.floor((height - side) / 2)),
        width: side,
        height: side,
      },
    });
  }

  actions.push({ resize: { width: MAX_PHOTO_SIZE, height: MAX_PHOTO_SIZE } });

  const result = await ImageManipulator.manipulateAsync(localUri, actions, {
    compress: 0.72,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return result.uri;
}

export async function uploadUserPhoto(
  userId: string,
  localUri: string,
  id: string,
  dimensions?: { width?: number; height?: number },
): Promise<string> {
  const squareUri = await prepareSquareJpeg(localUri, dimensions?.width, dimensions?.height);
  const formData = new FormData();
  formData.append('file', {
    uri: squareUri,
    name: `${id}.jpg`,
    type: 'image/jpeg',
  } as any);

  const response = await apiFetch<{ data?: { url?: string }; url?: string }>(
    '/api/v1/social/upload',
    { method: 'POST', body: formData },
  );
  const uploadedUrl = response.data?.url ?? response.url;
  if (!uploadedUrl?.startsWith('https://')) throw new Error('Upload returned an invalid photo URL');
  return uploadedUrl;
}

export async function saveBasicUserProfile(
  userId: string,
  data: {
    email?: string | null;
    displayName?: string;
    phone?: string | null;
    city?: string;
    vibeTags?: string[];
    photoURL?: string;
    photos?: string[];
  },
) {
  if (!userId) throw new Error('Missing user ID');
  await apiFetch('/api/v1/users/me', {
    method: 'PUT',
    body: JSON.stringify(
      clean({
        email: data.email ?? undefined,
        displayName: data.displayName,
        name: data.displayName,
        phone: data.phone ?? undefined,
        phoneNumber: data.phone ?? undefined,
        city: data.city,
        vibeTags: data.vibeTags,
        photoURL: data.photoURL,
        photos: data.photos,
        basicSetupComplete: true,
        profileSetupComplete: true,
        profileComplete: true,
      }),
    ),
  });
}

export async function isBasicUserProfileComplete(userId: string): Promise<boolean> {
  if (!userId) return false;
  const response = await apiFetch<{
    data?: { profile?: any };
    profile?: any;
  }>('/api/v1/users/me');
  const data = response.data?.profile ?? response.profile;
  if (!data) return false;
  return (
    data.basicSetupComplete === true ||
    data.profileSetupComplete === true ||
    data.profileComplete === true
  );
}
