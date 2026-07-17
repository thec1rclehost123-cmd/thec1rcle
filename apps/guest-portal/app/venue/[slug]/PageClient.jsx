'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import VenuePageClient from '../../../components/venue/VenuePageClient';
import { fetchPublicVenue } from '../../../features/discovery/publicDiscovery';
import { useAuth } from '../../../components/providers/AuthProvider';
import { guestApiFetch } from '../../../lib/api/client';

function normalizeEventCard(event) {
  return {
    ...event,
    name: event.name || event.title,
    coverImage: event.coverImage || event.image || event.posterUrl,
    startDate: event.startDate || event.startAt,
  };
}

function normalizeVenuePayload(payload) {
  if (!payload?.venue) return payload;
  const venue = payload.venue;
  return {
    ...payload,
    venue: {
      ...venue,
      id: venue.id || venue.venueId || venue.uid || venue.slug || null,
      slug: venue.slug || venue.handle || venue.id || venue.venueId || null,
    },
  };
}

export default function VenuePublicPageClient({ initialData = null, initialSlug = '' }) {
  const params = useParams();
  const slug = decodeURIComponent(String(params?.slug || initialSlug || ''));
  const [data, setData] = useState(normalizeVenuePayload(initialData));
  const [status, setStatus] = useState(initialData?.venue ? 'ready' : 'loading');
  const { user } = useAuth() || {};

  const venueId = data?.venue?.id;

  useEffect(() => {
    if (status === 'ready' && venueId) {
      let visitorId = user?.uid;
      if (!visitorId && typeof window !== 'undefined') {
        visitorId = window.localStorage.getItem('c1rcle:visitor-session-id');
        if (!visitorId) {
          visitorId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
          window.localStorage.setItem('c1rcle:visitor-session-id', visitorId);
        }
      }

      if (visitorId) {
        guestApiFetch('/analytics/venue-click', {
          method: 'POST',
          body: { venueId, visitorId },
        }).catch((err) => console.error('[Analytics] Failed to track venue click', err));
      }
    }
  }, [status, venueId, user?.uid]);

  useEffect(() => {
    let cancelled = false;

    if (initialData?.venue && slug === initialSlug) {
      setData(normalizeVenuePayload(initialData));
      setStatus('ready');
      return () => {
        cancelled = true;
      };
    }

    async function loadVenue() {
      setStatus('loading');
      try {
        const nextData = await fetchPublicVenue(slug);
        if (cancelled) return;
        setData(normalizeVenuePayload(nextData));
        setStatus(nextData?.venue ? 'ready' : 'missing');
      } catch (error) {
        if (!cancelled) {
          console.error('[VenuePublicPage] Failed to load venue', error);
          setStatus('error');
        }
      }
    }

    if (slug) {
      loadVenue();
    } else {
      setStatus('missing');
    }

    return () => {
      cancelled = true;
    };
  }, [slug, initialData, initialSlug]);

  if (status === 'loading') {
    return <div className="min-h-screen animate-pulse bg-white dark:bg-[#0A0A0A]" />;
  }

  if (status !== 'ready' || !data?.venue) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6 text-center text-black dark:bg-[#0A0A0A] dark:text-white">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#F44A22]">
            Venue unavailable
          </p>
          <h1 className="mt-4 text-3xl font-black uppercase tracking-tight">
            We could not load this venue.
          </h1>
        </div>
      </main>
    );
  }

  const venue = data.venue;
  const highlights = data.highlights || [];
  const stats = data.stats || null;
  const upcomingEvents = (data.upcomingEvents || []).map(normalizeEventCard);
  const pastEvents = (data.pastEvents || []).map(normalizeEventCard).slice(0, 20);
  const similarVenues = data.similarVenues || [];

  return (
    <main className="min-h-screen overflow-x-hidden bg-white font-body text-black transition-colors duration-300 selection:bg-[#F44A22]/40 selection:text-white dark:bg-[#0A0A0A] dark:text-white">
      <VenuePageClient
        venue={venue}
        upcomingEvents={upcomingEvents}
        pastEvents={pastEvents}
        stats={stats}
        highlights={highlights}
        similarVenues={similarVenues}
      />
    </main>
  );
}
