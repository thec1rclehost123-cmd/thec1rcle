'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useEffect, useState, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
  Ban,
  ChevronRight,
  Activity,
  Flame,
  User,
  Search,
  Filter,
  RotateCw,
} from 'lucide-react';
import { DataTable } from '@/components/ui/DataTable';
import { ActionDrawer } from '@/components/ui/ActionDrawer';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';

export default function AdminSafety() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalConfig, setModalConfig] = useState(null);
  const [refreshedAt, setRefreshedAt] = useState(new Date());

  const fetchSafety = async () => {
    try {
      setLoading(true);
      const token = await user.getIdToken();
      const res = await fetch('/api/list?collection=safety_reports', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setReports(json.data || []);
    } catch (err) {
      console.error('Failed to fetch safety reports', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchSafety();
  }, [user]);

  const handleSafetyAction = async (reason) => {
    if (!modalConfig || !selectedReport) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: modalConfig.action,
          targetId: modalConfig.targetId,
          reason,
          params: { type: modalConfig.type },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Action failed');
      await fetchSafety();
      setModalConfig(null);
      if (modalConfig.action === 'SAFETY_REPORT_DISMISS') setIsDrawerOpen(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const columns = useMemo(
    () => [
      {
        key: 'reason',
        label: 'Reported Incident',
        render: (val, row) => (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-white tracking-tight uppercase truncate max-w-[300px]">
              {row.reason || 'Reported Incident'}
            </span>
            <span className="text-[10px] text-zinc-600 font-mono tracking-widest">
              ID: {row.id?.slice(0, 12).toUpperCase()}
            </span>
          </div>
        ),
      },
      {
        key: 'reporterEmail',
        label: 'Reporter',
        render: (val) => (
          <div className="flex items-center gap-2">
            <User className="h-3 w-3 text-zinc-700" strokeWidth={2} />
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
              {val || 'Anonymous'}
            </span>
          </div>
        ),
      },
      {
        key: 'priority',
        label: 'Severity',
        render: (val) => {
          const priority = val;
          const isCritical = priority === 'CRITICAL';
          return (
            <div
              className={`inline-flex px-2.5 py-1 rounded border text-[9px] font-bold uppercase tracking-widest ${isCritical ? 'bg-iris/10 border-iris/20 text-iris' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'}`}
            >
              {priority || 'NORMAL'}
            </div>
          );
        },
      },
      {
        key: 'actions',
        label: '',
        render: (val, row) => (
          <div className="flex justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedReport(row);
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
    [],
  );

  const filtered = useMemo(() => {
    return reports.filter(
      (r) =>
        r.reporterEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.id?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [reports, searchTerm]);

  return (
    <div className="space-y-12 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 px-1">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="h-4 w-4 text-iris" strokeWidth={1.5} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-iris">
              Security Oversight
            </span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Safety Center</h1>
          <p className="text-sm text-zinc-500 font-medium max-w-xl">
            Monitor user reports, investigate incidents, and maintain platform security.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-1">
        <div className="p-8 rounded-xl bg-obsidian-surface border border-[#ffffff08] flex items-center gap-6 shadow-sm overflow-hidden relative group hover:border-iris/20 transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Flame className="h-24 w-24 text-iris" />
          </div>
          <div className="h-12 w-12 rounded-lg bg-iris/10 flex items-center justify-center border border-iris/20 shadow-inner">
            <ShieldAlert className="h-5 w-5 text-iris" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500 mb-0.5">
              Critical Incidents
            </p>
            <p className="text-3xl font-light text-white tracking-tighter font-mono-numbers">
              {reports.filter((r) => r.priority === 'CRITICAL').length}
            </p>
          </div>
        </div>
        <div className="p-8 rounded-xl bg-obsidian-surface border border-[#ffffff08] flex items-center gap-6 shadow-sm overflow-hidden relative group hover:border-amber-500/20 transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <AlertCircle className="h-24 w-24 text-amber-500" />
          </div>
          <div className="h-12 w-12 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shadow-inner">
            <AlertCircle className="h-5 w-5 text-amber-500" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500 mb-0.5">
              Active Reports
            </p>
            <p className="text-3xl font-light text-white tracking-tighter font-mono-numbers">
              {reports.length}
            </p>
          </div>
        </div>
        <div className="p-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-6 shadow-lg shadow-emerald-500/5 overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-emerald-500">
            <Activity className="h-24 w-24" />
          </div>
          <div className="h-12 w-12 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
            <ShieldCheck className="h-5 w-5 text-emerald-500" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-500 mb-0.5">
              Safety Rating
            </p>
            <p className="text-3xl font-light text-white tracking-tighter font-mono-numbers">
              99.9%
            </p>
          </div>
        </div>
      </div>

      {/* Refresh Bar */}
      <div className="flex items-center justify-between px-1 mb-6">
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
            await fetchSafety();
            setRefreshedAt(new Date());
          }}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all text-[11px] font-bold uppercase tracking-widest disabled:opacity-50"
        >
          <RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          REFRESH
        </button>
      </div>

      <div className="space-y-6">
        <div className="relative group px-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-600 group-focus-within:text-zinc-300 transition-colors" />
          <input
            type="text"
            placeholder="Search reports by email, reason, or report ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-obsidian-surface border border-[#ffffff08] rounded-xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-white/10 transition-all font-medium placeholder:text-zinc-700 text-white shadow-inner"
          />
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          onRowClick={(row) => {
            setSelectedReport(row);
            setIsDrawerOpen(true);
          }}
        />
      </div>

      <ActionDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Investigation Case"
        subtitle="Security Incident & Moderation Ledger"
      >
        {selectedReport && (
          <div className="space-y-8">
            <div
              className={`p-6 rounded-xl border ${selectedReport.priority === 'CRITICAL' ? 'bg-iris/5 border-iris/10' : 'bg-amber-500/5 border-amber-500/10'}`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Oversight Registry
                </span>
                <div
                  className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${selectedReport.priority === 'CRITICAL' ? 'bg-iris/10 text-iris border-iris/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}
                >
                  {selectedReport.priority || 'Normal'} Priority
                </div>
              </div>
              <h3 className="text-xl font-semibold text-white tracking-tight uppercase leading-snug">
                {selectedReport.reason || 'Reported Incident'}
              </h3>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 px-1">
                Origin Details
              </h4>
              <div className="grid grid-cols-1 gap-px bg-[#ffffff08] border border-[#ffffff08] rounded-xl overflow-hidden shadow-inner font-mono">
                <div className="bg-obsidian-surface p-4 flex items-center gap-4">
                  <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-700">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                      Reporter
                    </span>
                    <span className="text-[11px] font-bold text-white uppercase">
                      {selectedReport.reporterEmail || 'Anonymous'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 px-1">
                Authority Primitives
              </h4>
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() =>
                    setModalConfig({
                      action: 'USER_BAN',
                      targetId:
                        selectedReport.reportedUserId ||
                        selectedReport.targetId ||
                        selectedReport.id,
                      type: 'user',
                      title: 'Restrict User Access',
                      message:
                        'Ban the reported user from the platform. This action will be logged and requires justification.',
                      label: 'Confirm Restrict',
                      variant: 'danger',
                    })
                  }
                  className="w-full flex items-center justify-between p-4 rounded-xl bg-iris/10 border border-iris/20 text-iris hover:bg-iris/20 transition-all font-bold text-[11px] uppercase tracking-widest font-mono shadow-lg shadow-iris/5"
                >
                  <div className="flex items-center gap-3">
                    <Ban className="h-4 w-4" />
                    <span>Restrict Access</span>
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() =>
                    setModalConfig({
                      action: 'SAFETY_REPORT_DISMISS',
                      targetId: selectedReport.id,
                      type: 'safety_report',
                      title: 'Dismiss Report',
                      message:
                        'Mark this safety report as dismissed. Provide a reason for audit trail.',
                      label: 'Confirm Dismiss',
                      variant: 'info',
                    })
                  }
                  className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition-all font-bold text-[11px] uppercase tracking-widest font-mono"
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Dismiss Report</span>
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </ActionDrawer>

      {modalConfig && (
        <AdminConfirmModal
          isOpen={!!modalConfig}
          onClose={() => setModalConfig(null)}
          onConfirm={handleSafetyAction}
          title={modalConfig.title}
          message={modalConfig.message}
          actionLabel={modalConfig.label}
          type={modalConfig.variant}
        />
      )}
    </div>
  );
}
