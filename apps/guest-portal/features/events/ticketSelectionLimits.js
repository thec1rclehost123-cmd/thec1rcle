function toPositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function getRemainingInventory(ticket, fallback) {
  const rawRemaining =
    ticket?.remaining ?? ticket?.remainingQuantity ?? ticket?.quantity ?? ticket?.totalQuantity;
  if (rawRemaining === undefined || rawRemaining === null || rawRemaining === '') return fallback;

  const remaining = Number(rawRemaining);
  if (!Number.isFinite(remaining)) return fallback;
  return Math.max(0, Math.floor(remaining));
}

export function getTicketSelectionLimit({ event = {}, quantities = {}, ticket = {} }) {
  const currentQuantity = Math.max(0, Number(quantities[ticket.id] || 0));
  const totalSelected = Object.values(quantities).reduce(
    (total, quantity) => total + Math.max(0, Number(quantity || 0)),
    0,
  );
  const eventLimit = event.isRSVP ? 1 : toPositiveInteger(event.maxTicketsPerOrder, 10);
  const tierLimit = toPositiveInteger(ticket.maxPerOrder, eventLimit);
  const freeTierLimit = Number(ticket.basePrice ?? ticket.price ?? 0) <= 0 ? 1 : tierLimit;
  const otherSelected = Math.max(0, totalSelected - currentQuantity);
  const orderCapacityForTier = Math.max(0, eventLimit - otherSelected);
  const remainingInventory = getRemainingInventory(ticket, tierLimit);

  return Math.max(0, Math.min(tierLimit, freeTierLimit, orderCapacityForTier, remainingInventory));
}

export function getTicketSelectionLimitLabel({ limit, quantity }) {
  if (limit <= 0) return 'Closed';
  return quantity >= limit ? 'Limit Reached' : `Limit ${limit}`;
}
