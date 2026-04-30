import { describe, expect, it } from 'vitest';
import { resolvePromoterRequestContext } from './promoter-request-context';

function createWhereChain(result: any) {
    return {
        where: () => createWhereChain(result),
        limit: () => ({ get: async () => result }),
        get: async () => result,
    };
}

describe('resolvePromoterRequestContext', () => {
    it('uses active promoter membership claims when present', async () => {
        const context = await resolvePromoterRequestContext(
            { db: {} as any },
            {
                user: {
                    uid: 'user_1',
                    email: 'promoter@example.com',
                    activeMembership: {
                        partnerId: 'promoter_123',
                        partnerType: 'promoter',
                        role: 'TEAM_LEAD',
                    },
                },
                authContext: null,
            } as any
        );

        expect(context).toEqual({
            uid: 'user_1',
            promoterId: 'promoter_123',
            role: 'TEAM_LEAD',
            displayName: 'promoter@example.com',
            membershipId: null,
        });
    });

    it('falls back to a solo promoter document when memberships are absent', async () => {
        const db = {
            collection: (name: string) => {
                if (name === 'partner_memberships') {
                    return createWhereChain({ empty: true, docs: [] });
                }
                if (name === 'promoters') {
                    return {
                        doc: () => ({
                            get: async () => ({
                                exists: true,
                                id: 'user_2',
                                data: () => ({ displayName: 'Solo Promoter' }),
                            }),
                        }),
                    };
                }
                throw new Error(`Unexpected collection: ${name}`);
            },
        };

        const context = await resolvePromoterRequestContext(
            { db: db as any },
            {
                user: { uid: 'user_2' },
                authContext: { memberships: [] },
            } as any
        );

        expect(context).toEqual({
            uid: 'user_2',
            promoterId: 'user_2',
            role: 'PROMOTER',
            displayName: 'Solo Promoter',
            membershipId: null,
        });
    });
});
