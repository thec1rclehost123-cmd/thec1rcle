'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatEventDate } from '@c1rcle/core/time';
import { selectInterestedUsersForDisplay } from '../../../lib/eventAudienceUtils';
import { trackEventImpression, joinEventTierWaitlist } from '../api/eventEngagementApi';
import {
  buildGoingLabel,
  buildTagline,
  formatDateShort,
  formatINR,
  formatTimeLabel,
  formatTimeShort,
} from '../eventDetailUtils';

function getAvailability(ticket) {
  const quantity = Number(ticket.quantity || ticket.totalQuantity || 0);
  const remaining =
    ticket.remaining !== undefined
      ? Number(ticket.remaining)
      : ticket.remainingQuantity !== undefined
        ? Number(ticket.remainingQuantity)
        : quantity;

  if (remaining <= 0 && quantity > 0) {
    return {
      label: 'Sold out',
      isSoldOut: true,
      tone: 'text-white/[0.35]',
      barClass: 'bg-white/10',
      fill: 0,
    };
  }

  if (quantity > 0 && remaining >= 0) {
    const fill = Math.max(0, Math.min(1, remaining / quantity));
    if (fill <= 0.12) {
      return {
        label: `${remaining} left`,
        isSoldOut: false,
        tone: 'text-rose-300',
        barClass: 'bg-rose-500',
        fill,
      };
    }
    if (fill <= 0.35) {
      return {
        label: 'Few left',
        isSoldOut: false,
        tone: 'text-amber-200',
        barClass: 'bg-amber-400',
        fill,
      };
    }
    return {
      label: 'Available',
      isSoldOut: false,
      tone: 'text-emerald-200',
      barClass: 'bg-emerald-400',
      fill,
    };
  }

  return {
    label: 'Open',
    isSoldOut: false,
    tone: 'text-white/[0.65]',
    barClass: 'bg-white',
    fill: 1,
  };
}

function getTierLimit(ticket, pendingTotalFree = 0, currentQty = 0) {
  const maxPerOrder = Number(ticket?.maxPerOrder || 10);
  const remaining =
    ticket?.remaining !== undefined
      ? Number(ticket.remaining)
      : ticket?.remainingQuantity !== undefined
        ? Number(ticket.remainingQuantity)
        : ticket?.quantity !== undefined
          ? Number(ticket.quantity)
          : maxPerOrder;

  const computedMax = maxPerOrder;

  if (remaining > 0) {
    return Math.max(0, Math.min(computedMax, remaining));
  }
  if (ticket?.quantity === 0 || ticket?.remaining === 0 || ticket?.remainingQuantity === 0) {
    return 0;
  }
  return maxPerOrder;
}

export function useEventTicketSelection({ event, host, interestedData, onAction, user }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [quantities, setQuantities] = useState({});
  const [crowdModalOpen, setCrowdModalOpen] = useState(false);
  const [waitlistState, setWaitlistState] = useState({});
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  useEffect(() => {
    trackEventImpression(event?.id, searchParams?.get('ref') || null).catch(() => {});
  }, [event?.id, searchParams]);

  const tickets = useMemo(() => {
    if (!Array.isArray(event?.tickets)) return [];
    return event.tickets
      .map((ticket, index) => ({ ...ticket, id: ticket?.id || `tier-${index + 1}` }))
      .sort((first, second) => Number(first?.price || 0) - Number(second?.price || 0));
  }, [event?.tickets]);

  const startingPrice = useMemo(() => {
    if (tickets.length === 0) return 0;
    return tickets.reduce((minimum, ticket) => {
      const price = Number(ticket?.price || 0);
      return price < minimum ? price : minimum;
    }, Number.MAX_SAFE_INTEGER);
  }, [tickets]);

  const selectedTickets = useMemo(() => {
    return Object.entries(quantities)
      .filter(([, quantity]) => Number(quantity) > 0)
      .map(([id, quantity]) => ({ id, quantity }));
  }, [quantities]);

  const totalSelected = useMemo(() => {
    return Object.values(quantities).reduce((sum, quantity) => sum + Number(quantity || 0), 0);
  }, [quantities]);

  const totalPrice = useMemo(() => {
    return tickets.reduce((sum, ticket) => {
      return sum + Number(ticket?.price || 0) * Number(quantities[ticket.id] || 0);
    }, 0);
  }, [tickets, quantities]);

  const totalFreeSelected = useMemo(() => {
    return tickets.reduce((sum, ticket) => {
      const isFree = Number(ticket?.price || 0) === 0;
      return sum + (isFree ? Number(quantities[ticket.id] || 0) : 0);
    }, 0);
  }, [tickets, quantities]);

  const crowdPeople = useMemo(() => {
    if (interestedData?.users?.length) {
      return selectInterestedUsersForDisplay(interestedData.users, 12);
    }
    return [];
  }, [interestedData]);

  const visibleCrowdPeople = crowdPeople.slice(0, 5);
  const goingLabel = buildGoingLabel(interestedData);
  const timeLabel = formatTimeLabel(event);
  const dateShort = formatDateShort(event);
  const timeShort = formatTimeShort(event);
  const venueLabel =
    event?.venue ||
    event?.location ||
    event?.venueName ||
    event?.address ||
    'Venue to be announced';
  const scheduleDate = event?.startDate ? formatEventDate(event.startDate) : 'Date soon';
  const scheduleDoorNote =
    event?.doorPolicy || (timeShort ? 'Doors open 30 minutes past start time.' : '');
  const tagline = buildTagline(event, venueLabel);
  const cityLabel = event?.cityLabel || event?.city || host?.city || '';
  const isFreeEntry =
    tickets.length > 0 && tickets.every((ticket) => Number(ticket?.price || 0) === 0);
  const startsFree = tickets.length > 0 && Number(startingPrice || 0) === 0;
  const entryLabel =
    tickets.length > 0
      ? isFreeEntry
        ? 'Free RSVP'
        : startsFree
          ? 'From Free'
          : `From ${formatINR(startingPrice)}`
      : 'Tickets Soon';
  const ticketLeadCopy =
    tickets.length > 0
      ? 'Reserve your spot.'
      : 'Ticket tiers will appear here once the drop is live.';
  const noteLabel = event?.doorPolicy
    ? 'Door policy'
    : event?.dressCode
      ? 'Dress code'
      : 'Heads up';
  const noteValue =
    event?.doorPolicy ||
    (event?.dressCode
      ? String(event.dressCode)
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (character) => character.toUpperCase())
      : 'Arrive early for the smoothest entry window.');
  const stickySupportLabel = [venueLabel, timeLabel || dateShort].filter(Boolean).join(' · ');
  const primaryActionLabel =
    selectedTickets.length > 0
      ? `Continue • ${formatINR(totalPrice)}`
      : tickets.length > 0
        ? isFreeEntry
          ? 'RSVP Now'
          : 'Get Tickets'
        : 'Get Tickets';

  const setQuantity = useCallback((ticket, nextQuantity) => {
    const limit = getTierLimit(ticket);
    const safeQuantity = Math.max(0, Math.min(limit, nextQuantity));
    setQuantities((current) => ({
      ...current,
      [ticket.id]: safeQuantity,
    }));
  }, []);

  const handlePrimaryAction = useCallback(() => {
    if (selectedTickets.length > 0) {
      onAction?.('BOOK', { tickets: selectedTickets });
      return;
    }
    onAction?.('BOOK', {});
  }, [onAction, selectedTickets]);

  const handleNotifyMe = useCallback(
    async (ticket) => {
      if (!user) {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }

      setWaitlistState((state) => ({ ...state, [ticket.id]: 'loading' }));
      try {
        const { response } = await joinEventTierWaitlist(event?.id, ticket.id);
        setWaitlistState((state) => ({ ...state, [ticket.id]: response.ok ? 'joined' : 'error' }));
      } catch {
        setWaitlistState((state) => ({ ...state, [ticket.id]: 'error' }));
      }
    },
    [event?.id, router, user],
  );

  return {
    cityLabel,
    crowdModalOpen,
    crowdPeople,
    dateShort,
    entryLabel,
    handleNotifyMe,
    handlePrimaryAction,
    isDescriptionExpanded,
    isFreeEntry,
    noteLabel,
    noteValue,
    primaryActionLabel,
    scheduleDate,
    scheduleDoorNote,
    selectedTickets,
    setCrowdModalOpen,
    setIsDescriptionExpanded,
    setQuantity,
    startingPrice,
    startsFree,
    stickySupportLabel,
    tagline,
    ticketLeadCopy,
    tickets,
    timeLabel,
    timeShort,
    totalFreeSelected,
    totalPrice,
    totalSelected,
    venueLabel,
    visibleCrowdPeople,
    waitlistState,
    goingLabel,
    quantities,
    getAvailability,
    getTierLimit,
  };
}
