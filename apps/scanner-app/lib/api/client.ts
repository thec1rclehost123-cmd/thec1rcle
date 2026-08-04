import { auth } from '../firebase';
import { getScannerSessionToken } from '../deviceIdentity';

const getApiBase = () => {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  const gatewayUrl = process.env.EXPO_PUBLIC_GATEWAY_URL?.trim().replace(/\/+$/, '');
  const configured = apiUrl || (gatewayUrl ? `${gatewayUrl}/api/v1` : '');
  const url = configured || (__DEV__ ? 'http://localhost:4000/api/v1' : '');

  if (!url) {
    throw new Error(
      'Missing required Scanner App environment variable: EXPO_PUBLIC_API_URL or EXPO_PUBLIC_GATEWAY_URL',
    );
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('unsupported protocol');
    }
  } catch {
    throw new Error('Scanner App API URL must be an absolute HTTP(S) URL');
  }

  return url.replace(/\/+$/, '');
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

  const requiresFirebaseIdentity =
    path === '/scan/staff-login' ||
    path.startsWith('/scan/events') ||
    path === '/scan/staff/session';
  const scannerSession = requiresFirebaseIdentity ? null : await getScannerSessionToken();

  if (scannerSession) {
    headers['x-scanner-code'] = scannerSession;
  } else {
    await auth.authStateReady();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Scanner authentication is required');
    }
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
