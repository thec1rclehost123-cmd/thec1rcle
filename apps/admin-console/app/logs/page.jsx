'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useEffect, useState, useMemo } from 'react';
import {
  History,
  Search,
  Terminal,
  ChevronRight,
  User,
  ShieldCheck,
  X,
  RotateCw,
} from 'lucide-react';
import { DataTable } from '@/components/ui/DataTable';
import { ActionDrawer } from '@/components/ui/ActionDrawer';

export default function AdminLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshedAt, setRefreshedAt] = useState(new Date());

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const token = await user.getIdToken();
      const res = await fetch('/api/logs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.logs) {
        const results = data.logs.map((log) => ({
          ...log,
          ts: new Date(log.createdAt || new Date()),
        }));
        setLogs(results);
      }
    } catch (err) {
      console.error('Failed to fetch logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchLogs();
  }, [user]);

  const cleanJargon = (text) => {
    if (!text) return text;
    const normalized = text.replace(/ /g, '_').toUpperCase();
    const mapping = {
      IDENTITY_MIGRATION: 'System Profile Sync',
      ONBOARDING_APPROVE: 'Member Verified',
      EVENT_PAUSE: 'Sales Restricted',
      USER_BAN: 'Access Revoked',
      DISCOVERY_WEIGHT_ADJUST: 'Priority Score Update',
      WARNING_ISSUE: 'Compliance Notice Sent',
    };
    return (
      mapping[normalized] ||
      text
        .replace(/_/g, ' ')
        .split(' ')
        .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
        .join(' ')
    );
  };

  const getChangedFields = (before, after) => {
    if (!before && !after) return [];
    const b = before || {};
    const a = after || {};
    const allKeys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]));
    const changes = [];

    for (const key of allKeys) {
      if (key === 'updatedAt' || key === 'createdAt') continue;
      const valBefore = b[key];
      const valAfter = a[key];

      const strBefore =
        typeof valBefore === 'object' ? JSON.stringify(valBefore) : String(valBefore ?? '');
      const strAfter =
        typeof valAfter === 'object' ? JSON.stringify(valAfter) : String(valAfter ?? '');

      if (strBefore !== strAfter) {
        changes.push({
          field: key,
          before: valBefore,
          after: valAfter,
        });
      }
    }
    return changes;
  };

  const columns = useMemo(
    () => [
      {
        key: 'ts',
        label: 'Time',
        render: (val) => (
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium text-white leading-tight font-mono-numbers">
              {val.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest leading-tight">
              {val.toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </span>
          </div>
        ),
      },
      {
        key: 'actorEmail',
        label: 'Admin',
        render: (val) => (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-zinc-900 border border-white/5 flex items-center justify-center text-[10px] font-bold text-zinc-700">
              {val?.[0]?.toUpperCase() || 'A'}
            </div>
            <span className="text-[10px] font-bold text-zinc-400 truncate max-w-[150px] font-mono">
              {val}
            </span>
          </div>
        ),
      },
      {
        key: 'actionType',
        label: 'Action',
        render: (val, row) => (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white">
              {cleanJargon(row.actionType || row.action)}
            </span>
            <span className="text-[9px] font-bold text-zinc-600 tracking-widest uppercase font-mono">
              ID: {row.targetId?.slice(0, 12)}
            </span>
          </div>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        render: (val) => (
          <div
            className={`inline-flex items-center gap-2 px-2.5 py-1 rounded border ${val === 'failed' ? 'bg-iris/10 border-iris/20 text-iris' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}
          >
            <div
              className={`h-1.5 w-1.5 rounded-full ${val === 'failed' ? 'bg-iris' : 'bg-emerald-500'}`}
            />
            <span className="text-[9px] font-bold uppercase tracking-widest">
              {val === 'failed' ? 'Failed' : 'Success'}
            </span>
          </div>
        ),
      },
      {
        key: 'actions',
        label: '',
        render: (val, row) => (
          <div className="flex justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedLog(row);
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
    return logs.filter(
      (l) =>
        l.actionType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.actorEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.targetId?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [logs, searchTerm]);

  return (
    <div className="space-y-12 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 px-1">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <History className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">
              Activity History
            </span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">Audit Logs</h1>
          <p className="text-sm text-zinc-500 font-medium max-w-xl">
            A complete record of all administrative actions and system updates.
          </p>
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
            await fetchLogs();
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
            placeholder="Find logs by admin, action, or target ID..."
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
            setSelectedLog(row);
            setIsDrawerOpen(true);
          }}
        />
      </div>

      <ActionDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Audit Trace"
        subtitle="Administrative Identity & Protocol Review"
      >
        {selectedLog && (
          <div className="space-y-8">
            <div className="flex flex-col items-center text-center space-y-4 font-mono">
              <div className="h-16 w-16 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-700 shadow-inner">
                <Terminal className="h-8 w-8" strokeWidth={1.5} />
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-semibold tracking-tight text-white leading-tight uppercase">
                  {cleanJargon(selectedLog.actionType || selectedLog.action)}
                </h2>
                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest italic">
                  Immutable System Record
                </p>
              </div>
            </div>

            <div className="space-y-6 font-mono text-[11px]">
              {/* 1. OPERATIONAL LOGIC */}
              <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 space-y-3 shadow-inner">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-1">
                  Operational Logic
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">
                      Action Code
                    </span>
                    <span className="text-[10px] font-bold text-white uppercase">
                      {selectedLog.actionType || 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">
                      Authorization Flow
                    </span>
                    <span className="text-[10px] font-bold text-white uppercase">
                      {selectedLog.proposalId ? 'Consensus Approved' : 'Authority Direct'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">
                      Authority Narrative / Reason
                    </span>
                    <p className="text-[10px] font-medium text-zinc-400 italic bg-white/[0.01] p-2 rounded border border-white/5">
                      &quot;{selectedLog.reason || 'Routine administrative task.'}&quot;
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. ADMIN IDENTITY */}
              <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 space-y-3 shadow-inner">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-1">
                  Admin Identity
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">
                      Admin Name
                    </span>
                    <span className="text-[10px] font-bold text-white uppercase">
                      {selectedLog.actorName || 'System'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">
                      Admin ID (UID)
                    </span>
                    <span
                      className="text-[10px] font-bold text-zinc-400 font-mono truncate block"
                      title={selectedLog.adminId}
                    >
                      {selectedLog.adminId || 'system'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">
                      Admin Email
                    </span>
                    <span className="text-[10px] font-bold text-white truncate block">
                      {selectedLog.actorEmail}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">
                      Admin Role
                    </span>
                    <span className="text-[10px] font-bold text-white uppercase">
                      {selectedLog.adminRole || 'Admin'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. TARGET IDENTITY */}
              <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 space-y-3 shadow-inner">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-1">
                  Target Identity
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">
                      Target ID
                    </span>
                    <span className="text-[10px] font-bold text-white truncate block uppercase">
                      #{selectedLog.targetId?.slice(0, 12)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">
                      Target Type
                    </span>
                    <span className="text-[10px] font-bold text-white uppercase">
                      {selectedLog.targetType || 'System'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">
                      Target Name / Label
                    </span>
                    <span className="text-[10px] font-bold text-white block uppercase">
                      {selectedLog.targetName || 'Default System Entity / Dynamic Match Not Found'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. DATE AND TIME */}
              <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 space-y-3 shadow-inner">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-1">
                  Date and Time
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">
                      Date
                    </span>
                    <span className="text-[10px] font-bold text-white uppercase">
                      {new Date(selectedLog.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">
                      Time
                    </span>
                    <span className="text-[10px] font-bold text-white uppercase">
                      {new Date(selectedLog.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">
                      Network Origin IP
                    </span>
                    <span className="text-[10px] font-bold text-white">
                      {selectedLog.ipAddress || 'Protocol-Secured'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </ActionDrawer>
    </div>
  );
}
