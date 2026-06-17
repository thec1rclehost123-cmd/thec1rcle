import { describe, it, expect, vi } from 'vitest';
import * as EntitlementEngine from './entitlement-engine.js';

// Mock Admin for processEntryScan
vi.mock('./admin.js', () => {
  const mockDb = {
    collection: () => ({
      doc: () => ({
        get: vi.fn().mockResolvedValue({ exists: false, data: () => ({}) }),
        update: vi.fn(),
        set: vi.fn(),
      }),
    }),
    runTransaction: async (cb: any) =>
      cb({
        get: vi.fn().mockResolvedValue({ exists: false, data: () => ({}) }),
        update: vi.fn(),
        set: vi.fn(),
      }),
  };
  return {
    getAdminDb: () => mockDb,
    isFirebaseConfigured: () => false,
  };
});

describe('Entitlement Engine', () => {
  describe('QR Code Logic', () => {
    it('should generate a valid QR payload', () => {
      const eid = 'ENT-123';
      const payload = EntitlementEngine.generateEntitlementQR(eid);
      expect(payload.eid).toBe(eid);
      expect(payload.sig).toBeDefined();
      expect(payload.sig.length).toBe(16);
    });

    it('should verify a recently generated QR', () => {
      const eid = 'ENT-123';
      const payload = EntitlementEngine.generateEntitlementQR(eid);
      const result = EntitlementEngine.verifyEntitlementQR(payload);
      expect(result.valid).toBe(true);
      expect(result.entitlementId).toBe(eid);
    });

    it('should reject stale QR codes', () => {
      const eid = 'ENT-123';
      const oldTs = Math.floor(Date.now() / 1000) - 120; // 2 minutes ago
      const payload = { eid, ts: oldTs, sig: 'some-sig' };
      const result = EntitlementEngine.verifyEntitlementQR(payload);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('STALE_QR');
    });

    it('should reject invalid signatures', () => {
      const eid = 'ENT-123';
      const payload = EntitlementEngine.generateEntitlementQR(eid);
      payload.sig = 'wrong-signature';
      const result = EntitlementEngine.verifyEntitlementQR(payload);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_QR');
    });
  });

  describe('issueEntitlements', () => {
    it('should create correct number of human units', async () => {
      const order = { id: 'o1', eventId: 'e1', userId: 'u1' };
      const items = [{ ticketId: 't1', quantity: 3, name: 'General' }];

      // @ts-ignore
      const ents = await EntitlementEngine.issueEntitlements(order, items);
      expect(ents).toHaveLength(3);
      expect(ents[0].state).toBe('ISSUED');
      expect(ents[1].metadata.index).toBe(2);
    });
  });
});
