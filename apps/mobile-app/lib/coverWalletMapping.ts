export interface CoverWalletAdmissionKey {
  orderId: string;
  tierId?: string | null;
  unitIndex?: number | null;
}

export interface TicketAdmissionKey {
  ticketId?: string | null;
  tierId?: string | null;
  slotNumber?: number | null;
}

/**
 * A Cover Wallet belongs to one exact purchased admission unit. Never select
 * it by carousel position because mixed-tier orders do not share the same
 * index space as Cover Wallets.
 */
export function selectCoverWalletForTicketSlot<T extends CoverWalletAdmissionKey>({
  wallets,
  orderId,
  ticketSlot,
  totalTicketSlots,
}: {
  wallets: T[];
  orderId: string;
  ticketSlot: TicketAdmissionKey | null | undefined;
  totalTicketSlots: number;
}): T | null {
  const orderWallets = wallets.filter((wallet) => wallet.orderId === orderId);
  const tierId = ticketSlot?.ticketId || ticketSlot?.tierId;
  const unitIndex = Number(ticketSlot?.slotNumber || 1);
  const exact = orderWallets.find(
    (wallet) =>
      String(wallet.tierId || '') === String(tierId || '') &&
      Number(wallet.unitIndex || 1) === unitIndex,
  );
  if (exact) return exact;

  // Legacy records without unit attribution are safe only when the order has
  // one ticket and one wallet; any broader fallback could expose the wrong QR.
  return orderWallets.length === 1 && totalTicketSlots === 1 ? orderWallets[0] : null;
}
