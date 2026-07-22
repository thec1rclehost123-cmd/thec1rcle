import { describe, expect, it, vi } from 'vitest';
import { IdempotencyService } from './src/domain/services/idempotency-service';

describe('IdempotencyService Firestore serialization', () => {
  it('removes undefined fields from saved response bodies', async () => {
    const set = vi.fn(async () => undefined);
    const db = {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({ set })),
      })),
    } as any;
    const service = new IdempotencyService(db);

    await service.saveResponse(
      'verify:pay_1',
      'user_1',
      {
        success: true,
        order: { id: 'ord_1', source: undefined },
        tickets: [undefined, { id: 'ticket_1', source: undefined }],
      },
      200,
    );

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        responseBody: {
          success: true,
          order: { id: 'ord_1' },
          tickets: [null, { id: 'ticket_1' }],
        },
      }),
    );
  });

  it('stores a Firestore-safe response inside executeOnce', async () => {
    const transactionSet = vi.fn();
    const document = { id: 'idempotency-doc' };
    const db = {
      collection: vi.fn(() => ({ doc: vi.fn(() => document) })),
      runTransaction: vi.fn(async (work: any) =>
        work({
          get: vi.fn(async () => ({ exists: false })),
          set: transactionSet,
        }),
      ),
    } as any;
    const service = new IdempotencyService(db);

    const result = await service.executeOnce('verify:pay_1', 'user_1', async () => ({
      success: true,
      order: { id: 'ord_1', source: undefined },
    }));

    expect(result).toMatchObject({ success: true });
    expect(transactionSet).toHaveBeenCalledWith(
      document,
      expect.objectContaining({
        responseBody: { success: true, order: { id: 'ord_1' } },
      }),
    );
  });
});
