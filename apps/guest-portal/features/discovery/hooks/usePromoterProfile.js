'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchPromoterByUsername } from '../publicDiscovery';

const RESERVED_HANDLES = new Set([
  'about',
  'api',
  'app',
  'auth',
  'checkout',
  'confirmation',
  'e',
  'event',
  'explore',
  'forgot-password',
  'host',
  'hosts',
  'interviews',
  'login',
  'privacy',
  'profile',
  'terms',
  'tickets',
  'venue',
  'search',
  'sitemap',
  'robots',
]);

function getEventPriceLabel(event) {
  const min = Number(
    event?.priceRange?.min ?? event?.priceMin ?? event?.startingPrice ?? event?.price ?? 0,
  );
  return min > 0 ? `₹${min.toLocaleString('en-IN')}` : null;
}

export function usePromoterProfile(handle) {
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;

    async function loadPromoter() {
      if (!handle || RESERVED_HANDLES.has(handle)) {
        setStatus('missing');
        return;
      }

      setStatus('loading');
      try {
        const nextResult = await fetchPromoterByUsername(handle);
        if (cancelled) return;
        setResult(nextResult);
        setStatus(nextResult?.promoter ? 'ready' : 'missing');
      } catch (error) {
        if (!cancelled) {
          console.error('[PromoterHandlePage] Failed to load promoter', error);
          setStatus('error');
        }
      }
    }

    void loadPromoter();
    return () => {
      cancelled = true;
    };
  }, [handle]);

  return useMemo(() => {
    const promoter = result?.promoter || null;
    const events = result?.events || [];

    if (!promoter) {
      return {
        bio: null,
        city: 'India',
        events: [],
        initials: 'GP',
        name: handle,
        promoter: null,
        status,
        tonightEvents: [],
        upcomingEvents: [],
      };
    }

    const name = promoter.displayName || promoter.name || handle;
    const city = promoter.city || 'India';
    const bio = promoter.bio || promoter.summary || null;
    const initials = name
      .split(' ')
      .map((word) => word[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const now = new Date();
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const enrichedEvents = events.map((event) => ({
      ...event,
      priceLabel: getEventPriceLabel(event),
    }));

    return {
      bio,
      city,
      events: enrichedEvents,
      initials,
      name,
      promoter,
      status,
      tonightEvents: enrichedEvents.filter((event) => {
        const start = new Date(event.startDate || 0);
        return start >= now && start <= todayEnd;
      }),
      upcomingEvents: enrichedEvents.filter((event) => {
        const start = new Date(event.startDate || 0);
        return start > todayEnd;
      }),
    };
  }, [handle, result, status]);
}
