/**
 * Mock API client for development/demo mode.
 * Replaces apiFetch with canned responses so screens work without a backend.
 * Never import directly — use `apiFetch` from `./api` which delegates here in DEMO_MODE.
 */
import {
  DEMO_EVENTS,
  DEMO_EVENT_CHATS,
  DEMO_PRIVATE_CHATS,
  DEMO_CHAT_MESSAGES,
  DEMO_DM_MESSAGES,
  DEMO_NEW_MATCHES,
} from './demo';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Map of URL patterns to mock response generators. */
const routes: Record<string, (params: Record<string, string>, body?: any) => any> = {
  // ── Events ──
  'GET /api/v1/events/explore': () => ({
    events: DEMO_EVENTS,
    cursor: null,
    hasMore: false,
  }),
  'GET /api/v1/events': () => ({ events: DEMO_EVENTS }),
  'GET /api/v1/events/': (params) => {
    const event = DEMO_EVENTS.find((e) => e.id === params.id);
    return event || { error: 'Event not found' };
  },

  // ── Chats ──
  'GET /api/v1/social/my-chats': () => ({
    chats: DEMO_EVENT_CHATS,
    eventChats: DEMO_EVENT_CHATS,
    privateChats: DEMO_PRIVATE_CHATS,
    totalUnread: 3,
  }),
  'GET /api/v1/social/chat/': (params) => ({
    messages: (DEMO_CHAT_MESSAGES as any)[params.eventId] ?? [],
  }),
  'GET /api/v1/social/dm/': (params) => ({
    messages: (DEMO_DM_MESSAGES as any)[params.id] ?? [],
  }),
  'GET /api/v1/social/dm/conversations': () => ({
    conversations: DEMO_PRIVATE_CHATS,
  }),
  'GET /api/v1/social/matches': () => ({
    matches: DEMO_NEW_MATCHES,
  }),

  // ── Tickets ──
  'GET /api/v1/tickets/my-wallet': () => ({
    success: true,
    data: { orders: [], tickets: [] },
    orders: [],
    tickets: [],
    qrTtlSeconds: null,
  }),
  'GET /api/v1/tickets/transfer/pending': () => ({
    transfers: [],
  }),

  // ── Profile ──
  'GET /api/v1/users/me/settings': () => ({
    success: true,
    settings: {
      notifications: {},
      privacy: {},
      appearance: {},
      updatedAt: new Date().toISOString(),
    },
  }),
  'GET /api/v1/profiles/': () => ({
    displayName: 'Demo User',
    photoURL: null,
    bio: 'Demo account',
    city: 'Pune',
  }),

  // ── Notifications ──
  'GET /api/v1/guest-notifications': () => ({
    notifications: [],
  }),

  // ── Search ──
  'GET /api/v1/search': () => ({ results: [] }),
};

export async function apiFetchMock<T = any>(
  url: string,
  options: RequestInit & { requireAuth?: boolean } = {},
): Promise<T> {
  await delay(150 + Math.random() * 200);

  const method = (options.method || 'GET').toUpperCase();
  const path = extractPath(url);

  // Exact match first
  const exactKey = `${method} /api/v1${path}`;
  if (routes[exactKey]) {
    const params = extractParams(path);
    return routes[exactKey](params) as T;
  }

  // Prefix match (for /api/v1/social/chat/{eventId} style)
  const prefixKey = Object.keys(routes).find((key) => {
    const [kMethod, kPath] = key.split(' ');
    return kMethod === method && `/api/v1${path}`.startsWith(kPath) && kPath.endsWith('/');
  });
  if (prefixKey) {
    const params = extractParams(path);
    return routes[prefixKey](params) as T;
  }

  // Generic success for unhandled POST/PATCH/DELETE
  if (method !== 'GET') {
    return { success: true } as T;
  }

  console.warn(`[MockAPI] No mock for ${method} ${url}`);
  return {} as T;
}

function extractPath(url: string): string {
  // Strip base URL prefix if present
  const match = url.match(/\/api\/v1\/?(.*)/);
  if (!match) return url;
  return '/' + (match[1] || '');
}

function extractParams(path: string): Record<string, string> {
  // Extract dynamic segments like event/{id} → { id: 'demo-event-01' }
  const params: Record<string, string> = {};
  const segments = path.split('/').filter(Boolean);
  // For social/chat/{evenId}: the last segment is the eventId
  if (segments.length >= 2) {
    const last = segments[segments.length - 1];
    if (last && !routes[`GET /api/v1/${segments.join('/')}`]) {
      params.eventId = last;
      params.id = last;
    }
  }
  return params;
}
