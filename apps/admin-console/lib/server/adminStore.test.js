import { describe, expect, it, vi } from 'vitest';

const mockDoc = (id, data) => ({
  id,
  exists: true,
  data: () => data,
});

const mockDocSnapshot = (id, data) => ({
  id,
  exists: true,
  data: () => data,
  get: vi.fn(),
});

const mockDocRef = (id) => ({
  id,
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  update: vi.fn(),
});

const mockCollection = (docs = []) => {
  const query = {
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    startAfter: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue({ docs }),
    doc: vi.fn((id) => ({
      ...mockDocRef(id),
      get: vi.fn().mockResolvedValue(mockDocSnapshot(id, {})),
    })),
  };
  const collection = vi.fn(() => query);
  collection.query = query;
  return collection;
};

vi.mock('@/lib/firebase/admin', () => ({
  getAdminDb: vi.fn(() => ({
    collection: vi.fn(() => ({
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      startAfter: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: [] }),
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ exists: false, data: () => null }),
        set: vi.fn(),
        update: vi.fn(),
      })),
      add: vi.fn(),
    })),
    batch: vi.fn(() => ({ update: vi.fn(), commit: vi.fn() })),
    runTransaction: vi.fn((fn) => fn({ get: vi.fn(), update: vi.fn() })),
  })),
  getAdminAuth: vi.fn(() => ({
    getUserByEmail: vi.fn(),
    setCustomUserClaims: vi.fn(),
  })),
}));

vi.mock('@c1rcle/core/firestore-admin', () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => ({ _seconds: 1234567890, _nanoseconds: 0 })),
    delete: vi.fn(),
    increment: vi.fn((n) => n),
  },
}));

vi.mock('@c1rcle/core/redis', () => ({
  getRedisClient: vi.fn(() => null),
}));

vi.mock('resend', () => ({
  default: vi.fn().mockImplementation(() => ({
    emails: { send: vi.fn() },
  })),
}));

import { adminStore } from './adminStore';

describe('adminStore', () => {
  describe('getDocumentById', () => {
    it('returns document data when found', async () => {
      const { getAdminDb } = await import('@/lib/firebase/admin');
      getAdminDb.mockReturnValue({
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            get: vi.fn().mockResolvedValue(mockDocSnapshot('doc_1', { name: 'Test', email: 'test@test.com' })),
          })),
        })),
      });

      const result = await adminStore.getDocumentById('users', 'doc_1');
      expect(result).toEqual({ id: 'doc_1', name: 'Test', email: 'test@test.com' });
    });

    it('returns null when document does not exist', async () => {
      const { getAdminDb } = await import('@/lib/firebase/admin');
      const mockGet = vi.fn().mockResolvedValue({ exists: false, data: () => null });
      getAdminDb.mockReturnValue({
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({ get: mockGet })),
        })),
      });

      const result = await adminStore.getDocumentById('users', 'nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('findUserByEmail', () => {
    it('returns user when email matches', async () => {
      const { getAdminDb } = await import('@/lib/firebase/admin');
      getAdminDb.mockReturnValue({
        collection: vi.fn(() => ({
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({
            empty: false,
            docs: [mockDocSnapshot('user_1', { email: 'test@test.com', displayName: 'Test' })],
          }),
        })),
      });

      const result = await adminStore.findUserByEmail('test@test.com');
      expect(result).toEqual({ id: 'user_1', email: 'test@test.com', displayName: 'Test' });
    });

    it('returns null when no user matches', async () => {
      const { getAdminDb } = await import('@/lib/firebase/admin');
      getAdminDb.mockReturnValue({
        collection: vi.fn(() => ({
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
        })),
      });

      const result = await adminStore.findUserByEmail('missing@test.com');
      expect(result).toBeNull();
    });
  });

  describe('listCollection', () => {
    it('returns items with pagination metadata', async () => {
      const { getAdminDb } = await import('@/lib/firebase/admin');
      const docs = Array.from({ length: 5 }, (_, i) =>
        mockDocSnapshot(`doc_${i}`, { name: `Item ${i}`, createdAt: new Date() }),
      );
      getAdminDb.mockReturnValue({
        collection: vi.fn(() => ({
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          startAfter: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ docs }),
          doc: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({ exists: false }),
          })),
        })),
      });

      const result = await adminStore.listCollection('users', { limit: 10 });
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('hasMore');
      expect(result).toHaveProperty('nextCursor');
      expect(result.items.length).toBe(5);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('detects hasMore when more items exist', async () => {
      const { getAdminDb } = await import('@/lib/firebase/admin');
      const docs = Array.from({ length: 11 }, (_, i) =>
        mockDocSnapshot(`doc_${i}`, { name: `Item ${i}`, createdAt: new Date() }),
      );
      getAdminDb.mockReturnValue({
        collection: vi.fn(() => ({
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          startAfter: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ docs }),
          doc: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({ exists: false }),
          })),
        })),
      });

      const result = await adminStore.listCollection('users', { limit: 10 });
      expect(result.items.length).toBe(10);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe('doc_9');
    });
  });

  describe('getRefunds', () => {
    it('returns refunds with pagination metadata', async () => {
      const { getAdminDb } = await import('@/lib/firebase/admin');
      const docs = Array.from({ length: 3 }, (_, i) =>
        mockDocSnapshot(`refund_${i}`, { amount: 50, status: 'pending', createdAt: new Date() }),
      );
      getAdminDb.mockReturnValue({
        collection: vi.fn(() => ({
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          startAfter: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ docs }),
          doc: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({ exists: false }),
          })),
        })),
      });

      const result = await adminStore.getRefunds({ status: 'pending', limit: 25 });
      expect(result.refunds.length).toBe(3);
      expect(result).toHaveProperty('hasMore');
      expect(result).toHaveProperty('nextCursor');
    });
  });

  describe('getHealthStatus', () => {
    it('returns health status for database and audit pipeline', async () => {
      const { getAdminDb } = await import('@/lib/firebase/admin');
      getAdminDb.mockReturnValue({
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({ exists: true, data: () => ({}) }),
          })),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ empty: false, docs: [mockDocSnapshot('log_1', { sequence: 1 })] }),
        })),
      });

      const result = await adminStore.getHealthStatus();
      expect(result.database).toBe('Healthy');
      expect(result.audit_pipeline).toBe('Healthy');
    });
  });

  describe('searchCollection', () => {
    it('returns matching items for a given query', async () => {
      const { getAdminDb } = await import('@/lib/firebase/admin');
      const docs = Array.from({ length: 3 }, (_, i) =>
        mockDocSnapshot(`user_${i}`, { displayName_lower: `test user ${i}`, email_lower: `test${i}@test.com` }),
      );
      getAdminDb.mockReturnValue({
        collection: vi.fn(() => ({
          orderBy: vi.fn().mockReturnThis(),
          startAt: vi.fn().mockReturnThis(),
          endAt: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ docs }),
        })),
      });

      const result = await adminStore.searchCollection('users', 'test', { limit: 10 });
      expect(result.items.length).toBe(3);
      expect(result.total).toBe(3);
    });

    it('returns empty for unsupported collections', async () => {
      const result = await adminStore.searchCollection('unsupported', 'test');
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('exportCollection', () => {
    it('exports documents from a collection', async () => {
      const { getAdminDb } = await import('@/lib/firebase/admin');
      const docs = Array.from({ length: 3 }, (_, i) =>
        mockDocSnapshot(`doc_${i}`, { name: `Item ${i}` }),
      );
      getAdminDb.mockReturnValue({
        collection: vi.fn(() => ({
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ docs }),
        })),
      });

      const result = await adminStore.exportCollection('users', 10);
      expect(result.length).toBe(3);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
    });
  });
});
