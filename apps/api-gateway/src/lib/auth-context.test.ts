import { describe, expect, it } from 'vitest';
import { buildRequestAuthContext } from './auth-context';

describe('auth-context', () => {
    it('builds identity, scopes, and active membership from internal memberships', () => {
        const context = buildRequestAuthContext(
            {
                uid: 'user_123',
                email: 'ops@c1rcle.com',
                partnerId: 'venue_1',
                partnerType: 'venue',
            },
            [
                { partnerId: 'venue_1', partnerType: 'venue', role: 'manager', status: 'active' },
                { partnerId: 'host_1', partnerType: 'host', role: 'owner', status: 'active' },
            ],
        );

        expect(context.identity.uid).toBe('user_123');
        expect(context.activeMembership).toEqual({
            partnerId: 'venue_1',
            partnerType: 'venue',
            role: 'manager',
            status: 'active',
            isActive: true,
        });
        expect(context.scopes.partnerIds).toEqual(['venue_1', 'host_1']);
        expect(context.scopes.partnerTypes).toEqual(['venue', 'host']);
        expect(context.scopes.roles).toEqual(['manager', 'owner']);
    });
});
