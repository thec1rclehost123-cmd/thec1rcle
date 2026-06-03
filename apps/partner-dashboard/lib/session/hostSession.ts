export const HOST_SESSION_STORAGE_KEY = "partner-dashboard:host-session-id";
export const HOST_SESSION_COOKIE = "pd_host_session_id";
export const HOST_SESSION_HEADER = "x-host-session-id";
const HOST_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function canUseBrowserApis() {
    return typeof window !== "undefined" && typeof document !== "undefined";
}

function readCookie(name: string) {
    if (!canUseBrowserApis()) return null;
    const prefix = `${name}=`;
    const entry = document.cookie
        .split(";")
        .map((chunk) => chunk.trim())
        .find((chunk) => chunk.startsWith(prefix));
    if (!entry) return null;
    return decodeURIComponent(entry.slice(prefix.length));
}

function persistCookie(name: string, value: string) {
    if (!canUseBrowserApis()) return;
    document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${HOST_SESSION_TTL_SECONDS}; SameSite=Lax`;
}

function generateSessionId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    return `host-session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function readHostSessionIdFromCookieHeader(cookieHeader: string | null | undefined) {
    if (!cookieHeader) return null;
    const prefix = `${HOST_SESSION_COOKIE}=`;
    const entry = cookieHeader
        .split(";")
        .map((chunk) => chunk.trim())
        .find((chunk) => chunk.startsWith(prefix));
    if (!entry) return null;
    return decodeURIComponent(entry.slice(prefix.length));
}

export function getStoredHostSessionId() {
    if (!canUseBrowserApis()) return null;
    const stored = window.localStorage.getItem(HOST_SESSION_STORAGE_KEY);
    if (stored) {
        persistCookie(HOST_SESSION_COOKIE, stored);
        return stored;
    }

    const cookieValue = readCookie(HOST_SESSION_COOKIE);
    if (cookieValue) {
        window.localStorage.setItem(HOST_SESSION_STORAGE_KEY, cookieValue);
        persistCookie(HOST_SESSION_COOKIE, cookieValue);
        return cookieValue;
    }

    return null;
}

export function persistHostSessionId(sessionId: string) {
    if (!canUseBrowserApis() || !sessionId) return sessionId;
    window.localStorage.setItem(HOST_SESSION_STORAGE_KEY, sessionId);
    persistCookie(HOST_SESSION_COOKIE, sessionId);
    return sessionId;
}

export function getOrCreateHostSessionId() {
    const existing = getStoredHostSessionId();
    if (existing) return existing;
    const created = generateSessionId();
    return persistHostSessionId(created);
}

