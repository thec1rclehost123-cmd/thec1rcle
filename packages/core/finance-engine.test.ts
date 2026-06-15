import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFinancialSummary } from './finance-engine.js';
import { MONEY_STATES, ACCOUNTS } from './ledger-engine.js';

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
        doc: (id: string) => ({
          get: async () => {
            if (name === 'events' && id === 'event-1') {
              return {
                exists: true,
                data: () => ({
                  creatorId: 'host-1',
                  creatorRole: 'host',
                  venueId: 'club-1',
                  settlementStatus: 'pending',
                }),
              };
            }
            return { exists: false };
          },
        }),
        where: (field: string, op: string, val: any) => {
          return {
            where: (field2: string, op2: string, val2: any) => {
              return {
                get: async () => {
                  // Mock ledger entries query or orders query
                  if (
                    name === 'ledger_entries' &&
                    field === 'metadata.eventId' &&
                    val === 'event-1'
                  ) {
                    return { docs: [] }; // No settled ledger entries initially
                  }
                  if (name === 'orders' && field === 'eventId' && val === 'event-1') {
                    // Return two confirmed orders
                    return {
                      docs: [
                        {
                          data: () => ({
                            id: 'order-1',
                            totalAmount: 1000,
                            discountAmount: 100,
                            eventId: 'event-1',
                          }),
                        },
                        {
                          data: () => ({
                            id: 'order-2',
                            totalAmount: 2000,
                            discountAmount: 200,
                            eventId: 'event-1',
                            promoterLinkId: 'p-1',
                            promoterAttribution: {
                              promoterId: 'promoter-1',
                              commissionAmount: 200,
                            },
                          }),
                        },
                      ],
                    };
                  }
                  return { docs: [] };
                },
              };
            },
            get: async () => {
              if (name === 'ledger_entries' && field === 'metadata.eventId' && val === 'event-1') {
                return { docs: [] }; // Unsettled
              }
              return { docs: [] };
            },
          };
        },
      };
    });
  });

  it('should aggregate potential splits from orders when event is NOT settled yet', async () => {
    const result = await getFinancialSummary('event-1', 'event');

    // Total Gross = 1000 + 2000 = 3000
    // Total Discounts = 100 + 200 = 300
    // Order 1 splits:
    //   - Platform fee (5%): 50
    //   - Partner Net: remaining 950 (Host 30% = 285, Venue 70% = 665)
    // Order 2 splits (with promoter):
    //   - Promoter: 200
    //   - Platform fee (5%): 100
    //   - Partner Net: remaining 1700 (Host 30% = 510, Venue 70% = 1190)
    // Summing splits:
    //   - gross: 3000
    //   - discounts: 300
    //   - commissions: 200
    //   - fees: 50 + 100 = 150
    //   - net: (285 + 665) + (510 + 1190) = 950 + 1700 = 2650

    expect(result.gross).toBe(3000);
    expect(result.discounts).toBe(300);
    expect(result.commissions).toBe(200);
    expect(result.fees).toBe(150);
    expect(result.net).toBe(2650);
    expect(result.auditStatus).toBe('pending');
    expect(result.currency).toBe('INR');
  });

  it('should read settled amounts directly from ledger when event HAS been settled', async () => {
    mockCollection.mockImplementation((name) => {
      return {
        doc: (id: string) => ({
          get: async () => {
            if (name === 'events' && id === 'event-1') {
              return {
                exists: true,
                data: () => ({
                  creatorId: 'host-1',
                  creatorRole: 'host',
                  venueId: 'club-1',
                  settlementStatus: 'completed',
                }),
              };
            }
            return { exists: false };
          },
        }),
        where: (field: string, op: string, val: any) => {
          return {
            get: async () => {
              if (name === 'ledger_entries' && field === 'metadata.eventId' && val === 'event-1') {
                return {
                  docs: [
                    // Captured Gross
                    {
                      data: () => ({
                        state: MONEY_STATES.CAPTURED,
                        actorType: 'user',
                        amount: 3000,
                      }),
                    },
                    // Settled Platform fees
                    {
                      data: () => ({
                        state: MONEY_STATES.PAYABLE,
                        actorId: ACCOUNTS.PLATFORM_FEE,
                        amount: 150,
                      }),
                    },
                    // Settled Partner Net
                    {
                      data: () => ({
                        state: MONEY_STATES.PAYABLE,
                        actorType: ACCOUNTS.PARTNER,
                        amount: 2650,
                      }),
                    },
                    // Settled Promoter Commission
                    {
                      data: () => ({
                        state: MONEY_STATES.PAYABLE,
                        actorType: ACCOUNTS.PROMOTER,
                        amount: 200,
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
    expect(result.net).toBe(2650);
    expect(result.commissions).toBe(200);
    expect(result.fees).toBe(150);
    expect(result.auditStatus).toBe('completed');
  });
});
