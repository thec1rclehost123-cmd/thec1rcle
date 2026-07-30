'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import CheckoutContainer from '../../../features/checkout/CheckoutContainer';
import { normalizeCheckoutEventDetail } from '../../../features/checkout/checkoutEventModel.js';
import FunnelShell from '../../../components/FunnelShell';
import { fetchPublicEvent } from '../../../features/discovery/publicDiscovery';

function buildInitialTickets(event, searchParams) {
  if (!event?.tickets?.length) return [];

  return event.tickets.flatMap((ticket) => {
    const quantity = Number(searchParams?.get(`t_${ticket.id}`) || 0);
    if (quantity <= 0) return [];
    return [{ ...ticket, quantity }];
  });
}

export default function CheckoutPageClient({
  initialEvent = null,
  initialSummary = null,
  initialStatus = 'loading',
  initialEventId = '',
}) {
  const params = useParams();
  const searchParams = useSearchParams();
  const eventId = decodeURIComponent(String(params?.eventId || initialEventId || ''));
  const [event, setEvent] = useState(initialEvent);
  const [summary, setSummary] = useState(initialSummary);
  const [status, setStatus] = useState(initialEvent ? 'ready' : initialStatus);
  const searchKey = searchParams?.toString() || '';

  useEffect(() => {
    let cancelled = false;

    if (initialEvent && eventId === initialEventId) {
      setEvent(initialEvent);
      setSummary(initialSummary);
      setStatus(initialStatus === 'error' ? 'error' : 'ready');
      return () => {
        cancelled = true;
      };
    }

    async function loadEvent() {
      setStatus('loading');
      try {
        const detail = await fetchPublicEvent(eventId);
        if (cancelled) return;
        const nextEvent = normalizeCheckoutEventDetail(detail);
        setEvent(nextEvent);
        setSummary(null);
        setStatus(nextEvent ? 'ready' : 'missing');
      } catch (error) {
        if (!cancelled) {
          console.error('[CheckoutPage] Failed to load event', error);
          setStatus('error');
        }
      }
    }

    if (eventId) {
      loadEvent();
    } else {
      setStatus('missing');
    }

    return () => {
      cancelled = true;
    };
  }, [
    eventId,
    initialEvent,
    initialEventId,
    initialStatus,
    initialSummary,
    searchKey,
    searchParams,
  ]);

  const initialTickets = useMemo(() => {
    return buildInitialTickets(event, new URLSearchParams(searchKey));
  }, [event, searchKey]);

  if (status === 'loading') {
    return (
      <FunnelShell title="Checkout" showLogo backHref="/explore">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/15 border-t-orange" />
        </div>
      </FunnelShell>
    );
  }

  if (status === 'missing' || !event) {
    return (
      <FunnelShell title="Checkout" showLogo backHref="/explore">
        <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-4 sm:px-6 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-orange">
            Checkout unavailable
          </p>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">
            That event could not be found.
          </h1>
          <p className="text-sm text-white/60">
            The event may have moved, expired, or no longer be available for guests.
          </p>
        </div>
      </FunnelShell>
    );
  }

  if (status === 'error') {
    return (
      <FunnelShell title="Checkout" showLogo backHref={`/event/${event.id || eventId}`}>
        <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-4 sm:px-6 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-orange">
            Gateway sync error
          </p>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">
            We could not load checkout right now.
          </h1>
          <p className="text-sm text-white/60">Please refresh and try again in a moment.</p>
        </div>
      </FunnelShell>
    );
  }

  return (
    <FunnelShell title="Checkout" showLogo backHref={`/event/${event.id}`}>
      <CheckoutContainer event={event} initialSummary={summary} initialTickets={initialTickets} />
    </FunnelShell>
  );
}
