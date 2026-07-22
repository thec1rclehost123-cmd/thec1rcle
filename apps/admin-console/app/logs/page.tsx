'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useEffect, useState, useMemo } from 'react';
import { History, Search, Terminal, ChevronRight, User, ShieldCheck, X } from 'lucide-react';
import { DataTable } from '@/components/ui/DataTable';
import { ActionDrawer } from '@/components/ui/ActionDrawer';
import { PageSkeleton } from '@/components/ui/PageSkeleton';

interface LogEntry {
  actionType?: string;
  action?: string;
  actorEmail?: string;
  targetId?: string;
  status?: string;
  createdAt?: string;
  ipAddress?: string;
  ip?: string;
  reason?: string;
  details?: { reason?: string };
  proposalId?: string;
  ts: Date;
}

export default function AdminLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const token = await user.getIdToken();
      const res = await fetch('/api/logs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { logs?: Record<string, unknown>[] };
      if (data.logs) {
        const results: LogEntry[] = data.logs.map((log: Record<string, unknown>) => ({
          ...log,
          ts: new Date((log.createdAt as string) || new Date()),
        })) as LogEntry[];
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

  const cleanJargon = (text: string): string => {
    if (!text) return text;
    const normalized = text.replace(/ /g, '_').toUpperCase();
    const mapping: Record<string, string> = {
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

  const columns = useMemo(
    () => [
      {
        header: 'Time',
        accessorKey: 'ts',
        cell: ({ getValue }: { getValue: () => Date }) => (
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium text-white leading-tight font-mono-numbers">
              {getValue().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest leading-tight">
              {getValue().toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </span>
          </div>
        ),
      },
      {
        header: 'Admin',
        accessorKey: 'actorEmail',
        cell: ({ getValue }: { getValue: () => string }) => (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-zinc-900 border border-white/5 flex items-center justify-center text-[10px] font-bold text-zinc-700">
              {getValue()?.[0]?.toUpperCase() || 'A'}
            </div>
            <span className="text-[10px] font-bold text-zinc-400 truncate max-w-[150px] font-mono">
              {getValue()}
            </span>
          </div>
        ),
      },
      {
        header: 'Action',
        accessorKey: 'actionType',
        cell: ({ row }: { row: { original: LogEntry } }) => (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white">
              {cleanJargon(row.original.actionType || row.original.action)}
            </span>
            <span className="text-[9px] font-bold text-zinc-600 tracking-widest uppercase font-mono">
              ID: {row.original.targetId?.slice(0, 12)}
            </span>
          </div>
        ),
      },
      {
        header: 'Status',
        accessorKey: 'status',
        cell: ({ getValue }: { getValue: () => string }) => (
          <div
            className={`inline-flex items-center gap-2 px-2.5 py-1 rounded border ${getValue() === 'failed' ? 'bg-iris/10 border-iris/20 text-iris' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}
          >
            <div
              className={`h-1.5 w-1.5 rounded-full ${getValue() === 'failed' ? 'bg-iris' : 'bg-emerald-500'}`}
            />
            <span className="text-[9px] font-bold uppercase tracking-widest">
              {getValue() === 'failed' ? 'Failed' : 'Success'}
            </span>
          </div>
        ),
      },
      {
        header: '',
        id: 'actions',
        cell: ({ row }: { row: { original: LogEntry } }) => (
          <div className="flex justify-end">
            <button
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                setSelectedLog(row.original);
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
      (l: LogEntry) =>
        l.actionType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.actorEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.targetId?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [logs, searchTerm]);

  if (loading) return <PageSkeleton sections={['header', 'kpi', 'table']} />;

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

      <div className="space-y-6">
        <div className="relative group px-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-600 group-focus-within:text-zinc-300 transition-colors" />
          <input
            type="text"
            placeholder="Find logs by admin, action, or target ID..."
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            className="w-full bg-obsidian-surface border border-[#ffffff08] rounded-xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-white/10 transition-all font-medium placeholder:text-zinc-700 text-white shadow-inner"
          />
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          onRowClick={(row: LogEntry) => {
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

            <div className="space-y-6 font-mono">
              <div className="p-5 rounded-xl bg-white/[0.02] border border-[#ffffff05] space-y-6 shadow-inner">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">
                    Authority Narrative
                  </p>
                  <p className="text-sm font-medium text-zinc-400 italic leading-relaxed uppercase tracking-tight">
                    &quot;
                    {cleanJargon(
                      selectedLog.reason ||
                        selectedLog.details?.reason ||
                        'Authenticated administrative action recorded by system protocol.',
                    )}
                    &quot;
                  </p>
                </div>

                <div className="pt-4 border-t border-[#ffffff05] grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-1">
                      Target Identity
                    </p>
                    <p className="text-[10px] font-bold text-white truncate tracking-tight uppercase">
                      #{selectedLog.targetId?.slice(0, 12)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-1">
                      Network Origin
                    </p>
                    <p className="text-[10px] font-bold text-white uppercase tracking-tight">
                      {selectedLog.ipAddress || selectedLog.ip || 'Protocol-Secured'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900 border border-white/5">
                  <User className="h-4 w-4 text-zinc-600" strokeWidth={1.5} />
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-0.5">
                      Executor Identity
                    </p>
                    <p className="text-[11px] font-bold text-white truncate uppercase">
                      {selectedLog.actorEmail}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-500/50 mb-0.5">
                      Authorization Flow
                    </p>
                    <p className="text-[11px] font-bold text-emerald-500 uppercase tracking-widest">
                      {selectedLog.proposalId ? 'Consensus Approved' : 'Authority Direct'}
                    </p>
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
