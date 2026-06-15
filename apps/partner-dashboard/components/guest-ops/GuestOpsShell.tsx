'use client';

import { useState, useEffect, useCallback, ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  LayoutGrid,
  ListChecks,
  Search,
  Radio,
  AlertTriangle as ExcIcon,
  Settings2,
  ChevronDown,
  Circle,
  Wifi,
  WifiOff,
  AlertTriangle,
  Zap,
  Users,
  CheckCircle2,
  XCircle,
  Flag,
  ScanLine,
  Loader2,
} from 'lucide-react';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { useDoorHub } from '@/lib/context/DoorHubContext';
import type { GuestOpsOverview, DoorStatus } from '@/lib/types/guestOps';

const SUBNAV = [
  { label: 'Overview', href: 'overview', icon: LayoutGrid },
  { label: 'Guest List', href: 'list', icon: ListChecks },
  { label: 'Door Search', href: 'door', icon: Search },
  { label: 'Scanner', href: 'scanner', icon: Radio },
  { label: 'Exceptions', href: 'exceptions', icon: ExcIcon },
  { label: 'Rules', href: 'rules', icon: Settings2 },
];

const DOOR_STATUS_CONFIG: Record<DoorStatus, { label: string; color: string }> = {
  open: { label: 'OPEN', color: 'text-green-500' },
  soft_close: { label: 'SOFT', color: 'text-amber-500' },
  hard_close: { label: 'CLOSED', color: 'text-red-500' },
  cutoff: { label: 'CUTOFF', color: 'text-red-600' },
};

interface GuestOpsShellProps {
  children: ReactNode;
  events?: Array<{
    id: string;
    title: string;
    startDate?: string;
    status?: string;
    isLive?: boolean;
  }>;
  summary?: GuestOpsOverview | null;
  openExceptions?: number;
  isLoading?: boolean;
  onEventChange?: (eventId: string) => void;
}

/**
 * GuestOpsShell — wraps guest-ops sub-pages.
 * When inside DoorHubContext the hub already renders the event bar + nav, so we
 * skip the standalone sticky shell and just render children directly.
 */
export function GuestOpsShell(props: GuestOpsShellProps) {
  const hubCtx = useDoorHub();
  // In hub mode the hub owns the event bar — skip the shell entirely
  if (hubCtx) return <>{props.children}</>;
  return <StandaloneGuestOpsShell {...props} />;
}

function StandaloneGuestOpsShell({
  children,
  events = [],
  summary,
  openExceptions = 0,
  isLoading = false,
  onEventChange,
}: GuestOpsShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { profile } = useDashboardAuth();

  const [compactMode, setCompactMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('guestops_compact') === '1';
    }
    return false;
  });

  const selectedEventId = searchParams.get('eventId') ?? events[0]?.id ?? '';
  const activeTab = SUBNAV.find((t) => pathname.endsWith(t.href))?.href ?? 'overview';

  const handleEventChange = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('eventId', id);
      router.replace(`${pathname}?${params.toString()}`);
      onEventChange?.(id);
    },
    [pathname, router, searchParams, onEventChange],
  );

  const toggleCompact = useCallback(() => {
    setCompactMode((prev) => {
      const next = !prev;
      localStorage.setItem('guestops_compact', next ? '1' : '0');
      return next;
    });
  }, []);

  const kpis = summary?.kpis;
  const doorCfg = DOOR_STATUS_CONFIG[summary?.doorStatus ?? 'open'];

  const venueId = profile?.activeMembership?.partnerId;

  return (
    <div className={cn('flex flex-col min-h-0', compactMode && 'compact-mode')}>
      {/* ── Sticky top bar ── */}
      <div
        className="sticky top-0 z-30 border-b"
        style={{ background: 'var(--v-card)', borderColor: 'var(--v-border)' }}
      >
        {/* Row 1: event selector + KPI strip */}
        <div className="flex items-center gap-4 px-4 py-2.5 flex-wrap">
          {/* Event Selector */}
          <EventSelector
            events={events}
            selectedId={selectedEventId}
            onChange={handleEventChange}
          />

          {/* KPI strip — real-time fields only in non-compact; compact shows checkedIn only */}
          {kpis && !isLoading ? (
            compactMode ? (
              <div className="flex items-center gap-4 flex-1">
                <KPIBadge
                  icon={<CheckCircle2 size={14} className="text-green-500" />}
                  label="Checked In"
                  value={kpis.checkedIn}
                  total={kpis.totalExpected}
                  emphasis
                />
                <DoorStatusBadge
                  status={summary?.doorStatus ?? 'open'}
                  isLive={!!summary?.isLive}
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 flex-wrap flex-1">
                <KPIBadge
                  icon={<Users size={13} className="text-slate-400" />}
                  label="Expected"
                  value={kpis.totalExpected}
                />
                <KPIBadge
                  icon={<CheckCircle2 size={13} className="text-green-500" />}
                  label="In"
                  value={kpis.checkedIn}
                  emphasis
                />
                <KPIBadge
                  icon={<XCircle size={13} className="text-red-400" />}
                  label="Denied"
                  value={kpis.denied}
                />
                <KPIBadge
                  icon={<Flag size={13} className="text-amber-400" />}
                  label="Flagged"
                  value={kpis.flagged}
                />
                <KPIBadge
                  icon={<ScanLine size={13} className="text-blue-400" />}
                  label="Dupe Scans"
                  value={kpis.duplicateScans}
                />
                <KPIBadge
                  icon={<Wifi size={13} className="text-teal-400" />}
                  label="Devices"
                  value={kpis.onlineDevices}
                />
                <DoorStatusBadge
                  status={summary?.doorStatus ?? 'open'}
                  isLive={!!summary?.isLive}
                />
              </div>
            )
          ) : isLoading ? (
            <div className="flex items-center gap-2 flex-1">
              <Loader2 size={14} className="animate-spin text-[var(--v-text-muted)]" />
              <span className="text-[12px] text-[var(--v-text-muted)]">
                Loading operations data…
              </span>
            </div>
          ) : null}

          {/* Event Night Mode toggle */}
          <button
            onClick={toggleCompact}
            className={cn(
              'ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all shrink-0',
              compactMode
                ? 'bg-[var(--v-orange)] text-white'
                : 'bg-[var(--v-elevated)] text-[var(--v-text-secondary)] hover:bg-[var(--v-card-hover)]',
            )}
          >
            <Zap size={12} />
            {compactMode ? 'Event Mode ON' : 'Event Night Mode'}
          </button>
        </div>

        {/* Anomaly Banner */}
        {openExceptions > 0 && (
          <div
            className="flex items-center gap-2 px-4 py-1.5 text-[12px] font-medium border-t"
            style={{
              background: 'var(--v-warning-bg)',
              borderColor: 'var(--v-warning)',
              color: 'var(--v-warning)',
            }}
          >
            <AlertTriangle size={13} />
            <span>
              {openExceptions} open exception{openExceptions !== 1 ? 's' : ''} require
              {openExceptions === 1 ? 's' : ''} review
            </span>
            <Link
              href={`/venue/guest-ops/exceptions?eventId=${selectedEventId}&venueId=${venueId}`}
              className="ml-auto underline underline-offset-2 hover:opacity-80"
            >
              View
            </Link>
          </div>
        )}

        {/* Subnav tabs */}
        <div
          className="flex items-center gap-0.5 px-3 pt-1 overflow-x-auto scrollbar-hide border-t"
          style={{ borderColor: 'var(--v-border)' }}
        >
          {SUBNAV.map((tab) => {
            const isActive = activeTab === tab.href;
            const href = `/venue/guest-ops/${tab.href}?eventId=${selectedEventId}&venueId=${venueId}`;
            const showBadge = tab.href === 'exceptions' && openExceptions > 0;
            return (
              <Link
                key={tab.href}
                href={href}
                className={cn(
                  'relative flex items-center gap-1.5 px-3 py-2 text-[13px] whitespace-nowrap transition-all',
                  isActive
                    ? 'font-black text-[var(--v-orange)] border-b-2 border-[var(--v-orange)] tracking-wide'
                    : 'font-medium text-[var(--v-text-secondary)] hover:text-[var(--v-text-primary)]',
                )}
              >
                <tab.icon size={14} />
                {tab.label}
                {showBadge && (
                  <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--v-warning)] text-white text-[9px] font-bold">
                    {openExceptions > 9 ? '9+' : openExceptions}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className={cn('flex-1 min-h-0 overflow-auto', compactMode ? 'p-3' : 'p-4 md:p-6')}>
        {summary?.isLocked && (
          <div
            className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium"
            style={{ background: 'var(--v-elevated)', color: 'var(--v-text-secondary)' }}
          >
            <XCircle size={14} />
            This event is closed — all operations are locked. Data is read-only.
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function EventSelector({
  events,
  selectedId,
  onChange,
}: {
  events: Array<{
    id: string;
    title: string;
    startDate?: string;
    status?: string;
    isLive?: boolean;
  }>;
  selectedId: string;
  onChange: (id: string) => void;
}) {
  const selected = events.find((e) => e.id === selectedId) ?? events[0];
  const [open, setOpen] = useState(false);

  if (events.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--v-elevated)] text-[13px] text-[var(--v-text-muted)]">
        <Circle size={8} className="text-red-400" />
        No event selected
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--v-elevated)] hover:bg-[var(--v-card-hover)] text-[13px] font-medium text-[var(--v-text-primary)] transition-all max-w-[280px]"
      >
        <Circle
          size={8}
          className={
            selected?.isLive ? 'text-green-400 fill-green-400' : 'text-slate-400 fill-slate-400'
          }
        />
        <span className="truncate">{selected?.title ?? 'Select Event'}</span>
        <ChevronDown size={13} className="ml-1 text-[var(--v-text-muted)] shrink-0" />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 min-w-[280px] rounded-xl border shadow-xl overflow-hidden"
          style={{ background: 'var(--v-card)', borderColor: 'var(--v-border)' }}
        >
          {events.map((event) => (
            <button
              key={event.id}
              onClick={() => {
                onChange(event.id);
                setOpen(false);
              }}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-left text-[13px] hover:bg-[var(--v-card-hover)] transition-colors',
                event.id === selectedId && 'bg-[var(--v-elevated)]',
              )}
            >
              <Circle
                size={8}
                className={cn(
                  event.isLive ? 'text-green-400 fill-green-400' : 'text-slate-400 fill-slate-400',
                )}
              />
              <div>
                <div className="font-medium text-[var(--v-text-primary)]">{event.title}</div>
                {event.startDate && (
                  <div className="text-[11px] text-[var(--v-text-muted)]">
                    {new Date(event.startDate).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function KPIBadge({
  icon,
  label,
  value,
  total,
  emphasis,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  total?: number;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-lg',
        emphasis ? 'bg-green-50 dark:bg-green-900/20' : 'bg-[var(--v-elevated)]',
      )}
    >
      {emphasis && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{
            background: '#34D399',
            boxShadow: '0 0 6px rgba(52,211,153,0.8)',
            animation: 'pulse 1.5s cubic-bezier(0.4,0,0.6,1) infinite',
          }}
        />
      )}
      {icon}
      <span className="text-[11px] text-[var(--v-text-muted)]">{label}</span>
      <span
        className={cn(
          'text-[13px] font-bold tabular-nums',
          emphasis ? 'text-green-600 dark:text-green-400' : 'text-[var(--v-text-primary)]',
        )}
      >
        {value.toLocaleString()}
      </span>
      {total !== undefined && (
        <span className="text-[11px] text-[var(--v-text-muted)]">/ {total.toLocaleString()}</span>
      )}
    </div>
  );
}

function DoorStatusBadge({ status, isLive }: { status: DoorStatus; isLive?: boolean }) {
  const cfg = DOOR_STATUS_CONFIG[status] ?? {
    label: status.toUpperCase(),
    color: 'text-slate-400',
  };
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--v-elevated)]">
      <Circle size={7} className={cn('fill-current', cfg.color, isLive && 'animate-pulse')} />
      <span className="text-[11px] text-[var(--v-text-muted)]">Door</span>
      <span className={cn('text-[12px] font-bold', cfg.color)}>{cfg.label}</span>
    </div>
  );
}
