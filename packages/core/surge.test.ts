import { describe, it, expect, vi } from 'vitest';
import { generateAdmissionToken, validateAdmission } from './surge.js';

// Mock dependecies
vi.mock('./redis.js', () => ({
  getRedisClient: vi.fn(),
}));

vi.mock('./admin.js', () => ({
  getAdminDb: vi.fn(),
  isFirebaseConfigured: () => false,
}));

describe('Surge Protection System', () => {
  describe('Admission Tokens', () => {
    const mockEventId = 'event-1';
    const mockUserId = 'user-1';
    const mockQueueId = 'queue-1';

    it('should generate a verifiable token', () => {
      const token = generateAdmissionToken(mockEventId, mockUserId, mockQueueId);
      expect(token).toContain(mockEventId);
      expect(token).toContain(mockUserId);
      expect(token.split(':')).toHaveLength(4);
    });

    it('should reject tampered tokens', async () => {
      const token = generateAdmissionToken(mockEventId, mockUserId, mockQueueId);
      const tamperedToken = token.replace('user-1', 'user-2');

      // Mock DB for validation
      const mockDb = {
        collection: () => ({
          doc: () => ({
            get: vi.fn().mockResolvedValue({
              exists: true,
              data: () => ({ status: 'admitted', expiresAt: '2100-01-01' }),
            }),
          }),
        }),
      };

      const isValid = await validateAdmission(
        mockDb as any,
        mockEventId,
        mockUserId,
        tamperedToken,
      );
      expect(isValid).toBe(false);
    });

    it('should validate valid tokens for correct event/user', async () => {
      const token = generateAdmissionToken(mockEventId, mockUserId, mockQueueId);

      const mockDb = {
        collection: () => ({
          doc: () => ({
            get: vi.fn().mockResolvedValue({
              exists: true,
              data: () => ({ status: 'admitted', expiresAt: '2100-01-01' }),
              update: vi.fn(),
            }),
            update: vi.fn(),
          }),
        }),
      };

      const isValid = await validateAdmission(mockDb as any, mockEventId, mockUserId, token);
      expect(isValid).toBe(true);
    });
  });
});
