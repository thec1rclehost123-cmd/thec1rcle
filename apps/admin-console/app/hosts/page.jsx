'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useEffect, useState, useMemo } from 'react';
import {
  Users,
  ShieldCheck,
  TrendingUp,
  BadgeCheck,
  Ban,
  RotateCcw,
  ChevronRight,
  User,
  X,
  AlertCircle,
} from 'lucide-react';
import { DataTable } from '@/components/ui/DataTable';
import { ActionDrawer } from '@/components/ui/ActionDrawer';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';

export default function AdminHosts() {
  const { user } = useAuth();
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedHost, setSelectedHost] = useState(null);
  const [modalConfig, setModalConfig] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const fetchHosts = async () => {
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/list?collection=hosts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setHosts(json.data || []);
    } catch (err) {
      console.error('Failed to fetch host registry', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchHosts();
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
          targetId: selectedHost.id,
          reason,
          evidence,
          params: {
            type: 'host',
            message: modalConfig.action === 'WARNING_ISSUE' ? inputValue : undefined,
            weight:
              modalConfig.action === 'DISCOVERY_WEIGHT_ADJUST' ? Number(inputValue) : undefined,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Action failed');
      }

      if (json.message) alert(json.message);

      const updatedRes = await fetch('/api/list?collection=hosts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const updatedJson = await updatedRes.json();
      const mappedHosts = updatedJson.data || [];
      setHosts(mappedHosts);

      const updated = mappedHosts.find((h) => h.id === selectedHost.id);
      if (updated) setSelectedHost(updated);
    } catch (err) {
      alert(`Error: ${err.message}`);
      throw err;
    }
  };

  const [showOnlySuspended, setShowOnlySuspended] = useState(false);

  const exportToCSV = () => {
    const headers = ['ID', 'Name', 'Role', 'Status', 'Owner UID'];
    const rows = filteredHosts.map((h) => [
      h.id,
      h.name ?? 'Anonymous Organizer',
      h.role ?? 'Member',
      h.status,
      h.ownerUid,
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `organizer_ledger_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const filteredHosts = useMemo(() => {
    return hosts.filter((h) => {
      const matchesFilter = showOnlySuspended ? h.status === 'suspended' : true;
      return matchesFilter;
    });
  }, [hosts, showOnlySuspended]);

  const columns = [
    {
      key: 'name',
      label: 'Organizer',
      sortable: true,
      render: (val, row) => (
        <div className="flex items-center gap-4">
          <div className="h-9 w-9 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center font-bold text-xs text-zinc-600 group-hover:text-white transition-colors">
            {val?.[0] || 'H'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-white truncate uppercase tracking-tight">
                {val ?? 'Anonymous Organizer'}
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
      key: 'role',
      label: 'Profile',
      sortable: true,
      render: (val, row) => (
        <div className="min-w-[140px]">
          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-tight">
            {val ?? 'Member'}
          </p>
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest mt-1 font-mono-numbers">
            UID: {row.ownerUid?.slice(0, 8)}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (val) => (
        <div className="flex items-center justify-end gap-2.5">
          <div
            className={`h-1.5 w-1.5 rounded-full ${val === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : val === 'suspended' ? 'bg-iris shadow-[0_0_8px_rgba(244,74,34,0.4)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]'}`}
          ></div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
            {val}
          </span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-12 pb-24">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">
              Creator Network
            </span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">
            Organizer Profiles
          </h1>
          <p className="text-sm text-zinc-500 font-medium max-w-xl">
            Manage all platform organizers and monitor event hosting permissions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowOnlySuspended(!showOnlySuspended)}
            className={`flex items-center gap-2.5 px-6 py-3 rounded-xl border text-[11px] font-bold uppercase tracking-widest transition-all ${showOnlySuspended ? 'bg-iris text-white border-iris shadow-lg shadow-iris/20' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'}`}
          >
            <ShieldCheck className="w-4 h-4" />
            {showOnlySuspended ? 'Showing Restricted' : 'Filter Restricted'}
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-zinc-400 text-[11px] font-bold uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all font-mono-numbers"
          >
            <TrendingUp className="w-4 h-4" />
            Export Ledger
          </button>
        </div>
      </header>

      <DataTable
        columns={columns}
        data={filteredHosts}
        searchPlaceholder="Find organizer by name, ID or owner profile..."
        onRowClick={(host) => {
          setSelectedHost(host);
          setIsDrawerOpen(true);
        }}
      />

      <ActionDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={selectedHost?.name || 'Anonymous Organizer'}
        subtitle={`Organizer ID: ${selectedHost?.id}`}
        footer={
          <div className="space-y-3">
            <button
              onClick={() =>
                setModalConfig({
                  action: 'PAYOUT_FREEZE',
                  title: 'Restrict Payouts',
                  message:
                    'Immediately prevent all outgoing payments to this organizer. Requires security clearance.',
                  label: 'Confirm Restriction',
                  type: 'danger',
                  isTier3: true,
                })
              }
              className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-iris/10 border border-iris/20 text-white hover:bg-iris/20 transition-all font-bold text-[11px] uppercase tracking-widest shadow-lg shadow-iris/10"
            >
              <Ban className="h-4 w-4" strokeWidth={2} />
              Restrict Payouts
            </button>

            <button
              onClick={() =>
                setModalConfig({
                  action: 'PAYOUT_RELEASE',
                  title: 'Resume Payouts',
                  message: 'Restore standard payment processing for this organizer profile.',
                  label: 'Authorize Resume',
                  type: 'info',
                  isTier3: false,
                })
              }
              className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 text-zinc-600 hover:text-white hover:bg-white/10 transition-all font-bold text-[10px] uppercase tracking-widest"
            >
              <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
              Restore Payouts
            </button>
          </div>
        }
      >
        <div className="space-y-8">
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
              Administrative Owner
            </p>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-zinc-900 border border-white/5">
                <User className="h-5 w-5 text-emerald-500" strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-bold text-zinc-700 block uppercase tracking-tight mb-0.5">
                  Profile Reference
                </span>
                <span className="text-sm font-medium text-zinc-300 break-all leading-tight">
                  {selectedHost?.ownerUid}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 px-1">
              Management Controls
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() =>
                  setModalConfig({
                    action: 'WARNING_ISSUE',
                    title: 'Issue Official Notice',
                    message:
                      'Send a formal compliance notice to this organizer. This action is logged.',
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
                    title: 'Update Visibility Score',
                    message: 'Change how prominently this organizer appears in feeds.',
                    label: 'Approve New Weight',
                    inputLabel: 'Profile Priority (0-10)',
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
                    Adjust Visibility
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
          isTier3={modalConfig.isTier3}
        />
      )}
    </div>
  );
}
