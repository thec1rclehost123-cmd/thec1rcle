'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function VenueConnectionsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/venue/connections/requests');
  }, [router]);

  return (
    <div
      className="flex items-center justify-center min-h-[50vh] rounded-[32px]"
      style={{ background: 'var(--v-card)' }}
    >
      <p
        className="text-[11px] font-bold uppercase tracking-widest"
        style={{ color: 'var(--v-text-muted)' }}
      >
        Redirecting...
      </p>
    </div>
  );
}
