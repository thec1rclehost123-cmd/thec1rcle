export const EMPTY_TICKETS = Object.freeze({
  upcomingTickets: [],
  pastTickets: [],
  actionNeeded: [],
  cancelledTickets: [],
  coverWalletsByOrder: {},
});

export function groupTickets(list = []) {
  return list;
}

export function normalizeTicketsWallet(data = {}) {
  return {
    upcomingTickets: groupTickets(data.upcomingTickets || []),
    pastTickets: groupTickets(data.pastTickets || []),
    actionNeeded: data.actionNeeded || [],
    cancelledTickets: data.cancelledTickets || [],
    coverWalletsByOrder: data.coverWalletsByOrder || {},
  };
}

export function getTicketsWalletOrderIds(wallet = EMPTY_TICKETS) {
  const orderIds = new Set();
  for (const group of [...(wallet.upcomingTickets || []), ...(wallet.pastTickets || [])]) {
    const orderId = group?.orderId || group?.tickets?.[0]?.orderId;
    if (orderId) orderIds.add(orderId);
  }
  return [...orderIds];
}
