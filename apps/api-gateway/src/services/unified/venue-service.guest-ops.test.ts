import { describe, expect, it } from 'vitest';
import { VenueService } from './venue-service.js';

type TestDoc = {
  id: string;
  data: () => Record<string, unknown>;
};

class PaginatedQuery {
  private cursorId: string | null = null;
  private pageSize = Number.POSITIVE_INFINITY;

  constructor(
    private readonly docs: TestDoc[],
    private readonly metrics: {
      limits: number[];
      cursors: string[];
    },
  ) {}

  where() {
    return this;
  }

  orderBy() {
    return this;
  }

  limit(size: number) {
    this.pageSize = size;
    this.metrics.limits.push(size);
    return this;
  }

  startAfter(cursor: TestDoc) {
    this.cursorId = cursor.id;
    this.metrics.cursors.push(cursor.id);
    return this;
  }

  async get() {
    const cursorIndex = this.cursorId
      ? this.docs.findIndex((candidate) => candidate.id === this.cursorId)
      : -1;
    return {
      docs: this.docs.slice(cursorIndex + 1, cursorIndex + 1 + this.pageSize),
    };
  }
}

function makeDocs(count: number, data: (index: number) => Record<string, unknown>): TestDoc[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `doc-${String(index).padStart(4, '0')}`,
    data: () => data(index),
  }));
}

describe('VenueService guest operations pagination', () => {
  it('processes orders and check-ins in bounded cursor pages', async () => {
    const orderDocs = makeDocs(601, (index) => ({
      status: index % 5 === 0 ? 'cancelled' : 'confirmed',
      ticketCount: 2,
      deniedAt: index % 10 === 1 ? '2026-07-28T00:00:00.000Z' : null,
    }));
    const checkInDocs = makeDocs(501, () => ({ eventId: 'event-1' }));
    const metrics = {
      orders: { limits: [] as number[], cursors: [] as string[] },
      check_ins: { limits: [] as number[], cursors: [] as string[] },
    };
    const db = {
      collection(name: 'orders' | 'check_ins') {
        return new PaginatedQuery(name === 'orders' ? orderDocs : checkInDocs, metrics[name]);
      },
    };
    const service = new VenueService(db as any);

    const summary = await service.getGuestOps({ partnerId: 'venue-1' } as any, 'event-1');

    expect(summary).toEqual({
      eventId: 'event-1',
      totalGuests: 960,
      checkedIn: 501,
      pending: 339,
      denied: 120,
    });
    expect(metrics.orders.limits).toEqual([250, 250, 250]);
    expect(metrics.orders.cursors).toEqual(['doc-0249', 'doc-0499']);
    expect(metrics.check_ins.limits).toEqual([250, 250, 250]);
    expect(metrics.check_ins.cursors).toEqual(['doc-0249', 'doc-0499']);
  });
});
