import Constants from 'expo-constants';

/**
 * HYPER-ROBUST Image Resolver
 * Mirrors the exact behavior of the Guest Portal (web) and Admin Console.
 * Checks all possible legacy and modern field names to find the real uploaded image.
 */
export function getEventImage(event: any): string | null {
  if (!event) return null;

  const isInternalPlaceholder = (url: any) => {
    if (!url || typeof url !== 'string') return false;
    return url.includes('placeholder.svg') || url.includes('holi-edit.svg');
  };

  // 1. Check every possible field name used across the platforms
  // The order follows the priority found in packages/core and the Guest Portal
  const candidates = [
    event.posterUrl, // Admin Console / Mapped field
    event.poster, // Standard field
    event.image, // Legacy standard
    event.coverPhoto, // Used in some staging records
    event.coverImage, // Used in others
    event.flyer, // Used for club nights
    event.banner, // Secondary banner
    event.thumbnail, // Last resort small image
  ];

  // Try finding a direct string URL first
  let selected = candidates.find(
    (c) => typeof c === 'string' && c.trim() !== '' && !isInternalPlaceholder(c),
  );

  // 2. Deep check for nested objects (some records have { url: "..." })
  if (!selected) {
    if (event.poster?.url && !isInternalPlaceholder(event.poster.url)) selected = event.poster.url;
    else if (event.image?.url && !isInternalPlaceholder(event.image.url))
      selected = event.image.url;
    else if (event.cover?.url && !isInternalPlaceholder(event.cover.url))
      selected = event.cover.url;
  }

  // 3. Check arrays (Images > Gallery)
  if (!selected) {
    if (Array.isArray(event.images) && event.images.length > 0) {
      const first = event.images[0];
      if (typeof first === 'string' && !isInternalPlaceholder(first)) selected = first;
      else if (first?.url && !isInternalPlaceholder(first.url)) selected = first.url;
    }
  }
  if (!selected) {
    if (Array.isArray(event.gallery) && event.gallery.length > 0) {
      const first = event.gallery[0];
      if (typeof first === 'string' && !isInternalPlaceholder(first)) selected = first;
      else if (first?.url && !isInternalPlaceholder(first.url)) selected = first.url;
    }
  }

  // 4. Final resolution: if we found a real URL, ensure it's absolute
  if (selected) {
    return resolveUrl(selected);
  }

  // 5. No real image found — return null so callers show their gradient fallback
  return null;
}

/**
 * Ensures relative paths are resolved against the API base URL.
 */
function resolveUrl(url: string): string {
  if (!url) return '';

  // Handle relative paths from the backend assets
  if (url.startsWith('/')) {
    const apiBase = getMobileApiBase();
    return `${apiBase}${url}`;
  }

  return url;
}

/**
 * Helper to get the same API base URL as the main API client.
 */
function getMobileApiBase(): string {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }

  if (__DEV__) {
    const debuggerHost =
      Constants.expoConfig?.hostUri ||
      (Constants.manifest2 as any)?.extra?.expoClient?.hostUri ||
      (Constants.manifest as any)?.debuggerHost;

    if (debuggerHost) {
      const host = debuggerHost.split(':')[0];
      return `http://${host}:3001`;
    }
  }

  return 'https://api.thec1rcle.com';
}

/**
 * Fallback image if everything else fails.
 * Using a High-quality PNG version of THE C1RCLE branding for mobile compatibility.
 */
export const EVENT_PLACEHOLDER =
  'https://firebasestorage.googleapis.com/v0/b/c1rcle-staging.firebasestorage.app/o/brand%2Fplaceholder-dark.png?alt=media&token=placeholder-token';
