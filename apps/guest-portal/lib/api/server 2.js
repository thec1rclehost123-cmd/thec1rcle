import { headers } from "next/headers";

const API_BASE_URL = process.env.GUEST_API_GATEWAY_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api/v1";

export function getApiErrorMessage(data, fallback = "Request failed") {
  return data?.error?.message || data?.message || data?.error || fallback;
}

function normalizeServerApiPath(path) {
  if (!path) return API_BASE_URL;
  if (/^https?:\/\//.test(path)) return path;
  if (path.startsWith("/api/v1/")) return `${API_BASE_URL}${path.slice("/api/v1".length)}`;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
}

async function getForwardedCookieHeader() {
  const incomingHeaders = await headers();
  return incomingHeaders.get("cookie") || "";
}

export async function guestServerFetch(path, options = {}) {
  const {
    method = "GET",
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
    if (cookie && !nextHeaders.has("cookie")) {
      nextHeaders.set("cookie", cookie);
    }
  }
  if (!nextHeaders.has("x-request-id")) {
    nextHeaders.set("x-request-id", `guest-rsc-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  }

  const requestInit = {
    method,
    headers: nextHeaders,
    cache,
    next,
    ...rest,
  };

  if (body !== undefined) {
    if (typeof body === "string" || body instanceof URLSearchParams) {
      requestInit.body = body;
    } else {
      if (!nextHeaders.has("Content-Type")) {
        nextHeaders.set("Content-Type", "application/json");
      }
      requestInit.body = JSON.stringify(body);
    }
  }

  return fetch(normalizeServerApiPath(path), requestInit);
}

export async function guestServerJson(path, options = {}) {
  const response = await guestServerFetch(path, options);
  const data = await response.json().catch(() => ({}));
  return { response, data };
}
