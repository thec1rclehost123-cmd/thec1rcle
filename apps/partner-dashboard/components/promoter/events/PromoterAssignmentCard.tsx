'use client';

import { MapPin, Calendar, ExternalLink, Link as LinkIcon, Share, TrendingUp } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

const GUEST_PORTAL_HOST = (() => {
  const baseUrl =
    process.env.NEXT_PUBLIC_GUEST_PORTAL_URL || process.env.NEXT_PUBLIC_SITE_URL || '';
  if (!baseUrl) return 'guest-portal';
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl.replace(/^https?:\/\//, '');
  }
})();

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const datePart = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timePart = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${datePart} at ${timePart}`;
}

export function PromoterAssignmentCard({ assignment }: { assignment: any }) {
  const { event = {}, stats = {}, linkCode, id } = assignment ?? {};

  // Status color mapping
  const statusColors: any = {
    live: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    upcoming: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    completed: 'bg-surface-tertiary text-text-secondary border-border-subtle',
  };

  const statusColor = statusColors[event.status?.toLowerCase()] || statusColors.upcoming;

  return (
    <div className="bg-surface-elevated border border-border-subtle rounded-2xl p-5 hover:border-border-active transition-colors group flex flex-col md:flex-row gap-5 items-start">
      {/* Event Thumbnail */}
      <div className="w-full md:w-48 h-32 md:h-full min-h-[128px] relative rounded-xl overflow-hidden bg-surface-tertiary border border-border-subtle flex-shrink-0">
        {event.coverUrl ? (
          <Image src={event.coverUrl} alt={event.name ?? ''} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-text-muted">
            <Calendar className="h-8 w-8 mb-2 opacity-50" />
            <span className="text-xs font-medium uppercase tracking-widest text-text-muted/70">
              No Image
            </span>
          </div>
        )}
        {/* Status Badge overlay on image for mobile, positioned normally on desktop */}
        <div
          className={`absolute top-2 left-2 px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-md border backdrop-blur-md ${statusColor}`}
        >
          {event.status}
        </div>
      </div>

      {/* Event Details */}
      <div className="flex-1 flex flex-col min-w-0 w-full h-full">
        <div className="flex-1">
          <h3 className="text-xl font-bold tracking-tight text-text-primary truncate mb-2">
            {event.name ?? 'Unnamed Event'}
          </h3>

          <div className="flex flex-col gap-1.5 mb-4">
            <div className="flex items-center text-sm text-text-secondary">
              <Calendar className="h-4 w-4 mr-2 text-text-muted" />
              {event.date ? formatDate(event.date) : 'TBA'}
            </div>
            <div className="flex items-center text-sm text-text-secondary">
              <MapPin className="h-4 w-4 mr-2 text-text-muted" />
              <span className="truncate">{event.venue ?? '—'}</span>
            </div>
          </div>
        </div>

        {/* Tracking Link display */}
        {linkCode && (
          <div className="flex items-center gap-2 mt-auto pt-2">
            <div className="bg-surface-base border border-border-subtle rounded-lg px-3 py-1.5 flex items-center justify-between w-full md:max-w-sm text-sm font-mono text-text-secondary group-hover:border-border-hover transition-colors">
              <div className="flex items-center overflow-hidden">
                <LinkIcon className="h-3.5 w-3.5 mr-2 text-emerald-500 shrink-0" />
                <span className="truncate">
                  {GUEST_PORTAL_HOST}/e/{linkCode}
                </span>
              </div>
              <button className="text-text-muted hover:text-text-primary ml-2 shrink-0">
                <Share className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Performance Stats & Actions */}
      <div className="w-full md:w-56 flex flex-col gap-4 border-t md:border-t-0 border-border-subtle pt-4 md:pt-0 pl-0 md:pl-5 md:border-l h-full shrink-0">
        <div className="grid grid-cols-2 gap-3 mb-2 flex-1">
          <div className="bg-surface-base rounded-xl p-3 border border-border-subtle">
            <p className="text-xs text-text-tertiary mb-1 font-medium">MY SALES</p>
            <p className="text-lg font-black tabular-nums tracking-tight text-text-primary">
              {formatCurrency(stats.revenue ?? 0)}
            </p>
          </div>
          <div className="bg-surface-base rounded-xl p-3 border border-border-subtle">
            <p className="text-xs text-text-tertiary mb-1 font-medium">TICKETS</p>
            <p className="text-lg font-black tabular-nums tracking-tight text-text-primary">
              {stats.ticketsSold ?? 0}
            </p>
          </div>
        </div>

        <Link
          href={`/promoter/events/${id}`}
          className="w-full inline-flex items-center justify-center gap-2 bg-surface-tertiary hover:bg-surface-hover text-text-primary font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors border border-border-subtle mt-auto"
        >
          View Workspace
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
