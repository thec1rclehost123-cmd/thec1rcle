'use client';

import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

export default function ShortEventRedirect() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = decodeURIComponent(String(params?.eventId || ''));
  const searchKey = searchParams?.toString() || '';

  useEffect(() => {
    if (!eventId) {
      router.replace('/explore');
      return;
    }

    const redirectUrl = searchKey ? `/event/${eventId}?${searchKey}` : `/event/${eventId}`;

    router.replace(redirectUrl);
  }, [eventId, router, searchKey]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/15 border-t-orange" />
    </div>
  );
}
