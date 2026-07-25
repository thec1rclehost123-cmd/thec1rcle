'use client';

import { memo } from 'react';
import EventAnalyticsClient from '@/components/analytics/EventAnalyticsClient';

interface HostOverviewTabProps {
  eventId: string;
  role: 'host' | 'venue';
  idParam: 'hostId' | 'venueId';
}

function HostOverviewTabComponent({ eventId, role, idParam }: HostOverviewTabProps) {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-5 border-b border-white/5 pb-7 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-[26px] font-bold tracking-tight text-white">Analytics</h2>
          </div>
        </div>
      </div>
      <div className="pt-1">
        <EventAnalyticsClient role={role} idParam={idParam} eventId={eventId} embedded />
      </div>
    </section>
  );
}

export const HostOverviewTab = memo(HostOverviewTabComponent);
