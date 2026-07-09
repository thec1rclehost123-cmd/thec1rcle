'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Loader2,
  Building2,
  UserCircle,
  Handshake,
  Zap,
  Bell,
  X,
  RefreshCw,
  Compass,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { usePromoterPartnerships } from '@/lib/hooks/usePromoterQueries';
import { VenuePageShell, VenueActionButton } from '@/components/venue-layout/VenuePageShell';
import { DiscoverDirectory } from '@/components/partnerships/DiscoverDirectory';
import { BasePartnerCard } from '@/components/partnerships/BasePartnerCard';
import dynamic from 'next/dynamic';

const StatTrendCard = dynamic(
  () => import('@/components/promoter/PlaceholderCharts').then((m) => m.StatTrendCard),
  { ssr: false },
);
import { motion, AnimatePresence } from 'framer-motion';

type Tab = 'discover' | 'incoming' | 'pending' | 'active' | 'declined';

interface Partnership {
  id: string;
  otherId: string;
  otherName: string;
  otherType: 'host' | 'venue' | 'promoter';
  status: string;
  tier?: 'trusted' | 'standard';
  createdAt: any;
  updatedAt?: any;
  initiatedBy?: string;
  photoURL?: string | null;
  otherIsVerified?: boolean;
}

const mp = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as any, delay },
});

export default function PromoterPartnershipsPage() {
  const { profile, user } = useDashboardAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('discover');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [discoverSearch, setDiscoverSearch] = useState('');
  const [discoverType, setDiscoverType] = useState('venue');
  const [discoverCity, setDiscoverCity] = useState('');
  const [discoverRefresh, setDiscoverRefresh] = useState(0);
  const queryClient = useQueryClient();

  // Internal debounce hook
  const useDebounce = <T,>(value: T, delay: number): T => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
      const handler = setTimeout(() => setDebouncedValue(value), delay);
      return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
  };

  const debouncedDiscoverSearch = useDebounce(discoverSearch, 300);

  const promoterId = profile?.activeMembership?.partnerId;
  const { data, isLoading: loading } = usePromoterPartnerships(promoterId);
  const partnerships: Partnership[] = data?.connections || [];

  const allPending = partnerships.filter((p) => p.status === 'pending');
  const pendingIncoming = allPending.filter((p) => p.initiatedBy !== 'promoter');
  const pendingOutgoing = allPending.filter((p) => p.initiatedBy === 'promoter');
  const active = partnerships.filter((p) => p.status === 'approved' || p.status === 'active');
  const declined = partnerships.filter((p) => p.status === 'rejected' || p.status === 'declined');
  const declinedByThem = declined.filter((p) => p.initiatedBy === 'promoter');
  const declinedByPromoter = declined.filter((p) => p.initiatedBy !== 'promoter');

  const handleAction = async (connectionId: string, action: 'approve' | 'reject') => {
    setProcessingId(connectionId);
    try {
      const token = user ? await user.getIdToken() : '';
      await fetch(`/api/partners/promoters/connections/${connectionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action }),
      });
      queryClient.invalidateQueries({ queryKey: ['promoter-partnerships', promoterId || ''] });
    } catch {
      /* */
    } finally {
      setProcessingId(null);
    }
  };

  const handleReRequest = async (conn: Partnership) => {
    setProcessingId(conn.id);
    try {
      const token = user ? await user.getIdToken() : '';
      await fetch('/api/partners/promoters/connections/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          targetId: conn.otherId,
          targetType: conn.otherType,
          targetName: conn.otherName,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ['promoter-partnerships', promoterId || ''] });
    } catch {
      /* */
    } finally {
      setProcessingId(null);
    }
  };

  const handleRemove = async (connectionId: string) => {
    setProcessingId(connectionId);
    try {
      const token = user ? await user.getIdToken() : '';
      await fetch(`/api/partners/promoters/connections/${connectionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'remove' }),
      });
      queryClient.invalidateQueries({ queryKey: ['promoter-partnerships', promoterId || ''] });
    } catch {
      /* */
    } finally {
      setProcessingId(null);
    }
  };

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'discover', label: 'Discover' },
    { id: 'active', label: 'Active', count: active.length },
    { id: 'incoming', label: 'Incoming', count: pendingIncoming.length },
    { id: 'pending', label: 'Pending', count: pendingOutgoing.length },
    { id: 'declined', label: 'Declined', count: declined.length },
  ];

  const openPartnerProfile = (partnerId: string) => {
    router.push(`/promoter/partners/${partnerId}`);
  };

  const filterByUI = (list: Partnership[]) =>
    list.filter(
      (p) =>
        !debouncedDiscoverSearch ||
        p.otherName.toLowerCase().includes(debouncedDiscoverSearch.toLowerCase()),
    );

  return (
    <VenuePageShell
      title="Partners"
      actions={
        <div className="flex items-center gap-3">
          {[
            {
              label: 'Active',
              value: active.length,
              color: '#34d399',
              icon: <CheckCircle2 className="w-4 h-4" />,
            },
            {
              label: 'Pending',
              value: allPending.length,
              color: '#f59e0b',
              icon: <Clock className="w-4 h-4" />,
            },
            {
              label: 'Venues',
              value: active.filter((p) => p.otherType === 'venue').length,
              color: '#818cf8',
              icon: <Building2 className="w-4 h-4" />,
            },
            {
              label: 'Hosts',
              value: active.filter((p) => p.otherType === 'host').length,
              color: '#7c3aed',
              icon: <UserCircle className="w-4 h-4" />,
            },
          ].map((metric, i) => (
            <div
              key={i}
              className="min-w-[90px] rounded-[22px] px-4 py-2.5 text-center transition-all hover:scale-[1.02]"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 4px 24px -12px rgba(0,0,0,0.5)',
              }}
            >
              <p
                className="text-[20px] font-black tabular-nums leading-none tracking-tight"
                style={{ color: metric.color }}
              >
                {metric.value}
              </p>
              <p
                className="mt-1.5 text-[10px] font-black uppercase tracking-[0.15em] opacity-40"
                style={{ color: 'var(--v-text-primary)' }}
              >
                {metric.label}
              </p>
            </div>
          ))}
        </div>
      }
    >
      {/* Tab bar + search/filter */}
      <motion.div {...mp(0.1)} className="mt-6 mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex items-center p-1.5 rounded-2xl shrink-0"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all shrink-0"
                style={
                  activeTab === tab.id
                    ? { background: 'var(--v-elevated)', color: 'var(--v-text-primary)' }
                    : { color: 'var(--v-text-tertiary)' }
                }
              >
                {tab.id === 'discover' && (
                  <Compass
                    className={`w-3.5 h-3.5 ${activeTab === tab.id ? 'text-[#818cf8]' : ''}`}
                  />
                )}
                {tab.id === 'incoming' && (
                  <Bell className={`w-3.5 h-3.5 ${activeTab === tab.id ? 'text-[#a78bfa]' : ''}`} />
                )}
                {tab.id === 'pending' && (
                  <Clock
                    className={`w-3.5 h-3.5 ${activeTab === tab.id ? 'text-[#f59e0b]' : ''}`}
                  />
                )}
                {tab.id === 'active' && (
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${activeTab === tab.id ? 'text-[#34d399]' : ''}`}
                  />
                )}
                {tab.id === 'declined' && (
                  <XCircle
                    className={`w-3.5 h-3.5 ${activeTab === tab.id ? 'text-[#f87171]' : ''}`}
                  />
                )}
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className="px-1.5 py-0.5 rounded-md text-[10px] font-black"
                    style={
                      activeTab === tab.id
                        ? { background: '#7c3aed', color: '#fff' }
                        : { background: 'rgba(255,255,255,0.08)', color: 'var(--v-text-tertiary)' }
                    }
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-1 min-w-[300px]">
            <div
              className="flex items-center gap-2 flex-1 min-w-0 px-4 py-2.5 rounded-2xl"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <Search
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: 'var(--v-text-tertiary)' }}
              />
              <input
                type="text"
                value={discoverSearch}
                onChange={(e) => setDiscoverSearch(e.target.value)}
                placeholder="Search venues & hosts..."
                className="flex-1 min-w-0 bg-transparent border-none outline-none text-[13px] font-medium"
                style={{ color: 'var(--v-text-primary)' }}
              />
              {discoverSearch && (
                <button
                  onClick={() => setDiscoverSearch('')}
                  className="shrink-0 opacity-40 hover:opacity-70"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {activeTab === 'discover' && (
              <>
                <div
                  className="flex items-center gap-0.5 p-1 rounded-2xl shrink-0"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {[
                    { value: 'venue', label: 'Venues' },
                    { value: 'host', label: 'Hosts' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setDiscoverType(opt.value)}
                      className="px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all"
                      style={
                        discoverType === opt.value
                          ? { background: 'var(--v-elevated)', color: 'var(--v-text-primary)' }
                          : { color: 'var(--v-text-tertiary)' }
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <select
                  value={discoverCity}
                  onChange={(e) => setDiscoverCity(e.target.value)}
                  className="border-none outline-none text-[12px] font-semibold cursor-pointer px-4 py-2.5 rounded-2xl shrink-0 appearance-none bg-no-repeat bg-[right_1rem_center]"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: 'var(--v-text-primary)',
                  }}
                >
                  <option value="" className="bg-[#18181B]">
                    All Cities
                  </option>
                  <option value="Pune" className="bg-[#18181B]">
                    Pune
                  </option>
                  <option value="Mumbai" className="bg-[#18181B]">
                    Mumbai
                  </option>
                  <option value="Goa" className="bg-[#18181B]">
                    Goa
                  </option>
                  <option value="Bengaluru" className="bg-[#18181B]">
                    Bengaluru
                  </option>
                  <option value="Delhi" className="bg-[#18181B]">
                    Delhi
                  </option>
                </select>
                <button
                  onClick={() => setDiscoverRefresh((n) => n + 1)}
                  className="p-2.5 rounded-2xl flex items-center justify-center transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-[var(--v-text-tertiary)] shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Content Area */}
      <div className="min-h-[500px]">
        <AnimatePresence mode="wait">
          {activeTab === 'discover' ? (
            <motion.div
              key="discover"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <DiscoverDirectory
                allowedTypes={['venue', 'host']}
                partnerId={promoterId}
                role="promoter"
                searchQuery={discoverSearch}
                filterType={discoverType as any}
                filterCity={discoverCity}
                refreshTrigger={discoverRefresh}
                onOpenProfile={(partner) => openPartnerProfile(partner.id)}
              />
            </motion.div>
          ) : activeTab === 'incoming' || activeTab === 'pending' ? (
            <motion.div
              key="pending-section"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <PendingSection
                incoming={activeTab === 'incoming' ? filterByUI(pendingIncoming) : []}
                outgoing={activeTab === 'pending' ? filterByUI(pendingOutgoing) : []}
                loading={loading}
                processingId={processingId}
                handleAction={handleAction}
                emptyTab={activeTab}
                openPartnerProfile={openPartnerProfile}
              />
            </motion.div>
          ) : activeTab === 'declined' ? (
            <motion.div
              key="declined"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {loading ? (
                <div className="flex justify-center py-32">
                  <Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" />
                </div>
              ) : filterByUI(declined).length === 0 ? (
                <EmptyState tab="declined" />
              ) : (
                <div className="flex flex-col gap-8">
                  {filterByUI(declinedByThem).length > 0 && (
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-widest mb-4 text-[var(--v-text-tertiary)]">
                        They declined your request
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {filterByUI(declinedByThem).map((p) => (
                          <BasePartnerCard
                            key={p.id}
                            partner={{
                              id: p.otherId,
                              type: p.otherType,
                              name: p.otherName,
                              avatar: p.photoURL,
                              isVerified: p.otherIsVerified,
                              connectionStatus: 'rejected',
                            }}
                            onViewProfile={() => openPartnerProfile(p.otherId)}
                            onPrimaryAction={() => handleReRequest(p)}
                            primaryActionLabel="Re-request"
                            isActionLoading={processingId === p.id}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {filterByUI(declinedByPromoter).length > 0 && (
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-widest mb-4 text-[var(--v-text-tertiary)]">
                        You declined
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {filterByUI(declinedByPromoter).map((p) => (
                          <BasePartnerCard
                            key={p.id}
                            partner={{
                              id: p.otherId,
                              type: p.otherType,
                              name: p.otherName,
                              avatar: p.photoURL,
                              isVerified: p.otherIsVerified,
                              connectionStatus: 'rejected',
                            }}
                            onViewProfile={() => openPartnerProfile(p.otherId)}
                            onPrimaryAction={() => handleRemove(p.id)}
                            primaryActionLabel="Remove"
                            isActionLoading={processingId === p.id}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="active"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {loading ? (
                <div className="flex justify-center py-32">
                  <Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" />
                </div>
              ) : filterByUI(active).length === 0 ? (
                <EmptyState tab="active" />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {filterByUI(active).map((p) => (
                    <BasePartnerCard
                      key={p.id}
                      partner={{
                        id: p.otherId,
                        type: p.otherType,
                        name: p.otherName,
                        avatar: p.photoURL,
                        isVerified: p.otherIsVerified,
                        connectionStatus: 'active',
                      }}
                      onViewProfile={() => openPartnerProfile(p.otherId)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </VenuePageShell>
  );
}

function PendingSection({
  incoming,
  outgoing,
  loading,
  processingId,
  handleAction,
  emptyTab,
  openPartnerProfile,
}: {
  incoming: Partnership[];
  outgoing: Partnership[];
  loading: boolean;
  processingId: string | null;
  handleAction: (id: string, action: 'approve' | 'reject') => void;
  emptyTab: Tab;
  openPartnerProfile: (id: string) => void;
}) {
  if (loading)
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" />
      </div>
    );
  if (incoming.length === 0 && outgoing.length === 0) return <EmptyState tab={emptyTab} />;

  return (
    <div className="space-y-8">
      {incoming.length > 0 && (
        <div className="space-y-4">
          <p className="text-[11px] font-black uppercase tracking-widest text-text-tertiary border-l-4 border-l-amber-500 pl-4">
            Incoming · Awaiting your approval
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            <AnimatePresence mode="popLayout">
              {incoming.map((p) => (
                <BasePartnerCard
                  key={p.id}
                  partner={{
                    id: p.otherId,
                    type: p.otherType,
                    name: p.otherName,
                    avatar: p.photoURL,
                    isVerified: p.otherIsVerified,
                  }}
                  onViewProfile={() => openPartnerProfile(p.otherId)}
                  onPrimaryAction={() => handleAction(p.id, 'approve')}
                  onSecondaryAction={() => handleAction(p.id, 'reject')}
                  primaryActionLabel="Approve"
                  secondaryActionLabel="Decline"
                  isActionLoading={processingId === p.id}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
      {outgoing.length > 0 && (
        <div className="space-y-4">
          <p className="text-[11px] font-black uppercase tracking-widest text-text-tertiary border-l-4 border-l-border-default pl-4">
            Sent · Awaiting approval
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {outgoing.map((p) => (
              <BasePartnerCard
                key={p.id}
                partner={{
                  id: p.otherId,
                  type: p.otherType,
                  name: p.otherName,
                  avatar: p.photoURL,
                  isVerified: p.otherIsVerified,
                  connectionStatus: 'pending',
                }}
                onViewProfile={() => openPartnerProfile(p.otherId)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  const config: Record<string, { icon: React.ReactNode; title: string }> = {
    incoming: {
      icon: <Bell className="w-8 h-8" style={{ color: '#a78bfa' }} />,
      title: 'No incoming requests',
    },
    pending: {
      icon: <Clock className="w-8 h-8" style={{ color: '#f59e0b' }} />,
      title: 'No sent requests',
    },
    active: {
      icon: <CheckCircle2 className="w-8 h-8" style={{ color: '#34d399' }} />,
      title: 'No active partnerships',
    },
    declined: {
      icon: <XCircle className="w-8 h-8" style={{ color: '#f87171' }} />,
      title: 'No declined requests',
    },
  };
  const c = config[tab] || { icon: <Compass className="w-8 h-8" />, title: 'Nothing here yet' };
  return (
    <div className="py-24 rounded-[32px] flex flex-col items-center text-center px-10 bg-[rgba(255,255,255,0.02)] border border-dashed border-[rgba(255,255,255,0.08)]">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 bg-[rgba(124,58,237,0.1)]">
        {c.icon}
      </div>
      <h4 className="text-[16px] font-bold text-text-primary">{c.title}</h4>
    </div>
  );
}
