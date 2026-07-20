import { describe, expect, it, vi } from 'vitest';
import { writeAuditLog } from './audit-log';

describe('writeAuditLog', () => {
  it('removes undefined payload fields before writing to Firestore', async () => {
    const set = vi.fn(async () => undefined);
    const fastify = {
      db: {
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({ set })),
        })),
      },
    } as any;

    await writeAuditLog(fastify, {
      action: 'checkout.cancel',
      payload: {
        reservationId: undefined,
        orderId: 'ord_1',
        nested: { keep: true, omit: undefined },
        values: [undefined, { keep: 'yes', omit: undefined }],
      },
    });

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: {
          orderId: 'ord_1',
          nested: { keep: true },
          values: [null, { keep: 'yes' }],
        },
      }),
    );
  });
});
