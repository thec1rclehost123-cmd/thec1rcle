import { describe, expect, it } from 'vitest';
import { verifyTicketOwnershipDirect } from './guest-gp5';

function fakeDb(ticket: Record<string, unknown> | null) {
  return {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => ({
          exists: name === 'tickets' && id === 'TKT-ORDER-TIER-1' && Boolean(ticket),
          data: () => ticket,
        }),
      }),
    }),
  } as any;
}

describe('ticket ownership guard', () => {
  it('accepts the canonical TKT document id for its current owner', async () => {
    await expect(
      verifyTicketOwnershipDirect(
        'owner_1',
        'TKT-ORDER-TIER-1',
        fakeDb({ userId: 'owner_1', status: 'active' }),
      ),
    ).resolves.toBe(true);
  });

  it('rejects a canonical TKT document id owned by another user', async () => {
    await expect(
      verifyTicketOwnershipDirect(
        'attacker',
        'TKT-ORDER-TIER-1',
        fakeDb({ userId: 'owner_1', status: 'active' }),
      ),
    ).rejects.toThrow('Unauthorized: You do not own this ticket.');
  });
});
