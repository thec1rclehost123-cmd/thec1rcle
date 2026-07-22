// @ts-ignore -- package self-reference is resolved by the workspace build.
import { getEffectivePrice } from '@c1rcle/core/pricing-engine';

export const CHECKOUT_SNAPSHOT_VERSION = 1 as const;

const HIDDEN_TIER_STATUSES = new Set([
  'hidden',
  'disabled',
  'inactive',
  'deleted',
  'archived',
]);

export interface CheckoutSnapshotItem {
  tierId: string;
  quantity: number;
  unitPricePaise: number;
  salesStartAt: string | null;
  salesEndAt: string | null;
  status: string | null;
  visible: boolean;
  purchaseRules: string;
}

export interface CheckoutSnapshot {
  version: typeof CHECKOUT_SNAPSHOT_VERSION;
  eventId: string;
  currency: string;
  eventStartAt: string | null;
  eventEndAt: string | null;
  eventSalesStartAt: string | null;
  eventSalesEndAt: string | null;
  eventPurchaseRules: string;
  promoterPricing: string;
  items: CheckoutSnapshotItem[];
  capturedAt: string;
}

export class CheckoutReconciliationError extends Error {
  readonly code = 'STALE_CART';
  readonly statusCode = 409;

  constructor(
    message = 'Your cart changed. Review the latest price and availability before paying.',
    public readonly reasons: readonly string[] = [],
  ) {
    super(message);
    this.name = 'CheckoutReconciliationError';
  }
}

function normalizeTimestamp(value: any, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;

  let millis: number;
  if (typeof value?.toMillis === 'function') millis = value.toMillis();
  else if (typeof value?.toDate === 'function') millis = value.toDate().getTime();
  else if (typeof value?._seconds === 'number') millis = value._seconds * 1000;
  else if (value instanceof Date) millis = value.getTime();
  else if (typeof value === 'number') millis = value < 10_000_000_000 ? value * 1000 : value;
  else millis = Date.parse(String(value));

  if (!Number.isFinite(millis)) {
    throw new CheckoutReconciliationError('Checkout data is invalid.', [`invalid_${field}`]);
  }
  return new Date(millis).toISOString();
}

function moneyToPaise(value: unknown, tierId: string): number {
  const amount = Number(value);
  const scaled = amount * 100;
  const rounded = Math.round(scaled);
  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    !Number.isSafeInteger(rounded) ||
    Math.abs(scaled - rounded) > 1e-7
  ) {
    throw new CheckoutReconciliationError('Checkout price is invalid.', [
      `invalid_price:${tierId}`,
    ]);
  }
  return rounded;
}

function normalizedTierId(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeQuantity(value: unknown, tierId: string): number {
  const quantity = Number(value);
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new CheckoutReconciliationError('Checkout quantity is invalid.', [
      `invalid_quantity:${tierId || 'unknown'}`,
    ]);
  }
  return quantity;
}

function stablePricingValue(value: any): string {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stablePricingValue).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stablePricingValue(value[key])}`)
    .join(',')}}`;
}

function eventTiers(event: any): any[] {
  if (Array.isArray(event?.ticketCatalog?.tiers)) return event.ticketCatalog.tiers;
  if (Array.isArray(event?.tickets)) return event.tickets;
  return [];
}

function salesWindow(tier: any): { startsAt: any; endsAt: any } {
  return {
    startsAt: tier?.salesStart ?? tier?.saleWindow?.startsAt ?? null,
    endsAt: tier?.salesEnd ?? tier?.saleWindow?.endsAt ?? null,
  };
}

function assertSalesActive(
  startsAt: string | null,
  endsAt: string | null,
  nowMs: number,
  scope: string,
): void {
  if (startsAt && Date.parse(startsAt) > nowMs) {
    throw new CheckoutReconciliationError('Ticket sales have not started.', [
      `sales_not_started:${scope}`,
    ]);
  }
  if (endsAt && Date.parse(endsAt) < nowMs) {
    throw new CheckoutReconciliationError('Ticket sales have ended.', [`sales_ended:${scope}`]);
  }
}

/**
 * Capture only fields that are allowed to invalidate an active cart. Cosmetic
 * event edits do not force a new cart; price, dates, sale windows, visibility,
 * promoter pricing and requested quantities do.
 */
export function buildCheckoutSnapshot(
  event: any,
  requestedItems: any[],
  timestamp: Date | string | number = new Date(),
): CheckoutSnapshot {
  const now = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (!Number.isFinite(now.getTime())) {
    throw new CheckoutReconciliationError('Checkout timestamp is invalid.', [
      'invalid_checkout_timestamp',
    ]);
  }

  const eventId = normalizedTierId(event?.id);
  if (!eventId) {
    throw new CheckoutReconciliationError('Event is invalid.', ['event_id_missing']);
  }

  const tiers = eventTiers(event);
  const seen = new Set<string>();
  const items = requestedItems
    .map((item) => {
      const tierId = normalizedTierId(item?.tierId ?? item?.ticketId ?? item?.id);
      const quantity = normalizeQuantity(item?.quantity, tierId);
      if (!tierId || seen.has(tierId)) {
        throw new CheckoutReconciliationError('Checkout ticket selection is invalid.', [
          tierId ? `duplicate_tier:${tierId}` : 'tier_id_missing',
        ]);
      }
      seen.add(tierId);

      const tier = tiers.find(
        (candidate) => normalizedTierId(candidate?.id ?? candidate?.tierId) === tierId,
      );
      if (!tier) {
        throw new CheckoutReconciliationError('A ticket in your cart is no longer available.', [
          `tier_missing:${tierId}`,
        ]);
      }

      const status = String(tier.status ?? tier.lifecycle ?? '')
        .trim()
        .toLowerCase();
      const visible = !(
        HIDDEN_TIER_STATUSES.has(status) ||
        tier.isHidden === true ||
        tier.hidden === true ||
        tier.isDeleted === true
      );
      if (!visible) {
        throw new CheckoutReconciliationError('A ticket in your cart is no longer available.', [
          `tier_hidden:${tierId}`,
        ]);
      }

      const window = salesWindow(tier);
      const salesStartAt = normalizeTimestamp(window.startsAt, `tier_sales_start:${tierId}`);
      const salesEndAt = normalizeTimestamp(window.endsAt, `tier_sales_end:${tierId}`);
      assertSalesActive(salesStartAt, salesEndAt, now.getTime(), tierId);

      const effectivePrice = getEffectivePrice(tier, now);
      return {
        tierId,
        quantity,
        unitPricePaise: moneyToPaise(effectivePrice?.price, tierId),
        salesStartAt,
        salesEndAt,
        status: status || null,
        visible,
        purchaseRules: stablePricingValue({
          limits: tier.limits ?? null,
          minPerOrder: tier.minPerOrder ?? null,
          maxPerOrder: tier.maxPerOrder ?? null,
          genderRequirement:
            tier.genderRequirement ?? tier.requiredGender ?? tier.gender ?? tier.entryType ?? null,
          promoterEnabled: tier.promoterEnabled ?? null,
          promoterDiscount: tier.promoterDiscount ?? null,
          promoterDiscountType: tier.promoterDiscountType ?? null,
        }),
      };
    })
    .sort((left, right) => left.tierId.localeCompare(right.tierId));

  if (items.length === 0) {
    throw new CheckoutReconciliationError('Your cart is empty.', ['cart_empty']);
  }

  const eventStartAt = normalizeTimestamp(
    event.startDate ?? event.startAt ?? event.date ?? null,
    'event_start',
  );
  const eventEndAt = normalizeTimestamp(event.endDate ?? event.endAt ?? null, 'event_end');
  const eventSalesStartAt = normalizeTimestamp(
    event.salesStart ?? event.ticketSales?.startsAt ?? event.saleWindow?.startsAt ?? null,
    'event_sales_start',
  );
  const eventSalesEndAt = normalizeTimestamp(
    event.salesEnd ?? event.ticketSales?.endsAt ?? event.saleWindow?.endsAt ?? null,
    'event_sales_end',
  );
  assertSalesActive(eventSalesStartAt, eventSalesEndAt, now.getTime(), 'event');

  return {
    version: CHECKOUT_SNAPSHOT_VERSION,
    eventId,
    currency: String(event.currency ?? event.priceRange?.currency ?? 'INR').toUpperCase(),
    eventStartAt,
    eventEndAt,
    eventSalesStartAt,
    eventSalesEndAt,
    eventPurchaseRules: stablePricingValue({
      isRSVP: event.isRSVP ?? false,
      minTicketsPerOrder: event.minTicketsPerOrder ?? null,
      maxTicketsPerOrder: event.maxTicketsPerOrder ?? null,
      isPremiumOnly: event.isPremiumOnly ?? false,
      hotDrop: event.hotDrop ?? false,
      isHotDrop: event.isHotDrop ?? false,
      hasPremiumEarlyAccess: event.hasPremiumEarlyAccess ?? false,
      premiumEarlyAccess: event.premiumEarlyAccess ?? false,
      premiumEarlyAccessUntil: event.premiumEarlyAccessUntil ?? null,
      earlyAccessUntil: event.earlyAccessUntil ?? null,
      publicSaleStartsAt: event.publicSaleStartsAt ?? null,
      earlyAccess: event.earlyAccess ?? null,
    }),
    promoterPricing: stablePricingValue(event.promoterSettings ?? null),
    items,
    capturedAt: now.toISOString(),
  };
}

function comparable(snapshot: CheckoutSnapshot): Omit<CheckoutSnapshot, 'capturedAt'> {
  const { capturedAt: _capturedAt, ...value } = snapshot;
  return value;
}

export function assertCheckoutSnapshotCurrent(
  expected: CheckoutSnapshot | null | undefined,
  event: any,
  requestedItems: any[],
  timestamp: Date | string | number = new Date(),
): CheckoutSnapshot {
  if (!expected || expected.version !== CHECKOUT_SNAPSHOT_VERSION) {
    throw new CheckoutReconciliationError(undefined, ['reservation_snapshot_missing']);
  }
  if (!Array.isArray(expected.items)) {
    throw new CheckoutReconciliationError(undefined, ['reservation_snapshot_invalid']);
  }

  let current: CheckoutSnapshot;
  try {
    current = buildCheckoutSnapshot(event, requestedItems, timestamp);
  } catch (error) {
    if (error instanceof CheckoutReconciliationError) throw error;
    throw new CheckoutReconciliationError(undefined, ['snapshot_rebuild_failed']);
  }

  if (stablePricingValue(comparable(expected)) !== stablePricingValue(comparable(current))) {
    const reasons: string[] = [];
    if (expected.eventId !== current.eventId) reasons.push('event_changed');
    if (expected.currency !== current.currency) reasons.push('currency_changed');
    if (expected.eventStartAt !== current.eventStartAt) reasons.push('event_start_changed');
    if (expected.eventEndAt !== current.eventEndAt) reasons.push('event_end_changed');
    if (expected.eventSalesStartAt !== current.eventSalesStartAt) {
      reasons.push('event_sales_start_changed');
    }
    if (expected.eventSalesEndAt !== current.eventSalesEndAt) {
      reasons.push('event_sales_end_changed');
    }
    if (expected.eventPurchaseRules !== current.eventPurchaseRules) {
      reasons.push('event_purchase_rules_changed');
    }
    if (expected.promoterPricing !== current.promoterPricing) reasons.push('promoter_pricing_changed');

    const expectedByTier = new Map(expected.items.map((item) => [item.tierId, item]));
    const currentByTier = new Map(current.items.map((item) => [item.tierId, item]));
    for (const tierId of new Set([...expectedByTier.keys(), ...currentByTier.keys()])) {
      const before = expectedByTier.get(tierId);
      const after = currentByTier.get(tierId);
      if (!before || !after) reasons.push(`tier_changed:${tierId}`);
      else if (stablePricingValue(before) !== stablePricingValue(after)) {
        reasons.push(`tier_changed:${tierId}`);
      }
    }
    throw new CheckoutReconciliationError(undefined, reasons.length ? reasons : ['cart_changed']);
  }

  return current;
}
