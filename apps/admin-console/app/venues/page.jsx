'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useEffect, useState, useMemo } from 'react';
import {
  Building2,
  ShieldCheck,
  TrendingUp,
  BadgeCheck,
  Lock,
  Unlock,
  ShieldAlert,
  Percent,
  ChevronRight,
  AlertCircle,
  X,
  MapPin,
  RotateCw,
} from 'lucide-react';
import { DataTable } from '@/components/ui/DataTable';
import { ActionDrawer } from '@/components/ui/ActionDrawer';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';
import { useToast } from '@/components/providers/ToastProvider';

export default function AdminVenues() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [modalConfig, setModalConfig] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState(new Date());

  const fetchVenues = async () => {
    try {
      setLoading(true);
      const token = await user.getIdToken();

      const [venuesRes, proposalsRes] = await Promise.all([
        fetch('/api/list?collection=venues', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/list?collection=proposed_actions', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const venuesJson = await venuesRes.json();
      const proposalsJson = await proposalsRes.json();

      const activeProposals = (proposalsJson.data || []).filter((p) => p.status === 'pending');

      const mergedVenues = (venuesJson.data || []).map((venue) => {
        const pendingSuspend = activeProposals.find(
          (p) => p.targetId === venue.id && p.action === 'VENUE_SUSPEND',
        );
        const pendingReinstate = activeProposals.find(
          (p) => p.targetId === venue.id && p.action === 'VENUE_REINSTATE',
        );

        if (pendingSuspend) {
          return { ...venue, pendingAction: 'suspend', displayStatus: 'Restriction Requested' };
        } else if (pendingReinstate) {
          return { ...venue, pendingAction: 'reinstate', displayStatus: 'Restore Requested' };
        }
        return { ...venue, displayStatus: venue.status };
      });

      setVenues(mergedVenues);

      if (selectedVenue) {
        const updated = mergedVenues.find((v) => v.id === selectedVenue.id);
        if (updated) setSelectedVenue(updated);
      }
    } catch (err) {
      console.error('Failed to fetch venues', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchVenues();
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
          targetId: selectedVenue.id,
          reason,
          evidence,
          params: {
            type: 'venue',
            message: modalConfig.action === 'WARNING_ISSUE' ? inputValue : undefined,
            weight:
              modalConfig.action === 'DISCOVERY_WEIGHT_ADJUST' ? Number(inputValue) : undefined,
            rate: modalConfig.action === 'COMMISSION_ADJUST' ? Number(inputValue) : undefined,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Action failed');
      }

      if (json.message) {
        toast({ type: 'success', message: json.message });
      } else {
        toast({ type: 'success', message: 'Action executed successfully.' });
      }

      await fetchVenues();
    } catch (err) {
      throw err;
    }
  };

  const [showOnlyVerified, setShowOnlyVerified] = useState(false);

  const exportToCSV = () => {
    const headers = ['ID', 'Name', 'City', 'Area', 'Tier', 'Verified', 'Status'];
    const rows = filtered.map((v) => [
      v.id,
      v.name,
      v.city || 'Global',
      v.area || 'General',
      v.tier || 'Standard',
      v.isVerified ? 'Yes' : 'No',
      v.status,
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `venue_registry_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const filtered = useMemo(() => {
    return venues.filter((v) => {
      const matchesFilter = showOnlyVerified ? v.isVerified : true;
      return matchesFilter;
    });
  }, [venues, showOnlyVerified]);

  const columns = [
    {
      key: 'name',
      label: 'Partner Details',
      sortable: true,
      render: (val, row) => (
        <div className="flex items-center gap-4">
          <div className="h-9 w-9 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center font-bold text-xs text-zinc-600 group-hover:text-white transition-colors">
            {val?.[0] || 'V'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-white truncate uppercase tracking-tight">
                {val}
              </p>
              {row.isVerified && (
                <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" strokeWidth={1.5} />
              )}
            </div>
            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-0.5">
              ID: {row.id.slice(0, 8)}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'city',
      label: 'Location',
      sortable: true,
      render: (val, row) => (
        <div className="min-w-[120px]">
          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-tight">
            {val || 'Global'}
          </p>
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest mt-0.5 font-bold">
            {row.area || 'General'}
          </p>
        </div>
      ),
    },
    {
      key: 'tier',
      label: 'Classification',
      sortable: true,
      render: (val) => (
        <div
          className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${val === 'premium' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-white/5 text-zinc-500 border-white/5'}`}
        >
          {val || 'Standard'}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (val, row) => {
        const displayStatus = row.displayStatus || val;
        const colorClass =
          displayStatus === 'active'
            ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
            : displayStatus === 'Restriction Requested'
              ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)] animate-pulse'
              : displayStatus === 'Restore Requested'
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)] animate-pulse'
                : displayStatus === 'pending'
                  ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                  : 'bg-iris shadow-[0_0_8px_rgba(244,74,34,0.4)]';

        return (
          <div className="flex items-center justify-end gap-2.5">
            <div className={`h-1.5 w-1.5 rounded-full ${colorClass}`}></div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
              {displayStatus}
            </span>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-12 pb-24">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">
              Venue Registry
            </span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">
            Platform Partners
          </h1>
          <p className="text-sm text-zinc-500 font-medium max-w-xl">
            Monitor active locations and manage venue relationships across the network.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowOnlyVerified(!showOnlyVerified)}
            className={`flex items-center gap-2.5 px-6 py-3 rounded-xl border text-[11px] font-bold uppercase tracking-widest transition-all ${showOnlyVerified ? 'bg-emerald-500 text-black border-emerald-500' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'}`}
          >
            <ShieldCheck className="w-4 h-4" />
            {showOnlyVerified ? 'Showing Verified' : 'Filter Verified'}
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-zinc-400 text-[11px] font-bold uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all font-mono-numbers"
          >
            <TrendingUp className="w-4 h-4" />
            Export Registry
          </button>
        </div>
      </header>

      {/* Refresh Bar */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#A1A1AA]">
          Last updated{' '}
          {refreshedAt
            ? refreshedAt.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })
            : '—'}
        </span>
        <button
          onClick={async () => {
            await fetchVenues();
            setRefreshedAt(new Date());
          }}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all text-[11px] font-bold uppercase tracking-widest disabled:opacity-50"
        >
          <RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          REFRESH
        </button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        searchPlaceholder="Find venue by name, city or registry ID..."
        onRowClick={(venue) => {
          setSelectedVenue(venue);
          setIsDrawerOpen(true);
        }}
      />

      <ActionDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={selectedVenue?.name}
        subtitle={`Registry ID: ${selectedVenue?.id}`}
        footer={
          <div className="space-y-3">
            {selectedVenue?.pendingAction && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[11px] font-semibold flex items-center gap-2 mb-2 select-none animate-in fade-in duration-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  A request to {selectedVenue.pendingAction === 'suspend' ? 'restrict' : 'restore'}{' '}
                  this partner is currently pending approval. Duplicate requests are disabled.
                </span>
              </div>
            )}
            {selectedVenue?.status === 'suspended' ? (
              <button
                disabled={!!selectedVenue?.pendingAction}
                onClick={() =>
                  setModalConfig({
                    action: 'VENUE_REINSTATE',
                    title: 'Reinstate Relationship',
                    message: 'Allow the partner to resume hosting and sales.',
                    label: 'Review & Restore',
                    type: 'info',
                    isTier2: true,
                  })
                }
                className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 transition-all font-bold text-[11px] uppercase tracking-widest disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <Unlock className="h-4 w-4" strokeWidth={2} />
                Restore Partner
              </button>
            ) : (
              <button
                disabled={!!selectedVenue?.pendingAction}
                onClick={() =>
                  setModalConfig({
                    action: 'VENUE_SUSPEND',
                    title: 'Restrict Collaboration',
                    message:
                      'Deactivate partner operations immediately. Requires security clearance.',
                    label: 'Confirm Restriction',
                    type: 'danger',
                    isTier2: true,
                  })
                }
                className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-iris/10 border border-iris/20 text-white hover:bg-iris/20 transition-all font-bold text-[11px] uppercase tracking-widest shadow-lg shadow-iris/10 disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <Lock className="h-4 w-4" strokeWidth={2} />
                Restrict Partner
              </button>
            )}
            <button
              onClick={() =>
                setModalConfig({
                  action: 'COMMISSION_ADJUST',
                  title: 'Adjust Service Fee',
                  message: 'Modify the platform service fee percentage for this partner.',
                  label: 'Confirm Adjustment',
                  inputLabel: 'New Service Fee (%)',
                  inputType: 'number',
                  inputPlaceholder: selectedVenue?.platformFeeRate || '10',
                  type: 'danger',
                  isTier3: true,
                })
              }
              className="w-full flex items-center justify-center gap-2.5 p-3.5 rounded-xl border border-white/5 text-zinc-600 hover:text-white hover:bg-white/5 transition-all font-bold text-[10px] uppercase tracking-widest"
            >
              <Percent className="h-3.5 w-3.5" strokeWidth={1.5} />
              Override Commission
            </button>
          </div>
        }
      >
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-1">
                Network Status
              </p>
              <div className="flex items-center gap-2">
                <div
                  className={`h-1.5 w-1.5 rounded-full ${
                    selectedVenue?.displayStatus === 'active'
                      ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                      : selectedVenue?.displayStatus === 'Restriction Requested' ||
                          selectedVenue?.displayStatus === 'pending'
                        ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)] animate-pulse'
                        : selectedVenue?.displayStatus === 'Restore Requested'
                          ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)] animate-pulse'
                          : 'bg-iris shadow-[0_0_8px_rgba(244,74,34,0.4)]'
                  }`}
                />
                <p className="text-[11px] font-bold uppercase tracking-widest text-white truncate max-w-[150px]">
                  {selectedVenue?.displayStatus || selectedVenue?.status}
                </p>
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-1">
                Account Tier
              </p>
              <p className="text-xl font-light text-white uppercase">
                {selectedVenue?.tier || 'Standard'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 px-1">
              Authority Controls
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() =>
                  setModalConfig({
                    action: selectedVenue?.isVerified
                      ? 'VERIFICATION_REVOKE'
                      : 'VERIFICATION_ISSUE',
                    title: selectedVenue?.isVerified ? 'Revoke Verification' : 'Verify Partner',
                    message: 'Update the official verification status for this location.',
                    label: 'Update Status',
                    type: 'info',
                  })
                }
                className="flex items-center justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <BadgeCheck
                    className={`h-4 w-4 ${selectedVenue?.isVerified ? 'text-emerald-500' : 'text-zinc-600'}`}
                    strokeWidth={1.5}
                  />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-300">
                    Set Verification
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-700 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() =>
                  setModalConfig({
                    action: 'WARNING_ISSUE',
                    title: 'Issue Official Notice',
                    message: 'Send a formal compliance notice to the partner.',
                    label: 'Send Notice',
                    inputLabel: 'Notice Details',
                    inputPlaceholder: 'Describe the policy violation...',
                    type: 'warning',
                  })
                }
                className="flex items-center justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-4 w-4 text-amber-500" strokeWidth={1.5} />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-300">
                    Issue Notice
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-700 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() =>
                  setModalConfig({
                    action: 'DISCOVERY_WEIGHT_ADJUST',
                    title: 'Adjust Visibility Score',
                    message: 'Change how prominently this partner appears in discovery feeds.',
                    label: 'Save Profile Weight',
                    inputLabel: 'Visibility Priority (0-10)',
                    inputPlaceholder: '1.0',
                    inputType: 'number',
                    type: 'info',
                  })
                }
                className="flex items-center justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-300">
                    Adjust Weight
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-700 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
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
          isTier3={modalConfig.isTier3}
        />
      )}
    </div>
  );
}
