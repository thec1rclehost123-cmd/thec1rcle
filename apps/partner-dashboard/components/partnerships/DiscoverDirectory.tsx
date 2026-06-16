'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  Users,
  XCircle,
  Loader2,
  Bell,
  X,
  RotateCcw,
  Trash2,
  MapPin,
  ShieldCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Building2,
  UserCircle,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { BasePartnerCard } from '@/components/partnerships/BasePartnerCard';
import { useRouter } from 'next/navigation';

type PartnerFilterType = 'host' | 'venue' | 'promoter' | 'all';

export interface DiscoveredPartner {
  id: string;
  type: 'host' | 'venue' | 'promoter';
  name: string;
  avatar?: string | null;
  city: string;
  bio: string;
  tags: string[];
  eventsCount: number;
  followersCount: number;
  isVerified: boolean;
  connectionStatus: 'pending' | 'approved' | 'rejected' | 'blocked' | 'active' | null;
  capacity?: number;
  operatingHours?: string;
  soundSystem?: string;
  musicPolicy?: string;
  avgCrowdSize?: number;
  audienceDemographic?: string;
  noShowRate?: number;
  instagram?: string;
  phone?: string;
  photoURL?: string | null;
  coverURL?: string | null;
  hostsConnected?: number;
  promotersConnected?: number;
  ticketsSold?: number;
}

interface DiscoverDirectoryProps {
  allowedTypes: PartnerFilterType[];
  partnerId: string | undefined;
  role: string;
  // Controlled mode: when passed, hides the internal search bar
  searchQuery?: string;
  filterType?: PartnerFilterType;
  filterCity?: string;
  refreshTrigger?: number;
  onOpenProfile?: (partner: DiscoveredPartner) => void;
}

export function DiscoverDirectory({
  allowedTypes,
  partnerId,
  role,
  searchQuery: ctrlSearch,
  filterType: ctrlType,
  filterCity: ctrlCity,
  refreshTrigger,
  onOpenProfile,
}: DiscoverDirectoryProps) {
  const { profile, user } = useDashboardAuth();
  const router = useRouter();
  const [partners, setPartners] = useState<DiscoveredPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isControlled = ctrlSearch !== undefined;
  const [searchQuery, setSearchQuery] = useState('');

  // Internal debounce hook
  const useDebounce = <T,>(value: T, delay: number): T => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
      const handler = setTimeout(() => setDebouncedValue(value), delay);
      return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
  };

  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  const [filterType, setFilterType] = useState<PartnerFilterType>(
    allowedTypes.includes('all') || allowedTypes.length > 1 ? 'all' : allowedTypes[0],
  );
  const [filterCity, setFilterCity] = useState('');
  const [requestingId, setRequestingId] = useState<string | null>(null);

  const effectiveSearch = isControlled ? (ctrlSearch ?? '') : debouncedSearchQuery;
  const effectiveType = isControlled ? (ctrlType ?? filterType) : filterType;
  const effectiveCity = isControlled ? (ctrlCity ?? '') : filterCity;

  const fetchPartners = useCallback(async () => {
    if (!partnerId || !user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams({
        partnerId,
        role,
        action: 'discover',
        limit: '30',
      });
      if (effectiveType !== 'all') params.set('type', effectiveType);
      if (effectiveCity) params.set('city', effectiveCity);
      if (effectiveSearch) params.set('search', effectiveSearch);

      const res = await fetch(`/api/discovery?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Discovery failed: ${res.statusText}`);
      const data = await res.json();
      setPartners(data.partners || []);
    } catch (err: any) {
      console.error('DiscoverDirectory fetch error:', err);
      setError(err.message || 'Failed to load discovery directory');
    } finally {
      setLoading(false);
    }
  }, [partnerId, role, user, effectiveType, effectiveCity, effectiveSearch]);

  useEffect(() => {
    if (partnerId) fetchPartners();
  }, [partnerId, fetchPartners, refreshTrigger]);

  const handleRequestPartnership = async (targetId: string) => {
    if (!partnerId || !user) return;
    setRequestingId(targetId);
    try {
      const token = await user.getIdToken();
      const target = partners.find((p) => p.id === targetId);
      const res = await fetch('/api/discovery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requesterId: partnerId,
          requesterType: role,
          requesterName: profile?.activeMembership?.partnerName || profile?.displayName,
          requesterEmail: profile?.email,
          targetId,
          targetType: target?.type,
          targetName: target?.name,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error('Discovery POST failed:', res.status, text);
        throw new Error('Failed: ' + text);
      }
      await fetchPartners();
    } catch (err) {
      console.error(err);
      alert('Failed to send partnership request. Please try again.');
    } finally {
      setRequestingId(null);
    }
  };

  const openProfile = (partner: DiscoveredPartner) => {
    if (onOpenProfile) {
      onOpenProfile(partner);
      return;
    }
    const basePath =
      role === 'host'
        ? '/host/partners'
        : role === 'promoter'
          ? '/promoter/partners'
          : '/venue/partners';
    router.push(`${basePath}/${partner.id}`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Search bar — hidden when controlled externally via tab bar */}
      {!isControlled && (
        <div className="flex flex-col md:flex-row gap-3 p-3 bg-surface-elevated/80 backdrop-blur-xl border border-border-default rounded-[2rem] shadow-sm">
          <div className="flex-1 relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-text-tertiary group-focus-within:text-text-primary transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, city, genre..."
              className="h-14 w-full rounded-full bg-[#06090a] border-none pl-14 pr-4 text-[18px] font-medium text-text-primary placeholder:text-text-placeholder focus:outline-none"
            />
          </div>
          <div className="flex shrink-0 gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as PartnerFilterType)}
              className="h-14 rounded-[20px] border border-border-default bg-transparent px-5 pr-10 text-[16px] font-semibold text-text-secondary transition-colors hover:bg-white/[0.03] focus:outline-none cursor-pointer"
            >
              {allowedTypes.includes('all') && <option value="all">All Types</option>}
              {allowedTypes.includes('venue') && <option value="venue">Venues</option>}
              {allowedTypes.includes('host') && <option value="host">Hosts</option>}
              {allowedTypes.includes('promoter') && <option value="promoter">Promoters</option>}
            </select>
            <select
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              className="h-14 rounded-[20px] border border-border-default bg-transparent px-5 pr-10 text-[16px] font-semibold text-text-secondary transition-colors hover:bg-white/[0.03] focus:outline-none cursor-pointer"
            >
              <option value="">All Cities</option>
              <option value="Pune">Pune</option>
              <option value="Mumbai">Mumbai</option>
              <option value="Goa">Goa</option>
              <option value="Bengaluru">Bengaluru</option>
              <option value="Delhi">Delhi</option>
            </select>
            <button
              onClick={fetchPartners}
              className="inline-flex h-14 w-14 items-center justify-center rounded-[20px] border border-border-default bg-transparent text-text-tertiary transition-all hover:border-border-strong hover:bg-white/[0.03] hover:text-text-primary active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-72 bg-surface-secondary rounded-[2rem] animate-pulse border border-border-subtle"
            />
          ))}
        </div>
      ) : error ? (
        <div className="py-24 bg-surface-elevated rounded-[3rem] border border-dashed border-error/50 flex flex-col items-center text-center px-10">
          <div className="w-16 h-16 bg-error/10 rounded-2xl flex items-center justify-center mb-5">
            <XCircle className="w-8 h-8 text-error" />
          </div>
          <h4 className="text-title font-semibold text-text-primary">Discovery Unavailable</h4>
          <p className="text-body-sm text-text-tertiary mt-1 max-w-xs">{error}</p>
          <button
            onClick={() => fetchPartners()}
            className="mt-6 px-6 py-2 bg-surface-secondary hover:bg-surface-tertiary rounded-xl text-caption font-bold transition-all flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
        </div>
      ) : partners.length === 0 ? (
        <div className="py-24 bg-surface-elevated rounded-[3rem] border border-dashed border-border-default flex flex-col items-center text-center px-10">
          <div className="w-16 h-16 bg-surface-tertiary rounded-2xl flex items-center justify-center mb-5">
            <Users className="w-8 h-8 text-text-placeholder" />
          </div>
          <h4 className="text-title font-semibold text-text-primary">No results found</h4>
          <p className="text-body-sm text-text-tertiary mt-1 max-w-xs">
            Try adjusting your filters or search query.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {partners.map((partner) => (
              <BasePartnerCard
                key={partner.id}
                partner={partner as any}
                onViewProfile={() => openProfile(partner)}
                onPrimaryAction={() => handleRequestPartnership(partner.id)}
                isActionLoading={requestingId === partner.id}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// ── StatusCard — shared card for active / pending / incoming / declined tabs ──

export interface StatusCardData {
  name: string;
  type: 'host' | 'venue' | 'promoter';
  city?: string;
  photoURL?: string | null;
  coverURL?: string | null;
  isVerified?: boolean;
  bio?: string;
  eventsCount?: number;
  followersCount?: number;
  connectionStatus:
    | 'active'
    | 'approved'
    | 'pending'
    | 'incoming'
    | 'declined'
    | 'rejected'
    | 'blocked';
  onViewProfile?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onReRequest?: () => void;
  onRemove?: () => void;
  isProcessing?: boolean;
}

export function StatusCard({
  name,
  type,
  city,
  photoURL,
  coverURL,
  isVerified,
  bio,
  eventsCount,
  followersCount,
  connectionStatus,
  onViewProfile,
  onApprove,
  onReject,
  onReRequest,
  onRemove,
  isProcessing,
}: StatusCardData) {
  const typeIcon =
    type === 'venue' ? (
      <Building2 className="w-4 h-4" />
    ) : type === 'host' ? (
      <UserCircle className="w-4 h-4" />
    ) : (
      <Zap className="w-4 h-4" />
    );

  const statusBadge = () => {
    switch (connectionStatus) {
      case 'approved':
      case 'active':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20 text-[11px] font-black uppercase tracking-tight text-emerald-400">
            <CheckCircle2 className="w-3 h-3" /> ACTIVE
          </div>
        );
      case 'pending':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 rounded-full border border-amber-500/20 text-[11px] font-black uppercase tracking-tight text-amber-500">
            <Clock className="w-3 h-3" /> PENDING
          </div>
        );
      case 'incoming':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-[#F44A22]/10 rounded-full border border-[#F44A22]/20 text-[11px] font-black uppercase tracking-tight text-[#F44A22]">
            <Bell className="w-3 h-3" /> INCOMING
          </div>
        );
      case 'declined':
      case 'rejected':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 rounded-full border border-rose-500/20 text-[11px] font-black uppercase tracking-tight text-rose-400">
            <XCircle className="w-3 h-3" /> DECLINED
          </div>
        );
      default:
        return null;
    }
  };

  const actionArea = () => {
    if (connectionStatus === 'incoming') {
      return (
        <div className="flex gap-3">
          <button
            onClick={onApprove}
            disabled={isProcessing}
            className="flex-1 flex items-center justify-center gap-2 h-11 rounded-2xl text-[12px] font-black uppercase tracking-widest text-white transition-all active:scale-95 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #F44A22, #e03515)' }}
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" /> Approve
              </>
            )}
          </button>
          <button
            onClick={onReject}
            disabled={isProcessing}
            className="h-11 w-11 shrink-0 rounded-2xl border border-border-subtle text-text-tertiary flex items-center justify-center hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all active:scale-95 disabled:opacity-50"
            style={{ background: 'var(--v-elevated)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      );
    }
    if (connectionStatus === 'pending') {
      return (
        <div className="flex items-center justify-center gap-2 h-11 rounded-2xl text-[12px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-500/60 border border-amber-500/10 cursor-not-allowed">
          <Clock className="w-4 h-4" /> Awaiting Approval
        </div>
      );
    }
    if (connectionStatus === 'declined' || connectionStatus === 'rejected') {
      return (
        <div className="flex gap-3">
          {onReRequest && (
            <button
              onClick={onReRequest}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-2 h-11 rounded-2xl text-[12px] font-black uppercase tracking-widest border border-[#F44A22]/30 text-[#F44A22] hover:bg-[#F44A22] hover:text-white transition-all active:scale-95 disabled:opacity-50"
              style={{ background: 'rgba(244,74,34,0.08)' }}
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" /> Re-request
                </>
              )}
            </button>
          )}
          {onRemove && (
            <button
              onClick={onRemove}
              disabled={isProcessing}
              title="Remove"
              className={`${onReRequest ? 'h-11 w-11 shrink-0' : 'flex-1 h-11'} rounded-2xl border border-border-subtle text-text-tertiary flex items-center justify-center hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all active:scale-95 disabled:opacity-50`}
              style={{ background: 'var(--v-elevated)' }}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {!onReRequest && !onRemove && (
            <button
              onClick={onViewProfile}
              className="w-full flex items-center justify-center gap-2.5 h-11 rounded-2xl text-[13px] font-black uppercase tracking-widest bg-surface-secondary text-text-primary border border-border-subtle hover:bg-accent-primary hover:text-text-inverse hover:border-accent-primary transition-all duration-300 shadow-xl group/btn"
            >
              <span className="flex items-center justify-center gap-2 transition-transform group-hover/btn:translate-x-1">
                View Profile <Zap className="w-4 h-4 fill-current group-hover/btn:animate-pulse" />
              </span>
            </button>
          )}
        </div>
      );
    }
    return (
      <button
        onClick={onViewProfile}
        className="w-full flex items-center justify-center gap-2.5 h-11 rounded-2xl text-[13px] font-black uppercase tracking-widest bg-surface-secondary hover:bg-accent-primary hover:text-text-inverse hover:border-accent-primary hover:scale-[1.02] active:scale-[0.98] text-text-primary border border-border-subtle transition-all duration-300 shadow-xl group/btn"
      >
        <span className="flex items-center justify-center gap-2 transition-transform group-hover/btn:translate-x-1">
          View Profile <Zap className="w-4 h-4 fill-current group-hover/btn:animate-pulse" />
        </span>
      </button>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="group relative bg-surface-elevated border border-border-default rounded-[2rem] overflow-hidden hover:border-border-strong hover:shadow-sm transition-all duration-300 flex flex-col"
    >
      {coverURL && (
        <>
          <img
            src={coverURL}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-55 group-hover:opacity-70 transition-opacity duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1d] via-[#1a1a1d]/75 to-[#1a1a1d]/10" />
        </>
      )}
      <div className="relative z-10 h-1.5 bg-gradient-to-r from-accent-primary via-orange-600 to-transparent opacity-40 group-hover:opacity-100 transition-opacity" />
      <div className="relative z-10 p-7 flex-1 flex flex-col overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-accent-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

        <div className="flex items-start justify-between mb-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-surface-secondary to-surface-tertiary border border-border-subtle flex items-center justify-center text-2xl font-black text-text-primary shadow-xl group-hover:scale-105 transition-transform overflow-hidden">
              {photoURL ? (
                <img src={photoURL} alt={name} className="w-full h-full object-cover" />
              ) : (
                name[0]
              )}
            </div>
            <div>
              <h3 className="text-headline-sm font-black text-text-primary leading-none group-hover:text-accent-primary transition-colors">
                {name}
              </h3>
              <div className="flex items-center gap-1.5 mt-2 text-caption font-bold text-text-muted">
                <MapPin className="w-3 h-3 text-accent-primary" /> {city || 'India'}
              </div>
            </div>
          </div>
          {isVerified && (
            <ShieldCheck className="w-5 h-5 text-accent-primary shrink-0 transition-transform group-hover:rotate-12" />
          )}
        </div>

        <div className="flex items-center justify-between mb-6 relative z-10">
          <span className="flex items-center gap-2 px-3 py-1.5 bg-surface-secondary rounded-xl text-[10px] font-black uppercase tracking-widest text-text-secondary border border-border-subtle capitalize backdrop-blur-md">
            <span className="text-accent-primary">{typeIcon}</span> {type}
          </span>
          {statusBadge()}
        </div>

        {bio && (
          <p className="text-body-sm text-text-tertiary leading-relaxed line-clamp-2 mb-6 relative z-10 group-hover:text-text-secondary transition-colors">
            {bio}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 mb-8 mt-auto relative z-10">
          <div className="flex items-center gap-2.5 p-3 bg-surface-tertiary rounded-2xl border border-border-subtle group-hover:border-accent-primary/10 transition-colors">
            <CalendarDays className="w-4 h-4 text-accent-primary/60" />
            <div>
              <p className="text-[10px] font-black text-text-muted uppercase tracking-tighter">
                Events
              </p>
              <p className="text-body font-black text-text-primary leading-none">
                {eventsCount && eventsCount > 0 ? eventsCount : '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-3 bg-surface-tertiary rounded-2xl border border-border-subtle group-hover:border-accent-primary/10 transition-colors">
            <Users className="w-4 h-4 text-accent-primary/60" />
            <div>
              <p className="text-[10px] font-black text-text-muted uppercase tracking-tighter">
                Followers
              </p>
              <p className="text-body font-black text-text-primary leading-none">
                {followersCount && followersCount > 0
                  ? followersCount.toLocaleString('en-IN')
                  : '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10">{actionArea()}</div>
      </div>
    </motion.div>
  );
}
