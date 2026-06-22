import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getFirebaseApp } from './client';

const MAX_UPLOAD_BYTES = 1_000_000;
const MAX_PHOTO_SIZE = 1080;

function getDb() {
  return getFirestore(getFirebaseApp());
}

function getStore() {
  return getStorage(getFirebaseApp());
}

function clean<T extends Record<string, any>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

async function getFileSize(uri: string): Promise<number | null> {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists && typeof info.size === 'number' ? info.size : null;
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

  let compress = 0.82;
  let uri = localUri;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const result = await ImageManipulator.manipulateAsync(uri, actions, {
      compress,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    const size = await getFileSize(result.uri);
    if (!size || size <= MAX_UPLOAD_BYTES || compress <= 0.35) return result.uri;
    uri = result.uri;
    compress = Math.max(0.35, compress - 0.12);
  }

  return uri;
}

export async function uploadUserPhoto(
  userId: string,
  localUri: string,
  id: string,
  dimensions?: { width?: number; height?: number },
): Promise<string> {
  const squareUri = await prepareSquareJpeg(localUri, dimensions?.width, dimensions?.height);
  const response = await fetch(squareUri);
  const blob = await response.blob();
  const storageRef = ref(getStore(), `users/${userId}/photos/${id}.jpg`);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
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
  const userRef = doc(getDb(), 'users', userId);
  const existing = await getDoc(userRef);

  await setDoc(
    userRef,
    clean({
      uid: userId,
      email: data.email ?? undefined,
      displayName: data.displayName,
      name: data.displayName,
      phone: data.phone ?? undefined,
      phoneNumber: data.phone ?? undefined,
      city: data.city,
      vibeTags: data.vibeTags,
      photoURL: data.photoURL,
      photos: data.photos,
      profileSetupComplete: true,
      createdAt: existing.exists() ? undefined : serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
    { merge: true },
  );
}

export async function isBasicUserProfileComplete(userId: string): Promise<boolean> {
  const snap = await getDoc(doc(getDb(), 'users', userId));
  if (!snap.exists()) return false;
  const data = snap.data();
  return data.profileSetupComplete === true;
}
