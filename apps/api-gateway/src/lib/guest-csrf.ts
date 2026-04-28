import { randomBytes } from 'node:crypto';
import { buildErrorResponse } from './api-contracts';

export const GUEST_CSRF_COOKIE_NAME = 'guest_csrf';
export const GUEST_CSRF_HEADER_NAME = 'x-csrf-token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_EXEMPT_PATHS = [
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/auth/check',
    '/api/v1/auth/password-reset',
    '/api/v1/auth/google/start',
    '/api/v1/auth/google/callback',
    '/api/v1/auth/session',
];

function isProduction() {
    return process.env.NODE_ENV === 'production';
}

export function parseCookieHeader(header?: string | null) {
    const cookies: Record<string, string> = {};
    if (!header) return cookies;

    for (const part of String(header).split(';')) {
        const [rawName, ...rest] = part.trim().split('=');
        if (!rawName) continue;
        try {
            cookies[rawName] = decodeURIComponent(rest.join('=') || '');
        } catch {
            cookies[rawName] = rest.join('=') || '';
        }
    }

    return cookies;
}

export function createGuestCsrfToken() {
    return randomBytes(32).toString('base64url');
}

export function serializeGuestCsrfCookie(token: string, maxAgeSeconds = 60 * 60 * 24 * 5) {
    const parts = [
        `${GUEST_CSRF_COOKIE_NAME}=${encodeURIComponent(token)}`,
        'Path=/',
        'SameSite=Lax',
        `Max-Age=${maxAgeSeconds}`,
    ];

    if (isProduction()) {
        parts.push('Secure');
    }

    return parts.join('; ');
}

export function serializeGuestCsrfClearCookie() {
    return `${GUEST_CSRF_COOKIE_NAME}=; Path=/; SameSite=Lax; Max-Age=0${isProduction() ? '; Secure' : ''}`;
}

export function appendSetCookieHeader(reply: any, cookie: string) {
    const existing = typeof reply.getHeader === 'function' ? reply.getHeader('set-cookie') : undefined;
    if (!existing) {
        reply.header('set-cookie', cookie);
        return;
    }

    const nextValue = Array.isArray(existing) ? [...existing, cookie] : [existing, cookie];
    reply.header('set-cookie', nextValue);
}

export function issueGuestCsrfCookie(reply: any, maxAgeSeconds = 60 * 60 * 24 * 5) {
    const token = createGuestCsrfToken();
    appendSetCookieHeader(reply, serializeGuestCsrfCookie(token, maxAgeSeconds));
    return token;
}

export function ensureGuestCsrfCookie(request: any, reply: any) {
    const cookies = parseCookieHeader(request.headers?.cookie);
    const token = cookies[GUEST_CSRF_COOKIE_NAME] || createGuestCsrfToken();
    appendSetCookieHeader(reply, serializeGuestCsrfCookie(token));
    return token;
}

export function shouldRequireGuestCsrf(request: any) {
    const method = String(request.method || 'GET').toUpperCase();
    if (SAFE_METHODS.has(method)) return false;

    const url = String(request.url || '').split('?')[0];
    if (!url.startsWith('/api/v1/')) return false;
    if (CSRF_EXEMPT_PATHS.some((path) => url === path || url.startsWith(`${path}/`))) return false;

    const cookies = parseCookieHeader(request.headers?.cookie);
    return Boolean(cookies.__session);
}

export function verifyGuestCsrfRequest(request: any) {
    if (!shouldRequireGuestCsrf(request)) return { ok: true as const };

    const cookies = parseCookieHeader(request.headers?.cookie);
    const cookieToken = cookies[GUEST_CSRF_COOKIE_NAME];
    const headerValue = request.headers?.[GUEST_CSRF_HEADER_NAME];
    const headerToken = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (cookieToken && headerToken && cookieToken === headerToken) {
        return { ok: true as const };
    }

    return {
        ok: false as const,
        response: buildErrorResponse({
            code: 'CSRF_TOKEN_INVALID',
            message: 'Missing or invalid CSRF token.',
            requestId: request.id,
        }),
    };
}
