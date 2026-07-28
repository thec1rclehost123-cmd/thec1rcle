import { describe, expect, it } from 'vitest';
import { buildCoverWalletTransferUpdate } from './ticket-share-engine.js';

describe('ticket transfer Cover Wallet ownership', () => {
  const transfer = {
    orderId: 'order_1',
    eventId: 'event_1',
    senderId: 'sender_1',
  };
  const ticket = {
    tierId: 'tier_cover',
    slotIndex: 2,
  };
  const wallet = {
    id: 'wallet_1',
    orderId: 'order_1',
    eventId: 'event_1',
    tierId: 'tier_cover',
    unitIndex: 2,
    userId: 'sender_1',
    qrVersion: 3,
  };

  it('moves the exact wallet unit and rotates its QR authority', () => {
    expect(
      buildCoverWalletTransferUpdate({
        wallet,
        walletId: 'wallet_1',
        transfer,
        ticket,
        recipientId: 'recipient_1',
        transferredAt: '2026-07-27T12:00:00.000Z',
      }),
    ).toEqual({
      userId: 'recipient_1',
      previousOwnerUserId: 'sender_1',
      transferredAt: '2026-07-27T12:00:00.000Z',
      updatedAt: '2026-07-27T12:00:00.000Z',
      qrVersion: 4,
    });
  });

  it('returns null for a ticket that has no Cover Wallet', () => {
    expect(
      buildCoverWalletTransferUpdate({
        wallet: null,
        walletId: 'wallet_1',
        transfer,
        ticket,
        recipientId: 'recipient_1',
        transferredAt: '2026-07-27T12:00:00.000Z',
      }),
    ).toBeNull();
  });

  it('fails closed when the wallet belongs to another owner or admission unit', () => {
    expect(() =>
      buildCoverWalletTransferUpdate({
        wallet: { ...wallet, userId: 'someone_else' },
        walletId: 'wallet_1',
        transfer,
        ticket,
        recipientId: 'recipient_1',
        transferredAt: '2026-07-27T12:00:00.000Z',
      }),
    ).toThrow('conflicts');
    expect(() =>
      buildCoverWalletTransferUpdate({
        wallet: { ...wallet, unitIndex: 1 },
        walletId: 'wallet_1',
        transfer,
        ticket,
        recipientId: 'recipient_1',
        transferredAt: '2026-07-27T12:00:00.000Z',
      }),
    ).toThrow('conflicts');
  });
});
