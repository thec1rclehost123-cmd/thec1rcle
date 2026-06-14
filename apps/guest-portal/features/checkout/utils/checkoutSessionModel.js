import { normalizeReservationItems } from "./checkoutViewModel";

const ADMISSION_TOKEN_STORAGE_PREFIX = "admission_token_";

export function getReservationItemsSignature(items) {
  return JSON.stringify(normalizeReservationItems(items));
}

function buildItemsToken(items) {
  const normalized = normalizeReservationItems(items);
  if (normalized.length === 0) return "empty";
  return normalized
    .map((item) => `${item.tierId}:${item.quantity}`)
    .join("|");
}

export function getPromoterCodeFromSearch(search = "") {
  const params = new URLSearchParams(search);
  return params.get("ref");
}

export function mergeAttendeeDetails(current, user, profile) {
  return {
    name: current.name || user?.displayName || profile?.name || "",
    email: current.email || user?.email || profile?.email || "",
    phone: current.phone || profile?.phone || "",
  };
}

export function isReservationActive(reservation, eventId) {
  return Boolean(
    reservation?.reservationId &&
    (!eventId || reservation?.eventId === eventId) &&
    reservation?.expiresAt &&
    new Date(reservation.expiresAt) > new Date(),
  );
}

export function shouldUseSavedReservationQuote({ cartReservation, eventId, selectedTickets }) {
  if (!isReservationActive(cartReservation, eventId)) return false;
  return getReservationItemsSignature(cartReservation?.items || []) === getReservationItemsSignature(selectedTickets);
}

export function buildCheckoutQuotePayload({
  appliedPromoCode,
  cartReservation,
  eventId,
  promoterCode,
  selectedTickets,
}) {
  if (shouldUseSavedReservationQuote({ cartReservation, eventId, selectedTickets })) {
    return {
      reservationId: cartReservation.reservationId,
      promoCode: appliedPromoCode,
      promoterCode,
    };
  }

  return {
    eventId,
    items: normalizeReservationItems(selectedTickets),
    promoCode: appliedPromoCode,
    promoterCode,
  };
}

export function buildPromoValidationPayload({ code, eventId, selectedTickets }) {
  return {
    eventId,
    code,
    items: normalizeReservationItems(selectedTickets),
  };
}

export function shouldReserveBeforeCheckout({ cartReservation, eventId, selectedTickets }) {
  return !shouldUseSavedReservationQuote({ cartReservation, eventId, selectedTickets });
}

export function getAdmissionTokenStorageKey(eventId) {
  if (!eventId) return null;
  return `${ADMISSION_TOKEN_STORAGE_PREFIX}${eventId}`;
}

export function readAdmissionToken(eventId) {
  if (typeof window === "undefined") return null;
  const storageKey = getAdmissionTokenStorageKey(eventId);
  if (!storageKey) return null;

  try {
    return window.sessionStorage.getItem(storageKey) || null;
  } catch {
    return null;
  }
}

export function clearAdmissionToken(eventId) {
  if (typeof window === "undefined") return;
  const storageKey = getAdmissionTokenStorageKey(eventId);
  if (!storageKey) return;

  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {}
}

export function buildReserveCheckoutPayload({ admissionToken = null, eventId, selectedTickets, userUid }) {
  return {
    admissionToken: admissionToken || undefined,
    eventId,
    items: normalizeReservationItems(selectedTickets),
    deviceId: `browser-${userUid || "anon"}`,
  };
}

export function buildInitiateCheckoutPayload({
  attendeeDetails,
  promoCode,
  promoterCode,
  reservationId,
}) {
  return {
    reservationId,
    userName: attendeeDetails.name,
    userEmail: attendeeDetails.email,
    userPhone: attendeeDetails.phone,
    promoCode,
    promoterCode,
  };
}

export function buildGuestLoginRedirect(pathname, search = "") {
  return `/login?next=${encodeURIComponent(`${pathname}${search}`)}`;
}

export function deriveCheckoutConstraints({
  checkoutQuote,
  event,
  hasExpiredReservation = false,
  isProcessing,
  isQuoteSyncing,
  totalSelectedQuantity,
}) {
  const order = checkoutQuote?.constraints?.order;
  const cta = checkoutQuote?.cta;
  const quoteReady = Boolean(checkoutQuote);
  const minTickets = order?.minTickets ?? (event.isRSVP ? 1 : (event.minTicketsPerOrder || 1));
  const maxTickets = order?.maxTickets ?? (event.isRSVP ? 1 : (event.maxTicketsPerOrder || 10));

  return {
    canProceedStep1: quoteReady && !isQuoteSyncing && !hasExpiredReservation && (order?.canProceed ?? false),
    canSubmitCheckout:
      quoteReady &&
      !isQuoteSyncing &&
      !hasExpiredReservation &&
      !isProcessing &&
      totalSelectedQuantity > 0 &&
      (order?.canProceed ?? false) &&
      (cta?.state === "pay" || cta?.state === "issue"),
    isAboveMax: totalSelectedQuantity > maxTickets,
    isBelowMin: totalSelectedQuantity > 0 && totalSelectedQuantity < minTickets,
    maxTickets,
    minTickets,
    quoteReady,
  };
}

export function applyTicketQuantityDelta({
  delta,
  eventTickets = [],
  maxTickets,
  quoteTierConstraints,
  ticketId,
  selectedTickets,
}) {
  const existing = selectedTickets.find((ticket) => ticket.id === ticketId);
  const quoteTier = quoteTierConstraints.get(ticketId);
  const totalSelectedQuantity = selectedTickets.reduce((sum, ticket) => sum + Number(ticket.quantity || 0), 0);

  if (delta > 0) {
    if (totalSelectedQuantity >= maxTickets) return selectedTickets;
    const available = Math.min(quoteTier?.available ?? 0, quoteTier?.maxPerOrder ?? 10);
    if ((existing?.quantity || 0) >= available) return selectedTickets;
  }

  if (!existing) {
    if (delta <= 0) return selectedTickets;
    const ticket = eventTickets.find((candidate) => candidate.id === ticketId);
    if (!ticket) return selectedTickets;
    return [...selectedTickets, { ...ticket, quantity: delta }];
  }

  const nextQuantity = Math.max(0, existing.quantity + delta);
  if (nextQuantity === 0) {
    return selectedTickets.filter((ticket) => ticket.id !== ticketId);
  }

  return selectedTickets.map((ticket) =>
    ticket.id === ticketId ? { ...ticket, quantity: nextQuantity } : ticket,
  );
}

export function buildCheckoutRequestIdempotencyKey({
  code,
  eventId,
  prefix,
  promoterCode,
  reservationId,
  selectedTickets,
}) {
  return [
    "checkout",
    prefix,
    eventId || "unknown-event",
    reservationId || "no-reservation",
    code || "no-code",
    promoterCode || "no-promoter",
    buildItemsToken(selectedTickets),
  ].join(":");
}

export function buildCheckoutPhaseIdempotencyKey(actionId, phase) {
  if (!actionId) return "";
  return `${actionId}:${phase}`;
}

export function createCheckoutActionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `checkout-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
