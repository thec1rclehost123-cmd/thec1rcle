'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import PublicProfileUnavailable from '../../../../components/profile/PublicProfileUnavailable';
import { fetchPublicVenue } from '../../../../features/discovery/publicDiscovery';
import MenuClient from './MenuClient';

export default function VenueMenuPageClient() {
  const params = useParams();
  const slug = decodeURIComponent(String(params?.slug || ''));
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;

    async function loadVenue() {
      setStatus('loading');
      try {
        const response = await fetchPublicVenue(slug);
        if (cancelled) return;
        const nextVenue = response?.venue || null;
        setData(response || null);
        setStatus(nextVenue ? 'ready' : 'missing');
      } catch (error) {
        if (!cancelled) {
          console.error('[VenueMenuPage] Failed to load venue', error);
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
  }, [slug]);

  if (status === 'loading') {
    return <div className="min-h-screen animate-pulse bg-black" />;
  }

  const venue = data?.venue || null;

  if (status !== 'ready' || !venue) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-6 text-center text-white">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-orange">
            Menu unavailable
          </p>
          <h1 className="mt-4 text-3xl font-black uppercase tracking-tight">
            We could not load this venue menu.
          </h1>
        </div>
      </div>
    );
  }

  if (venue.visibility === 'private' || venue.publicProfileEnabled === false) {
    return <PublicProfileUnavailable type="venue" name={venue.name} />;
  }

  return (
    <MenuClient
      venue={venue}
      menu={data?.menu || venue.menuDoc || venue.menu || null}
      slug={slug}
    />
  );
}
