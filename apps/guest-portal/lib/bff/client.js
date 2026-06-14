const GUEST_BFF_BASE_PATH = "/api/app";

function normalizeGuestBffPath(path) {
  if (!path) return GUEST_BFF_BASE_PATH;
  if (path.startsWith(GUEST_BFF_BASE_PATH)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${GUEST_BFF_BASE_PATH}${normalized}`;
}

function createRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `guest-bff-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readCookie(name) {
  if (typeof document === "undefined") return "";
  const prefix = `${name}=`;
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : "";
}

function isUnsafeMethod(method) {
  return !["GET", "HEAD", "OPTIONS"].includes(String(method || "GET").toUpperCase());
}

export function getGuestBffErrorMessage(data, fallback = "Request failed") {
  return data?.error?.message || data?.message || data?.error || fallback;
}

export async function guestBffFetch(path, options = {}) {
  const {
    method = "GET",
    headers,
    body,
    credentials = "include",
    cache = "no-store",
    ...rest
  } = options;

  const nextHeaders = new Headers(headers || {});
  if (!nextHeaders.has("x-request-id")) {
    nextHeaders.set("x-request-id", createRequestId());
  }
  if (isUnsafeMethod(method) && !nextHeaders.has("x-csrf-token")) {
    const csrfToken = readCookie("guest_csrf");
    if (csrfToken) {
      nextHeaders.set("x-csrf-token", csrfToken);
    }
  }

  const requestInit = {
    method,
    headers: nextHeaders,
    credentials,
    cache,
    ...rest,
  };

  if (body !== undefined) {
    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
    const isString = typeof body === "string";
    const isBlob = typeof Blob !== "undefined" && body instanceof Blob;
    const isUrlSearchParams = body instanceof URLSearchParams;

    if (isFormData || isString || isBlob || isUrlSearchParams) {
      requestInit.body = body;
    } else {
      if (!nextHeaders.has("Content-Type")) {
        nextHeaders.set("Content-Type", "application/json");
      }
      requestInit.body = JSON.stringify(body);
    }
  }

  return fetch(normalizeGuestBffPath(path), requestInit);
}

export async function guestBffJson(path, options = {}) {
  const response = await guestBffFetch(path, options);
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

export function unwrapGuestBffPayload(data) {
  if (data && typeof data === "object" && "ok" in data && "data" in data) {
    return data.data;
  }
  return data;
}
