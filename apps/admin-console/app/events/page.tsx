'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useEffect, useState, useMemo } from 'react';
import {
  Activity,
  Ticket,
  TrendingUp,
  ExternalLink,
  AlertCircle,
  Play,
  Pause,
  ChevronRight,
  MoreHorizontal,
  Search,
  Filter,
  ArrowUpRight,
  Star,
} from 'lucide-react';
import { mapEventForClient } from '@c1rcle/core/events';
import { DataTable } from '@/components/ui/DataTable';
import { ActionDrawer } from '@/components/ui/ActionDrawer';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';
import { PageSkeleton } from '@/components/ui/PageSkeleton';

export default function AdminEvents() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyLive, setShowOnlyLive] = useState(false);
  const [featuredIds, setFeaturedIds] = useState([]);

  const fetchSpotlights = async () => {
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/list?collection=platform_settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      const spotlights = (json.data || []).find((d) => d.id === 'spotlights');
      setFeaturedIds(Array.isArray(spotlights?.featured) ? spotlights.featured : []);
    } catch (_) {
      /* non-critical */
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    setError(false);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/list?collection=events', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const mapped = (json.data || []).map((e) => mapEventForClient(e, e.id));
      setEvents(mapped);
      return mapped;
    } catch (err) {
      console.error('Failed to fetch events', err);
      setError(true);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchEvents();
      fetchSpotlights();
    }
  }, [user]);

  const handleAction = async (reason, targetId, inputValue, evidence) => {
    if (!modalConfig) return;

    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: modalConfig.action,
          targetId: selectedEvent.id,
          reason,
          evidence,
          params: {
            type: 'event',
            message: modalConfig.action === 'WARNING_ISSUE' ? inputValue : undefined,
            weight:
              modalConfig.action === 'DISCOVERY_WEIGHT_ADJUST' ? Number(inputValue) : undefined,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Action failed');

      const freshEvents = await fetchEvents();
      if (
        modalConfig.action === 'FEATURE_EVENT_PIN' ||
        modalConfig.action === 'FEATURE_EVENT_UNPIN'
      ) {
        await fetchSpotlights();
      }

      // Re-select using freshly fetched data to avoid stale state reference
      if (selectedEvent) {
        const updated = (freshEvents || []).find((e) => e.id === selectedEvent.id);
        if (updated) setSelectedEvent(updated);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
      throw err;
    }
  };

  const columns = useMemo(
    () => [
      {
        header: 'Experience',
        accessorKey: 'title',
        cell: ({ row }) => (
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-zinc-900 border border-white/5 overflow-hidden flex-shrink-0">
              {row.original.poster || row.original.image ? (
                <img
                  src={row.original.poster || row.original.image}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <Activity className="h-4 w-4 text-zinc-800" />
                </div>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-white truncate uppercase tracking-tight">
                {row.original.title}
              </span>
              <span className="text-[10px] text-zinc-600 font-mono tracking-tighter">
                ID: {row.original.id.slice(0, 12)}
              </span>
            </div>
          </div>
        ),
      },
      {
        header: 'Status',
        accessorKey: 'status',
        cell: ({ getValue }) => {
          const status = getValue();
          return (
            <div
              className={`inline-flex px-2.5 py-1 rounded border text-[9px] font-bold uppercase tracking-widest ${status === 'live' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-iris/10 border-iris/20 text-iris'}`}
            >
              {status}
            </div>
          );
        },
      },
      {
        header: 'Performance',
        accessorKey: 'ticketsSold',
        cell: ({ row }) => (
          <div className="flex items-center gap-3 text-zinc-400 text-[10px] font-bold uppercase tracking-widest font-mono-numbers">
            <span className="flex items-center gap-1.5">
              <Ticket className="h-3 w-3 text-zinc-700" /> {row.original.ticketsSold || 0}
            </span>
          </div>
        ),
      },
      {
        header: 'Discovery',
        accessorKey: 'discoveryWeight',
        cell: ({ getValue }) => (
          <div className="flex items-center gap-1.5 text-zinc-500 font-mono-numbers text-[10px] font-bold uppercase tracking-widest">
            <TrendingUp className="h-3 w-3 text-zinc-700" />
            Weight: {getValue() || 0}
          </div>
        ),
      },
      {
        header: 'Featured',
        id: 'featured',
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <Star
              className={`h-4 w-4 ${featuredIds.includes(row.original.id) ? 'text-amber-400 fill-amber-400' : 'text-zinc-700'}`}
              strokeWidth={1.5}
            />
          </div>
        ),
      },
      {
        header: '',
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedEvent(row.original);
                setIsDrawerOpen(true);
              }}
              className="p-2 hover:bg-white/5 rounded-lg text-zinc-600 hover:text-white transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [featuredIds],
  );

  const filtered = useMemo(() => {
    return events.filter((e) => {
      const matchesSearch =
        e.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.id?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = showOnlyLive ? e.status === 'live' : true;
      return matchesSearch && matchesFilter;
    });
  }, [events, searchTerm, showOnlyLive]);

  const exportToCSV = () => {
    const headers = ['ID', 'Title', 'Status', 'Tickets Sold', 'Discovery Weight'];
    const rows = filtered.map((e) => [
      e.id,
      e.title,
      e.status,
      e.ticketsSold || 0,
      e.discoveryWeight || 0,
    ]);
    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `experiences_report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  if (loading) return <PageSkeleton sections={['header', 'kpi', 'table']} />;

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 px-1">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">
              Inventory Feed
            </span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Experiences</h1>
          <p className="text-sm text-zinc-500 font-medium max-w-xl">
            Monitor active listings, track sales performance, and manage marketplace visibility.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowOnlyLive(!showOnlyLive)}
            className={`flex items-center gap-2.5 px-6 py-3 rounded-xl border text-[11px] font-bold uppercase tracking-widest transition-all ${showOnlyLive ? 'bg-emerald-500 text-black border-emerald-500' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'}`}
          >
            <Filter className="w-4 h-4" />
            {showOnlyLive ? 'Showing Live' : 'Filter Live'}
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-zinc-400 text-[11px] font-bold uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all"
          >
            <ArrowUpRight className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="relative group px-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-600 group-focus-within:text-zinc-300 transition-colors" />
          <input
            type="text"
            placeholder="Search experiences by title or system ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-obsidian-surface border border-[#ffffff08] rounded-xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-white/10 transition-all font-medium placeholder:text-zinc-700 text-white shadow-inner"
          />
        </div>

        {error ? (
          <div className="flex flex-col items-center justify-center py-24 rounded-xl border border-iris/20 bg-iris/5 gap-4 text-center">
            <AlertCircle className="h-8 w-8 text-iris" strokeWidth={1.5} />
            <div>
              <p className="text-sm font-bold text-white">Failed to load experiences</p>
              <p className="text-[11px] text-zinc-500 mt-1">
                Could not fetch the event registry. Check your connection.
              </p>
            </div>
            <button
              onClick={fetchEvents}
              className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-[11px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
            >
              Retry
            </button>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            loading={loading}
            onRowClick={(row) => {
              setSelectedEvent(row);
              setIsDrawerOpen(true);
            }}
          />
        )}
      </div>

      <ActionDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Review Experience"
        subtitle="Registry ID & Performance Audit"
      >
        {selectedEvent && (
          <div className="space-y-8">
            {/* Media Preview */}
            <div className="aspect-video relative rounded-xl overflow-hidden border border-white/5 bg-zinc-900 group">
              {selectedEvent.poster || selectedEvent.image ? (
                <img
                  src={selectedEvent.poster || selectedEvent.image}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <Activity className="h-12 w-12 text-zinc-800" />
                </div>
              )}
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-px bg-[#ffffff10] border border-[#ffffff10] rounded-xl overflow-hidden shadow-sm">
              <div className="bg-obsidian-surface p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-1.5 font-mono">
                  Discovery Weight
                </p>
                <p className="text-3xl font-light text-white font-mono-numbers">
                  {selectedEvent.discoveryWeight || 0}
                </p>
              </div>
              <div className="bg-obsidian-surface p-5 text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-1.5 font-mono">
                  Total Sales
                </p>
                <p className="text-3xl font-light text-white font-mono-numbers">
                  {selectedEvent.ticketsSold || 0}
                </p>
              </div>
            </div>

            {/* Identity Information */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-[#ffffff05]">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                    Listing Status
                  </p>
                  <p className="text-sm font-bold text-white uppercase tracking-tight">
                    {selectedEvent.status}
                  </p>
                </div>
                <div
                  className={`h-2.5 w-2.5 rounded-full ${selectedEvent.status === 'live' ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]' : 'bg-iris shadow-[0_0_12px_rgba(163,163,255,0.4)]'}`}
                />
              </div>
            </div>

            {/* Authority Actions */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 px-1">
                Authority Override
              </h4>

              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() =>
                    setModalConfig({
                      action: 'WARNING_ISSUE',
                      title: 'Issue Official Notice',
                      message:
                        'Send a formal compliance notice to the organizer regarding this listing.',
                      label: 'Send Notice',
                      inputLabel: 'Notice Details',
                      inputPlaceholder: 'Describe the policy violation...',
                      type: 'warning',
                    })
                  }
                  className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-white/[0.02] hover:border-white/10 hover:bg-white/[0.02] transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-4 w-4 text-amber-500" strokeWidth={1.5} />
                    <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-300 font-mono">
                      Issue Compliance Notice
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-zinc-700 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  onClick={() =>
                    setModalConfig({
                      action: 'DISCOVERY_WEIGHT_ADJUST',
                      title: 'Adjust Visibility Score',
                      message:
                        'Override the discovery priority for this experience across the feed.',
                      label: 'Update Weight',
                      inputLabel: 'Priority Factor (0-10)',
                      inputPlaceholder: '1.0',
                      inputType: 'number',
                      type: 'info',
                    })
                  }
                  className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-white/[0.02] hover:border-white/10 hover:bg-white/[0.02] transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                    <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-300 font-mono">
                      Override Discovery Priority
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-zinc-700 group-hover:translate-x-1 transition-transform" />
                </button>

                {featuredIds.includes(selectedEvent.id) ? (
                  <button
                    onClick={() =>
                      setModalConfig({
                        action: 'FEATURE_EVENT_UNPIN',
                        title: 'Remove from Featured',
                        message:
                          'Remove this event from the Featured Drops carousel. Heat-ranked events will fill the slot.',
                        label: 'Unpin from Featured',
                        type: 'warning',
                      })
                    }
                    className="flex items-center justify-between p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <Star className="h-4 w-4 text-amber-400 fill-amber-400" strokeWidth={1.5} />
                      <span className="text-[11px] font-bold uppercase tracking-widest text-amber-300 font-mono">
                        Pinned to Featured — Remove
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-zinc-700 group-hover:translate-x-1 transition-transform" />
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      setModalConfig({
                        action: 'FEATURE_EVENT_PIN',
                        title: 'Pin to Featured Drops',
                        message:
                          'Add this event to the Featured Drops carousel on the landing and explore pages. Pinned events appear before heat-ranked ones.',
                        label: 'Pin to Featured',
                        type: 'info',
                      })
                    }
                    className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-white/[0.02] hover:border-amber-500/20 hover:bg-amber-500/5 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <Star
                        className="h-4 w-4 text-zinc-600 group-hover:text-amber-400 transition-colors"
                        strokeWidth={1.5}
                      />
                      <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-300 font-mono">
                        Pin to Featured Drops
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-zinc-700 group-hover:translate-x-1 transition-transform" />
                  </button>
                )}

                <div className="pt-4">
                  {selectedEvent.status === 'live' ? (
                    <button
                      onClick={() =>
                        setModalConfig({
                          action: 'EVENT_PAUSE',
                          title: 'Restrict Sales Activity',
                          message:
                            'Immediately stop all ticket sales for this listing. Requires tier-2 auth.',
                          label: 'Confirm Restriction',
                          type: 'danger',
                          isTier2: true,
                        })
                      }
                      className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-iris/10 border border-iris/20 text-white hover:bg-iris/20 transition-all font-bold text-[11px] uppercase tracking-widest shadow-lg shadow-iris/10 font-mono"
                    >
                      <Pause className="h-4 w-4" strokeWidth={2} />
                      Freeze Sales Activity
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        setModalConfig({
                          action: 'EVENT_RESUME',
                          title: 'Restore Sales Activity',
                          message:
                            'Authorize the experience to resume ticket sales and marketplace visibility.',
                          label: 'Approve Restoration',
                          type: 'info',
                          isTier2: true,
                        })
                      }
                      className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 transition-all font-bold text-[11px] uppercase tracking-widest font-mono"
                    >
                      <Play className="h-4 w-4" strokeWidth={2} />
                      Resume Listing Activity
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* External Links */}
            <div className="pt-6 border-t border-[#ffffff05] flex items-center justify-between px-1">
              <a
                href={`/event/${selectedEvent.slug || selectedEvent.id}`}
                target="_blank"
                className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-700 hover:text-white transition-colors group"
              >
                <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
                View Public Marketplace Listing
              </a>
            </div>
          </div>
        )}
      </ActionDrawer>

      {modalConfig && (
        <AdminConfirmModal
          isOpen={!!modalConfig}
          onClose={() => setModalConfig(null)}
          onConfirm={handleAction}
          title={modalConfig.title}
          message={modalConfig.message}
          actionLabel={modalConfig.label}
          type={modalConfig.type}
          inputLabel={modalConfig.inputLabel}
          inputType={modalConfig.inputType}
          inputPlaceholder={modalConfig.inputPlaceholder}
          isTier2={modalConfig.isTier2}
        />
      )}
    </div>
  );
}
