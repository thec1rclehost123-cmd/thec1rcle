export class EventUpdateValidationError extends Error {
  constructor(message, issues, statusCode = 400) {
    super(message);
    this.name = 'EventUpdateValidationError';
    this.code = 'EVENT_UPDATE_INVALID';
    this.statusCode = statusCode;
    this.issues = issues;
  }
}

const EVENT_EDITABLE_FIELDS = new Set([
  'title',
  'shortDescription',
  'description',
  'coverImage',
  'image',
  'tags',
  'venue',
  'venueAddress',
  'city',
  'timezone',
  'timeZone',
  'startDate',
  'endDate',
  'capacity',
  'settings',
  'isPublic',
]);

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function eventSoldCount(event) {
  const tiers = event.ticketTiers || event.ticketCatalog?.tiers || event.tickets || [];
  return Math.max(
    asNumber(event.ticketsSold || event.totalTicketsSold),
    ...tiers.map((tier) => asNumber(tier.sold || tier.soldCount)),
  );
}

export function buildHostEventUpdatePatch(event, input) {
  const patch = {};
  for (const [field, value] of Object.entries(input || {})) {
    if (EVENT_EDITABLE_FIELDS.has(field) && value !== undefined) patch[field] = value;
  }

  const issues = [];
  if ('title' in patch && !String(patch.title || '').trim()) {
    issues.push({ field: 'title', message: 'Event title is required' });
  }
  if ('capacity' in patch) {
    patch.capacity = asNumber(patch.capacity, -1);
    const sold = eventSoldCount(event);
    if (patch.capacity < sold) {
      issues.push({
        field: 'capacity',
        message: `Capacity cannot be lower than ${sold} tickets already sold`,
      });
    }
  }

  const nextStart = patch.startDate || event.startDate;
  const nextEnd = patch.endDate || event.endDate;
  if (nextStart && nextEnd) {
    const startTime = new Date(nextStart).getTime();
    const endTime = new Date(nextEnd).getTime();
    if (!Number.isFinite(startTime)) {
      issues.push({ field: 'startDate', message: 'Start date is invalid' });
    }
    if (!Number.isFinite(endTime)) {
      issues.push({ field: 'endDate', message: 'End date is invalid' });
    }
    if (Number.isFinite(startTime) && Number.isFinite(endTime) && endTime <= startTime) {
      issues.push({ field: 'endDate', message: 'End date must be after the start date' });
    }
  }

  if (issues.length > 0) {
    throw new EventUpdateValidationError('Event update validation failed', issues);
  }

  if (patch.coverImage) patch.image = patch.coverImage;
  if (patch.timezone && !patch.timeZone) patch.timeZone = patch.timezone;
  return { ...patch, updatedAt: new Date().toISOString() };
}

function tierId(tier) {
  return String(tier?.id || tier?.tierId || tier?.ticketId || '');
}

function validateTier(tier) {
  const issues = [];
  const sold = asNumber(tier.sold || tier.soldCount);
  const quantity = asNumber(tier.quantity ?? tier.capacity, -1);
  const price = asNumber(tier.price, -1);
  const min = asNumber(tier.minPurchaseQuantity ?? tier.minPerOrder ?? 1, 1);
  const max = asNumber(tier.maxPurchaseQuantity ?? tier.maxPerOrder ?? 1, 1);
  const start = tier.startSale || tier.saleStartDate || tier.salesStart;
  const end = tier.endSale || tier.saleEndDate || tier.salesEnd;

  if (!tierId(tier)) issues.push({ field: 'tierId', message: 'Ticket tier ID is required' });
  if (!String(tier.name || '').trim()) {
    issues.push({ field: 'name', message: 'Ticket tier name is required' });
  }
  if (price < 0) issues.push({ field: 'price', message: 'Price must be zero or greater' });
  if (quantity < sold) {
    issues.push({
      field: 'quantity',
      message: `Inventory cannot be lower than ${sold} tickets already sold`,
    });
  }
  if (min < 1)
    issues.push({ field: 'minPerOrder', message: 'Minimum per order must be at least 1' });
  if (max < min) {
    issues.push({
      field: 'maxPerOrder',
      message: 'Maximum per order cannot be lower than the minimum',
    });
  }
  if (price === 0 && max > 1) {
    issues.push({
      field: 'maxPerOrder',
      message: 'Free ticket tiers are limited to one ticket per user',
    });
  }
  if (start && end && new Date(end).getTime() <= new Date(start).getTime()) {
    issues.push({ field: 'salesEnd', message: 'Sale end must be after sale start' });
  }
  return issues;
}

export function buildHostTicketTierUpdate(event, input) {
  const existingTiers = [
    ...(event.ticketTiers || event.ticketCatalog?.tiers || event.tickets || []),
  ];
  let tiers;

  if (Array.isArray(input?.tiers)) {
    tiers = input.tiers.map((tier) => ({ ...tier }));
    const incomingIds = new Set(tiers.map(tierId));
    const removedSoldTier = existingTiers.find(
      (tier) => asNumber(tier.sold || tier.soldCount) > 0 && !incomingIds.has(tierId(tier)),
    );
    if (removedSoldTier) {
      throw new EventUpdateValidationError('Sold ticket tiers cannot be deleted', [
        {
          field: `tiers.${tierId(removedSoldTier)}`,
          message: 'Disable this tier instead; it already has ticket sales',
        },
      ]);
    }
  } else {
    const requestedId = String(input?.tierId || '');
    const index = existingTiers.findIndex((tier) => tierId(tier) === requestedId);
    if (!requestedId || index < 0) {
      throw new EventUpdateValidationError(
        'Ticket tier not found',
        [{ field: 'tierId', message: 'Select an existing ticket tier' }],
        404,
      );
    }
    const current = existingTiers[index];
    const updated = {
      ...current,
      id: tierId(current),
      name: input.name ?? current.name,
      description: input.description ?? current.description ?? '',
      entryType: input.entryType ?? current.entryType ?? 'general',
      price: input.price ?? current.price,
      quantity: input.quantity ?? current.quantity ?? current.capacity,
      startSale: input.salesStart || input.startSale || current.startSale || null,
      endSale: input.salesEnd || input.endSale || current.endSale || null,
      minPurchaseQuantity:
        input.minPerOrder ?? input.minPurchaseQuantity ?? current.minPurchaseQuantity ?? 1,
      maxPurchaseQuantity:
        input.maxPerOrder ?? input.maxPurchaseQuantity ?? current.maxPurchaseQuantity ?? 1,
      promoterEnabled: input.promoterEnabled ?? current.promoterEnabled ?? true,
      isHidden: input.hidden ?? input.isHidden ?? current.isHidden ?? false,
      isDisabled: input.disabled ?? input.isDisabled ?? current.isDisabled ?? false,
      sold: asNumber(current.sold || current.soldCount),
    };
    updated.remaining = Math.max(0, asNumber(updated.quantity) - updated.sold);
    tiers = existingTiers.map((tier, tierIndex) => (tierIndex === index ? updated : tier));
  }

  const issues = tiers.flatMap((tier, index) =>
    validateTier(tier).map((issue) => ({
      ...issue,
      field: `tiers.${tierId(tier) || index}.${issue.field}`,
    })),
  );
  if (issues.length > 0) {
    throw new EventUpdateValidationError('Ticket tier update validation failed', issues);
  }
  return tiers;
}
