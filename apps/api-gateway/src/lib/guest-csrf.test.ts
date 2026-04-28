import { describe, expect, it } from 'vitest';
import {
    GUEST_CSRF_HEADER_NAME,
    parseCookieHeader,
    shouldRequireGuestCsrf,
    verifyGuestCsrfRequest,
} from './guest-csrf';

describe('guest CSRF guard', () => {
    it('requires CSRF only for authenticated guest mutations', () => {
        expect(shouldRequireGuestCsrf({ method: 'GET', url: '/api/v1/tickets', headers: { cookie: '__session=s' } })).toBe(false);
        expect(shouldRequireGuestCsrf({ method: 'POST', url: '/api/v1/auth/login', headers: { cookie: '__session=s' } })).toBe(false);
        expect(shouldRequireGuestCsrf({ method: 'POST', url: '/api/v1/tickets/share', headers: { cookie: '__session=s' } })).toBe(true);
        expect(shouldRequireGuestCsrf({ method: 'POST', url: '/api/v1/tickets/share', headers: {} })).toBe(false);
    });

    it('accepts matching double-submit token and rejects mismatches', () => {
        const valid = verifyGuestCsrfRequest({
            id: 'req_1',
            method: 'PATCH',
            url: '/api/v1/profiles',
            headers: {
                cookie: '__session=session; guest_csrf=token_1',
                [GUEST_CSRF_HEADER_NAME]: 'token_1',
            },
        });
        const invalid = verifyGuestCsrfRequest({
            id: 'req_2',
            method: 'PATCH',
            url: '/api/v1/profiles',
            headers: {
                cookie: '__session=session; guest_csrf=token_1',
                [GUEST_CSRF_HEADER_NAME]: 'wrong',
            },
        });

        expect(valid.ok).toBe(true);
        expect(invalid.ok).toBe(false);
        if (!invalid.ok) expect(invalid.response.error.code).toBe('CSRF_TOKEN_INVALID');
    });

    it('parses encoded cookie values safely', () => {
        expect(parseCookieHeader('guest_csrf=a%2Fb%3Dc; other=value')).toMatchObject({
            guest_csrf: 'a/b=c',
            other: 'value',
        });
    });
});
