import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { auth } from '../firebase';

const getApiBase = () => {
  let url = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

  if (__DEV__) {
    // Dynamically replace localhost/127.0.0.1 with Metro packager host IP in development
    const hostUri = Constants.expoConfig?.hostUri; // e.g. "192.168.29.70:8081"
    if (hostUri) {
      const host = hostUri.split(':')[0]; // "192.168.29.70"
      if (url.includes('localhost') || url.includes('127.0.0.1')) {
        url = url.replace('localhost', host).replace('127.0.0.1', host);
      }
    } else if (
      Platform.OS === 'android' &&
      (url.includes('localhost') || url.includes('127.0.0.1'))
    ) {
      url = url.replace('localhost', '10.0.2.2').replace('127.0.0.1', '10.0.2.2');
    }
  }
  return url;
};

const API_BASE = getApiBase();

interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

/**
 * Lightweight fetch wrapper for all scanner API calls.
 * Attaches X-Scanner-Code header when a scannerCode is provided.
 * Throws on non-2xx responses with .status and .data attached.
 */
export async function scannerFetch(path: string, options: FetchOptions = {}): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  await auth.authStateReady();
  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      const idToken = await currentUser.getIdToken();
      headers['Authorization'] = `Bearer ${idToken}`;
    } catch (e) {
      console.warn('[scannerFetch] Failed to get current user ID token:', e);
    }
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMessage =
      typeof data.error === 'object' && data.error?.message
        ? data.error.message
        : data.error || `HTTP ${res.status}`;
    const err: any = new Error(errorMessage);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}
