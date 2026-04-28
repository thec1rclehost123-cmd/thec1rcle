"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildNeedToKnowItems,
  hydrateReservationItems,
  normalizeReservationItems,
} from "../utils/checkoutViewModel";
import {
  applyTicketQuantityDelta,
  buildCheckoutPhaseIdempotencyKey,
  buildCheckoutQuotePayload,
  buildCheckoutRequestIdempotencyKey,
  buildGuestLoginRedirect,
  buildInitiateCheckoutPayload,
  buildPromoValidationPayload,
  buildReserveCheckoutPayload,
  createCheckoutActionId,
  deriveCheckoutConstraints,
  getPromoterCodeFromSearch,
  getReservationItemsSignature,
  isReservationActive,
  mergeAttendeeDetails,
  shouldReserveBeforeCheckout,
  shouldUseSavedReservationQuote,
} from "../utils/checkoutSessionModel";
import {
  calculateCheckout,
  fetchCheckoutOrderStatus,
  initiateCheckout,
  reserveCheckoutInventory,
  validateCheckoutPromo,
} from "../api/checkoutApi";
import { useReservationStorage } from "./useReservationStorage";
import { useRazorpayCheckout } from "./useRazorpayCheckout";

const PENDING_ORDER_STORAGE_KEY = "c1rcle_checkout_pending_order";
const PENDING_ORDER_TTL_MS = 30 * 60 * 1000;

function readPendingOrderSnapshot() {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.localStorage.getItem(PENDING_ORDER_STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function persistPendingOrderSnapshot(snapshot) {
  if (typeof window === "undefined" || !snapshot?.orderId) return;
  try {
    window.localStorage.setItem(PENDING_ORDER_STORAGE_KEY, JSON.stringify({
      ...snapshot,
      savedAt: Date.now(),
    }));
  } catch {}
}

function clearPendingOrderSnapshot() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
  } catch {}
}

function isPendingOrderSnapshotCurrent(snapshot, eventId, userId) {
  if (!snapshot?.orderId) return false;
  if (snapshot?.eventId && eventId && snapshot.eventId !== eventId) return false;
  if (snapshot?.userId && userId && snapshot.userId !== userId) return false;
  return Date.now() - Number(snapshot?.savedAt || 0) < PENDING_ORDER_TTL_MS;
}

export function useCheckoutSession({ event, initialTickets = [], profile, router, user }) {
  const [step, setStep] = useState(1);
  const [selectedTickets, setSelectedTickets] = useState(initialTickets);
  const [attendeeDetails, setAttendeeDetails] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingState, setProcessingState] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [promoterCode, setPromoterCode] = useState(null);
  const [appliedPromoCode, setAppliedPromoCode] = useState(null);
  const [pricingResult, setPricingResult] = useState(null);
  const [checkoutQuote, setCheckoutQuote] = useState(null);
  const [isQuoteSyncing, setIsQuoteSyncing] = useState(false);
  const [feesBreakdownOpen, setFeesBreakdownOpen] = useState(false);
  const redirectTimeoutRef = useRef(null);
  const paymentInFlightRef = useRef(false);
  const checkoutActionIdRef = useRef(null);
  const pendingOrderIdRef = useRef(null);
  const lockedUserIdRef = useRef(user?.uid || null);

  const {
    cartReservation,
    clearPersistedReservation,
    otherEventReservation,
    persistReservation,
  } = useReservationStorage({
    event,
    selectedTickets,
    setSelectedTickets,
    userId: user?.uid || null,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ref = getPromoterCodeFromSearch(window.location.search);
    if (ref) {
      setPromoterCode(ref);
    }
  }, []);

  useEffect(() => {
    if (!user && !profile) return;
    setAttendeeDetails((current) => mergeAttendeeDetails(current, user, profile));
  }, [profile, user]);

  const persistPendingOrder = useCallback((orderId) => {
    if (!orderId) return;
    pendingOrderIdRef.current = orderId;
    persistPendingOrderSnapshot({
      eventId: event?.id,
      orderId,
      userId: user?.uid || null,
    });
  }, [event?.id, user?.uid]);

  const clearPendingOrder = useCallback(() => {
    pendingOrderIdRef.current = null;
    clearPendingOrderSnapshot();
  }, []);

  const readCurrentPendingOrderId = useCallback(() => {
    if (pendingOrderIdRef.current) return pendingOrderIdRef.current;
    const saved = readPendingOrderSnapshot();
    if (!isPendingOrderSnapshotCurrent(saved, event?.id, user?.uid || null)) {
      clearPendingOrder();
      return null;
    }
    pendingOrderIdRef.current = saved.orderId;
    return saved.orderId;
  }, [clearPendingOrder, event?.id, user?.uid]);

  const finishSuccessfulCheckout = useCallback((orderId) => {
    persistPendingOrder(orderId);
    clearPersistedReservation();
    setProcessingState("issuing");
    setIsSuccess(true);
    router.prefetch("/tickets");
    redirectTimeoutRef.current = window.setTimeout(() => {
      router.push(`/confirmation/${orderId}`);
    }, 4000);
  }, [clearPersistedReservation, persistPendingOrder, router]);

  const resolveFinalOrderState = useCallback(async (orderId = null) => {
    const targetOrderId = orderId || readCurrentPendingOrderId();
    if (!targetOrderId) return null;

    try {
      const order = await fetchCheckoutOrderStatus(targetOrderId);
      if (!order) {
        clearPendingOrder();
        return null;
      }

      persistPendingOrder(order.id || targetOrderId);
      if (order.status === "confirmed") {
        finishSuccessfulCheckout(order.id || targetOrderId);
      }
      return order;
    } catch {
      return null;
    }
  }, [clearPendingOrder, finishSuccessfulCheckout, persistPendingOrder, readCurrentPendingOrderId]);

  useEffect(() => {
    const nextUserId = user?.uid || null;
    const previousUserId = lockedUserIdRef.current;
    if (previousUserId === nextUserId) return;

    lockedUserIdRef.current = nextUserId;
    setAttendeeDetails(mergeAttendeeDetails({ name: "", email: "", phone: "" }, user, profile));

    if (previousUserId && previousUserId !== nextUserId) {
      clearPersistedReservation();
      clearPendingOrder();
      checkoutActionIdRef.current = null;
      paymentInFlightRef.current = false;
      setCheckoutQuote(null);
      setPricingResult(null);
      setProcessingState("");
      setIsProcessing(false);
      setStep(1);
      setError("Your session changed. Please review checkout again.");
    }
  }, [clearPendingOrder, clearPersistedReservation, profile, user]);

  const selectedTicketSignature = useMemo(
    () => getReservationItemsSignature(selectedTickets),
    [selectedTickets],
  );
  const hasExpiredReservation = Boolean(cartReservation?.reservationId) && !isReservationActive(cartReservation, event?.id);
  const quoteRequestHeaders = useMemo(() => ({
    "x-idempotency-key": buildCheckoutRequestIdempotencyKey({
      eventId: event?.id,
      prefix: "quote",
      promoterCode,
      selectedTickets,
    }),
  }), [event?.id, promoterCode, selectedTickets]);
  const promoRequestHeaders = useMemo(() => ({
    "x-idempotency-key": buildCheckoutRequestIdempotencyKey({
      code: appliedPromoCode,
      eventId: event?.id,
      prefix: "promo",
      promoterCode,
      selectedTickets,
    }),
  }), [appliedPromoCode, event?.id, promoterCode, selectedTickets]);

  useEffect(() => {
    checkoutActionIdRef.current = null;
  }, [appliedPromoCode, event?.id, selectedTicketSignature]);

  useEffect(() => {
    if (cartReservation?.orderId) {
      persistPendingOrder(cartReservation.orderId);
    }
  }, [cartReservation?.orderId, persistPendingOrder]);

  useEffect(() => {
    if (!isReservationActive(cartReservation, event?.id)) return;
    if (selectedTickets.length === 0) return;
    const reservationSignature = getReservationItemsSignature(cartReservation?.items || []);
    if (reservationSignature === selectedTicketSignature) return;

    clearPersistedReservation();
  }, [cartReservation, clearPersistedReservation, event?.id, selectedTicketSignature, selectedTickets.length]);

  useEffect(() => {
    let cancelled = false;

    const syncCheckoutQuote = async () => {
      setIsQuoteSyncing(true);
      try {
        const useReservationQuote = shouldUseSavedReservationQuote({
          cartReservation,
          eventId: event?.id,
          selectedTickets,
        });

        const { response, data } = await calculateCheckout(
          buildCheckoutQuotePayload({
            appliedPromoCode,
            cartReservation,
            eventId: event.id,
            promoterCode,
            selectedTickets,
          }),
          {
            headers: quoteRequestHeaders,
          },
        );

        if (cancelled) return;

        if (!response.ok || !data?.success) {
          if (useReservationQuote) {
            clearPersistedReservation();
            setSelectedTickets([]);
            setError(data?.error || "Your cart reservation has expired. Please select tickets again.");
            setStep(1);
          }
          setPricingResult(null);
          setCheckoutQuote(null);
          return;
        }

        setPricingResult(data.pricing || null);
        setCheckoutQuote(data.quote || null);
        setError("");

        if (useReservationQuote && data.reservation) {
          const reservationItems = normalizeReservationItems(data.reservation.items || cartReservation.items);
          persistReservation(data.reservation || cartReservation, reservationItems);
          setSelectedTickets((current) => {
            if (getReservationItemsSignature(current) === getReservationItemsSignature(reservationItems)) {
              return current;
            }
            return hydrateReservationItems(reservationItems, event.tickets ?? []);
          });
        }
      } catch {
        if (cancelled) return;
        setError("We could not refresh live pricing. Please try again.");
        setPricingResult(null);
        setCheckoutQuote(null);
      } finally {
        if (!cancelled) {
          setIsQuoteSyncing(false);
        }
      }
    };

    syncCheckoutQuote();
    return () => {
      cancelled = true;
    };
  }, [appliedPromoCode, cartReservation, clearPersistedReservation, event?.id, event?.tickets, persistReservation, promoterCode, selectedTicketSignature, selectedTickets, user?.uid]);

  useEffect(() => {
    if (isSuccess) {
      router.prefetch("/tickets");
    }
  }, [isSuccess, router]);

  const subtotal = useMemo(() => {
    return selectedTickets.reduce((sum, ticket) => sum + ticket.price * ticket.quantity, 0);
  }, [selectedTickets]);
  const totalDiscount = Number(pricingResult?.discountTotal || 0);
  const totalAmount = Math.max(0, subtotal - totalDiscount);
  const displaySubtotal = pricingResult?.subtotal ?? subtotal;
  const displayTotal = pricingResult?.grandTotal ?? totalAmount;
  const displayFees = pricingResult?.fees?.total ?? 0;
  const isFreeOrder = pricingResult ? pricingResult.isFree : totalAmount === 0;
  const feeBreakdown = useMemo(() => {
    const fees = pricingResult?.fees;
    if (!fees) return [];
    return [
      { label: "Platform fee", value: Number(fees.platform) || 0 },
      { label: "Payment fee", value: Number(fees.payment) || 0 },
      { label: "GST on fees", value: Number(fees.gst) || 0 },
    ].filter((item) => item.value > 0);
  }, [pricingResult]);

  const handleApplyPromoCode = useCallback(async (code) => {
    try {
      const { response, data } = await validateCheckoutPromo(
        buildPromoValidationPayload({
          code,
          eventId: event.id,
          selectedTickets,
        }),
        {
          headers: {
            ...promoRequestHeaders,
            "x-idempotency-key": buildCheckoutRequestIdempotencyKey({
              code,
              eventId: event.id,
              prefix: "promo",
              promoterCode,
              selectedTickets,
            }),
          },
        },
      );
      if (response.ok && data.valid) {
        setAppliedPromoCode(code);
        return {
          valid: true,
          discountAmount: data.discountAmount,
          message: data.message || `Discount of ₹${data.discountAmount} applied!`,
        };
      }
      return {
        valid: false,
        error: data.error || "Invalid promo code",
      };
    } catch {
      return {
        valid: false,
        error: "Failed to validate promo code",
      };
    }
  }, [event.id, promoRequestHeaders, promoterCode, selectedTickets]);

  const handleRemovePromoCode = useCallback(() => {
    setAppliedPromoCode(null);
  }, []);

  const handleCartExpired = useCallback(() => {
    clearPersistedReservation();
    setSelectedTickets([]);
    setError("Your cart reservation has expired. Please select tickets again.");
    setCheckoutQuote(null);
    setPricingResult(null);
    setStep(1);
  }, [clearPersistedReservation]);

  const totalSelectedQuantity = useMemo(() => {
    return selectedTickets.reduce((sum, ticket) => sum + Number(ticket.quantity), 0);
  }, [selectedTickets]);

  const {
    canProceedStep1,
    canSubmitCheckout,
    isAboveMax,
    isBelowMin,
    maxTickets,
    minTickets,
    quoteReady,
  } = useMemo(() => deriveCheckoutConstraints({
    checkoutQuote,
    event,
    hasExpiredReservation,
    isProcessing,
    isQuoteSyncing,
    totalSelectedQuantity,
  }), [checkoutQuote, event, hasExpiredReservation, isProcessing, isQuoteSyncing, totalSelectedQuantity]);
  const canProceedStep2 = attendeeDetails.name.trim() !== "" && attendeeDetails.email.trim() !== "";

  const quoteTierConstraints = useMemo(() => {
    const entries = checkoutQuote?.constraints?.tiers || [];
    return new Map(entries.map((entry) => [entry.tierId, entry]));
  }, [checkoutQuote]);

  const displayTiers = useMemo(() => {
    return (event.tickets ?? []).map((ticket) => {
      const quoteTier = quoteTierConstraints.get(ticket.id);
      const pricedItem = pricingResult?.items?.find((item) => item.tierId === ticket.id);
      const selected = selectedTickets.find((item) => item.id === ticket.id);

      return {
        ...ticket,
        id: ticket.id,
        name: ticket.name,
        description: quoteTier?.description || ticket.description,
        quantity: selected?.quantity || 0,
        price: pricedItem?.unitPrice ?? quoteTier?.unitPrice ?? Number(ticket.price || 0),
        remaining: quoteTier?.available ?? 0,
      };
    });
  }, [event.tickets, pricingResult?.items, quoteTierConstraints, selectedTickets]);

  const needToKnowItems = useMemo(() => buildNeedToKnowItems(event, selectedTickets), [event, selectedTickets]);

  useEffect(() => {
    if (displayFees <= 0) {
      setFeesBreakdownOpen(false);
    }
  }, [displayFees]);

  const handleTicketChange = useCallback((ticketId, delta) => {
    if (!quoteReady || isQuoteSyncing) return;

    setSelectedTickets((prev) => applyTicketQuantityDelta({
      delta,
      eventTickets: event.tickets,
      maxTickets,
      quoteTierConstraints,
      ticketId,
      selectedTickets: prev,
    }));
  }, [event.tickets, maxTickets, quoteReady, quoteTierConstraints, isQuoteSyncing]);

  const launchRazorpayCheckout = useRazorpayCheckout({
    attendeeDetails,
    eventTitle: event.title,
    isPaymentPending: () => isProcessing && !isSuccess,
    onPaymentCancelled: (paymentError) => {
      setIsProcessing(false);
      setProcessingState("");
      setError(paymentError.message);
    },
    onPaymentError: (paymentError) => {
      setError(paymentError.message);
      setIsProcessing(false);
    },
    onPaymentStateChange: setProcessingState,
    onPaymentVerified: async (initiateData) => {
      finishSuccessfulCheckout(initiateData.order.id);
    },
  });

  const handlePayment = useCallback(async () => {
    if (!canSubmitCheckout) {
      setError(
        hasExpiredReservation
          ? "Your cart reservation has expired. Please select tickets again."
          : "Checkout is still syncing your live availability. Please wait a moment.",
      );
      if (hasExpiredReservation) {
        handleCartExpired();
      }
      return;
    }
    if (paymentInFlightRef.current) return;

    paymentInFlightRef.current = true;
    setIsProcessing(true);
    setError("");
    setProcessingState("initiating");

    try {
      if (!user) {
        setIsProcessing(false);
        setProcessingState("");
        router.push(buildGuestLoginRedirect(window.location.pathname, window.location.search));
        return;
      }

      const existingOrder = await resolveFinalOrderState();
      if (existingOrder?.status === "confirmed") {
        return;
      }

      const checkoutActionId = checkoutActionIdRef.current || createCheckoutActionId();
      checkoutActionIdRef.current = checkoutActionId;

      const { response: quoteResponse, data: quoteData } = await calculateCheckout(
        buildCheckoutQuotePayload({
          appliedPromoCode,
          cartReservation,
          eventId: event.id,
          promoterCode,
          selectedTickets,
        }),
        {
          headers: quoteRequestHeaders,
        },
      );

      if (!quoteResponse.ok || !quoteData?.success) {
        if (shouldUseSavedReservationQuote({ cartReservation, eventId: event.id, selectedTickets })) {
          handleCartExpired();
          return;
        }
        throw new Error(quoteData?.error || "We could not refresh live pricing. Please try again.");
      }

      setPricingResult(quoteData.pricing || null);
      setCheckoutQuote(quoteData.quote || null);
      setError("");

      let quoteReservation = cartReservation;
      if (quoteData.reservation) {
        const reservationItems = normalizeReservationItems(quoteData.reservation.items || selectedTickets);
        quoteReservation = {
          ...(quoteData.reservation || cartReservation),
          eventId: event.id,
          orderId: quoteData.reservation.orderId || cartReservation?.orderId || null,
          userId: user?.uid || null,
        };
        persistReservation(quoteReservation, reservationItems);
      }

      let nextReservation = quoteReservation;
      if (shouldReserveBeforeCheckout({ cartReservation: nextReservation, eventId: event.id, selectedTickets })) {
        setProcessingState("reserving");
        const reserveData = await reserveCheckoutInventory(
          buildReserveCheckoutPayload({
            eventId: event.id,
            selectedTickets,
            userUid: user?.uid,
          }),
          {
            headers: {
              "x-idempotency-key": buildCheckoutPhaseIdempotencyKey(checkoutActionId, "reserve"),
            },
          },
        );
        nextReservation = reserveData;
        persistReservation(
          { ...reserveData, eventId: event.id, userId: user?.uid || null },
          normalizeReservationItems(selectedTickets),
        );
      }

      setProcessingState("initiating");
      const initiateData = await initiateCheckout(
        buildInitiateCheckoutPayload({
          attendeeDetails,
          promoCode: appliedPromoCode,
          promoterCode,
          reservationId: nextReservation.reservationId,
        }),
        {
          headers: {
            "x-idempotency-key": buildCheckoutPhaseIdempotencyKey(checkoutActionId, "initiate"),
          },
        },
      );

      persistPendingOrder(initiateData?.order?.id);
      if (nextReservation?.reservationId) {
        persistReservation(
          {
            ...nextReservation,
            eventId: event.id,
            orderId: initiateData?.order?.id || nextReservation.orderId || null,
            userId: user?.uid || null,
          },
          normalizeReservationItems(selectedTickets),
        );
      }

      if (initiateData.requiresPayment) {
        const latestOrder = await resolveFinalOrderState(initiateData?.order?.id);
        if (latestOrder?.status === "confirmed") {
          return;
        }

        await launchRazorpayCheckout(initiateData, {
          paymentVerifyKey: buildCheckoutPhaseIdempotencyKey(checkoutActionId, "verify"),
        });
      } else {
        finishSuccessfulCheckout(initiateData.order.id);
      }
    } catch (checkoutError) {
      const recoveredOrder = await resolveFinalOrderState();
      if (recoveredOrder?.status === "confirmed") {
        return;
      }
      setError(checkoutError.message || "Something went wrong.");
      setIsProcessing(false);
      setProcessingState("");
    } finally {
      paymentInFlightRef.current = false;
    }
  }, [appliedPromoCode, attendeeDetails.email, attendeeDetails.name, attendeeDetails.phone, canSubmitCheckout, cartReservation, event.id, finishSuccessfulCheckout, handleCartExpired, hasExpiredReservation, launchRazorpayCheckout, persistPendingOrder, persistReservation, promoterCode, quoteRequestHeaders, resolveFinalOrderState, router, selectedTickets, user]);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        window.clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  return {
    appliedPromoCode,
    attendeeDetails,
    canProceedStep1,
    canProceedStep2,
    canSubmitCheckout,
    cartReservation,
    clearPersistedReservation,
    displayFees,
    displaySubtotal,
    displayTiers,
    displayTotal,
    error,
    feeBreakdown,
    feesBreakdownOpen,
    handleApplyPromoCode,
    handleCartExpired,
    handlePayment,
    handleRemovePromoCode,
    handleTicketChange,
    isAboveMax,
    isBelowMin,
    isFreeOrder,
    isProcessing,
    isQuoteSyncing,
    isSuccess,
    maxTickets,
    minTickets,
    needToKnowItems,
    otherEventReservation,
    paymentMethod,
    pricingResult,
    processingState,
    quoteReady,
    quoteTierConstraints,
    selectedTickets,
    setAttendeeDetails,
    setError,
    setFeesBreakdownOpen,
    setPaymentMethod,
    setStep,
    step,
    totalDiscount,
  };
}
