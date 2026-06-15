import { describe, it, expect, vi } from 'vitest';
import { recordLedgerTransaction, MONEY_STATES } from './ledger-engine.js';

// Mock Admin to disable Firestore for these logic tests
vi.mock('./admin.js', () => ({
  getAdminDb: () => ({
    collection: () => ({
      doc: () => ({ set: vi.fn() }),
    }),
    runTransaction: async (cb) => cb({ set: vi.fn() }),
  }),
  isFirebaseConfigured: () => false,
}));

describe('Ledger Engine', () => {
  describe('Balance Validation', () => {
    it('should throw error if entries are not balanced', async () => {
      const entries = [
        { amount: 100, state: MONEY_STATES.CAPTURED },
        { amount: -50, state: MONEY_STATES.CAPTURED },
      ];

      await expect(recordLedgerTransaction(entries)).rejects.toThrow('out of balance');
    });

    it('should succeed for balanced entries', async () => {
      const entries = [
        { amount: 100, state: MONEY_STATES.CAPTURED },
        { amount: -100, state: MONEY_STATES.CAPTURED },
      ];

      const result = await recordLedgerTransaction(entries);
      expect(result).toHaveLength(2);
    });

    it('should handle small floating point differences', async () => {
      const entries = [
        { amount: 100.0001, state: MONEY_STATES.CAPTURED },
        { amount: -100, state: MONEY_STATES.CAPTURED },
      ];

      const result = await recordLedgerTransaction(entries);
      expect(result).toBeDefined();
    });
  });
});
