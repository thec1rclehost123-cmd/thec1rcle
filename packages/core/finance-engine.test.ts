import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFinancialSummary } from './finance-engine.js';

// Setup highly controlled mock database environment
const mockGet = vi.fn();
const mockCollection = vi.fn();

vi.mock('./admin.js', () => {
  return {
    getAdminDb: () => ({
      collection: mockCollection,
    }),
    isFirebaseConfigured: () => true,
  };
});

describe('Finance Engine - Event Financial Summary Aggregator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.mockImplementation((name) => {
      return {
        where: (field: string, op: string, val: any) => {
          return {
            get: async () => {
              if (name === 'partner_ledger' && field === 'eventId' && val === 'event-1') {
                return {
                  docs: [
                    {
                      data: () => ({
                        type: 'ticket_revenue',
                        amountPaise: 300000,
                        status: 'pending',
                      }),
                    },
                    {
                      data: () => ({
                        type: 'platform_fee',
                        amountPaise: 15000,
                        status: 'pending',
                      }),
                    },
                    {
                      data: () => ({
                        type: 'promoter_commission',
                        amountPaise: 20000,
                        status: 'pending',
                      }),
                    },
                    {
                      data: () => ({
                        type: 'host_payout',
                        amountPaise: 79500,
                        status: 'pending',
                      }),
                    },
                    {
                      data: () => ({
                        type: 'venue_share',
                        amountPaise: 185500,
                        status: 'pending',
                      }),
                    },
                  ],
                };
              }
              return { docs: [] };
            },
          };
        },
      };
    });
  });

  it('reads event financial truth only from partner_ledger', async () => {
    const result = await getFinancialSummary('event-1', 'event');

    expect(result.gross).toBe(3000);
    expect(result.commissions).toBe(200);
    expect(result.fees).toBe(150);
    expect(result.net).toBe(3000);
    expect(result.partnerNet).toBe(2650);
    expect(result.grossPaise).toBe(300000);
    expect(result.source).toBe('partner_ledger');
    expect(result.currency).toBe('INR');
  });

  it('subtracts immutable refund rows without reading raw order amounts', async () => {
    mockCollection.mockImplementation((name) => {
      return {
        where: (field: string, op: string, val: any) => {
          return {
            get: async () => {
              if (name === 'partner_ledger' && field === 'eventId' && val === 'event-1') {
                return {
                  docs: [
                    {
                      data: () => ({
                        type: 'ticket_revenue',
                        amountPaise: 300000,
                        status: 'pending',
                      }),
                    },
                    {
                      data: () => ({
                        type: 'refund',
                        allocationType: 'platform_fee',
                        amountPaise: -5000,
                        status: 'pending',
                      }),
                    },
                    {
                      data: () => ({
                        type: 'refund',
                        allocationType: 'host_payout',
                        amountPaise: -30000,
                        status: 'pending',
                      }),
                    },
                    {
                      data: () => ({
                        type: 'refund',
                        allocationType: 'venue_share',
                        amountPaise: -60000,
                        status: 'pending',
                      }),
                    },
                    {
                      data: () => ({
                        type: 'refund',
                        allocationType: 'promoter_commission',
                        amountPaise: -5000,
                        status: 'pending',
                      }),
                    },
                  ],
                };
              }
              return { docs: [] };
            },
          };
        },
      };
    });

    const result = await getFinancialSummary('event-1', 'event');

    expect(result.gross).toBe(3000);
    expect(result.refunds).toBe(1000);
    expect(result.net).toBe(2000);
    expect(result.refundPaise).toBe(100000);
  });
});
