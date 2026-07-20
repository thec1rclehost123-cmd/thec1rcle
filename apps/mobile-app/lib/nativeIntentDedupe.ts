export const RAPID_DETAIL_INTENT_WINDOW_MS = 1_500;

type AcceptedDetailIntent = { key: string; acceptedAt: number };

let lastAcceptedDetailIntent: AcceptedDetailIntent | null = null;

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Returns a stable key only for native host/venue file routes. Other routes are
 * deliberately outside this dedupe boundary.
 */
export function getNativeDetailIntentKey(path: string): string | null {
  const trimmedPath = path.trim();
  if (!trimmedPath) return null;

  let segments: string[];
  try {
    const parsed = new URL(trimmedPath);
    const hostname = parsed.hostname.toLowerCase();
    const pathSegments = parsed.pathname.split('/').filter(Boolean);
    segments =
      hostname === 'host' || hostname === 'venue' ? [hostname, ...pathSegments] : pathSegments;
  } catch {
    segments = trimmedPath.split(/[?#]/, 1)[0].split('/').filter(Boolean);
  }

  if (segments[0]?.toLowerCase() === 'app') segments.shift();
  const type = segments[0]?.toLowerCase();
  const identifier = segments[1] ? safeDecode(segments[1]).trim() : '';
  if ((type !== 'host' && type !== 'venue') || !identifier) return null;
  return `${type}:${identifier}`;
}

/**
 * Expo Router calls this before accepting a native system path. Returning null
 * keeps the current route, preventing rapid duplicate intents from adding an
 * identical detail screen to the navigation stack.
 */
export function collapseRapidDuplicateDetailIntent(path: string, now = Date.now()): string | null {
  const key = getNativeDetailIntentKey(path);
  if (!key) return path;

  if (
    lastAcceptedDetailIntent?.key === key &&
    now - lastAcceptedDetailIntent.acceptedAt >= 0 &&
    now - lastAcceptedDetailIntent.acceptedAt <= RAPID_DETAIL_INTENT_WINDOW_MS
  ) {
    return null;
  }

  lastAcceptedDetailIntent = { key, acceptedAt: now };
  return path;
}

export function resetNativeDetailIntentDedupe(): void {
  lastAcceptedDetailIntent = null;
}
