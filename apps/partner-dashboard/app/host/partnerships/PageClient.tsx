'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Building2,
  Users,
  Search,
  MapPin,
  Send,
  CheckCircle2,
  Clock,
  XCircle,
  Handshake,
  CalendarDays,
  TrendingUp,
  Compass,
  Plus,
  Loader2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { VenuePageShell, VenueActionButton } from '@/components/venue-layout/VenuePageShell';
import { VenueCalendarPreview } from '@/components/host/VenueCalendarPreview';
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

type NetworkTab = 'venues' | 'promoters' | 'requests';

interface VenuePartner {
  id: string;
  name: string;
  city: string;
  capacity?: number;
  style?: string;
  coverImage?: string;
  partnershipStatus: 'active' | 'pending' | 'rejected' | 'none';
  eventsHosted?: number;
}

interface PromoterPartner {
  id: string;
  displayName: string;
  handle?: string;
  photoURL?: string;
  cities?: string[];
  partnershipStatus: 'active' | 'pending' | 'none';
  totalGuestsBrought?: number;
  conversionRate?: number;
  eventsSupported?: number;
}

interface PartnershipRequest {
  id: string;
  type: 'venue' | 'promoter';
  direction: 'incoming' | 'outgoing';
  partnerName: string;
  partnerCity?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusConfig: Record<
  string,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  active: { label: 'Active', color: 'var(--v-success)', icon: CheckCircle2 },
  pending: { label: 'Pending', color: 'var(--v-warning)', icon: Clock },
  rejected: { label: 'Rejected', color: 'var(--v-error)', icon: XCircle },
  none: { label: 'Connect', color: 'var(--v-orange)', icon: Plus },
};

// ─── Venue card ───────────────────────────────────────────────────────────────

function VenueCard({
  venue,
  onRequest,
  onSelectSlot,
}: {
  venue: VenuePartner;
  onRequest: (id: string) => void;
  onSelectSlot: (venue: { id: string; name: string }) => void;
}) {
  const cfg = statusConfig[venue.partnershipStatus] || statusConfig.none;
  const StatusIcon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative rounded-[32px] bg-[var(--v-card)] border border-[var(--v-border)] hover:bg-[var(--v-elevated)] transition-all overflow-hidden"
    >
      <div className="h-40 bg-surface-tertiary relative overflow-hidden">
        {venue.coverImage ? (
          <img
            src={venue.coverImage}
            alt=""
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Building2 className="w-12 h-12 text-text-tertiary" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div
          className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12px] font-black uppercase tracking-widest border border-white/10 backdrop-blur-md"
          style={{ color: cfg.color, background: 'rgba(0,0,0,0.4)' }}
        >
          <StatusIcon className="w-3.5 h-3.5" />
          {cfg.label}
        </div>
      </div>

      <div className="p-7">
        <h3 className="text-[18px] font-black text-text-primary tracking-tight truncate">
          {venue.name}
        </h3>
        <div className="flex items-center gap-2 text-[14px] text-[var(--v-text-tertiary)] font-bold mt-2 mb-6">
          <MapPin className="w-4 h-4 shrink-0" />
          <span>{venue.city}</span>
          {venue.style && (
            <>
              <span className="opacity-30">·</span>
              <span>{venue.style}</span>
            </>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {venue.eventsHosted !== undefined && venue.eventsHosted > 0 && (
            <div className="flex items-center gap-2.5 text-[12px] text-[var(--v-text-muted)] font-black uppercase tracking-widest">
              <CalendarDays className="w-4 h-4" />
              {venue.eventsHosted} Production Windows
            </div>
          )}

          <div className="flex items-center gap-3">
            {venue.partnershipStatus === 'active' ? (
              <button
                onClick={() => onSelectSlot({ id: venue.id, name: venue.name })}
                className="flex-1 flex items-center justify-center gap-2.5 h-11 rounded-2xl text-[12px] font-black uppercase tracking-widest bg-[var(--v-orange)]/10 hover:bg-[var(--v-orange)] text-[var(--v-orange)] hover:text-white border border-[var(--v-orange)]/20 transition-all active:scale-95"
              >
                <CalendarDays className="w-4 h-4" /> Request Slot
              </button>
            ) : venue.partnershipStatus === 'pending' ? (
              <div className="flex-1 flex items-center justify-center gap-2.5 h-11 rounded-2xl text-[12px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-500/40 border border-amber-500/10 cursor-not-allowed">
                <Clock className="w-4 h-4" /> Status Pending
              </div>
            ) : venue.partnershipStatus === 'none' ? (
              <button
                onClick={() => onRequest(venue.id)}
                className="flex-1 flex items-center justify-center gap-2.5 h-11 rounded-2xl text-[12px] font-black uppercase tracking-widest bg-[var(--v-orange)]/10 hover:bg-[var(--v-orange)] text-[var(--v-orange)] hover:text-white border border-[var(--v-orange)]/20 transition-all active:scale-95"
              >
                <Send className="w-4 h-4" /> Request Access
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Promoter card ─────────────────────────────────────────────────────────────

function PromoterCard({
  promoter,
  onInvite,
}: {
  promoter: PromoterPartner;
  onInvite: (id: string) => void;
}) {
  const cfg = statusConfig[promoter.partnershipStatus] || statusConfig.none;
  const initials = promoter.displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="group rounded-[32px] bg-[var(--v-card)] border border-[var(--v-border)] hover:bg-[var(--v-elevated)] transition-all p-8"
    >
      <div className="flex items-center gap-5 mb-8">
        <div className="w-16 h-16 rounded-2xl bg-surface-tertiary flex items-center justify-center text-text-primary font-black text-[20px] shrink-0 overflow-hidden border border-border-subtle relative">
          {promoter.photoURL ? (
            <img src={promoter.photoURL} alt="" className="w-full h-full object-cover" />
          ) : (
            initials
          )}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[17px] font-black text-text-primary truncate tracking-tight">
            {promoter.displayName}
          </h3>
          {promoter.handle && (
            <p className="text-[13px] text-[var(--v-text-tertiary)] font-bold">
              @{promoter.handle}
            </p>
          )}
        </div>
        <div
          className="px-3 py-1.5 rounded-xl text-[12px] font-black uppercase tracking-widest border shrink-0"
          style={{ color: cfg.color, borderColor: `${cfg.color}20`, background: `${cfg.color}05` }}
        >
          {cfg.label}
        </div>
      </div>

      {promoter.partnershipStatus === 'active' && (
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="text-center p-4 rounded-2xl bg-surface-tertiary border border-border-subtle">
            <p className="text-[18px] font-black text-text-primary tabular-nums">
              {promoter.totalGuestsBrought ?? 0}
            </p>
            <p className="text-[12px] text-[var(--v-text-muted)] uppercase tracking-widest font-black mt-1">
              Guests
            </p>
          </div>
          <div className="text-center p-4 rounded-2xl bg-surface-tertiary border border-border-subtle">
            <p className="text-[18px] font-black text-text-primary tabular-nums">
              {promoter.conversionRate ? `${promoter.conversionRate.toFixed(0)}%` : '—'}
            </p>
            <p className="text-[12px] text-[var(--v-text-muted)] uppercase tracking-widest font-black mt-1">
              ROI
            </p>
          </div>
          <div className="text-center p-4 rounded-2xl bg-surface-tertiary border border-border-subtle">
            <p className="text-[18px] font-black text-text-primary tabular-nums">
              {promoter.eventsSupported ?? 0}
            </p>
            <p className="text-[12px] text-[var(--v-text-muted)] uppercase tracking-widest font-black mt-1">
              Windows
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        {promoter.partnershipStatus === 'active' ? (
          <Link href="/host/events" className="flex-1">
            <VenueActionButton variant="secondary" className="w-full h-11 text-[12px]">
              Assign To Production
            </VenueActionButton>
          </Link>
        ) : promoter.partnershipStatus === 'none' ? (
          <button
            onClick={() => onInvite(promoter.id)}
            className="flex-1 flex items-center justify-center gap-2.5 h-11 rounded-2xl text-[12px] font-black uppercase tracking-widest bg-[var(--v-orange)]/10 hover:bg-[var(--v-orange)] text-[var(--v-orange)] hover:text-white border border-[var(--v-orange)]/20 transition-all active:scale-95"
          >
            <Send className="w-4 h-4" /> Issue Invite
          </button>
        ) : (
          <div className="flex-1 flex items-center justify-center gap-2.5 h-11 rounded-2xl text-[12px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-500/40 border border-amber-500/10 cursor-not-allowed">
            <Clock className="w-4 h-4" /> Invite Sent
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Request row ──────────────────────────────────────────────────────────────

function RequestRow({ req }: { req: PartnershipRequest }) {
  const statusStyle: Record<string, { color: string; label: string }> = {
    pending: { color: 'var(--v-warning)', label: 'Pending' },
    approved: { color: 'var(--v-success)', label: 'Approved' },
    rejected: { color: 'var(--v-error)', label: 'Rejected' },
  };
  const s = statusStyle[req.status] || statusStyle.pending;
  const date = new Date(req.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <div className="flex items-center gap-6 px-7 py-5 rounded-[24px] bg-[var(--v-card)] border border-[var(--v-border)] hover:bg-[var(--v-elevated)] transition-all">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-border-subtle"
        style={{ background: `${s.color}08` }}
      >
        {req.type === 'venue' ? (
          <Building2 className="w-6 h-6" style={{ color: s.color }} />
        ) : (
          <Users className="w-6 h-6" style={{ color: s.color }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[16px] font-black text-text-primary truncate tracking-tight">
          {req.partnerName}
        </p>
        <div className="flex items-center gap-3 text-[13px] text-[var(--v-text-tertiary)] font-bold mt-1">
          <span className="capitalize">{req.type}</span>
          <span className="opacity-20">·</span>
          <span>{req.direction === 'outgoing' ? 'Outgoing' : 'Incoming'}</span>
          <span className="opacity-20">·</span>
          <span>{date}</span>
        </div>
      </div>
      <span
        className="shrink-0 px-4 py-1.5 rounded-xl text-[12px] font-black uppercase tracking-widest border"
        style={{ color: s.color, borderColor: `${s.color}20`, background: `${s.color}05` }}
      >
        {s.label}
      </span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function HostPartnershipsPage() {
  const router = useRouter();
  const { profile, getIdToken } = useDashboardAuth();
  const hostId = profile?.activeMembership?.partnerId;

  const [tab, setTab] = useState<NetworkTab>('venues');
  const [search, setSearch] = useState('');
  const [venues, setVenues] = useState<VenuePartner[]>([]);
  const [promoters, setPromoters] = useState<PromoterPartner[]>([]);
  const [requests, setRequests] = useState<PartnershipRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<{ id: string; name: string } | null>(null);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!hostId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const token = typeof getIdToken === 'function' ? await getIdToken() : '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [partnershipRes, promoterNetworkRes, promoterReqRes] = await Promise.allSettled([
        fetch(`/api/partners/hosts/partnerships?hostId=${hostId}`, { headers }),
        fetch(`/api/discovery?action=list&partnerId=${hostId}&role=host`, { headers }),
        fetch(`/api/partners/hosts/promoter-requests?hostId=${hostId}`, { headers }),
      ]);

      if (partnershipRes.status === 'fulfilled' && partnershipRes.value.ok) {
        const d = await partnershipRes.value.json();
        const allPartners = d.partnerships || d.partners || [];
        const venuePartners = allPartners.filter((p: any) => {
          const status = p.status || p.partnershipStatus || 'pending';
          return (
            Boolean(p.venueId || p.id) &&
            (p.type === 'venue' || !p.type) &&
            ['active', 'pending', 'rejected'].includes(status)
          );
        });
        const reqList: PartnershipRequest[] = allPartners.map((p: any) => ({
          id: p.id,
          type: 'venue' as const,
          direction: p.initiatedBy === 'venue' ? 'incoming' : 'outgoing',
          partnerName: p.name || p.venueName || 'Venue',
          partnerCity: p.city,
          status: ((p.status || p.partnershipStatus || 'pending') === 'active'
            ? 'approved'
            : p.status || p.partnershipStatus || 'pending') as any,
          createdAt: p.requestedAt || p.createdAt || new Date().toISOString(),
        }));
        setVenues(
          venuePartners.map((p: any) => ({
            id: p.venueId || p.id,
            name: p.name || p.venueName || 'Venue',
            city: p.city || '',
            capacity: p.capacity,
            style: p.style,
            coverImage: p.coverImage || p.coverURL,
            partnershipStatus:
              (p.status || p.partnershipStatus || 'none') === 'approved'
                ? 'active'
                : p.status || p.partnershipStatus || 'none',
            eventsHosted: p.eventsHosted,
          })),
        );
        setRequests((prev) => {
          const existingIds = new Set(prev.map((r) => r.id));
          const newItems = reqList.filter((r) => !existingIds.has(r.id));
          return [...reqList, ...prev.filter((r) => !reqList.find((n) => n.id === r.id))];
        });
      }

      if (promoterNetworkRes.status === 'fulfilled' && promoterNetworkRes.value.ok) {
        const d = await promoterNetworkRes.value.json();
        const promoterConnections = (d.connections || []).filter(
          (c: any) => c.type === 'promoter_connection',
        );
        setPromoters(
          promoterConnections.map((c: any) => ({
            id: c.otherId || c.promoterId || c.id,
            displayName: c.otherName || c.promoterName || 'Promoter',
            handle: c.promoterInstagram || c.instagram || undefined,
            photoURL: c.otherAvatar || undefined,
            cities: c.otherCity ? [c.otherCity] : [],
            partnershipStatus:
              c.status === 'approved' || c.status === 'active'
                ? 'active'
                : c.status === 'pending'
                  ? 'pending'
                  : 'none',
            totalGuestsBrought: c.totalGuestsBrought || 0,
            conversionRate: c.conversionRate || 0,
            eventsSupported: c.eventsSupported || 0,
          })),
        );
      } else {
        setPromoters([]);
      }

      if (promoterReqRes.status === 'fulfilled' && promoterReqRes.value.ok) {
        const d = await promoterReqRes.value.json();
        const promoterRequests: PartnershipRequest[] = (d.requests || []).map((r: any) => ({
          id: r.id,
          type: 'promoter' as const,
          direction: 'incoming' as const,
          partnerName: r.promoterName || r.name || 'Promoter',
          status: (r.status || 'pending') as any,
          createdAt: r.createdAt || new Date().toISOString(),
        }));
        setRequests((prev) => {
          const venueReqs = prev.filter((r) => r.type === 'venue');
          return [...venueReqs, ...promoterRequests];
        });
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [hostId, getIdToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleVenueRequest = async (venueId: string) => {
    try {
      const token = typeof getIdToken === 'function' ? await getIdToken() : '';
      await fetch('/api/partners/hosts/partnerships/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ hostId, venueId }),
      });
      fetchData();
    } catch {
      /* */
    }
  };

  const handlePromoterInvite = async (promoterId: string) => {
    try {
      const token = typeof getIdToken === 'function' ? await getIdToken() : '';
      const promoter = promoters.find((entry) => entry.id === promoterId);
      if (!promoter) return;
      await fetch('/api/discovery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          requesterId: hostId,
          requesterType: 'host',
          requesterName: profile?.displayName || profile?.activeMembership?.partnerName || 'Host',
          targetId: promoterId,
          targetType: 'promoter',
          targetName: promoter.displayName,
        }),
      });
      fetchData();
    } catch {
      /* */
    }
  };

  const handlePartnershipAction = async (partnershipId: string, action: 'approve' | 'reject') => {
    setProcessingRequest(partnershipId);
    try {
      const token = typeof getIdToken === 'function' ? await getIdToken() : '';
      await fetch('/api/partners/hosts/partnerships', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ partnershipId, action }),
      });
      fetchData();
    } catch {
      /* */
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleSelectSlot = (
    date: string,
    startTime: string,
    endTime: string,
    doorsOpen: string,
    lastEntry: string,
  ) => {
    if (!selectedVenue) return;
    const params = new URLSearchParams({
      venue: selectedVenue.id,
      venueName: selectedVenue.name,
      date,
      startTime,
      endTime,
      doorsOpen,
      lastEntry,
    });
    router.push(`/host/create?${params.toString()}`);
  };

  const filteredVenues = venues.filter(
    (v) =>
      !search ||
      (v.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (v.city ?? '').toLowerCase().includes(search.toLowerCase()),
  );
  const filteredPromoters = promoters.filter(
    (p) => !search || (p.displayName ?? '').toLowerCase().includes(search.toLowerCase()),
  );
  const pendingRequestCount = requests.filter((r) => r.status === 'pending').length;

  const tabs: { id: NetworkTab; label: string; count?: number }[] = [
    {
      id: 'venues',
      label: 'Infrastructure',
      count: venues.filter((v) => v.partnershipStatus === 'active').length,
    },
    {
      id: 'promoters',
      label: 'Promoter',
      count: promoters.filter((p) => p.partnershipStatus === 'active').length,
    },
    { id: 'requests', label: 'Audit Log', count: pendingRequestCount || undefined },
  ];

  return (
    <VenuePageShell
      title="Partnership Hub"
      subtitle="Coordinate with venues and distribution networks"
      actions={
        <Link href="/host/discover">
          <VenueActionButton variant="primary">
            <Compass className="w-5 h-5 mr-2" />
            Explore Venues
          </VenueActionButton>
        </Link>
      }
    >
      <div className="space-y-10">
        {/* Stats strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Building2,
              label: 'Infrastructure',
              value: venues.filter((v) => v.partnershipStatus === 'active').length,
              color: 'var(--v-info)',
            },
            {
              icon: Users,
              label: 'Promoter',
              value: promoters.filter((p) => p.partnershipStatus === 'active').length,
              color: 'var(--v-orange)',
            },
            {
              icon: TrendingUp,
              label: 'Network Effect',
              value: promoters.reduce((acc, p) => acc + (p.totalGuestsBrought ?? 0), 0),
              color: 'var(--v-success)',
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="flex items-center gap-5 p-8 rounded-[32px] bg-[var(--v-card)] border border-[var(--v-border)]"
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center border border-border-subtle shadow-xl"
                  style={{ background: `${stat.color}10` }}
                >
                  <Icon className="w-7 h-7" style={{ color: stat.color }} />
                </div>
                <div>
                  <p className="text-3xl font-black text-text-primary tabular-nums tracking-tight">
                    {stat.value.toLocaleString()}
                  </p>
                  <p className="text-[13px] text-[var(--v-text-tertiary)] font-black uppercase tracking-[0.1em]">
                    {stat.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tab bar + search */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
          <div className="flex p-2 bg-[var(--v-card)] border border-[var(--v-border)] rounded-[24px] w-fit gap-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-7 py-3 rounded-[16px] text-[13px] font-black uppercase tracking-wider transition-all flex items-center gap-3 ${tab === t.id ? 'bg-[var(--v-elevated)] text-text-primary shadow-lg' : 'text-[var(--v-text-tertiary)] hover:text-text-primary'}`}
              >
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-md text-[12px] font-black tabular-nums ${tab === t.id ? 'bg-surface-elevated text-text-primary' : 'bg-surface-tertiary text-text-tertiary'}`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
          {tab !== 'requests' && (
            <div className="relative group w-full xl:w-96">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--v-text-muted)] group-focus-within:text-[var(--v-orange)] transition-colors" />
              <input
                type="text"
                placeholder={tab === 'venues' ? 'Locate venues...' : 'Locate promoters...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[var(--v-card)] border border-[var(--v-border)] rounded-[24px] pl-14 pr-6 py-4 text-[15px] text-text-primary placeholder:text-[var(--v-text-muted)] focus:outline-none focus:border-[var(--v-orange)]/50 transition-all font-bold tracking-tight shadow-sm"
              />
            </div>
          )}
        </div>

        {/* Tab content */}
        {error && (
          <div className="flex flex-col items-center justify-center py-16 rounded-[40px] border border-red-500/20 bg-red-500/5 gap-4 text-center">
            <Handshake className="w-10 h-10 text-red-400" />
            <div>
              <p className="text-[16px] font-black text-text-primary">
                Failed to load partnerships
              </p>
              <p className="text-[13px] text-[var(--v-text-tertiary)] mt-2">
                Could not fetch your partnership data. Check your connection.
              </p>
            </div>
            <button
              onClick={fetchData}
              className="h-11 px-8 rounded-2xl bg-surface-tertiary border border-border-subtle text-text-primary text-[13px] font-black uppercase tracking-widest hover:bg-surface-elevated transition-all"
            >
              Retry
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {tab === 'venues' && (
            <motion.div
              key="venues"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
            >
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      className="h-72 rounded-[40px] animate-pulse bg-[var(--v-card)] border border-[var(--v-border)]"
                    />
                  ))}
                </div>
              ) : filteredVenues.length === 0 ? (
                <div className="py-32 rounded-[56px] bg-[var(--v-card)] border border-dashed border-[var(--v-border)] flex flex-col items-center text-center px-12">
                  <div className="w-20 h-20 rounded-full bg-surface-tertiary flex items-center justify-center mb-8">
                    <Building2 className="w-10 h-10 text-text-tertiary" />
                  </div>
                  <h3 className="text-2xl font-black text-text-primary">
                    No infrastructure connections
                  </h3>
                  <p className="text-[15px] text-[var(--v-text-tertiary)] mt-3 mb-10 max-w-sm leading-relaxed">
                    Discover venues across the network and request production access to their
                    calendar.
                  </p>
                  <Link href="/host/discover">
                    <VenueActionButton variant="primary" className="h-12 px-8">
                      Explore Venues
                    </VenueActionButton>
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {filteredVenues.map((v) => (
                    <VenueCard
                      key={v.id}
                      venue={v}
                      onRequest={handleVenueRequest}
                      onSelectSlot={setSelectedVenue}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {tab === 'promoters' && (
            <motion.div
              key="promoters"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-64 rounded-[40px] animate-pulse bg-[var(--v-card)] border border-[var(--v-border)]"
                    />
                  ))}
                </div>
              ) : filteredPromoters.length === 0 ? (
                <div className="py-32 rounded-[56px] bg-[var(--v-card)] border border-dashed border-[var(--v-border)] flex flex-col items-center text-center px-12">
                  <div className="w-20 h-20 rounded-full bg-surface-tertiary flex items-center justify-center mb-8">
                    <Users className="w-10 h-10 text-text-tertiary" />
                  </div>
                  <h3 className="text-2xl font-black text-text-primary">No distribution network</h3>
                  <p className="text-[15px] text-[var(--v-text-tertiary)] mt-3 mb-10 max-w-sm leading-relaxed">
                    Invite promoters to amplify your productions and drive verified attendance.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {filteredPromoters.map((p) => (
                    <PromoterCard key={p.id} promoter={p} onInvite={handlePromoterInvite} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {tab === 'requests' && (
            <motion.div
              key="requests"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-24 rounded-[32px] animate-pulse bg-[var(--v-card)] border border-[var(--v-border)]"
                    />
                  ))}
                </div>
              ) : requests.length === 0 ? (
                <div className="py-32 rounded-[56px] bg-[var(--v-card)] border border-dashed border-[var(--v-border)] flex flex-col items-center text-center px-12">
                  <div className="w-20 h-20 rounded-full bg-surface-tertiary flex items-center justify-center mb-8">
                    <Handshake className="w-10 h-10 text-text-tertiary" />
                  </div>
                  <h3 className="text-2xl font-black text-text-primary">Audit log empty</h3>
                  <p className="text-[15px] text-[var(--v-text-tertiary)] mt-3">
                    Active partnership audits will appear here for verification.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Incoming pending requests from venues — host must approve/reject */}
                  {requests.filter((r) => r.status === 'pending' && r.direction === 'incoming')
                    .length > 0 && (
                    <>
                      <p className="text-[12px] font-black uppercase tracking-[0.2em] text-[var(--v-text-muted)] border-l-4 border-l-[var(--v-warning)] pl-4">
                        Incoming Requests
                      </p>
                      <div className="space-y-4">
                        {requests
                          .filter((r) => r.status === 'pending' && r.direction === 'incoming')
                          .map((r) => (
                            <div
                              key={r.id}
                              className="flex items-center gap-6 px-7 py-5 rounded-[24px] bg-[var(--v-card)] border border-[var(--v-border)] hover:bg-[var(--v-elevated)] transition-all"
                            >
                              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-border-subtle bg-amber-500/08">
                                {r.type === 'venue' ? (
                                  <Building2 className="w-6 h-6 text-amber-400" />
                                ) : (
                                  <Users className="w-6 h-6 text-amber-400" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[16px] font-black text-text-primary truncate tracking-tight">
                                  {r.partnerName}
                                </p>
                                <div className="flex items-center gap-3 text-[13px] text-[var(--v-text-tertiary)] font-bold mt-1">
                                  <span className="capitalize">{r.type}</span>
                                  <span className="opacity-20">·</span>
                                  <span>
                                    {new Date(r.createdAt).toLocaleDateString('en-IN', {
                                      day: 'numeric',
                                      month: 'short',
                                    })}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <button
                                  onClick={() => handlePartnershipAction(r.id, 'approve')}
                                  disabled={!!processingRequest}
                                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-400 hover:to-rose-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-orange-500/20 transition-all active:scale-95 disabled:opacity-50"
                                >
                                  {processingRequest === r.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    'Approve'
                                  )}
                                </button>
                                <button
                                  onClick={() => handlePartnershipAction(r.id, 'reject')}
                                  disabled={!!processingRequest}
                                  className="h-10 w-10 rounded-xl bg-surface-tertiary border border-border-subtle text-text-tertiary flex items-center justify-center hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all active:scale-95 disabled:opacity-50"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </>
                  )}
                  {/* Outgoing pending requests — host sent these, awaiting venue approval */}
                  {requests.filter((r) => r.status === 'pending' && r.direction === 'outgoing')
                    .length > 0 && (
                    <>
                      <p className="text-[12px] font-black uppercase tracking-[0.2em] text-[var(--v-text-muted)] border-l-4 border-l-[var(--v-warning)] pl-4">
                        In Review
                      </p>
                      {requests
                        .filter((r) => r.status === 'pending' && r.direction === 'outgoing')
                        .map((r) => (
                          <RequestRow key={r.id} req={r} />
                        ))}
                    </>
                  )}
                  {requests.filter((r) => r.status !== 'pending').length > 0 && (
                    <>
                      <p className="text-[12px] font-black uppercase tracking-[0.2em] text-[var(--v-text-muted)] border-l-4 border-l-[var(--v-border)] pl-4 mt-12">
                        Audit History
                      </p>
                      {requests
                        .filter((r) => r.status !== 'pending')
                        .map((r) => (
                          <RequestRow key={r.id} req={r} />
                        ))}
                    </>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Venue Calendar Preview Modal */}
      <AnimatePresence>
        {selectedVenue && (
          <VenueCalendarPreview
            venueId={selectedVenue.id}
            venueName={selectedVenue.name}
            hostId={hostId || ''}
            onSelectSlot={handleSelectSlot}
            onClose={() => setSelectedVenue(null)}
          />
        )}
      </AnimatePresence>
    </VenuePageShell>
  );
}
