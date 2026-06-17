'use client';

import Link from 'next/link';
import { Ticket, ChevronRight } from 'lucide-react';
import { OverviewResponse } from './types';
import { formatCompactINR, formatEventDate } from './utils';

export function UpcomingEventCard({
  assignment,
}: {
  assignment: NonNullable<OverviewResponse['activeAssignments']>[number];
}) {
  const href = assignment.id ? `/promoter/events/${assignment.id}` : '/promoter/events';
  const stats = [
    { label: 'Clicks', value: '0' },
    { label: 'Tickets Sold', value: String(assignment.ticketsSold || 0) },
    { label: 'Earnings', value: formatCompactINR(assignment.commission) },
  ];

  return (
    <Link
      href={href}
      className="group rounded-[24px] p-4 md:p-5 transition-all"
      style={{ background: '#17191f', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center">
        <div
          className="h-[104px] w-full overflow-hidden rounded-[20px] shrink-0 xl:h-[120px] xl:w-[140px]"
          style={{
            background: 'linear-gradient(180deg, rgba(244,106,58,0.18), rgba(94,194,255,0.08))',
          }}
        >
          {assignment.coverImage ? (
            <img src={assignment.coverImage} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Ticket className="w-8 h-8" style={{ color: 'rgba(255,255,255,0.38)' }} />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 xl:flex xl:items-center">
          <div className="w-full xl:flex xl:items-center xl:gap-6">
            <div className="min-w-0 xl:flex xl:min-h-[120px] xl:flex-col xl:justify-center">
              <p
                className="text-[11px] font-black uppercase tracking-[0.22em]"
                style={{ color: '#ff9a66' }}
              >
                {assignment.venueName || 'Venue TBA'}
              </p>
              <p className="text-[22px] md:text-[24px] font-semibold text-white truncate">
                {assignment.eventName || 'Untitled Event'}
              </p>
              <p className="text-[15px] mt-1" style={{ color: '#ffd9c7' }}>
                {formatEventDate(assignment.eventDate)}
              </p>
            </div>

            <div className="flex items-center justify-center xl:min-h-[120px] xl:flex-1">
              <div className="grid grid-cols-3 gap-2 xl:min-w-[360px] xl:max-w-[420px]">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-[16px] px-3 py-3 text-center"
                    style={{
                      background:
                        'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.04) 100%)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
                    }}
                  >
                    <p className="text-[20px] leading-none font-semibold text-white">
                      {stat.value}
                    </p>
                    <p
                      className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      style={{ color: '#ffc6a8' }}
                    >
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 flex items-center justify-end gap-3 xl:self-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-[18px]"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.04) 100%)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
          >
            <ChevronRight className="w-5 h-5" style={{ color: '#f46a3a' }} />
          </div>
        </div>
      </div>
    </Link>
  );
}
