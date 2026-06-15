'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const VenueEventCalendar = dynamic(
  () =>
    import('@/components/venue-events/VenueEventCalendar').then((mod) => mod.VenueEventCalendar),
  {
    ssr: false,
    loading: () => (
      <div className="py-40 flex justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-text-placeholder" />
      </div>
    ),
  },
);

export default function CalendarPage() {
  return (
    <div className="pb-20">
      <VenueEventCalendar />
    </div>
  );
}
