import { selectCoverWalletForTicketSlot } from '../../lib/coverWalletMapping';

describe('Cover Wallet admission mapping', () => {
  const wallets = [
    { id: 'cover-a-1', orderId: 'order-1', tierId: 'cover-a', unitIndex: 1 },
    { id: 'cover-a-2', orderId: 'order-1', tierId: 'cover-a', unitIndex: 2 },
    { id: 'cover-b-1', orderId: 'order-1', tierId: 'cover-b', unitIndex: 1 },
  ];

  it('selects by tier and admission unit instead of carousel position', () => {
    expect(
      selectCoverWalletForTicketSlot({
        wallets,
        orderId: 'order-1',
        ticketSlot: { tierId: 'cover-a', slotNumber: 2 },
        totalTicketSlots: 4,
      }),
    ).toMatchObject({ id: 'cover-a-2' });
    expect(
      selectCoverWalletForTicketSlot({
        wallets,
        orderId: 'order-1',
        ticketSlot: { tierId: 'cover-b', slotNumber: 1 },
        totalTicketSlots: 4,
      }),
    ).toMatchObject({ id: 'cover-b-1' });
  });

  it('does not attach a Cover Wallet to a non-cover admission in a mixed order', () => {
    expect(
      selectCoverWalletForTicketSlot({
        wallets,
        orderId: 'order-1',
        ticketSlot: { tierId: 'general', slotNumber: 1 },
        totalTicketSlots: 4,
      }),
    ).toBeNull();
  });

  it('allows only the unambiguous one-ticket legacy fallback', () => {
    const legacyWallet = [{ id: 'legacy', orderId: 'order-2' }];
    expect(
      selectCoverWalletForTicketSlot({
        wallets: legacyWallet,
        orderId: 'order-2',
        ticketSlot: { tierId: 'legacy-tier', slotNumber: 1 },
        totalTicketSlots: 1,
      }),
    ).toMatchObject({ id: 'legacy' });
    expect(
      selectCoverWalletForTicketSlot({
        wallets: legacyWallet,
        orderId: 'order-2',
        ticketSlot: { tierId: 'general', slotNumber: 1 },
        totalTicketSlots: 2,
      }),
    ).toBeNull();
  });
});
