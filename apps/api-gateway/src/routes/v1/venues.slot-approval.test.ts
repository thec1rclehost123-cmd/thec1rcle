import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import validatePlugin from '../../plugins/validate.js';
import { MockFirestore } from '../../test-utils/mock-firestore.js';
import venueRoutes from './venues.js';

class StrictTransactionFirestore extends MockFirestore {
  override async runTransaction<T>(handler: (transaction: any) => Promise<T>): Promise<T> {
    return super.runTransaction(async (transaction: any) => {
      let hasWritten = false;
      const strictTransaction = {
        get: async (target: any) => {
          if (hasWritten) {
            throw new Error(
              'Firestore transactions require all reads to be executed before all writes.',
            );
          }
          return transaction.get(target);
        },
        set: (...args: any[]) => {
          hasWritten = true;
          return transaction.set(...args);
        },
        create: (...args: any[]) => {
          hasWritten = true;
          return transaction.create(...args);
        },
        update: (...args: any[]) => {
          hasWritten = true;
          return transaction.update(...args);
        },
        delete: (...args: any[]) => {
          hasWritten = true;
          return transaction.delete(...args);
        },
      };
      return handler(strictTransaction);
    });
  }
}

async function buildServer() {
  const server = Fastify({ logger: false });
  const db = new StrictTransactionFirestore();
  server.decorate('db', db as any);
  server.decorate('requireAuth', async () => {});
  server.decorate('verifyPartnerAccess', async () => true);
  server.decorate('publicDiscoveryService', { syncEventReadModels: async () => undefined } as any);
  server.decorate('invalidatePublicDiscovery', async () => undefined);
  server.addHook('onRequest', (request: any, _reply, done) => {
    request.user = { uid: 'venue-user-1', partnerId: 'venue-1', role: 'venue' };
    done();
  });
  await server.register(validatePlugin);
  await server.register(venueRoutes);
  return { server, db };
}

function seedRequest(db: StrictTransactionFirestore, id: string) {
  db.seed(`availability_slots/${id}`, {
    venueId: 'venue-1',
    venueName: 'QA Venue',
    hostId: 'host-1',
    eventId: 'event-1',
    date: '2026-08-01',
    startTime: '18:00',
    endTime: '21:00',
    requestedDate: '2026-08-01',
    requestedStartTime: '18:00',
    requestedEndTime: '21:00',
    status: 'pending',
  });
  db.seed('events/event-1', {
    venueId: 'venue-1',
    hostId: 'host-1',
    lifecycle: 'submitted',
    status: 'submitted',
  });
}

describe('venue slot approval transaction', () => {
  it('approves a slot and linked event without reading after a transaction write', async () => {
    const { server, db } = await buildServer();
    seedRequest(db, 'slot-approve');

    const response = await server.inject({
      method: 'PATCH',
      url: '/slots/slot-approve',
      payload: { action: 'approve', notes: 'Approved for E2E.' },
    });

    expect(response.statusCode).toBe(200);
    expect(db.getDoc('availability_slots/slot-approve')).toMatchObject({ status: 'approved' });
    expect(db.getDoc('events/event-1')).toMatchObject({
      lifecycle: 'scheduled',
      slotStatus: 'approved',
      visibility: 'public',
    });
    await server.close();
  });

  it('rejects a slot and linked event without reading after a transaction write', async () => {
    const { server, db } = await buildServer();
    seedRequest(db, 'slot-reject');

    const response = await server.inject({
      method: 'PATCH',
      url: '/slots/slot-reject',
      payload: { action: 'reject', notes: 'Please choose another time.' },
    });

    expect(response.statusCode).toBe(200);
    expect(db.getDoc('availability_slots/slot-reject')).toMatchObject({ status: 'rejected' });
    expect(db.getDoc('events/event-1')).toMatchObject({
      lifecycle: 'denied',
      slotStatus: 'rejected',
    });
    await server.close();
  });
});
