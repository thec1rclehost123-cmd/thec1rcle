/**
 * Pure utility functions for the checkout flow.
 * No React, no state — safe to import in server or client contexts.
 */

export function truncateInfo(value, maxLength = 88) {
  if (!value) return '';
  const normalized = String(value).replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

export function formatNeedToKnowTime(event) {
  if (event?.startTime || event?.endTime) {
    if (event.startTime && event.endTime) return `${event.startTime} - ${event.endTime}`;
    return event.startTime || event.endTime || '';
  }

  if (!event?.startDate) return '';

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
    const startLabel = formatter.format(new Date(event.startDate));
    if (!event?.endDate) return startLabel;
    const endFormatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `${startLabel} - ${endFormatter.format(new Date(event.endDate))}`;
  } catch {
    return '';
  }
}

export function prettifyRule(value) {
  if (!value) return '';
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function buildNeedToKnowItems(event, selectedTickets = []) {
  const items = [];
  const pushItem = (label, value) => {
    const normalized = truncateInfo(value);
    if (!normalized) return;
    if (items.some((item) => item.label === label && item.value === normalized)) return;
    items.push({ label, value: normalized });
  };

  pushItem('Doors', event?.doorsOpen || event?.doorsTime || event?.doorTime || event?.doors);
  pushItem('Timing', formatNeedToKnowTime(event));
  pushItem('Last entry', event?.lastEntry);

  const ageRule = event?.ageRestriction || event?.ageLimit;
  if (ageRule && String(ageRule).toLowerCase() !== 'all') {
    pushItem('Age', ageRule);
  }

  pushItem('Outfit', event?.dressCodeDescription || prettifyRule(event?.dressCode || event?.dress));

  const entryNote =
    event?.entryRules ||
    event?.guestListRules ||
    event?.houseRules ||
    event?.terms ||
    event?.policyNotes;
  pushItem('Entry', Array.isArray(entryNote) ? entryNote.join(', ') : entryNote);

  selectedTickets.forEach((ticket) => {
    const isCoverTicket =
      String(ticket?.entryType || '').toLowerCase() === 'cover' ||
      /cover/i.test(String(ticket?.name || ''));

    if (ticket?.description) {
      pushItem(ticket.name || 'Tier', ticket.description);
      return;
    }

    if (isCoverTicket) {
      pushItem(ticket.name || 'Cover', 'Venue cover policy applies to this tier.');
    }
  });

  return items.slice(0, 7);
}

export function normalizeReservationItems(items = []) {
  return items
    .map((item) => ({
      tierId: item?.tierId || item?.id || null,
      quantity: Number(item?.quantity || 0),
    }))
    .filter((item) => item.tierId && item.quantity > 0)
    .sort((a, b) => String(a.tierId).localeCompare(String(b.tierId)));
}

export function hydrateReservationItems(items = [], tiers = []) {
  return normalizeReservationItems(items).map((item) => {
    const tier = tiers.find((candidate) => candidate.id === item.tierId);
    return tier
      ? {
          ...tier,
          id: tier.id,
          quantity: item.quantity,
          price: Number(tier.price || 0),
          name: tier.name,
        }
      : {
          id: item.tierId,
          tierId: item.tierId,
          quantity: item.quantity,
          price: 0,
          name: 'Reserved Ticket',
        };
  });
}
