export const EMPTY_TICKETS = Object.freeze({
  upcomingTickets: [],
  pastTickets: [],
  actionNeeded: [],
  cancelledTickets: [],
  coverWalletsByOrder: {},
});

export function groupTickets(list = []) {
  const groups = {};
  list.forEach((ticket) => {
    const key = ticket.orderId || ticket.eventId || ticket.id;
    if (!groups[key]) {
      groups[key] = { ...ticket, isGroup: true, tickets: [] };
    }
    groups[key].tickets.push(ticket);
  });
  return Object.values(groups);
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
