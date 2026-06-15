'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  fetchPromoterByUsername,
  fetchPromoterVanityLink,
  fetchPublicEvent,
} from '../../../features/discovery/publicDiscovery';
import { PUBLIC_LIFECYCLE_STATES } from '@c1rcle/core/events';

function buildRedirectQuery(searchParams, overrides = {}) {
  const query = new URLSearchParams();
  searchParams?.forEach((value, key) => {
    query.append(key, value);
  });
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  }
  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

export default function VanityEventPageClient() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const handle = decodeURIComponent(String(params?.handle || '')).toLowerCase();
  const slug = decodeURIComponent(String(params?.eventSlug || ''));
  const [status, setStatus] = useState('resolving');

  const redirectQuery = useMemo(() => buildRedirectQuery(searchParams), [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function resolveRoute() {
      setStatus('resolving');

      try {
        const vanityLink = await fetchPromoterVanityLink(handle, slug);
        if (cancelled) return;

        if (vanityLink?.eventId && vanityLink?.code) {
          router.replace(
            `/event/${encodeURIComponent(vanityLink.eventSlug || vanityLink.eventId)}${buildRedirectQuery(searchParams, { ref: vanityLink.code })}`,
          );
          return;
        }

        const [promoterResult, detail] = await Promise.all([
          fetchPromoterByUsername(handle).catch(() => null),
          fetchPublicEvent(slug).catch(() => null),
        ]);

        if (cancelled) return;

        const event = detail?.event || null;
        if (
          !promoterResult?.promoter ||
          !event ||
          !PUBLIC_LIFECYCLE_STATES.includes(event.lifecycle)
        ) {
          setStatus('missing');
          return;
        }

        router.replace(`/event/${encodeURIComponent(event.id)}${redirectQuery}`);
      } catch (error) {
        if (!cancelled) {
          console.error('[VanityEventPage] Failed to resolve vanity route', error);
          setStatus('missing');
        }
      }
    }

    resolveRoute();
    return () => {
      cancelled = true;
    };
  }, [handle, redirectQuery, router, slug]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050508] px-6 text-center text-white">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-violet-400">
          {status === 'missing' ? 'Link unavailable' : 'Resolving link'}
        </p>
        <h1 className="mt-4 text-3xl font-black tracking-tight">
          {status === 'missing'
            ? 'We could not open this promoter link.'
            : 'Taking you to the event.'}
        </h1>
      </div>
    </div>
  );
}
