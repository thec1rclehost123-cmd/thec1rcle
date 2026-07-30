'use client';

import { GUEST_API_BASE_PATH, guestV1Operations } from './generated/guest-v1.js';

export function getApiErrorMessage(data, fallback = 'Request failed') {
  return data?.error?.message || data?.message || data?.error || fallback;
}

function normalizeApiPath(path) {
  if (!path) return GUEST_API_BASE_PATH;
  if (path.startsWith(GUEST_API_BASE_PATH)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${GUEST_API_BASE_PATH}${normalized}`;
}

function createRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `guest-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readCookie(name) {
  if (typeof document === 'undefined') return '';
  const prefix = `${name}=`;
  const entry = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : '';
}

function isUnsafeMethod(method) {
  return !['GET', 'HEAD', 'OPTIONS'].includes(String(method || 'GET').toUpperCase());
}

const DUPLICATE_FETCH_WINDOW_MS = 750;
const recentGuestFetches = new Map();
const pendingGuestJsonRequests = new Map();

export function getGuestFetchDiagnostics() {
  if (typeof window === 'undefined') return { duplicates: [] };
  return window.__C1RCLE_GUEST_FETCH_DIAGNOSTICS__ || { duplicates: [] };
}

function recordGuestFetch(normalizedPath, method) {
  if (process.env.NODE_ENV === 'production') return;
  if (typeof window === 'undefined') return;
  if (String(method || 'GET').toUpperCase() !== 'GET') return;

  const now = performance.now();
  const previous = recentGuestFetches.get(normalizedPath);
  recentGuestFetches.set(normalizedPath, now);

  if (!previous || now - previous > DUPLICATE_FETCH_WINDOW_MS) return;

  const diagnostics = window.__C1RCLE_GUEST_FETCH_DIAGNOSTICS__ || { duplicates: [] };
  diagnostics.duplicates.push({
    path: normalizedPath,
    deltaMs: Math.round(now - previous),
    observedAt: Date.now(),
  });
  if (diagnostics.duplicates.length > 50) {
    diagnostics.duplicates.splice(0, diagnostics.duplicates.length - 50);
  }
  window.__C1RCLE_GUEST_FETCH_DIAGNOSTICS__ = diagnostics;
  console.info('[guest-api] duplicate GET observed', diagnostics.duplicates.at(-1));
}

export async function guestApiFetch(path, options = {}) {
  const {
    method = 'GET',
    headers,
    body,
    credentials = 'include',
    cache = 'no-store',
    ...rest
  } = options;

  const nextHeaders = new Headers(headers || {});
  if (!nextHeaders.has('x-request-id')) {
    nextHeaders.set('x-request-id', createRequestId());
  }
  if (isUnsafeMethod(method) && !nextHeaders.has('x-csrf-token')) {
    const csrfToken = readCookie('guest_csrf');
    if (csrfToken) {
      nextHeaders.set('x-csrf-token', csrfToken);
    }
  }

  const requestInit = {
    method,
    headers: nextHeaders,
    credentials,
    cache,
    // A hung request (dropped connection, backend restart mid-flight, etc.)
    // must surface as an error rather than leave callers awaiting forever —
    // this matters most for payment verification, where an infinite hang
    // strands the guest on the processing screen with no feedback at all.
    signal: rest.signal || AbortSignal.timeout(20000),
    ...rest,
  };

  if (body !== undefined) {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const isString = typeof body === 'string';
    const isBlob = typeof Blob !== 'undefined' && body instanceof Blob;
    const isUrlSearchParams = body instanceof URLSearchParams;

    if (isFormData || isString || isBlob || isUrlSearchParams) {
      requestInit.body = body;
    } else {
      if (!nextHeaders.has('Content-Type')) {
        nextHeaders.set('Content-Type', 'application/json');
      }
      requestInit.body = JSON.stringify(body);
    }
  }

  const normalizedPath = normalizeApiPath(path);
  recordGuestFetch(normalizedPath, method);
  return fetch(normalizedPath, requestInit);
}

export async function guestApiJson(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const normalizedPath = normalizeApiPath(path);
  const canCoalesce = method === 'GET' && options.body === undefined;
  const requestKey = canCoalesce
    ? JSON.stringify({
        method,
        normalizedPath,
        credentials: options.credentials || 'include',
        cache: options.cache || 'no-store',
      })
    : null;

  if (requestKey && pendingGuestJsonRequests.has(requestKey)) {
    const result = await pendingGuestJsonRequests.get(requestKey);
    return {
      response: result.response.clone(),
      data: result.data,
    };
  }

  const requestPromise = (async () => {
    const response = await guestApiFetch(normalizedPath, options);
    const responseClone = response.clone();
    const data = await response.json().catch(() => ({}));
    return { response: responseClone, data };
  })();

  if (requestKey) {
    pendingGuestJsonRequests.set(requestKey, requestPromise);
  }

  try {
    const result = await requestPromise;
    return {
      response: result.response.clone(),
      data: result.data,
    };
  } finally {
    if (requestKey) {
      pendingGuestJsonRequests.delete(requestKey);
    }
  }
}

export function buildGuestOperationPath(operationId, params = {}, query = '') {
  const operation = guestV1Operations[operationId];
  if (!operation) throw new Error(`Unknown guest API operation: ${operationId}`);

  const path = operation.path.replace(/:([A-Za-z0-9_]+)/g, (_match, key) => {
    if (params[key] === undefined || params[key] === null) {
      throw new Error(`Missing guest API path param "${key}" for ${operationId}`);
    }
    return encodeURIComponent(String(params[key]));
  });

  if (!query) return path;
  if (typeof query === 'string') return `${path}${query.startsWith('?') ? query : `?${query}`}`;
  const search = new URLSearchParams(query);
  const serialized = search.toString();
  return serialized ? `${path}?${serialized}` : path;
}

export async function guestApiOperationJson(operationId, options = {}) {
  const { params, query, body, ...rest } = options;
  const operation = guestV1Operations[operationId];
  if (!operation) throw new Error(`Unknown guest API operation: ${operationId}`);

  return guestApiJson(buildGuestOperationPath(operationId, params, query), {
    method: operation.method,
    body,
    ...rest,
  });
}

export const guestApi = Object.freeze({
  auth: {
    me: (options) => guestApiOperationJson('getGuestAuthBootstrap', options),
    login: (body, options) => guestApiOperationJson('loginGuest', { body, ...options }),
    register: (body, options) => guestApiOperationJson('registerGuest', { body, ...options }),
    logout: (options) => guestApiOperationJson('logoutGuest', options),
    changePassword: (body, options) =>
      guestApiOperationJson('changeGuestPassword', { body, ...options }),
    passwordReset: (body, options) =>
      guestApiOperationJson('requestGuestPasswordReset', { body, ...options }),
    sendOtp: (body, options) => guestApiOperationJson('sendGuestOtp', { body, ...options }),
    verifyOtp: (body, options) => guestApiOperationJson('verifyGuestOtp', { body, ...options }),
  },
  profiles: {
    personal: (body, options) =>
      guestApiOperationJson('updateGuestPersonalProfile', { body, ...options }),
    social: (body, options) =>
      guestApiOperationJson('updateGuestSocialProfile', { body, ...options }),
    bio: (body, options) => guestApiOperationJson('updateGuestBioProfile', { body, ...options }),
    avatarUpdate: (body, options) =>
      guestApiOperationJson('updateGuestAvatarProfile', { body, ...options }),
    update: (body, options) =>
      guestApiOperationJson('updateGuestProfile', { body, ...options }),
    create: (body, options) => guestApiOperationJson('createGuestProfile', { body, ...options }),
    get: (id, options) =>
      guestApiOperationJson('getGuestPublicProfile', { params: { id }, ...options }),
    avatar: (body, options) => guestApiOperationJson('uploadGuestAvatar', { body, ...options }),
    lookup: (query = '', options) =>
      guestApiOperationJson('lookupGuestProfile', { query, ...options }),
  },
  public: {
    events: (query = '', options) =>
      guestApiOperationJson('listPublicEvents', { query, ...options }),
    event: (idOrSlug, options) =>
      guestApiOperationJson('getPublicEvent', { params: { idOrSlug }, ...options }),
    hosts: (query = '', options) => guestApiOperationJson('listPublicHosts', { query, ...options }),
    venues: (query = '', options) =>
      guestApiOperationJson('listPublicVenues', { query, ...options }),
    search: (query = '', options) =>
      guestApiOperationJson('searchPublicDiscovery', { query, ...options }),
  },
  events: {
    view: (eventId, options) =>
      guestApiOperationJson('recordEventView', { params: { eventId }, ...options }),
    track: (eventId, body, options) =>
      guestApiOperationJson('trackEventInteraction', { params: { eventId }, body, ...options }),
    rsvp: (eventId, body, options) =>
      guestApiOperationJson('setEventRsvp', { params: { eventId }, body, ...options }),
    queue: (eventId, query = '', options) =>
      guestApiOperationJson('getEventQueue', { params: { eventId }, query, ...options }),
    joinQueue: (eventId, body, options) =>
      guestApiOperationJson('joinEventQueue', { params: { eventId }, body, ...options }),
  },
  social: {
    followStatus: (targetId, options) =>
      guestApiOperationJson('getFollowStatus', { query: { targetId }, ...options }),
    follow: (body, options) => guestApiOperationJson('followEntity', { body, ...options }),
    unfollow: (targetId, targetType, options) =>
      guestApiOperationJson('unfollowEntity', { query: { targetId, targetType }, ...options }),
  },
  venues: {
    followStatus: (venueId, options) =>
      guestApiOperationJson('getVenueFollowStatus', { params: { venueId }, ...options }),
    follow: (venueId, options) =>
      guestApiOperationJson('followVenue', { params: { venueId }, ...options }),
    unfollow: (venueId, options) =>
      guestApiOperationJson('unfollowVenue', { params: { venueId }, ...options }),
    reserve: (body, options) =>
      guestApiOperationJson('createVenueReservation', { body, ...options }),
  },
  promoters: {
    trackClick: (body, options) =>
      guestApiOperationJson('trackPromoterLinkClick', { body, ...options }),
  },
  checkout: {
    calculate: (body, options) => guestApiOperationJson('calculateCheckout', { body, ...options }),
    promo: (body, options) => guestApiOperationJson('validateCheckoutPromo', { body, ...options }),
    reserve: (body, options) =>
      guestApiOperationJson('reserveCheckoutInventory', { body, ...options }),
    initiate: (body, options) => guestApiOperationJson('initiateCheckout', { body, ...options }),
  },
  payments: {
    config: (options) => guestApiOperationJson('getPaymentConfig', options),
    order: (body, options) => guestApiOperationJson('createPaymentOrder', { body, ...options }),
    verify: (body, options) => guestApiOperationJson('verifyPayment', { body, ...options }),
  },
  orders: {
    get: (orderId, options) =>
      guestApiOperationJson('getGuestOrder', { params: { orderId }, ...options }),
    cancelEligibility: (orderId, options) =>
      guestApiOperationJson('getOrderCancelEligibility', { params: { orderId }, ...options }),
    cancel: (orderId, body, options) =>
      guestApiOperationJson('requestOrderCancel', { params: { orderId }, body, ...options }),
    reissue: (orderId, options) =>
      guestApiOperationJson('reissueOrderFulfillment', { params: { orderId }, ...options }),
  },
  tickets: {
    wallet: (options) => guestApiOperationJson('getGuestTickets', options),
    get: (ticketId, options) =>
      guestApiOperationJson('getGuestTicket', { params: { ticketId }, ...options }),
    getPublic: (entitlementId, options) =>
      guestApiOperationJson('getPublicTicket', { params: { entitlementId }, ...options }),
    share: (body, options) =>
      guestApiOperationJson('createTicketShareBundle', { body, ...options }),
    shareBundle: (query = '', options) =>
      guestApiOperationJson('getTicketShareBundle', { query, ...options }),
    claimShare: (body, options) => guestApiOperationJson('claimSharedTicket', { body, ...options }),
    claimPartnerSlot: (body, options) =>
      guestApiOperationJson('claimPartnerSlot', { body, ...options }),
    assignPartner: (body, options) =>
      guestApiOperationJson('assignPartnerTicket', { body, ...options }),
    partnerClaimLink: (body, options) =>
      guestApiOperationJson('createPartnerClaimLink', { body, ...options }),
    transferCouple: (body, options) =>
      guestApiOperationJson('transferCoupleTicket', { body, ...options }),
    initiateTransfer: (body, options) =>
      guestApiOperationJson('initiateTicketTransfer', { body, ...options }),
    acceptTransfer: (body, options) =>
      guestApiOperationJson('acceptTicketTransfer', { body, ...options }),
    cancelTransfer: (body, options) =>
      guestApiOperationJson('cancelTicketTransfer', { body, ...options }),
    coverWallet: (query = '', options) =>
      guestApiOperationJson('getTicketCoverWallet', { query, ...options }),
    coverChargeWallet: (walletId, options) =>
      guestApiOperationJson('getCoverChargeWallet', { params: { walletId }, ...options }),
  },
  notifications: {
    list: (query = '', options) =>
      guestApiOperationJson('listGuestNotifications', { query, ...options }),
    unreadCount: (options) =>
      guestApiOperationJson('listGuestNotifications', { query: { countOnly: 'true' }, ...options }),
    markAllRead: (options) =>
      guestApiOperationJson('updateGuestNotifications', { body: { markAll: true }, ...options }),
    markRead: (id, options) =>
      guestApiOperationJson('markGuestNotificationRead', { params: { id }, ...options }),
  },
  waitlist: {
    join: (body, options) => guestApiOperationJson('joinWaitlist', { body, ...options }),
  },
});
