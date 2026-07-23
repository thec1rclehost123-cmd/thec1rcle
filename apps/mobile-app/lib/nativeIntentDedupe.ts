export const RAPID_DETAIL_INTENT_WINDOW_MS = 1_500;

type AcceptedDetailIntent = { key: string; acceptedAt: number };

let lastAcceptedDetailIntent: AcceptedDetailIntent | null = null;

const APP_HOSTS = new Set(['thec1rcle.com', 'www.thec1rcle.com']);
const IDENTIFIER_QUERY_KEYS: Record<string, string[]> = {
  event: ['eventId', 'id'],
  transfer: ['code', 'id'],
  profile: ['userId', 'id'],
  ticket: ['orderId', 'id'],
  chat: ['eventId', 'id'],
  host: ['hostId', 'id'],
  venue: ['venueId', 'id'],
  claim: ['token', 'id'],
  going: ['orderId', 'id'],
};

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Rewrite custom and universal URLs into Expo Router file paths. */
export function normalizeNativeIntentPath(path: string): string {
  const trimmedPath = path.trim();
  if (!trimmedPath) return path;

  try {
    const parsed = new URL(trimmedPath);
    const isAppScheme = parsed.protocol.toLowerCase() === 'c1rcle:';
    const isAppWebLink = APP_HOSTS.has(parsed.hostname.toLowerCase());
    if (!isAppScheme && !isAppWebLink) return path;

    const segments = parsed.pathname.split('/').filter(Boolean);
    if (isAppScheme && parsed.hostname) segments.unshift(parsed.hostname);
    if (segments[0]?.toLowerCase() === 'app') segments.shift();

    const routeType = segments[0]?.toLowerCase();
    if (segments.length === 1 && routeType && IDENTIFIER_QUERY_KEYS[routeType]) {
      const identifier = IDENTIFIER_QUERY_KEYS[routeType]
        .map((key) => parsed.searchParams.get(key))
        .find((value) => Boolean(value?.trim()));
      if (identifier) segments.push(encodeURIComponent(safeDecode(identifier).trim()));
    }

    const route = `/${segments.join('/')}`;
    return `${route}${parsed.search}${parsed.hash}`;
  } catch {
    return path;
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
  const normalizedPath = normalizeNativeIntentPath(path);
  const key = getNativeDetailIntentKey(normalizedPath);
  if (!key) return normalizedPath;

  if (
    lastAcceptedDetailIntent?.key === key &&
    now - lastAcceptedDetailIntent.acceptedAt >= 0 &&
    now - lastAcceptedDetailIntent.acceptedAt <= RAPID_DETAIL_INTENT_WINDOW_MS
  ) {
    return null;
  }

  lastAcceptedDetailIntent = { key, acceptedAt: now };
  return normalizedPath;
}

export function resetNativeDetailIntentDedupe(): void {
  lastAcceptedDetailIntent = null;
}
