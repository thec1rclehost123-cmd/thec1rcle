"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import FunnelShell from "../../../components/FunnelShell";
import OrderConfirmationDetails from "../../../components/OrderConfirmationDetails";
import { useAuth } from "../../../components/providers/AuthProvider";
import { fetchPublicEvent } from "../../../features/discovery/publicDiscovery";
import { fetchGuestOrder } from "../../../features/orders/api/orderApi";

export default function ConfirmationPageClient() {
  const params = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const orderId = decodeURIComponent(String(params?.orderId || ""));
  const [status, setStatus] = useState("loading");
  const [order, setOrder] = useState(null);
  const [event, setEvent] = useState(null);

  useEffect(() => {
    if (loading) return;

    const returnPath = `/confirmation/${encodeURIComponent(orderId)}`;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(returnPath)}`);
      return;
    }

    let cancelled = false;

    async function loadOrder() {
      setStatus("loading");
      try {
        const { response, data } = await fetchGuestOrder(orderId, {
          cache: "no-store",
        });

        if (cancelled) return;

        if (response.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(returnPath)}`);
          return;
        }

        if (response.status === 403 || response.status === 404 || !response.ok) {
          setStatus("missing");
          return;
        }

        const nextOrder = data?.order || null;
        const nextEvent = data?.event || (nextOrder?.eventId ? normalizeEvent(await fetchPublicEvent(nextOrder.eventId)) : null);

        if (cancelled) return;

        if (!nextOrder) {
          setStatus("missing");
          return;
        }

        setOrder(nextOrder);
        setEvent(nextEvent);
        setStatus("ready");
      } catch (error) {
        if (!cancelled) {
          console.error("[ConfirmationPage] Failed to load order", error);
          setStatus("error");
        }
      }
    }

    if (orderId) {
      loadOrder();
    } else {
      setStatus("missing");
    }

    return () => {
      cancelled = true;
    };
  }, [loading, orderId, router, user]);

  if (loading || status === "loading") {
    return (
      <FunnelShell title="Booking Confirmed" showLogo backHref="/tickets">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/15 border-t-orange" />
        </div>
      </FunnelShell>
    );
  }

  if (status === "missing" || !order) {
    return (
      <FunnelShell title="Booking Confirmed" showLogo backHref="/tickets">
        <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-orange">Confirmation unavailable</p>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">We could not find that order.</h1>
          <p className="text-sm text-white/60">If you just checked out, give it a moment and then open your ticket vault again.</p>
        </div>
      </FunnelShell>
    );
  }

  if (status === "error") {
    return (
      <FunnelShell title="Booking Confirmed" showLogo backHref="/tickets">
        <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-orange">Gateway sync error</p>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">We could not load your confirmation yet.</h1>
          <p className="text-sm text-white/60">Please refresh in a moment. Your order record is still owned by the gateway.</p>
        </div>
      </FunnelShell>
    );
  }

  if (order.status !== "confirmed") {
    return (
      <FunnelShell title="Payment Pending" showLogo backHref="/tickets">
        <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-orange">Confirmation Pending</p>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">Your payment is still settling.</h1>
          <p className="max-w-xl text-sm text-white/60">
            We have not confirmed this order yet. Check your ticket vault in a moment. If the payment already went through,
            this page will resolve from the gateway order record once verification completes.
          </p>
        </div>
      </FunnelShell>
    );
  }

  if (!event) {
    return (
      <FunnelShell title="Booking Confirmed" showLogo backHref="/tickets">
        <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-orange">Event unavailable</p>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">Your order is confirmed.</h1>
          <p className="text-sm text-white/60">We could not load the event details, but your tickets should still appear in your vault.</p>
        </div>
      </FunnelShell>
    );
  }

  return (
    <FunnelShell title="Booking Confirmed" showLogo backHref="/explore">
      <OrderConfirmationDetails order={order} event={event} />
    </FunnelShell>
  );
}

function normalizeEvent(detail) {
  const event = detail?.event || detail;
  if (!event) return null;
  return {
    ...event,
    tickets: event.ticketCatalog?.tiers ?? event.tickets ?? [],
  };
}
