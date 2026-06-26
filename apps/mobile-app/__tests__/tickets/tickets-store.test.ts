import { apiFetch } from '@/lib/api';
import { useTicketsStore } from '@/store/ticketsStore';

jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(),
}));

const mockedApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

describe('ticketsStore wallet sync', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    useTicketsStore.getState().clearOrders();
  });

  it('preserves existing wallet orders and sets error when fetch fails', async () => {
    mockedApiFetch.mockResolvedValueOnce({
      success: true,
      orders: [
        {
          id: 'ord_1',
          userId: 'user_1',
          eventId: 'event_1',
          eventTitle: 'After Dark',
          eventDate: '2099-01-01T20:00:00.000Z',
          status: 'pending_payment',
          bookingCode: 'AX9B21',
          bookingCodes: [{ ticketId: 'TKT-ORD-1-GA-1', bookingCode: 'AX9B21' }],
          qrCodes: [
            {
              ticketId: 'TKT-ORD-1-GA-1',
              qrMode: 'raw_id',
              qrCode: 'TKT-ORD-1-GA-1',
              bookingCode: 'AX9B21',
            },
          ],
          tickets: [{ ticketId: 'ga', name: 'GA', quantity: 1, price: 0 }],
          totalAmount: 0,
          createdAt: '2026-06-23T00:00:00.000Z',
        },
      ],
    } as any);

    await useTicketsStore.getState().fetchUserOrders('user_1');
    expect(useTicketsStore.getState().orders).toHaveLength(1);
    expect(useTicketsStore.getState().orders[0].status).toBe('pending_payment');
    expect(useTicketsStore.getState().orders[0].bookingCode).toBe('AX9B21');
    expect(useTicketsStore.getState().orders[0].bookingCodes?.[0].bookingCode).toBe('AX9B21');
    expect(useTicketsStore.getState().orders[0].qrCodes?.[0].bookingCode).toBe('AX9B21');

    mockedApiFetch.mockRejectedValueOnce(new Error('wallet backend down'));
    await useTicketsStore.getState().fetchUserOrders('user_1');

    expect(useTicketsStore.getState().orders).toHaveLength(1);
    expect(useTicketsStore.getState().error).toBe('wallet backend down');
    expect(useTicketsStore.getState().loading).toBe(false);
  });
});
