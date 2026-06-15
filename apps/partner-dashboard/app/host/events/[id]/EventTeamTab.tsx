'use client';

import { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Shield,
  Ticket,
  TrendingUp,
  Users,
  X,
  IndianRupee,
  MousePointerClick,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatINR, formatINRCompact, formatNumber, formatRelativeDate } from '@/lib/utils/format';
import { cn } from '@/lib/utils';

// ─── Types (matching EventPromoterRow in PageClient.tsx) ────────────────────

interface EventPromoterRow {
  id: string;
  promoterId: string | null;
  promoterName: string;
  name: string;
  avatar: string | null;
  isSelected: boolean;
  assignmentId: string | null;
  commissionRate: number;
  shortCode: string;
  trackingLink: string | null;
  sales: number;
  revenue: number;
  clicks: number;
  assignedAt: string | null;
  status: string;
}

interface TeamSummary {
  totalPromoters: number;
  selectedPromoters: number;
  activePromoters: number;
  disabledPromoters: number;
  ticketsSold: number;
  revenue: number;
  clicks: number;
}

interface GuestRow {
  id: string;
  userName: string;
  userEmail: string;
  totalAmount: number;
  ticketCount: number;
  checkedIn: boolean;
  status: string;
  createdAt: string;
}

interface EventTeamTabProps {
  eventId: string;
  promoters: EventPromoterRow[];
  summary: TeamSummary | undefined;
  isLoading: boolean;
  onSave: (payload: { enabled: boolean; allowedPromoterIds: string[] }) => Promise<void>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function conversionPct(sales: number, clicks: number): string {
  if (!clicks) return '—';
  return `${((sales / clicks) * 100).toFixed(1)}%`;
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatPill({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/6 bg-white/[0.03] px-5 py-3">
      <Icon className="h-4 w-4 shrink-0" style={{ color: accent ?? 'rgba(255,255,255,0.4)' }} />
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">{label}</p>
        <p className="text-sm font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={cn('inline-block h-2 w-2 rounded-full', active ? 'bg-emerald-400' : 'bg-white/20')}
    />
  );
}

function GuestMiniRow({ guest }: { guest: GuestRow }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-white/5 py-2.5 text-sm">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-[10px] font-bold text-white/60">
          {initials(guest.userName || '?')}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">{guest.userName || 'Guest'}</p>
          <p className="truncate text-xs text-white/40">{guest.userEmail}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <span className="tabular-nums text-white/70">{formatINR(guest.totalAmount)}</span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-bold',
            guest.checkedIn ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-white/40',
          )}
        >
          {guest.checkedIn ? 'In' : 'Ticket'}
        </span>
      </div>
    </div>
  );
}

// ─── Promoter Card ───────────────────────────────────────────────────────────

function PromoterCard({
  promoter,
  eventId,
  authedFetch,
  onRemove,
  isRemoving,
}: {
  promoter: EventPromoterRow;
  eventId: string;
  authedFetch: (url: string) => Promise<any>;
  onRemove: (promoterId: string) => void;
  isRemoving: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [guestsLoading, setGuestsLoading] = useState(false);
  const [guestsFetched, setGuestsFetched] = useState(false);

  const toggleExpand = async () => {
    if (!expanded && !guestsFetched) {
      setGuestsLoading(true);
      try {
        const data = await authedFetch(
          `/api/partners/hosts/events/${eventId}/guestlist?promoterCode=${promoter.shortCode}&limit=20`,
        );
        setGuests(data.guests || []);
      } catch {
        /* silently fail — guests stay empty */
      } finally {
        setGuestsLoading(false);
        setGuestsFetched(true);
      }
    }
    setExpanded((v) => !v);
  };

  const pId = promoter.promoterId ?? '';
  const conv = conversionPct(promoter.sales, promoter.clicks);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[20px] border border-white/6 bg-[#0f0f12] transition-all duration-200',
        expanded && 'border-white/10',
      )}
    >
      {/* Card Header */}
      <div className="p-5">
        {/* Top row: avatar + name + status + remove */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.07]">
              {promoter.avatar ? (
                <img
                  src={promoter.avatar}
                  alt={promoter.promoterName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-sm font-bold text-white/60">
                  {initials(promoter.promoterName)}
                </span>
              )}
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#0f0f12]">
                <StatusDot active={promoter.isSelected} />
              </span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{promoter.promoterName}</p>
              <p className="text-[11px] text-white/40">
                {promoter.assignedAt
                  ? `Added ${formatRelativeDate(promoter.assignedAt)}`
                  : 'No assignment date'}
              </p>
            </div>
          </div>
          <button
            onClick={() => pId && onRemove(pId)}
            disabled={isRemoving || !pId}
            title="Remove from event"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/40 transition-all hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isRemoving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <UserMinus className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Tickets', value: formatNumber(promoter.sales) },
            { label: 'Revenue', value: formatINRCompact(promoter.revenue) },
            { label: 'Clicks', value: formatNumber(promoter.clicks) },
            { label: 'Conv.', value: conv },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-white/[0.03] p-2.5 text-center">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-white/35">
                {label}
              </p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-white">{value}</p>
            </div>
          ))}
        </div>

        {/* Code pill */}
        {promoter.shortCode && (
          <div className="mt-3 flex items-center gap-2">
            <span className="rounded-full bg-violet-500/10 px-3 py-1 font-mono text-[11px] font-bold text-violet-300">
              {promoter.shortCode}
            </span>
            <span className="text-[10px] text-white/30">tracking code</span>
          </div>
        )}
      </div>

      {/* Expand toggle */}
      <button
        onClick={toggleExpand}
        className="flex w-full items-center justify-between border-t border-white/5 px-5 py-3 text-[11px] font-semibold text-white/50 transition-colors hover:bg-white/[0.02] hover:text-white/70"
      >
        <span>Guest List {guestsFetched ? `(${guests.length})` : ''}</span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {/* Guest list */}
      {expanded && (
        <div className="border-t border-white/5 bg-white/[0.01] px-5 pb-4">
          {guestsLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-white/40">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading guests…
            </div>
          ) : guests.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/30">No guests attributed yet</p>
          ) : (
            <div>
              {guests.map((g) => (
                <GuestMiniRow key={g.id} guest={g} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function EventTeamTab({
  eventId,
  promoters,
  summary,
  isLoading,
  onSave,
}: EventTeamTabProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Simple authed fetch — uses the cookie/session already in place
  const authedFetch = async (url: string) => {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  const handleRemove = async (promoterId: string) => {
    if (saving) return;
    setRemovingId(promoterId);
    setSaving(true);
    try {
      const currentIds = promoters
        .filter((p) => p.isSelected && p.promoterId !== promoterId)
        .map((p) => p.promoterId!)
        .filter(Boolean);
      await onSave({ enabled: currentIds.length > 0, allowedPromoterIds: currentIds });
    } finally {
      setRemovingId(null);
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!selectedToAdd || adding) return;
    setAdding(true);
    try {
      const currentIds = promoters
        .filter((p) => p.isSelected && p.promoterId)
        .map((p) => p.promoterId!);
      const nextIds = [...new Set([...currentIds, selectedToAdd])];
      await onSave({ enabled: true, allowedPromoterIds: nextIds });
      setAddModalOpen(false);
      setSelectedToAdd(null);
    } finally {
      setAdding(false);
    }
  };

  // Promoters not yet enabled — available to add
  const availableToAdd = promoters.filter((p) => !p.isSelected && p.promoterId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 py-20 text-sm text-white/40">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading team…
      </div>
    );
  }

  const activePromoters = promoters.filter((p) => p.isSelected);
  const totalTickets = summary?.ticketsSold ?? promoters.reduce((s, p) => s + (p.sales || 0), 0);
  const totalRevenue = summary?.revenue ?? promoters.reduce((s, p) => s + (p.revenue || 0), 0);
  const totalClicks = summary?.clicks ?? promoters.reduce((s, p) => s + (p.clicks || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-end justify-between border-b border-white/5 pb-6">
        <div>
          <h2 className="text-[26px] font-bold tracking-tight text-white">Event Team</h2>
          <p className="mt-1 text-sm text-white/40">
            {activePromoters.length} active promoter{activePromoters.length !== 1 ? 's' : ''} ·
            click a card to view guest list
          </p>
        </div>
        {availableToAdd.length > 0 && (
          <button
            onClick={() => {
              setAddModalOpen(true);
              setSelectedToAdd(null);
            }}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all"
            style={{
              background: 'rgba(139,92,246,0.12)',
              color: '#a78bfa',
              border: '1px solid rgba(139,92,246,0.20)',
            }}
          >
            <UserPlus className="h-4 w-4" />
            Add Promoter
          </button>
        )}
      </div>

      {/* Summary strip */}
      <div className="flex flex-wrap gap-3">
        <StatPill
          icon={Users}
          label="Total Promoters"
          value={String(promoters.length)}
          accent="#a78bfa"
        />
        <StatPill
          icon={Shield}
          label="Active"
          value={String(activePromoters.length)}
          accent="#34d399"
        />
        <StatPill
          icon={Ticket}
          label="Tickets Sold"
          value={formatNumber(totalTickets)}
          accent="#fbbf24"
        />
        <StatPill
          icon={IndianRupee}
          label="Revenue"
          value={formatINRCompact(totalRevenue)}
          accent="#60a5fa"
        />
        <StatPill
          icon={MousePointerClick}
          label="Total Clicks"
          value={formatNumber(totalClicks)}
          accent="#f472b6"
        />
        <StatPill
          icon={TrendingUp}
          label="Avg. Conv."
          value={conversionPct(totalTickets, totalClicks)}
          accent="#fb923c"
        />
      </div>

      {/* Promoter cards grid */}
      {promoters.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-[24px] border border-white/5 bg-white/[0.02] py-16">
          <UserPlus className="h-8 w-8 text-white/20" />
          <div className="text-center">
            <p className="font-semibold text-white/50">No promoters yet</p>
            <p className="mt-1 text-sm text-white/30">
              Go to Settings → Promoters to assign promoters to this event
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {promoters.map((p) => (
            <PromoterCard
              key={p.assignmentId || p.id}
              promoter={p}
              eventId={eventId}
              authedFetch={authedFetch}
              onRemove={handleRemove}
              isRemoving={removingId === p.promoterId}
            />
          ))}
        </div>
      )}

      {/* ── Add Promoter Modal ── */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setAddModalOpen(false)}
          />
          <div
            className="relative w-full max-w-sm rounded-[24px] border border-white/10 p-6 shadow-2xl"
            style={{ background: '#0e0e12' }}
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Add Promoter</h3>
                <p className="mt-0.5 text-xs text-white/40">
                  Select a connected promoter to add to this event
                </p>
              </div>
              <button
                onClick={() => setAddModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {availableToAdd.length === 0 ? (
              <p className="py-6 text-center text-sm text-white/40">
                All connected promoters are already active on this event
              </p>
            ) : (
              <div className="mb-5 max-h-60 overflow-y-auto space-y-2 pr-1">
                {availableToAdd.map((p) => {
                  const pid = p.promoterId!;
                  const isChosen = selectedToAdd === pid;
                  return (
                    <button
                      key={pid}
                      onClick={() => setSelectedToAdd(isChosen ? null : pid)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all',
                        isChosen
                          ? 'border-violet-500/40 bg-violet-500/10'
                          : 'border-white/8 bg-white/[0.02] hover:bg-white/[0.05]',
                      )}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.07]">
                        {p.avatar ? (
                          <img
                            src={p.avatar}
                            alt={p.promoterName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-bold text-white/60">
                            {initials(p.promoterName)}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">
                          {p.promoterName}
                        </p>
                        <p className="text-xs text-white/40">{p.commissionRate}% commission</p>
                      </div>
                      {isChosen && <Check className="h-4 w-4 shrink-0 text-violet-400" />}
                    </button>
                  );
                })}
              </div>
            )}

            {availableToAdd.length > 0 && (
              <button
                onClick={handleAdd}
                disabled={!selectedToAdd || adding}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background: 'rgba(139,92,246,0.15)',
                  color: '#a78bfa',
                  border: '1px solid rgba(139,92,246,0.25)',
                }}
              >
                {adding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Adding…
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Add to Event
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
