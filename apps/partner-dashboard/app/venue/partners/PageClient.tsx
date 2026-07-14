'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  XCircle,
  Compass,
  Loader2,
  UserCircle,
  Handshake,
  Zap,
  X,
  Bell,
  Search,
  RefreshCw,
} from 'lucide-react';
import { useDashboardAuth } from '@/components/providers/DashboardAuthProvider';
import { VenuePageShell } from '@/components/venue-layout/VenuePageShell';
import { DiscoverDirectory, StatusCard } from '@/components/partnerships/DiscoverDirectory';
import { NetworkProfileModal, NetworkProfile } from '@/components/partnerships/NetworkProfileModal';
import { StatTrendCard } from '@/components/promoter/PlaceholderCharts';
import { BasePartnerCard } from '@/components/partnerships/BasePartnerCard';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

type Tab = 'discover' | 'incoming' | 'pending' | 'active' | 'declined';

interface Connection {
  id: string;
  type: string;
  otherId: string;
  otherName: string;
  otherType: 'host' | 'promoter';
  otherAvatar?: string | null;
  otherIsVerified?: boolean;
  otherEventsCount?: number;
  otherFollowersCount?: number;
  status: string;
  createdAt: any;
  updatedAt?: any;
  message?: string;
  initiatedBy?: string;
  city?: string;
  photoURL?: string | null;
  coverURL?: string | null;
}

const mp = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as any, delay },
});

export default function VenuePartnersPage() {
  const router = useRouter();
  const { profile, user } = useDashboardAuth();
  const [activeTab, setActiveTab] = useState<Tab>('active');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [discoverSearch, setDiscoverSearch] = useState('');
  const [discoverType, setDiscoverType] = useState('host');
  const [discoverCity, setDiscoverCity] = useState('');
  const [discoverRefresh, setDiscoverRefresh] = useState(0);

  const venueId = profile?.activeMembership?.partnerId;
  const venueName = profile?.displayName;

  const fetchData = useCallback(async () => {
    if (!venueId || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/discovery?action=list&partnerId=${venueId}&role=venue`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setConnections(data.connections || []);
    } catch (err) {
      console.error('[VenuePartners] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [venueId, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setDiscoverRefresh((n) => n + 1);
    fetchData();
  }, [fetchData]);

  const handleApprove = async (connectionId: string) => {
    const conn = connections.find((c) => c.id === connectionId);
    setProcessingId(connectionId);
    try {
      const token = await user?.getIdToken();
      await fetch('/api/discovery', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          connectionId,
          action: 'approve',
          type: conn?.type,
          role: 'venue',
          partnerId: venueId,
          partnerName: venueName,
        }),
      });
      await fetchData();
    } catch {
      alert('Failed to approve partnership.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (connectionId: string) => {
    const conn = connections.find((c) => c.id === connectionId);
    setProcessingId(connectionId);
    try {
      const token = await user?.getIdToken();
      await fetch('/api/discovery', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          connectionId,
          action: 'reject',
          type: conn?.type,
          role: 'venue',
          partnerId: venueId,
        }),
      });
      await fetchData();
    } catch {
      /* */
    } finally {
      setProcessingId(null);
    }
  };

  const handleReRequest = async (conn: Connection) => {
    setProcessingId(conn.id);
    try {
      const token = await user?.getIdToken();
      await fetch('/api/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          requesterId: venueId,
          requesterType: 'venue',
          requesterName: venueName,
          requesterEmail: profile?.email,
          targetId: conn.otherId,
          targetType: conn.otherType,
          targetName: conn.otherName,
        }),
      });
      await fetchData();
    } catch {
      /* */
    } finally {
      setProcessingId(null);
    }
  };

  const handleRemove = async (connectionId: string) => {
    setProcessingId(connectionId);
    try {
      const token = await user?.getIdToken();
      await fetch('/api/discovery', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ connectionId, action: 'remove', role: 'venue', partnerId: venueId }),
      });
      await fetchData();
    } catch {
      /* */
    } finally {
      setProcessingId(null);
    }
  };

  const active = connections.filter((c) => c.status === 'approved' || c.status === 'active');
  const allPending = connections.filter((c) => c.status === 'pending');
  const pendingIncoming = allPending.filter((c) => c.initiatedBy !== 'venue');
  const pendingOutgoing = allPending.filter((c) => c.initiatedBy === 'venue');
  const declined = connections.filter((c) => c.status === 'rejected');
  const declinedByThem = declined.filter((c) => c.initiatedBy === 'venue');
  const declinedByVenue = declined.filter((c) => c.initiatedBy !== 'venue');

  const filterByUI = (list: Connection[]) =>
    list.filter(
      (c) => !discoverSearch || c.otherName.toLowerCase().includes(discoverSearch.toLowerCase()),
    );

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'discover', label: 'Discover' },
    { id: 'active', label: 'Active', count: active.length },
    { id: 'incoming', label: 'Incoming', count: pendingIncoming.length },
    { id: 'pending', label: 'Pending', count: pendingOutgoing.length },
    { id: 'declined', label: 'Declined', count: declined.length },
  ];

  return (
    <VenuePageShell
      title="Partners"
      subtitle="Hosts and promoters who operate with your venue"
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
              label: 'Hosts',
              value: active.filter((c) => c.otherType === 'host').length,
              color: '#F44A22',
              icon: <UserCircle className="w-4 h-4" />,
            },
            {
              label: 'Promoters',
              value: active.filter((c) => c.otherType === 'promoter').length,
              color: '#818cf8',
              icon: <Zap className="w-4 h-4" />,
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
      {/* Hero banner */}
      <motion.div {...mp(0)}>
        <div
          className="relative rounded-[32px] overflow-hidden px-6 py-7 flex items-center gap-5"
          style={{
            background: 'linear-gradient(135deg, #1a0e05 0%, #0f0a05 60%, #080808 100%)',
            border: '1px solid rgba(244,74,34,0.2)',
          }}
        >
          <div
            className="absolute top-0 right-0 w-56 h-56 rounded-full blur-3xl pointer-events-none"
            style={{ background: 'rgba(244,74,34,0.08)' }}
          />
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 relative z-10"
            style={{ background: 'rgba(244,74,34,0.15)', color: '#F44A22' }}
          >
            <Handshake className="w-6 h-6" />
          </div>
          <div className="relative z-10">
            <p className="text-[11px] font-black uppercase tracking-widest text-text-tertiary mb-1">
              Partner Network
            </p>
            <p className="text-[13px] font-medium text-text-secondary max-w-lg">
              Connect with hosts and promoters to build your event production network and grow your
              venue's reach.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Tab bar + search + filters */}
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
                    className={`w-3.5 h-3.5 ${activeTab === tab.id ? 'text-[#F44A22]' : ''}`}
                  />
                )}
                {tab.id === 'active' && (
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${activeTab === tab.id ? 'text-[#34d399]' : ''}`}
                  />
                )}
                {tab.id === 'incoming' && (
                  <Bell className={`w-3.5 h-3.5 ${activeTab === tab.id ? 'text-[#F44A22]' : ''}`} />
                )}
                {tab.id === 'pending' && (
                  <Clock
                    className={`w-3.5 h-3.5 ${activeTab === tab.id ? 'text-[#f59e0b]' : ''}`}
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
                        ? { background: '#F44A22', color: '#fff' }
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
                placeholder="Search partners..."
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
                    { value: 'host', label: 'Hosts' },
                    { value: 'promoter', label: 'Promoters' },
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
              </>
            )}
            <button
              onClick={handleRefresh}
              className="p-2.5 rounded-2xl flex items-center justify-center transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-[var(--v-text-tertiary)] hover:text-[var(--v-text-primary)] shrink-0"
              title="Refresh Partner Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Content area */}
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
                allowedTypes={['host', 'promoter']}
                partnerId={venueId}
                role="venue"
                searchQuery={discoverSearch}
                filterType={discoverType as any}
                filterCity={discoverCity}
                refreshTrigger={discoverRefresh}
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
                onAccept={handleApprove}
                onDecline={handleDecline}
                emptyTab={activeTab}
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
                  <Loader2 className="w-8 h-8 animate-spin text-[#F44A22]" />
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
                        {filterByUI(declinedByThem).map((c) => (
                          <BasePartnerCard
                            key={c.id}
                            partner={{
                              id: c.otherId,
                              type: c.otherType,
                              name: c.otherName,
                              avatar: c.photoURL,
                              isVerified: c.otherIsVerified,
                              connectionStatus: 'rejected',
                            }}
                            onViewProfile={() => router.push(`/venue/partners/${c.otherId}`)}
                            onPrimaryAction={() => handleReRequest(c)}
                            primaryActionLabel="Re-request"
                            isActionLoading={processingId === c.id}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {filterByUI(declinedByVenue).length > 0 && (
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-widest mb-4 text-[var(--v-text-tertiary)]">
                        You declined
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {filterByUI(declinedByVenue).map((c) => (
                          <BasePartnerCard
                            key={c.id}
                            partner={{
                              id: c.otherId,
                              type: c.otherType,
                              name: c.otherName,
                              avatar: c.photoURL,
                              isVerified: c.otherIsVerified,
                              connectionStatus: 'rejected',
                            }}
                            onViewProfile={() => router.push(`/venue/partners/${c.otherId}`)}
                            onPrimaryAction={() => handleRemove(c.id)}
                            primaryActionLabel="Remove"
                            isActionLoading={processingId === c.id}
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
                  <Loader2 className="w-8 h-8 animate-spin text-[#F44A22]" />
                </div>
              ) : filterByUI(active).length === 0 ? (
                <EmptyState tab="active" />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {filterByUI(active).map((c) => (
                    <BasePartnerCard
                      key={c.id}
                      partner={{
                        id: c.otherId,
                        type: c.otherType,
                        name: c.otherName,
                        avatar: c.otherAvatar || c.photoURL,
                        isVerified: c.otherIsVerified,
                        eventsCount: c.otherEventsCount,
                        followersCount: c.otherFollowersCount,
                        connectionStatus: 'active',
                      }}
                      onViewProfile={() => router.push(`/venue/partners/${c.otherId}`)}
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
  onAccept,
  onDecline,
  emptyTab = 'pending',
}: {
  incoming: Connection[];
  outgoing: Connection[];
  loading: boolean;
  processingId: string | null;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  emptyTab?: Tab;
}) {
  const router = useRouter();
  if (loading)
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-[#F44A22]" />
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
              {incoming.map((req) => (
                <BasePartnerCard
                  key={req.id}
                  partner={{
                    id: req.otherId,
                    type: req.otherType,
                    name: req.otherName,
                    avatar: req.otherAvatar || req.photoURL,
                    isVerified: req.otherIsVerified,
                  }}
                  onViewProfile={() => router.push(`/venue/partners/${req.otherId}`)}
                  onPrimaryAction={() => onAccept(req.id)}
                  onSecondaryAction={() => onDecline(req.id)}
                  primaryActionLabel="Accept"
                  secondaryActionLabel="Decline"
                  isActionLoading={processingId === req.id}
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
            {outgoing.map((req) => (
              <BasePartnerCard
                key={req.id}
                partner={{
                  id: req.otherId,
                  type: req.otherType,
                  name: req.otherName,
                  avatar: req.otherAvatar || req.photoURL,
                  isVerified: req.otherIsVerified,
                  connectionStatus: 'pending',
                }}
                onViewProfile={() => router.push(`/venue/partners/${req.otherId}`)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  const config: Record<string, { icon: React.ReactNode; title: string; subtitle: string }> = {
    discover: {
      icon: <Compass className="w-8 h-8 text-[#F44A22]" />,
      title: 'Start discovering',
      subtitle: 'Search for hosts and promoters to grow your network.',
    },
    incoming: {
      icon: <Bell className="w-8 h-8 text-[#F44A22]" />,
      title: 'No incoming requests',
      subtitle: 'Partnership requests from hosts and promoters will appear here.',
    },
    pending: {
      icon: <Clock className="w-8 h-8 text-[#f59e0b]" />,
      title: 'No pending requests',
      subtitle: "Requests you've sent awaiting approval will appear here.",
    },
    active: {
      icon: <CheckCircle2 className="w-8 h-8 text-[#34d399]" />,
      title: 'No active partners',
      subtitle: 'Once you approve a request, the partner shows here.',
    },
    declined: {
      icon: <XCircle className="w-8 h-8 text-[#f87171]" />,
      title: 'No declined requests',
      subtitle: 'Requests you declined will appear here.',
    },
  };
  const c = config[tab] || config.active;
  return (
    <div className="py-24 rounded-[32px] flex flex-col items-center text-center px-10 bg-[rgba(255,255,255,0.02)] border border-dashed border-[rgba(255,255,255,0.08)]">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 bg-[rgba(244,74,34,0.1)]">
        {c.icon}
      </div>
      <h4 className="text-[16px] font-bold text-text-primary">{c.title}</h4>
      <p className="text-[13px] text-text-tertiary mt-1 max-w-xs">{c.subtitle}</p>
    </div>
  );
}
