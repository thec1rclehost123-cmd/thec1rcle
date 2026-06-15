'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import EventRSVP from '../../../components/EventRSVP';
import { fetchPublicEvent } from '../../../features/discovery/publicDiscovery';
import { fetchGuestBffEventDetail } from '../../../lib/bff/fetchers.js';
import { isGuestBffEnabled } from '../../../lib/bff/flags.js';
import { PUBLIC_LIFECYCLE_STATES } from '@c1rcle/core/events';
import { useParams } from 'next/navigation';

const AuroraBackground = () => (
  <div className="fixed inset-0 -z-10 overflow-hidden bg-[var(--bg-color)]">
    <div className="absolute -top-[30%] left-0 h-[80vh] w-full animate-pulse bg-gradient-to-b from-orange/10 via-transparent to-transparent blur-[120px] opacity-60 dark:from-iris/10" />
    <div className="absolute right-[-20%] top-[20%] h-[600px] w-[600px] animate-pulse rounded-full bg-orange/5 opacity-40 mix-blend-multiply blur-[100px] dark:bg-gold/5 dark:mix-blend-screen" />
  </div>
);

const toPartnerSlug = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

function resolveHostProfile(event) {
  let hostProfile = null;

  if (event?.hostData && Object.keys(event.hostData).length > 0) {
    hostProfile = { ...event.hostData, type: event.hostData.type || 'host' };
  }

  if (!hostProfile && event?.venueData && Object.keys(event.venueData).length > 0) {
    hostProfile = {
      ...event.venueData,
      type: 'venue',
      avatar: event.venueData.photoURL || event.venueData.image,
    };
  }

  if (hostProfile && !hostProfile.type) hostProfile.type = 'host';
  if (hostProfile && !hostProfile.slug) {
    hostProfile.slug = hostProfile.handle ? toPartnerSlug(hostProfile.handle) : hostProfile.id;
  }

  return hostProfile;
}

function normalizeDetailPayload(payload) {
  if (!payload) return null;
  if (payload?.event) return payload;
  if (payload?.id) return { event: payload };
  return null;
}

export default function EventDetailPageClient({ initialDetail = null, initialEventId = '' }) {
  const params = useParams();
  const eventId = decodeURIComponent(String(params?.eventId || initialEventId || ''));
  const normalizedInitialDetail = useMemo(
    () => normalizeDetailPayload(initialDetail),
    [initialDetail],
  );
  const [detail, setDetail] = useState(normalizedInitialDetail);
  const [status, setStatus] = useState(normalizedInitialDetail?.event ? 'ready' : 'loading');

  useEffect(() => {
    let cancelled = false;

    if (normalizedInitialDetail?.event && eventId === initialEventId) {
      setDetail(normalizedInitialDetail);
      setStatus('ready');
      return () => {
        cancelled = true;
      };
    }

    async function loadDetail() {
      setStatus('loading');
      try {
        const nextPayload = isGuestBffEnabled('eventDetail')
          ? await fetchGuestBffEventDetail(eventId)
          : await fetchPublicEvent(eventId);
        const nextDetail = normalizeDetailPayload(nextPayload);
        if (cancelled) return;
        setDetail(nextDetail);
        setStatus(nextDetail?.event ? 'ready' : 'missing');
      } catch (error) {
        if (!cancelled) {
          console.error('[EventDetailPage] Failed to load event detail', error);
          setStatus('error');
        }
      }
    }

    if (eventId) {
      loadDetail();
    } else {
      setStatus('missing');
    }

    return () => {
      cancelled = true;
    };
  }, [eventId, normalizedInitialDetail, initialEventId]);

  const event = detail?.event || null;
  const interestedData = detail?.interestedData || { count: 0, users: [] };
  const hostProfile = useMemo(() => (event ? resolveHostProfile(event) : null), [event]);

  if (status === 'loading') {
    return (
      <div className="relative flex min-h-[80vh] items-center justify-center bg-[var(--bg-color)] px-4">
        <AuroraBackground />
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-black/10 border-t-orange dark:border-white/10" />
      </div>
    );
  }

  if (status === 'missing' || status === 'error' || !event) {
    return (
      <div className="relative flex min-h-[80vh] items-center justify-center bg-[var(--bg-color)] px-4">
        <AuroraBackground />
        <div className="text-center">
          <div className="mb-8 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black/5 dark:bg-white/5">
              <svg
                className="h-10 w-10 text-[var(--text-muted)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
          <h1 className="font-heading text-2xl sm:text-4xl font-black uppercase tracking-tight text-[var(--text-primary)] md:text-6xl">
            Event unavailable
          </h1>
          <p className="mx-auto mt-6 max-w-sm text-sm font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
            The event reference is missing or broken. This link might have expired or the host has
            removed the listing.
          </p>
          <div className="mt-12">
            <Link
              href="/explore"
              className="inline-flex items-center gap-3 rounded-full bg-orange px-6 sm:px-10 py-4 sm:py-5 text-[10px] font-black uppercase tracking-[0.3em] text-white shadow-lg shadow-orange/20 transition-transform hover:scale-105 dark:bg-white dark:text-black dark:shadow-none"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Explore Events
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isPublic = PUBLIC_LIFECYCLE_STATES.includes(event.lifecycle);
  const isCancelled = event.lifecycle === 'cancelled';
  const isCompleted = event.lifecycle === 'completed';
  const isPaused = event.lifecycle === 'paused';

  if (!isPublic && !isCancelled && !isCompleted && !isPaused) {
    return (
      <div className="relative flex min-h-[80vh] items-center justify-center bg-[var(--bg-color)] px-4">
        <AuroraBackground />
        <div className="text-center">
          <h1 className="font-heading text-2xl sm:text-4xl font-black uppercase tracking-tight text-[var(--text-primary)] md:text-6xl">
            Event unavailable
          </h1>
          <p className="mx-auto mt-6 max-w-sm text-sm font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
            This event is not available on the public guest surface.
          </p>
        </div>
      </div>
    );
  }

  if (isPaused) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-[var(--bg-color)] px-4 py-20">
        <AuroraBackground />
        <div className="relative z-10 w-full max-w-lg text-center">
          <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-yellow-500/10 ring-8 ring-yellow-500/5">
            <svg
              className="h-12 w-12 text-yellow-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="font-heading text-3xl font-black uppercase tracking-tight text-[var(--text-primary)] md:text-5xl">
            Ticket Sales Paused
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base font-medium leading-relaxed text-[var(--text-muted)]">
            <span className="font-bold text-[var(--text-primary)]">{event.title}</span> has
            temporarily paused ticket sales. Check back soon.
          </p>
          <div className="mt-12">
            <Link
              href="/explore"
              className="inline-flex items-center gap-3 rounded-full bg-orange px-10 py-5 text-[10px] font-black uppercase tracking-[0.3em] text-white shadow-lg shadow-orange/20 transition-transform hover:scale-105 dark:bg-white dark:text-black dark:shadow-none"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              Explore Other Events
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isCancelled) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-[var(--bg-color)] px-4 py-20">
        <AuroraBackground />
        <div className="relative z-10 w-full max-w-lg text-center">
          <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-red-500/10 ring-8 ring-red-500/5">
            <svg
              className="h-12 w-12 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </div>
          <h1 className="font-heading text-3xl font-black uppercase tracking-tight text-[var(--text-primary)] md:text-5xl">
            Event Cancelled
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base font-medium leading-relaxed text-[var(--text-muted)]">
            <span className="font-bold text-[var(--text-primary)]">{event.title}</span> has been
            cancelled by the organizer.
          </p>
          {event.cancellationReason ? (
            <div className="mx-auto mt-8 max-w-md rounded-3xl border border-black/5 bg-black/3 p-6 dark:border-white/5 dark:bg-white/3">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Reason
              </p>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {event.cancellationReason}
              </p>
            </div>
          ) : null}
          <div className="mt-12 flex flex-col items-center gap-4">
            <Link
              href="/explore"
              className="inline-flex items-center gap-3 rounded-full bg-orange px-10 py-5 text-[10px] font-black uppercase tracking-[0.3em] text-white shadow-lg shadow-orange/20 transition-transform hover:scale-105 dark:bg-white dark:text-black dark:shadow-none"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              Explore Other Events
            </Link>
            <Link
              href="/profile"
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
            >
              View My Tickets →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <EventRSVP
      event={event}
      host={hostProfile}
      interestedData={interestedData}
      isCompleted={isCompleted}
    />
  );
}
