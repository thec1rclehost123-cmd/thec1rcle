import { headers } from 'next/headers';
import { resolveGuestApiBaseUrl } from './base-url.mjs';

const API_BASE_URL = resolveGuestApiBaseUrl(process.env);

export function getApiErrorMessage(data, fallback = 'Request failed') {
  return data?.error?.message || data?.message || data?.error || fallback;
}

function normalizeServerApiPath(path) {
  if (!path) return API_BASE_URL;
  if (/^https?:\/\//.test(path)) return path;
  if (path.startsWith('/api/v1/')) return `${API_BASE_URL}${path.slice('/api/v1'.length)}`;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
}

async function getForwardedCookieHeader() {
  const incomingHeaders = await headers();
  return incomingHeaders.get('cookie') || '';
}

export async function guestServerFetch(path, options = {}) {
  const {
    method = 'GET',
    headers: requestHeaders,
    body,
    cache,
    next,
    forwardCookies = true,
    ...rest
  } = options;

  const nextHeaders = new Headers(requestHeaders || {});
  if (forwardCookies) {
    const cookie = await getForwardedCookieHeader();
    if (cookie && !nextHeaders.has('cookie')) {
      nextHeaders.set('cookie', cookie);
    }
  }
  if (!nextHeaders.has('x-request-id')) {
    nextHeaders.set(
      'x-request-id',
      `guest-rsc-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
  }

  const requestInit = {
    method,
    headers: nextHeaders,
    cache,
    next,
    ...rest,
  };

  if (body !== undefined) {
    if (typeof body === 'string' || body instanceof URLSearchParams) {
      requestInit.body = body;
    } else {
      if (!nextHeaders.has('Content-Type')) {
        nextHeaders.set('Content-Type', 'application/json');
      }
      requestInit.body = JSON.stringify(body);
    }
  }

  try {
    return await fetch(normalizeServerApiPath(path), requestInit);
  } catch (error) {
    const payload = {
      success: false,
      error: 'Upstream API unavailable',
      message: error?.message || 'Unable to reach the guest API gateway.',
    };
    return new Response(JSON.stringify(payload), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'x-guest-fetch-error': '1',
      },
    });
  }
}

export async function guestServerJson(path, options = {}) {
  const response = await guestServerFetch(path, options);
  const data = await response.json().catch(() => ({}));
  return { response, data };
}
